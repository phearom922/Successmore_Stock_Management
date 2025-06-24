const express = require('express');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');
const app = express();

app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb+srv://ronphearom2540:Phearom090790@cluster0.4ufedff.mongodb.net/stock-management', {
})
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('Connection error:', err));

// Register API Routes
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));