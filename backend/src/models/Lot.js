const mongoose = require('mongoose');

const lotTransactionSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  quantityAdjusted: { type: Number, required: true },
  beforeQty: { type: Number, required: true },
  afterQty: { type: Number, required: true },
  transactionType: {
    type: String,
    enum: ['Receive', 'Issue', 'TransferOut', 'TransferIn', 'Adjust', 'Cancel', 'Sale', 'Waste', 'Welfares', 'Activities', 'TransferInPending', 'TransferInRejected'], // เพิ่ม TransferInRejected
    required: true
  },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  destinationWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }
});

const lotSchema = new mongoose.Schema({
  lotCode: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productionDate: { type: Date, required: true },
  expDate: { type: Date, required: true },
  quantity: { type: Number, required: true },
  boxCount: { type: Number, required: true },
  qtyPerBox: { type: Number, required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  transactionNumber: { type: String, required: true },
  status: { type: String, enum: ['active', 'damaged', 'expired', 'pending'], default: 'active' },
  qtyOnHand: { type: Number, default: 0 },
  damaged: { type: Number, default: 0 },
  transactions: [lotTransactionSchema]
}, {
  timestamps: true
});

lotSchema.index({ lotCode: 1, warehouse: 1 }, { unique: true });
lotSchema.index({ warehouse: 1, productId: 1, expDate: 1 });
lotSchema.index({ status: 1 });

module.exports = mongoose.model('Lot', lotSchema);