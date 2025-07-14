const mongoose = require('mongoose');

const damagedAuditTrailSchema = new mongoose.Schema({
  transactionNumber: { type: String, required: true, unique: true },
  lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true }, // เพิ่ม warehouseId
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('DamagedAuditTrail', damagedAuditTrailSchema);