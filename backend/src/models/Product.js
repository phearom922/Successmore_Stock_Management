const mongoose = require('mongoose');

  const productSchema = new mongoose.Schema({
    productCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    sku: { type: String, sparse: true }, // sparse: true อนุญาตให้ null/undefined ไม่ถูกนับเป็นค่าเดียวกัน
    createdAt: { type: Date, default: Date.now },
  });

  module.exports = mongoose.model('Product', productSchema);