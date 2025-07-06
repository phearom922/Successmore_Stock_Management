const mongoose = require('mongoose');
const { z } = require('zod');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  lastName: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], required: true },
  assignedWarehouse: { type: String, ref: 'Warehouse', required: true },
  permissions: [{
    feature: { type: String, enum: ['lotManagement', 'manageDamage', 'category', 'products'] },
    permissions: { type: [String], enum: ['Show', 'Edit', 'Cancel'], default: [] }
  }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Partial schema สำหรับการอัปเดต
const updateUserSchema = z.object({
  username: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional(),
  assignedWarehouse: z.string().min(1).optional(),
  permissions: z.array(
    z.object({
      feature: z.enum(['lotManagement', 'manageDamage', 'category', 'products']),
      permissions: z.array(z.enum(['Show', 'Edit', 'Cancel'])).optional()
    })
  ).optional().nullable(),
  isActive: z.boolean().optional(),
}).strict();

module.exports = mongoose.model('User', userSchema);
module.exports.updateUserSchema = updateUserSchema; // Export อย่างถูกต้อง