const mongoose = require('mongoose');

  const warehouseSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // User ที่รับผิดชอบ
  });

  module.exports = mongoose.model('Warehouse', warehouseSchema);