const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  expirationWarningDays: { type: Number, required: true, default: 15 },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Setting', settingsSchema);