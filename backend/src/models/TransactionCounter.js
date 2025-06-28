const mongoose = require('mongoose');

const transactionCounterSchema = new mongoose.Schema({
  warehouseCode: { type: String, required: true, unique: true },
  counter: { type: Number, default: 0 }
});

module.exports = mongoose.model('TransactionCounter', transactionCounterSchema);