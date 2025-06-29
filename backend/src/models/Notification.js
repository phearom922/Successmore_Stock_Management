const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['success', 'warning', 'error'], required: true },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  relatedTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction' } // เชื่อมโยงกับ StockTransaction
});

module.exports = mongoose.model('Notification', notificationSchema);