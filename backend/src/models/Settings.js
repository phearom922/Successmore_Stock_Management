const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  expirationWarningDays: { type: Number, required: true, default: 15 },
  lowStockThreshold: { type: Number, required: true, default: 10 }, // ค่าเริ่มต้น 10
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Setting', settingsSchema);