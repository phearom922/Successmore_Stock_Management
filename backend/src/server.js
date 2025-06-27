require("dotenv").config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');
const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`Received ${req.method} request to ${req.url}`);
  next();
});



// Load API routes
app.use('/api', apiRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-management')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });

// Validate environment variables
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));