require("dotenv").config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api'); // ต้องเป็นแบบนี้ ไม่ต้อง destructure
const logger = require('./config/logger'); // ปรับ path จาก root

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`, { user: req.user });
  next();
});

// Load API routes
app.use('/api', apiRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-management')
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => {
    logger.error('Connection error:', { error: err.message, stack: err.stack });
    process.exit(1);
  });

// Validate environment variables
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
