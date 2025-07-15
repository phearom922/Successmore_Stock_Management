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
  status: { type: String, enum: ['Pending', 'Completed', 'Cancelled'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, {
  timestamps: true // เพิ่ม createdAt และ updatedAt อัตโนมัติ
});

// Index สำหรับการค้นหา (ลบการกำหนด transferNumber ออก เพราะมี unique: true อยู่แล้ว)
transferTransactionSchema.index({ sourceWarehouseId: 1, createdAt: -1 });
transferTransactionSchema.index({ destinationWarehouseId: 1, createdAt: -1 });

module.exports = mongoose.model('TransferTransaction', transferTransactionSchema);