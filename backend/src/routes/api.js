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

// Create Warehouse
router.post('/warehouses', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create warehouses' });
    }
    const data = warehouseSchema.parse(req.body);
    const { warehouseCode, name, branch, status, assignedUser } = data;

    const exists = await Warehouse.findOne({ warehouseCode }).session(session);
    if (exists) {
      return res.status(400).json({ message: 'Warehouse code already exists' });
    }

    let validAssignedUser = null;
    if (assignedUser) {
      validAssignedUser = await User.findById(assignedUser).session(session);
      if (!validAssignedUser) {
        return res.status(400).json({ message: 'Invalid assigned user' });
      }
      if (validAssignedUser.assignedWarehouse) {
        return res.status(400).json({ message: 'User is already assigned to another warehouse' });
      }
    }

    const warehouse = await Warehouse.create(
      [{
        warehouseCode,
        name,
        branch,
        status: status || 'Active',
        assignedUser: validAssignedUser ? validAssignedUser._id : null,
        hasAssignedUserHistory: !!validAssignedUser,
      }],
      { session }
    );

    if (validAssignedUser) {
      await User.findByIdAndUpdate(
        assignedUser,
        { assignedWarehouse: warehouse[0]._id },
        { session }
      );
    }

    await session.commitTransaction();
    res.json({ message: 'Warehouse created successfully', warehouse: warehouse[0] });
  } catch (error) {
    await session.abortTransaction();
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating warehouse',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Update Warehouse
router.put('/warehouses/:id', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update warehouses' });
    }
    const data = warehouseSchema.parse(req.body);
    const { warehouseCode, name, branch, status, assignedUser } = data;

    const warehouse = await Warehouse.findById(req.params.id).session(session);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    const codeExists = await Warehouse.findOne({
      warehouseCode,
      _id: { $ne: warehouse._id },
    }).session(session);
    if (codeExists) {
      return res.status(400).json({ message: 'Warehouse code already in use' });
    }

    let validAssignedUser = null;
    if (assignedUser) {
      validAssignedUser = await User.findById(assignedUser).session(session);
      if (!validAssignedUser) {
        return res.status(400).json({ message: 'Invalid assigned user' });
      }
      if (validAssignedUser.assignedWarehouse && validAssignedUser.assignedWarehouse.toString() !== warehouse._id.toString()) {
        return res.status(400).json({ message: 'User is already assigned to another warehouse' });
      }
    }

    // Clear previous assignment
    if (warehouse.assignedUser && (!assignedUser || assignedUser !== warehouse.assignedUser.toString())) {
      await User.findByIdAndUpdate(
        warehouse.assignedUser,
        { assignedWarehouse: null },
        { session }
      );
    }

    warehouse.warehouseCode = warehouseCode;
    warehouse.name = name;
    warehouse.branch = branch;
    warehouse.status = status || 'Active';
    warehouse.assignedUser = validAssignedUser ? validAssignedUser._id : null;
    warehouse.hasAssignedUserHistory = warehouse.hasAssignedUserHistory || !!validAssignedUser;

    const updated = await warehouse.save({ session });

    if (validAssignedUser) {
      await User.findByIdAndUpdate(
        assignedUser,
        { assignedWarehouse: warehouse._id },
        { session }
      );
    }

    await session.commitTransaction();
    res.json({ message: 'Warehouse updated successfully', warehouse: updated });
  } catch (error) {
    await session.abortTransaction();
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating warehouse',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Delete Warehouse
router.delete('/warehouses/:id', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete warehouses' });
    }
    const warehouse = await Warehouse.findById(req.params.id).session(session);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    if (warehouse.hasAssignedUserHistory) {
      return res.status(400).json({ message: 'Cannot delete warehouse with user assignment history' });
    }
    const lotsUsingWarehouse = await Lot.countDocuments({ warehouse: warehouse.name }).session(session);
    if (lotsUsingWarehouse > 0) {
      return res.status(400).json({ message: 'Cannot delete warehouse in use by lots' });
    }
    if (warehouse.assignedUser) {
      await User.findByIdAndUpdate(
        warehouse.assignedUser,
        { assignedWarehouse: null },
        { session }
      );
    }
    await Warehouse.findByIdAndDelete(req.params.id, { session });
    await session.commitTransaction();
    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error deleting warehouse', error: error.message });
  } finally {
    session.endSession();
  }
});

// Get all warehouses
router.get('/warehouses', authMiddleware, async (req, res) => {
  try {
    const warehouses = await Warehouse.find().populate('assignedUser', 'username');
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching warehouses', error: error.message });
  }
});

// Create User
router.post('/users', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create users' });
    }
    const data = userSchema.parse(req.body);
    const { username, password, role, assignedWarehouse } = data;

    const existingUser = await User.findOne({ username }).session(session);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let warehouse = null;
    if (assignedWarehouse) {
      warehouse = await Warehouse.findById(assignedWarehouse).session(session);
      if (!warehouse) {
        return res.status(400).json({ message: 'Invalid warehouse' });
      }
      if (warehouse.assignedUser) {
        return res.status(400).json({ message: 'Warehouse already assigned to another user' });
      }
    }

    const user = await User.create(
      [{
        username,
        password: hashedPassword,
        role,
        assignedWarehouse: assignedWarehouse || null,
      }],
      { session }
    );

    if (warehouse) {
      await Warehouse.findByIdAndUpdate(
        assignedWarehouse,
        { assignedUser: user[0]._id, hasAssignedUserHistory: true },
        { session }
      );
    }

    await session.commitTransaction();
    res.json({ message: 'User created successfully', user: user[0] });
  } catch (error) {
    await session.abortTransaction();
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating user',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Update User
router.put('/users/:id', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update users' });
    }
    const data = userSchema.parse(req.body);
    const { username, password, role, assignedWarehouse } = data;

    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingUser = await User.findOne({ username, _id: { $ne: user._id } }).session(session);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    let warehouse = null;
    if (assignedWarehouse) {
      warehouse = await Warehouse.findById(assignedWarehouse).session(session);
      if (!warehouse) {
        return res.status(400).json({ message: 'Invalid warehouse' });
      }
      if (warehouse.assignedUser && warehouse.assignedUser.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Warehouse already assigned to another user' });
      }
    }

    // Clear previous assignment
    if (user.assignedWarehouse && (!assignedWarehouse || assignedWarehouse !== user.assignedWarehouse.toString())) {
      await Warehouse.findByIdAndUpdate(
        user.assignedWarehouse,
        { assignedUser: null },
        { session }
      );
    }

    user.username = username;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    user.role = role;
    user.assignedWarehouse = assignedWarehouse || null;

    const updated = await user.save({ session });

    if (warehouse) {
      await Warehouse.findByIdAndUpdate(
        assignedWarehouse,
        { assignedUser: user._id, hasAssignedUserHistory: true },
        { session }
      );
    }

    await session.commitTransaction();
    res.json({ message: 'User updated successfully', user: updated });
  } catch (error) {
    await session.abortTransaction();
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating user',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Delete User
router.delete('/users/:id', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete users' });
    }
    const user = await User.findById(req.params.id).session(session);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.assignedWarehouse) {
      await Warehouse.findByIdAndUpdate(
        user.assignedWarehouse,
        { assignedUser: null },
        { session }
      );
    }
    await User.findByIdAndDelete(req.params.id, { session });
    await session.commitTransaction();
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  } finally {
    session.endSession();
  }
});

// Get all users
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view users' });
    }
    const users = await User.find().select('-password').populate('assignedWarehouse', 'name');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Get all products
router.get('/products', authMiddleware, async (req, res) => {
  try {
    const products = await Product.find().populate('category', 'name description');
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// Batch create products
router.post('/products/batch', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create products' });
    }
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: 'Products array is required' });
    }

    const validProducts = products.filter(p => p.productCode && p.name && p.category);
    if (validProducts.length === 0) {
      return res.status(400).json({ message: 'No valid products provided' });
    }

    const createdProducts = await Product.insertMany(validProducts.map(p => ({
      productCode: p.productCode,
      name: p.name,
      category: p.category,
      sku: p.sku || null,
    })), { ordered: false });

    res.json({ message: 'Products created successfully', products: createdProducts });
  } catch (error) {
    console.error('Error creating products in batch:', error);
    res.status(500).json({ message: 'Error creating products', error: error.message });
  }
});

// Create product
router.post('/products', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create products' });
    }
    const { productCode, name, category, sku } = req.body;
    if (!productCode || !name || !category) {
      return res.status(400).json({ message: 'Product code, name, and category are required' });
    }
    const product = await Product.create({ productCode, name, category, sku: sku || null });
    res.json({ message: 'Product created successfully', product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Error creating product', error: error.message });
  }
});

// Update product
router.put('/products/:id', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update products' });
    }
    const { productCode, name, category, sku } = req.body;
    if (!productCode || !name || !category) {
      return res.status(400).json({ message: 'Product code, name, and category are required' });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, { productCode, name, category, sku: sku || null }, { new: true, runValidators: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Error updating product', error: error.message });
  }
});

// Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete products' });
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// Create category
router.post('/categories', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create categories' });
    }
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const category = await Category.create({ name, description });
    res.json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category', error: error.message });
  }
});

// Update category
router.put('/categories/:id', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update categories' });
    }
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const category = await Category.findByIdAndUpdate(req.params.id, { name, description }, { new: true, runValidators: true });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json({ message: 'Category updated successfully', category });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category', error: error.message });
  }
});

// Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete categories' });
    }
    const categoryId = req.params.id;
    // ตรวจสอบว่ามี Product ใช้ Category นี้หรือไม่
    const productCount = await Product.countDocuments({ category: categoryId });
    if (productCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category, it is in use by products' });
    }
    const category = await Category.findByIdAndDelete(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
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
    console.log('Creating lot:', { lotCode, productId, expDate, qtyOnHand, warehouse }); // Debug
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

    console.log('Issuing stock:', { productId, quantity, warehouse, issueType, lotId }); // Debug

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
    console.log('Filtered lots:', lots); // Debug
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
    console.error('Error issuing stock:', error); // Debug
    await session.abortTransaction();
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error issuing stock',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Update lot status
router.post('/lots/status', async (req, res) => {
  try {
    const user = req.user;
    const { lotId, status } = req.body;

    if (!lotId || !status) {
      return res.status(400).json({ message: 'Lot ID and status are required' });
    }
    if (!['active', 'damaged', 'expired'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const lot = await Lot.findById(lotId);
    if (!lot) {
      return res.status(404).json({ message: 'Lot not found' });
    }
    if (user.role !== 'admin' && lot.warehouse !== user.warehouse) {
      return res.status(403).json({ message: 'Unauthorized to update this lot' });
    }

    lot.status = status;
    const updatedLot = await lot.save();
    console.log('Updated lot status:', updatedLot);

    res.json({ message: 'Lot status updated successfully', lot: updatedLot });
  } catch (error) {
    console.error('Error updating lot status:', error);
    res.status(500).json({ message: 'Error updating lot status', error: error.message });
  }
});

// Split lot status with quantity
router.post('/lots/split-status', async (req, res) => {
  try {
    const user = req.user;
    const { lotId, status, quantity } = req.body;

    if (!lotId || !status || !quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Lot ID, status, and quantity are required' });
    }
    if (!['active', 'damaged', 'expired'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const lot = await Lot.findById(lotId);
    if (!lot) {
      return res.status(404).json({ message: 'Lot not found' });
    }
    if (user.role !== 'admin' && lot.warehouse !== user.warehouse) {
      return res.status(403).json({ message: 'Unauthorized to update this lot' });
    }
    if (lot.qtyOnHand < quantity) {
      return res.status(400).json({
        message: 'Insufficient quantity available',
        availableStock: lot.qtyOnHand,
      });
    }

    // ลดจำนวนจาก Lot เดิม
    lot.qtyOnHand -= quantity;
    const originalLot = await lot.save();

    // สร้าง Lot ใหม่สำหรับของเสีย
    const newLot = new Lot({
      lotCode: `${lot.lotCode}-Damaged-${Date.now()}`, // เพิ่ม timestamp เพื่อความไม่ซ้ำ
      productId: lot.productId,
      expDate: lot.expDate,
      qtyOnHand: quantity,
      warehouse: lot.warehouse,
      status: status,
    });
    const savedNewLot = await newLot.save();

    console.log('Original lot after split:', originalLot);
    console.log('New damaged lot:', savedNewLot);

    res.json({
      message: 'Lot split and status updated successfully',
      originalLot: originalLot,
      newLot: savedNewLot,
    });
  } catch (error) {
    console.error('Error splitting lot status:', error);
    res.status(500).json({ message: 'Error splitting lot status', error: error.message });
  }
});

// Get all lots
router.get('/lots', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching lots for user:', req.user); // Debug
    const user = req.user;
    const query = user.role === 'admin' ? {} : { warehouse: user.warehouse };
    const lots = await Lot.find(query).populate('productId');
    console.log('Fetched lots:', lots); // Debug
    res.json(lots);
  } catch (error) {
    console.error('Error fetching lots:', error); // Debug
    res.status(500).json({ message: 'Error fetching lots', error: error.message });
  }
});

module.exports = router;