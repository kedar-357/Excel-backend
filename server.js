const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

// Optional base route to check server status
app.get('/', (req, res) => {
  res.send('API is running...');
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('MongoDB connected');
    app.listen(5000, () => console.log('Server running on port 5000'));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Optional: Catch-all route for unknown paths
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});
