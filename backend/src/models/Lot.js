const mongoose = require('mongoose');

const lotSchema = new mongoose.Schema({
  lotCode: { type: String, required: true, unique: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  expDate: { type: Date, required: true },
  productionDate: { type: Date, required: true },
  qtyOnHand: { type: Number, required: true },
  boxCount: { type: Number, required: true },
  qtyPerBox: { type: Number, required: true },
  warehouse: { type: String, required: true },
  status: { type: String, enum: ['active', 'damaged', 'expired'], default: 'active' }
}, { timestamps: true });

lotSchema.index({ productId: 1, lotCode: 1 });

module.exports = mongoose.model('Lot', lotSchema);