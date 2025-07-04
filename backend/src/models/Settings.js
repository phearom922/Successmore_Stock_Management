const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  expirationWarningDays: { type: Number, required: true, default: 15 },
  lowStockThreshold: { type: Number, required: true, default: 10 }, // เพิ่มเกณฑ์สต็อกต่ำ
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Setting', settingsSchema);