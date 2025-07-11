const mongoose = require('mongoose');

const lotSchema = new mongoose.Schema({
  lotCode: { type: String, required: true, unique: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productionDate: { type: Date, required: true },
  expDate: { type: Date, required: true },
  quantity: { type: Number, required: true },
  boxCount: { type: Number, required: true },
  qtyPerBox: { type: Number, required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true }, // ยืนยันเป็น _id
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  transactionNumber: { type: String, required: true },
  status: { type: String, enum: ['active', 'damaged', 'expired'], default: 'active' },
  qtyOnHand: { type: Number, default: 0 },
  damaged: { type: Number, default: 0 },

  transactions: [{
    timestamp: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    quantityAdjusted: Number,
    beforeQty: Number,
    afterQty: Number,
    transactionType: { type: String, enum: ['Receive', 'Issue', 'Transfer', 'Adjust', 'Cancel'] },
    warehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    destinationWarehouseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' } // เพิ่มสำหรับ Transfer
  }]
});

module.exports = mongoose.model('Lot', lotSchema);