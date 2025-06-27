const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  address: { type: String, default: '' },
  phone: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);