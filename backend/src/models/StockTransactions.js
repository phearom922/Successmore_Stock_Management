const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  transactionNumber: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  boxCount: { type: Number, required: true },
  qtyPerBox: { type: Number, required: true },
  productionDate: { type: Date, required: true },
  expDate: { type: Date, required: true },
  warehouse: { type: String, required: true },
  type: { type: String, enum: ['receive', 'issue', 'adjust'], required: true }, // เปลี่ยนจาก action เป็น type
  auditTrail: { type: mongoose.Schema.Types.ObjectId, ref: 'UserTransaction' },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' }
}, { timestamps: true });

stockTransactionSchema.index({ transactionNumber: 1, productId: 1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);