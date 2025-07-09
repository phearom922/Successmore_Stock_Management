const mongoose = require('mongoose');

const transactionCounterSchema = new mongoose.Schema({
  warehouseCode: { type: String, required: true, unique: true },
});

module.exports = mongoose.model('TransactionCounter', transactionCounterSchema);