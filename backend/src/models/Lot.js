const mongoose = require('mongoose');

const lotSchema = new mongoose.Schema({
  lotCode: { type: String, required: true, unique: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  expDate: { type: Date, required: true },
  qtyOnHand: { type: Number, required: true, min: 0, default: 0 },
  warehouse: { type: String, required: true },
  status: { type: String, enum: ['active', 'damaged', 'expired'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Lot', lotSchema);