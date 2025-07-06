const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  warehouseCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  branch: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  // เปลี่ยน assignedUser เป็น Array เพื่อรองรับหลาย User (ถ้าต้องการเก็บ)
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  hasAssignedUserHistory: { type: Boolean, default: false }
}, { timestamps: true });

// เพิ่ม index เพื่อประสิทธิภาพการค้นหา
warehouseSchema.index({ warehouseCode: 1, name: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);