const mongoose = require('mongoose');

  const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // ควร hash ด้วย bcrypt
    role: { type: String, enum: ['admin', 'user'], required: true },
    warehouse: { type: String, required: true }, // Warehouse ที่ User ดูแล
    assignedWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null }, // ผูกกับ Warehouse
  });

  module.exports = mongoose.model('User', userSchema);