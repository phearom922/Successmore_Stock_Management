const mongoose = require('mongoose');

const issueTransactionSchema = new mongoose.Schema({
  transactionNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['Receive', 'Issue', 'TransferOut', 'TransferIn', 'Adjust', 'Cancel', 'Sale', 'Waste', 'Welfares', 'Activities'], required: true },
  warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  destinationWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' }, // สำหรับ Transfer
  lots: [{
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot' },
    quantity: { type: Number, required: true }
  }],
  createdAt: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['Active', 'Cancelled'], default: 'Active' },
  note: String,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledDate: { type: Date }
});

module.exports = mongoose.model('IssueTransaction', issueTransactionSchema);