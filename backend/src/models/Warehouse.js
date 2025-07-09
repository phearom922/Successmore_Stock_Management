const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema({
  warehouseCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  branch: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  hasAssignedUserHistory: { type: Boolean, default: false }
}, { timestamps: true });


warehouseSchema.index({ warehouseCode: 1, name: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);