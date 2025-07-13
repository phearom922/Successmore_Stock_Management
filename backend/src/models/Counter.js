const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, unique: true },
  sequence: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);