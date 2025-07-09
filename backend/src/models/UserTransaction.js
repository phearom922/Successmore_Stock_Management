const mongoose = require('mongoose');

const userTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  description: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String },
  details: { type: Object }
});

module.exports = mongoose.model('UserTransaction', userTransactionSchema);