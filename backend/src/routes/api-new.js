const express = require('express');
const router = express.Router();
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth');
const Product = require('../models/Product');
const Lot = require('../models/Lot');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Category = require('../models/Category');

// Validation Schemas
const warehouseSchema = z.object({
  warehouseCode: z.string().min(1),
  name: z.string().min(1),
  branch: z.string().min(1),
  status: z.enum(['Active', 'Inactive']).optional(),
  assignedUser: z.string().optional(),
});

const userSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']),
  assignedWarehouse: z.string().optional(),
});

const lotSchema = z.object({
  lotCode: z.string().min(1),
  productId: z.string().min(1),
  expDate: z.string().datetime(),
  qtyOnHand: z.number().positive(),
  warehouse: z.string().min(1),
});

const issueSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  warehouse: z.string().min(1),
  issueType: z.enum(['normal', 'expired', 'waste']),
  lotId: z.string().optional(),
});

// Seed Data
router.post('/seed', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can seed data' });
  }
  try {
    const users = await User.find();
    const products = await Product.find();
    const categories = await Category.find();
    if (users.length === 0 || products.length === 0 || categories.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await User.deleteMany();
      await Product.deleteMany();
      await Lot.deleteMany();
      await Warehouse.deleteMany();
      await Category.deleteMany();

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const admin = await User.create(
          [{ username: 'admin', password: hashedPassword, role: 'admin', assignedWarehouse: null }],
          { session }
        );
        const user1 = await User.create(
          [{ username: 'user1', password: hashedPassword, role: 'user', assignedWarehouse: null }],
          { session }
        );

        const bangkokWarehouse = await Warehouse.create(
          [{ name: 'Bangkok Main Warehouse', warehouseCode: 'BKK001', branch: 'Bangkok', assignedUser: user1[0]._id }],
          { session }
        );
        await User.findByIdAndUpdate(user1[0]._id, { assignedWarehouse: bangkokWarehouse[0]._id }, { session });

        await Warehouse.create([{ name: 'Silom Sub Warehouse', warehouseCode: 'BKK002', branch: 'Bangkok' }], { session });

        const category1 = await Category.create(
          [{ name: 'Personal Care', description: 'Personal hygiene products' }],
          { session }
        );
        const category2 = await Category.create([{ name: 'Household', description: 'Household items' }], { session });

        const doveProduct = await Product.create(
          [{
            productCode: 'PROD001',
            name: 'Dove Soap 100g',
            category: category1[0]._id,
            sku: null,
          }],
          { session }
        );
        await Product.create(
          [{
            productCode: 'PROD002',
            name: 'Shampoo 200ml',
            category: category1[0]._id,
            sku: null,
          }],
          { session }
        );
        await Lot.create(
          [{
            lotCode: 'LOT001-240101',
            productId: doveProduct[0]._id,
            expDate: new Date('2025-12-31'),
            qtyOnHand: 40,
            warehouse: 'Bangkok Main Warehouse',
            status: 'active',
          }],
          { session }
        );
        await Lot.create(
          [{
            lotCode: 'LOT002-240101',
            productId: doveProduct[0]._id,
            expDate: new Date('2024-12-31'),
            qtyOnHand: 30,
            warehouse: 'Bangkok Main Warehouse',
            status: 'active',
          }],
          { session }
        );
        await Lot.create(
          [{
            lotCode: 'LOT003-240101',
            productId: doveProduct[0]._id,
            expDate: new Date('2025-12-31'),
            qtyOnHand: 20,
            warehouse: 'Silom Sub Warehouse',
            status: 'active',
          }],
          { session }
        );
        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
      console.log('Seed data added');
    }
    res.json({ message: 'Seed data completed' });
  } catch (error) {
    res.status(500).json({ message: 'Error seeding data', error: error.message });
  }
});

// Login Endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username }).populate('assignedWarehouse');
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (!(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({
    id: user._id,
    role: user.role,
    username: user.username,
    warehouse: user.assignedWarehouse ? user.assignedWarehouse.name : 'All'
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Create Lot
router.post('/lots', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create lots' });
    }
    const data = lotSchema.parse(req.body);
    const { lotCode, productId, expDate, qtyOnHand, warehouse } = data;

    const existingLot = await Lot.findOne({ lotCode }).session(session);
    if (existingLot) {
      return res.status(400).json({ message: 'Lot code already exists' });
    }

    const product = await Product.findById(productId).session(session);
    if (!product) {
      return res.status(400).json({ message: 'Invalid product' });
    }

    const warehouseDoc = await Warehouse.findOne({ name: warehouse }).session(session);
    if (!warehouseDoc) {
      return res.status(400).json({ message: 'Invalid warehouse' });
    }

    const lot = await Lot.create(
      [{
        lotCode,
        productId,
        expDate: new Date(expDate),
        qtyOnHand,
        warehouse,
        status: 'active',
      }],
      { session }
    );

    await session.commitTransaction();
    res.json({ message: 'Lot created successfully', lot: lot[0] });
  } catch (error) {
    await session.abortTransaction();
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating lot',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Issue stock
router.post('/issue', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const data = issueSchema.parse(req.body);
    const { productId, quantity, warehouse, issueType, lotId } = data;

    const warehouseDoc = await Warehouse.findOne({ name: warehouse }).session(session);
    if (!warehouseDoc) {
      return res.status(400).json({ message: 'Invalid warehouse' });
    }

    let lots = [];
    if (issueType === 'expired') {
      lots = await Lot.find({ productId, qtyOnHand: { $gt: 0 }, expDate: { $lt: new Date() } }).sort({ expDate: 1 }).session(session);
    } else if (issueType === 'waste') {
      if (!lotId) return res.status(400).json({ message: 'Lot ID is required for waste issue' });
      const lot = await Lot.findOne({ _id: lotId }).session(session);
      if (!lot) return res.status(400).json({ message: 'Lot not found' });
      if (lot.qtyOnHand < quantity) {
        return res.status(400).json({
          message: 'Insufficient stock available',
          availableStock: lot.qtyOnHand,
        });
      }
      lot.qtyOnHand -= quantity;
      const updatedLot = await lot.save({ session });
      lots = [updatedLot];
    } else {
      lots = await Lot.find({ productId, qtyOnHand: { $gt: 0 }, status: 'active' }).sort({ expDate: 1 }).session(session);
    }

    if (req.user.role !== 'admin') {
      lots = lots.filter(lot => lot.warehouse === warehouse);
    }
    const totalAvailable = lots.reduce((sum, lot) => sum + lot.qtyOnHand, 0);

    if (totalAvailable < quantity) {
      return res.status(400).json({
        message: 'Insufficient stock available',
        availableStock: totalAvailable,
      });
    }

    let remainingQty = quantity;
    const issuedLots = [];

    for (const lot of lots) {
      if (remainingQty <= 0) break;

      const qtyToIssue = Math.min(remainingQty, lot.qtyOnHand);
      lot.qtyOnHand -= qtyToIssue;
      const updatedLot = await lot.save({ session });
      issuedLots.push({
        lotCode: lot.lotCode,
        qtyIssued: qtyToIssue,
        remainingQty: updatedLot.qtyOnHand,
      });
      remainingQty -= qtyToIssue;
    }

    await session.commitTransaction();
    res.json({
      message: 'Stock issued successfully',
      issuedLots,
      totalIssued: quantity,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error issuing stock',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});



// คง endpoints อื่น ๆ ไว้เหมือนเดิม
router.get('/products', authMiddleware, async (req, res) => {
  try {
    const products = await Product.find().populate('category', 'name description');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// ... (คง endpoints อื่น ๆ: /products/batch, /products/:id, /categories, /warehouses, /lots, /users, /lots/status, /lots/split-status)

module.exports = router;