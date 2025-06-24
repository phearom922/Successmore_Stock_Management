const express = require('express');
     const mongoose = require('mongoose');
     const apiRoutes = require('./routes/api');
     const cors = require('cors');

     const app = express();

     // Enable CORS for localhost:5173
     app.use(cors({
       origin: 'http://localhost:5173',
       methods: ['GET', 'POST', 'PUT', 'DELETE'],
       allowedHeaders: ['Content-Type', 'Authorization'],
     }));

     app.use(express.json());

     // MongoDB Connection
     mongoose.connect('mongodb://localhost:27017/stock-management')
       .then(() => console.log('Connected to MongoDB Atlas'))
       .catch(err => console.error('Connection error:', err));

     // Register API Routes
     app.use('/api', apiRoutes);

     const PORT = process.env.PORT || 3000;
     app.listen(PORT, () => console.log(`Server running on port ${PORT}`));