const mongoose = require('mongoose');

const transactionCounterSchema = new mongoose.Schema({
  warehouseCode: { type: String, required: true, unique: true }, // ใช้ warehouseCode
  sequence: { type: Number, default: 0 }
});

module.exports = mongoose.model('TransactionCounter', transactionCounterSchema);