const mongoose = require('mongoose');

const transactionCounterSchema = new mongoose.Schema({
  warehouseCode: { type: String, required: true, unique: true },
  sequence: { type: Number, default: 0 } // เพิ่ม sequence เริ่มต้นที่ 0
});

module.exports = mongoose.model('TransactionCounter', transactionCounterSchema);