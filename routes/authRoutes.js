const express = require('express');
const router = express.Router();
const { signup, login, forgotPasswordQuestion, resetPassword,checkUser,verifyAnswer, getProfile, updateProfile } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPasswordQuestion);
router.post('/reset-password', resetPassword);
router.post('/check-user', checkUser);
router.post('/verify-answer', verifyAnswer);

// Profile routes
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
