const mongoose = require('mongoose');

const transferTransactionSchema = new mongoose.Schema({
  transferNumber: { type: String, required: true, unique: true },
  sourceWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  destinationWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  lots: [{
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', required: true },
    quantity: { type: Number, required: true, min: 1 }
  }],
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, default: '' },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Rejected'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  trackingNumber: { type: String }
}, {
  timestamps: true
});

transferTransactionSchema.index({ sourceWarehouseId: 1, createdAt: -1 });
transferTransactionSchema.index({ destinationWarehouseId: 1, createdAt: -1 });

const TransferTransaction = mongoose.model('TransferTransaction', transferTransactionSchema);

module.exports = TransferTransaction;