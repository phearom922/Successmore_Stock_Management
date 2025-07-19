const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  expirationWarningDays: { type: Number, required: true, default: 15 },
  lowStockThreshold: { type: Number, required: true, default: 10 },
  issueStockNotificationEnabled: { type: Boolean, default: true },
  issueHistoryNotificationEnabled: { type: Boolean, default: true },
  telegramBotToken: { type: String, default: '' }, // เก็บ Token (อาจใช้ .env แทน)
  chatId: { type: String, default: '-4871143154' }, // เก็บ Chat ID
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Setting', settingsSchema);