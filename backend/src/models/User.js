
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], required: true },
  assignedWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);