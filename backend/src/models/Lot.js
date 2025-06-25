const mongoose = require('mongoose');

  const lotSchema = new mongoose.Schema({
    lotCode: { type: String, required: true, unique: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    expDate: { type: Date, required: true },
    qtyOnHand: { type: Number, default: 0 },
    warehouse: { type: String, required: true },
    status: { type: String, enum: ['active', 'damaged', 'expired'], default: 'active' }, // เพิ่ม 'damaged'
  });

  module.exports = mongoose.model('Lot', lotSchema);