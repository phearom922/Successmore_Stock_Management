const express = require('express');
  const mongoose = require('mongoose');
  const apiRoutes = require('./routes/api');
  const cors = require('cors');
  const jwt = require('jsonwebtoken');

  const app = express();

  // Enable CORS for localhost:5173
  app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json());

  // Middleware to verify JWT
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    console.log('Auth Header:', authHeader); // Debug header
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({ message: 'Access denied, no token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
      if (err) {
        console.error('Token verification error:', err.message); // Debug error
        return res.status(403).json({ message: 'Invalid token', error: err.message });
      }
      req.user = user;
      console.log('Authenticated user:', user); // Debug user
      next();
    });
  };

  // MongoDB Connection
  mongoose.connect('mongodb://localhost:27017/stock-management')
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Connection error:', err));

  // Apply authentication to protected routes
  app.use('/api/lots', authenticateToken);
  app.use('/api/issue', authenticateToken);
  app.use('/api/warehouses', authenticateToken);
  app.use('/api/users', authenticateToken); // Ensure this is protected
  app.use('/api', apiRoutes);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));