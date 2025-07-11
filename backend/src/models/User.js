const mongoose = require('mongoose');
const { z } = require('zod');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  lastName: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: false }, // เปลี่ยนจาก assignedWarehouse
  permissions: [{
    feature: { type: String, enum: ['lotManagement', 'manageDamage', 'category', 'products'] },
    permissions: [{ type: String, enum: ['Show', 'Edit', 'Cancel'] }]
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Partial schema สำหรับการอัปเดต
const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional(),
  warehouse: z.string().min(1).optional(), // เปลี่ยนจาก assignedWarehouse
  permissions: z.array(
    z.object({
      feature: z.enum(['lotManagement', 'manageDamage', 'category', 'products']),
      permissions: z.array(z.enum(['Show', 'Edit', 'Cancel'])).optional()
    })
  ).optional().nullable(),
  isActive: z.boolean().optional(),
}).strict().passthrough();

// ฟังก์ชัน Pre-save Hook เพื่อบังคับ Warehouse สำหรับ Role 'user'
userSchema.pre('save', function (next) {
  if (this.role === 'user' && !this.warehouse) {
    next(new Error('User role must have a warehouse'));
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
module.exports.updateUserSchema = updateUserSchema;