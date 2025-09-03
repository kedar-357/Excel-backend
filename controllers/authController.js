const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// STEP 1: Check if user exists and return their security question
exports.checkUser = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.securityQuestion) {
      return res.status(200).json({
        hasSecurityQuestion: true,
        question: user.securityQuestion,
      });
    } else {
      return res.status(200).json({ hasSecurityQuestion: false });
    }
  } catch (err) {
    console.error('Error in /check-user:', err);
    res.status(500).json({ message: 'Unable to check user at this time. Please try again later.', error: err.message });
  }
};

// STEP 2: Verify security answer
exports.verifyAnswer = async (req, res) => {
  const { email, answer } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isCorrect = await bcrypt.compare(answer, user.securityAnswer);
    if (isCorrect) {
      return res.status(200).json({ message: 'Security answer verified' });
    } else {
      return res.status(401).json({ message: 'Incorrect answer' });
    }
  } catch (err) {
    console.error('Error in /verify-answer:', err);
    res.status(500).json({ message: 'Unable to verify security answer at this time. Please try again later.', error: err.message });
  }
};


// SIGNUP
exports.signup = async (req, res) => {
  const {
    name,
    username,
    email,
    password,
    securityQuestion,
    securityAnswer,
  } = req.body;

  if (!name || !username || !email || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  try {
    const userExists = await User.findOne({ $or: [{ email }, { username }] });

    if (userExists) {
      return res.status(400).json({ msg: 'Email or username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const hashedAnswer = await bcrypt.hash(securityAnswer, 10);

    const newUser = new User({
      name,
      username,
      email,
      password: hashedPassword,
      securityQuestion,
      securityAnswer: hashedAnswer,
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Unable to complete signup at this time. Please try again later.', error: err.message });
  }
};


// LOGIN
exports.login = async (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ msg: 'Please enter both email/username and password' });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
      },
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// STEP 1: Return security question for a given email/username
exports.forgotPasswordQuestion = async (req, res) => {
  const { emailOrUsername } = req.body;

  if (!emailOrUsername) {
    return res.status(400).json({ msg: 'Email or username required' });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({ securityQuestion: user.securityQuestion });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// STEP 2: Verify security answer and reset password
exports.resetPassword = async (req, res) => {
  const { emailOrUsername, securityAnswer, newPassword, confirmNewPassword } = req.body;

  if (!emailOrUsername || !securityAnswer || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ msg: 'Passwords do not match' });
  }

  try {
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
    });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const isAnswerCorrect = await bcrypt.compare(securityAnswer, user.securityAnswer);
    if (!isAnswerCorrect) {
      return res.status(401).json({ msg: 'Incorrect answer to security question' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name username email');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile (username/email)
exports.updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (username) user.username = username;
    if (email) user.email = email;
    await user.save();
    res.json({ message: 'Profile updated successfully', user: { name: user.name, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

