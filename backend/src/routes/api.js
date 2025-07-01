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
const XLSX = require('xlsx');
const Supplier = require('../models/Suppliers');
const StockTransaction = require('../models/StockTransactions');
const TransactionCounter = require('../models/TransactionCounter');
const logger = require('../config/logger');
const UserTransaction = require('../models/UserTransaction');
const Notification = require('../models/Notification');
const { format, parse, startOfDay, endOfDay } = require('date-fns');


// Validation Schemas
const receiveSchema = z.object({
  lots: z.array(
    z.object({
      productId: z.string().min(1),
      lotCode: z.string().min(1),
      productionDate: z.string().datetime(),
      expDate: z.string().datetime(),
      quantity: z.number().positive(),
      boxCount: z.number().positive(),
      qtyPerBox: z.number().positive(),
      warehouse: z.string().min(1),
      supplierId: z.string().min(1),
    }).refine((data) => data.quantity === data.boxCount * data.qtyPerBox, {
      message: 'Quantity must equal Box Count * Quantity per Box',
      path: ['quantity'],
    })
  ),
});

const warehouseSchema = z.object({
  warehouseCode: z.string().min(1),
  name: z.string().min(1),
  branch: z.string().min(1),
  status: z.enum(['Active', 'Inactive']).optional(),
  assignedUser: z.string().optional(),
});

const userSchema = z.object({
  username: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6).optional(),
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












// Login Endpoint
router.post('/login', async (req, res) => {
  try {
    logger.info('Login attempt:', req.body.username); // ใช้ logger แทน console.log
    const { username, password } = req.body;
    const user = await User.findOne({ username }).populate('assignedWarehouse');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({
      id: user._id, // ตรวจสอบว่า _id ถูกส่ง
      role: user.role,
      username: user.username,
      warehouse: user.assignedWarehouse ? user.assignedWarehouse.name : 'All'
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    logger.error('Error during login:', { error: error.message, stack: error.stack }); // ใช้ logger
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
});

// Create User
router.post('/users', authMiddleware, async (req, res) => {
  try {
    console.log('Creating user, payload:', req.body, 'user:', req.user);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create users' });
    }
    const data = userSchema.parse(req.body);
    const { username, lastName, password, role, assignedWarehouse } = data;

    if (!password) {
      return res.status(400).json({ message: 'Password is required for new users' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    let warehouse = null;
    if (assignedWarehouse) {
      if (!mongoose.Types.ObjectId.isValid(assignedWarehouse)) {
        return res.status(400).json({ message: 'Invalid warehouse ID format' });
      }
      warehouse = await Warehouse.findById(assignedWarehouse);
      if (!warehouse) {
        return res.status(400).json({ message: 'Warehouse not found' });
      }
      if (warehouse.assignedUser) {
        return res.status(400).json({ message: 'Warehouse already assigned to another user' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      lastName,
      password: hashedPassword,
      role,
      assignedWarehouse: assignedWarehouse || null,
    });

    if (warehouse) {
      await Warehouse.findByIdAndUpdate(
        assignedWarehouse,
        { assignedUser: user._id, hasAssignedUserHistory: true }
      );
    }

    res.json({ message: 'User created successfully', user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating user',
      error: error.message
    });
  }
});

// Update User
router.put('/users/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Updating user:', req.params.id, 'payload:', req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update users' });
    }
    const data = userSchema.parse(req.body);
    const { username, lastName, password, role, assignedWarehouse } = data;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existingUser = await User.findOne({ username, _id: { $ne: user._id } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    let warehouse = null;
    if (assignedWarehouse) {
      if (!mongoose.Types.ObjectId.isValid(assignedWarehouse)) {
        return res.status(400).json({ message: 'Invalid warehouse ID format' });
      }
      warehouse = await Warehouse.findById(assignedWarehouse);
      if (!warehouse) {
        return res.status(400).json({ message: 'Warehouse not found' });
      }
      if (warehouse.assignedUser && warehouse.assignedUser.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'Warehouse already assigned to another user' });
      }
    }

    if (user.assignedWarehouse && (!assignedWarehouse || assignedWarehouse !== user.assignedWarehouse.toString())) {
      await Warehouse.findByIdAndUpdate(
        user.assignedWarehouse,
        { assignedUser: null }
      );
    }

    user.username = username;
    user.lastName = lastName;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    user.role = role;
    user.assignedWarehouse = assignedWarehouse || null;

    const updated = await user.save();

    if (warehouse) {
      await Warehouse.findByIdAndUpdate(
        assignedWarehouse,
        { assignedUser: user._id, hasAssignedUserHistory: true }
      );
    }

    res.json({ message: 'User updated successfully', user: { ...updated.toObject(), password: undefined } });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating user',
      error: error.message
    });
  }
});

// Delete User
router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Deleting user:', req.params.id);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete users' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.assignedWarehouse) {
      await Warehouse.findByIdAndUpdate(
        user.assignedWarehouse,
        { assignedUser: null }
      );
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
});

// Get all users
router.get('/users', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching users for:', req.user);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view users' });
    }
    const users = await User.find().select('-password').populate('assignedWarehouse', 'name warehouseCode');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Create Lot
router.post('/lots', authMiddleware, async (req, res) => {
  try {
    console.log('Creating lot:', req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create lots' });
    }
    const data = lotSchema.parse(req.body);
    const { lotCode, productId, expDate, qtyOnHand, warehouse } = data;

    const existingLot = await Lot.findOne({ lotCode });
    if (existingLot) {
      return res.status(400).json({ message: 'Lot code already exists' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ message: 'Invalid product' });
    }

    const warehouseDoc = await Warehouse.findOne({ name: warehouse });
    if (!warehouseDoc) {
      return res.status(400).json({ message: 'Invalid warehouse' });
    }

    const lot = await Lot.create({
      lotCode,
      productId,
      expDate: new Date(expDate),
      qtyOnHand,
      warehouse,
      status: 'active',
    });

    res.json({ message: 'Lot created successfully', lot });
  } catch (error) {
    console.error('Error creating lot:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating lot',
      error: error.message
    });
  }
});

// Get all lots
router.get('/lots', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching lots for user:', req.user);
    const user = req.user;
    const query = user.role === 'admin' ? {} : { warehouse: user.warehouse };
    const lots = await Lot.find(query).populate('productId');
    console.log('Fetched lots:', lots);
    res.json(lots);
  } catch (error) {
    console.error('Error fetching lots:', error);
    res.status(500).json({ message: 'Error fetching lots', error: error.message });
  }
});

// Issue stock
router.post('/issue', authMiddleware, async (req, res) => {
  try {
    logger.info('Issuing stock:', req.body);
    const data = issueSchema.parse(req.body);
    const { productId, quantity, warehouse, issueType, lotId } = data;

    const warehouseDoc = await Warehouse.findOne({ name: warehouse });
    if (!warehouseDoc) {
      return res.status(400).json({ message: 'Invalid warehouse' });
    }

    let lots = [];
    if (issueType === 'expired') {
      lots = await Lot.find({ productId, qtyOnHand: { $gt: 0 }, expDate: { $lt: new Date() } }).sort({ expDate: 1 });
    } else if (issueType === 'waste') {
      if (!lotId) return res.status(400).json({ message: 'Lot ID is required for waste issue' });
      const lot = await Lot.findOne({ _id: lotId });
      if (!lot) return res.status(400).json({ message: 'Lot not found' });
      if (lot.qtyOnHand < quantity) {
        return res.status(400).json({
          message: 'Insufficient stock available',
          availableStock: lot.qtyOnHand,
        });
      }
      lot.qtyOnHand -= quantity;
      const updatedLot = await lot.save();
      lots = [updatedLot];
    } else {
      lots = await Lot.find({ productId, qtyOnHand: { $gt: 0 }, status: 'active' }).sort({ expDate: 1 });
    }

    if (req.user.role !== 'admin') {
      lots = lots.filter(lot => lot.warehouse === warehouse);
    }
    logger.info('Filtered lots:', lots);
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
      const updatedLot = await lot.save();
      issuedLots.push({
        lotCode: lot.lotCode,
        qtyIssued: qtyToIssue,
        remainingQty: updatedLot.qtyOnHand,
      });
      remainingQty -= qtyToIssue;
    }

    res.json({
      message: 'Stock issued successfully',
      issuedLots,
      totalIssued: quantity,
    });
  } catch (error) {
    logger.error('Error issuing stock:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error issuing stock',
      error: error.message
    });
  }
});

// Get all products
router.get('/products', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching products for user:', req.user);
    const products = await Product.find().populate('category', 'name description');
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products', error: error.message });
  }
});

// Create Product
router.post('/products', authMiddleware, async (req, res) => {
  try {
    console.log('Creating product:', req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create products' });
    }
    const productSchema = z.object({
      productCode: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      sku: z.string().nullable(),
    });
    const data = productSchema.parse(req.body);
    const { productCode, name, category, sku } = data;

    const existingProduct = await Product.findOne({ productCode });
    if (existingProduct) {
      return res.status(400).json({ message: 'Product code already exists' });
    }

    const product = await Product.create({ productCode, name, category, sku });
    res.json({ message: 'Product created successfully', product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating product',
      error: error.message
    });
  }
});

// Update Product
router.put('/products/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Updating product:', req.params.id, req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update products' });
    }
    const productSchema = z.object({
      productCode: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      sku: z.string().nullable(),
    });
    const data = productSchema.parse(req.body);
    const { productCode, name, category, sku } = data;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingProduct = await Product.findOne({ productCode, _id: { $ne: product._id } });
    if (existingProduct) {
      return res.status(400).json({ message: 'Product code already exists' });
    }

    product.productCode = productCode;
    product.name = name;
    product.category = category;
    product.sku = sku;
    const updated = await product.save();
    res.json({ message: 'Product updated successfully', product: updated });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating product',
      error: error.message
    });
  }
});

// Delete Product
router.delete('/products/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Deleting product:', req.params.id);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete products' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error deleting product', error: error.message });
  }
});

// Batch Create Products
router.post('/products/batch', authMiddleware, async (req, res) => {
  try {
    console.log('Batch creating products:', req.body.products);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create products' });
    }
    const productSchema = z.object({
      productCode: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      sku: z.string().nullable(),
    });
    const batchSchema = z.object({
      products: z.array(productSchema),
    });
    const data = batchSchema.parse(req.body);
    const existingCodes = await Product.find({
      productCode: { $in: data.products.map(p => p.productCode) },
    });
    if (existingCodes.length > 0) {
      return res.status(400).json({
        message: 'Some product codes already exist',
        existingCodes: existingCodes.map(p => p.productCode),
      });
    }
    const products = await Product.insertMany(data.products, { ordered: false });
    res.json({ message: 'Products created successfully', products });
  } catch (error) {
    console.error('Error batch creating products:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating products',
      error: error.message
    });
  }
});

// Download Excel Template
router.get('/products/template', async (req, res) => {
  try {
    const categories = await Category.find({}, 'name');
    const sampleData = [
      { ProductCode: 'PROD003', ProductName: 'Toothpaste', Category: categories[0]?.name || 'Personal Care', SKU: 'SKU001' },
      { ProductCode: 'PROD004', ProductName: 'Detergent', Category: categories[1]?.name || 'Household', SKU: 'SKU002' },
    ];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=products_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ message: 'Error generating template', error: error.message });
  }
});

// Create Warehouse
router.post('/warehouses', authMiddleware, async (req, res) => {
  try {
    console.log('Creating warehouse:', req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create warehouses' });
    }
    const data = warehouseSchema.parse(req.body);
    const { warehouseCode, name, branch, status, assignedUser } = data;

    const exists = await Warehouse.findOne({ warehouseCode });
    if (exists) {
      return res.status(400).json({ message: 'Warehouse code already exists' });
    }

    let validAssignedUser = null;
    if (assignedUser) {
      if (!mongoose.Types.ObjectId.isValid(assignedUser)) {
        return res.status(400).json({ message: 'Invalid assigned user ID format' });
      }
      validAssignedUser = await User.findById(assignedUser);
      if (!validAssignedUser) {
        return res.status(400).json({ message: 'Invalid assigned user' });
      }
      if (validAssignedUser.assignedWarehouse) {
        return res.status(400).json({ message: 'User is already assigned to another warehouse' });
      }
    }

    const warehouse = await Warehouse.create({
      warehouseCode,
      name,
      branch,
      status: status || 'Active',
      assignedUser: validAssignedUser ? validAssignedUser._id : null,
      hasAssignedUserHistory: !!validAssignedUser,
    });

    if (validAssignedUser) {
      await User.findByIdAndUpdate(
        assignedUser,
        { assignedWarehouse: warehouse._id }
      );
    }

    res.json({ message: 'Warehouse created successfully', warehouse });
  } catch (error) {
    console.error('Error creating warehouse:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating warehouse',
      error: error.message
    });
  }
});

// Update Warehouse
router.put('/warehouses/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Updating warehouse:', req.params.id, req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update warehouses' });
    }
    const data = warehouseSchema.parse(req.body);
    const { warehouseCode, name, branch, status, assignedUser } = data;

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    const codeExists = await Warehouse.findOne({
      warehouseCode,
      _id: { $ne: warehouse._id },
    });
    if (codeExists) {
      return res.status(400).json({ message: 'Warehouse code already in use' });
    }

    let validAssignedUser = null;
    if (assignedUser) {
      if (!mongoose.Types.ObjectId.isValid(assignedUser)) {
        return res.status(400).json({ message: 'Invalid assigned user ID format' });
      }
      validAssignedUser = await User.findById(assignedUser);
      if (!validAssignedUser) {
        return res.status(400).json({ message: 'Invalid assigned user' });
      }
      if (validAssignedUser.assignedWarehouse && validAssignedUser.assignedWarehouse.toString() !== warehouse._id.toString()) {
        return res.status(400).json({ message: 'User is already assigned to another warehouse' });
      }
    }

    if (warehouse.assignedUser && (!assignedUser || assignedUser !== warehouse.assignedUser.toString())) {
      await User.findByIdAndUpdate(
        warehouse.assignedUser,
        { assignedWarehouse: null }
      );
    }

    warehouse.warehouseCode = warehouseCode;
    warehouse.name = name;
    warehouse.branch = branch;
    warehouse.status = status || 'Active';
    warehouse.assignedUser = validAssignedUser ? validAssignedUser._id : null;
    warehouse.hasAssignedUserHistory = warehouse.hasAssignedUserHistory || !!validAssignedUser;

    const updated = await warehouse.save();

    if (validAssignedUser) {
      await User.findByIdAndUpdate(
        assignedUser,
        { assignedWarehouse: warehouse._id }
      );
    }

    res.json({ message: 'Warehouse updated successfully', warehouse: updated });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating warehouse',
      error: error.message
    });
  }
});

// Delete Warehouse
router.delete('/warehouses/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Deleting warehouse:', req.params.id);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete warehouses' });
    }
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }
    if (warehouse.hasAssignedUserHistory) {
      return res.status(400).json({ message: 'Cannot delete warehouse with user assignment history' });
    }
    const lotsUsingWarehouse = await Lot.countDocuments({ warehouse: warehouse.name });
    if (lotsUsingWarehouse > 0) {
      return res.status(400).json({ message: 'Cannot delete warehouse in use by lots' });
    }
    if (warehouse.assignedUser) {
      await User.findByIdAndUpdate(
        warehouse.assignedUser,
        { assignedWarehouse: null }
      );
    }
    await Warehouse.findByIdAndDelete(req.params.id);
    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ message: 'Error deleting warehouse', error: error.message });
  }
});

// Get all warehouses
router.get('/warehouses', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching warehouses for user:', req.user);
    const warehouses = await Warehouse.find().populate('assignedUser', 'username lastName');
    res.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ message: 'Error fetching warehouses', error: error.message });
  }
});

// Create Category
router.post('/categories', authMiddleware, async (req, res) => {
  try {
    console.log('Creating category:', req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create categories' });
    }
    const categorySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    });
    const data = categorySchema.parse(req.body);
    const { name, description } = data;

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = await Category.create({ name, description });
    res.json({ message: 'Category created successfully', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating category',
      error: error.message
    });
  }
});

// Update Category
router.put('/categories/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Updating category:', req.params.id, req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update categories' });
    }
    const categorySchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    });
    const data = categorySchema.parse(req.body);
    const { name, description } = data;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const existingCategory = await Category.findOne({ name, _id: { $ne: category._id } });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category name already exists' });
    }

    category.name = name;
    category.description = description;
    const updated = await category.save();
    res.json({ message: 'Category updated successfully', category: updated });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating category',
      error: error.message
    });
  }
});

// Delete Category
router.delete('/categories/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Deleting category:', req.params.id);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete categories' });
    }
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    const productsUsingCategory = await Product.countDocuments({ category: category._id });
    if (productsUsingCategory > 0) {
      return res.status(400).json({ message: 'Cannot delete category in use by products' });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category', error: error.message });
  }
});

// Get all categories
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching categories for user:', req.user);
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories', error: error.message });
  }
});

// Update Lot Status
router.post('/lots/status', authMiddleware, async (req, res) => {
  try {
    console.log('Updating lot status:', req.body);
    const statusSchema = z.object({
      lotId: z.string().min(1),
      status: z.enum(['active', 'damaged', 'expired']),
    });
    const data = statusSchema.parse(req.body);
    const { lotId, status } = data;

    const lot = await Lot.findById(lotId);
    if (!lot) {
      return res.status(404).json({ message: 'Lot not found' });
    }
    if (req.user.role !== 'admin' && lot.warehouse !== req.user.warehouse) {
      return res.status(403).json({ message: 'Unauthorized to update this lot' });
    }

    lot.status = status;
    await lot.save();

    res.json({ message: 'Lot status updated successfully', lot });
  } catch (error) {
    console.error('Error updating lot status:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating lot status',
      error: error.message
    });
  }
});

// Split Lot Status
router.post('/lots/split-status', authMiddleware, async (req, res) => {
  try {
    console.log('Splitting lot status:', req.body);
    const splitSchema = z.object({
      lotId: z.string().min(1),
      status: z.enum(['active', 'damaged', 'expired']),
      quantity: z.number().positive(),
    });
    const data = splitSchema.parse(req.body);
    const { lotId, status, quantity } = data;

    const lot = await Lot.findById(lotId);
    if (!lot) {
      return res.status(404).json({ message: 'Lot not found' });
    }
    if (req.user.role !== 'admin' && lot.warehouse !== req.user.warehouse) {
      return res.status(403).json({ message: 'Unauthorized to update this lot' });
    }
    if (lot.qtyOnHand < quantity) {
      return res.status(400).json({ message: 'Insufficient quantity in lot' });
    }

    lot.qtyOnHand -= quantity;
    await lot.save();

    const newLot = await Lot.create({
      lotCode: `${lot.lotCode}-split-${Date.now()}`,
      productId: lot.productId,
      expDate: lot.expDate,
      qtyOnHand: quantity,
      warehouse: lot.warehouse,
      status,
    });

    res.json({ message: 'Lot split and status updated successfully', newLot });
  } catch (error) {
    console.error('Error splitting lot status:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error splitting lot status',
      error: error.message
    });
  }
});

// Validation Schemas
const supplierSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
});

// Create Supplier
router.post('/suppliers', authMiddleware, async (req, res) => {
  try {
    console.log('Creating supplier:', req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create suppliers' });
    }
    const data = supplierSchema.parse(req.body);
    const { name, address, phone } = data;

    const existingSupplier = await Supplier.findOne({ name });
    if (existingSupplier) {
      return res.status(400).json({ message: 'Supplier name already exists' });
    }

    const supplier = await Supplier.create({ name, address, phone });
    res.json({ message: 'Supplier created successfully', supplier });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error creating supplier',
      error: error.message
    });
  }
});

// Update Supplier
router.put('/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Updating supplier:', req.params.id, req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update suppliers' });
    }
    const data = supplierSchema.parse(req.body);
    const { name, address, phone } = data;

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const existingSupplier = await Supplier.findOne({ name, _id: { $ne: supplier._id } });
    if (existingSupplier) {
      return res.status(400).json({ message: 'Supplier name already exists' });
    }

    supplier.name = name;
    supplier.address = address;
    supplier.phone = phone;
    const updated = await supplier.save();
    res.json({ message: 'Supplier updated successfully', supplier: updated });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating supplier',
      error: error.message
    });
  }
});

// Delete Supplier
router.delete('/suppliers/:id', authMiddleware, async (req, res) => {
  try {
    console.log('Deleting supplier:', req.params.id);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete suppliers' });
    }
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    await Supplier.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ message: 'Error deleting supplier', error: error.message });
  }
});

// Get all suppliers
router.get('/suppliers', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching suppliers for user:', req.user);
    const suppliers = await Supplier.find();
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ message: 'Error fetching suppliers', error: error.message });
  }
});





// Receive Stock
router.post('/receive', authMiddleware, async (req, res) => {
  const session = await Lot.startSession();
  try {
    logger.info('Starting /api/receive request', { user: req.user, body: req.body });

    if (!req.user || !req.user._id) {
      throw new Error('User authentication data missing');
    }

    const { lots } = receiveSchema.parse(req.body);

    session.startTransaction();

    // บันทึก UserTransaction
    logger.info('Attempting to save UserTransaction');
    const userTransaction = new UserTransaction({
      userId: req.user._id,
      action: 'receive_stock',
      description: `User ${req.user.username} received stock for ${lots.length} lots`,
      ipAddress: req.ip,
      details: { lotCount: lots.length }
    });
    await userTransaction.save({ session });
    logger.info('UserTransaction saved successfully', { userTransactionId: userTransaction._id });

    let lastTransaction;
    for (const lot of lots) {
      logger.info('Processing lot', { lotCode: lot.lotCode, quantity: lot.quantity });

      const existingLot = await Lot.findOne({ lotCode: lot.lotCode, warehouse: lot.warehouse }).session(session);
      if (!existingLot) {
        logger.warn('No existing lot found, creating new lot', { lotCode: lot.lotCode });
      }

      const warehouseDoc = await Warehouse.findOne({ name: lot.warehouse }).session(session);
      if (!warehouseDoc) {
        throw new Error(`Warehouse ${lot.warehouse} not found`);
      }
      const transactionCounter = await TransactionCounter.findOneAndUpdate(
        { warehouseCode: warehouseDoc.warehouseCode },
        { $inc: { sequence: 1 } },
        { new: true, upsert: true, session }
      );

      const transactionNumber = `${warehouseDoc.warehouseCode}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(transactionCounter.sequence).padStart(3, '0')}`;

      let updatedLot;
      if (existingLot) {
        // อัปเดต Lot เดิมถ้ามีอยู่
        existingLot.quantity = Number(existingLot.quantity) + Number(lot.quantity);
        existingLot.boxCount = Number(existingLot.boxCount) + Number(lot.boxCount);
        existingLot.qtyOnHand = Number(existingLot.qtyOnHand) + Number(lot.quantity);
        existingLot.damaged = existingLot.damaged || 0; // รักษาค่า damaged เดิม
        await existingLot.save({ session });
        updatedLot = existingLot;
        logger.info(`Updated existing lot ${lot.lotCode} with new quantity: ${existingLot.quantity}`);
      } else {
        // สร้าง Lot ใหม่ถ้าไม่มี
        const newLot = new Lot({
          productId: lot.productId,
          lotCode: lot.lotCode,
          productionDate: new Date(lot.productionDate),
          expDate: new Date(lot.expDate),
          quantity: lot.quantity,
          boxCount: lot.boxCount,
          qtyPerBox: lot.qtyPerBox,
          warehouse: lot.warehouse,
          supplierId: lot.supplierId,
          transactionNumber,
          status: 'active',
          qtyOnHand: lot.quantity,
          damaged: 0 // ตั้งค่าเริ่มต้นเป็น 0
        });
        await newLot.save({ session });
        updatedLot = newLot;
        logger.info('Successfully processed new lot', { lotCode: lot.lotCode, transactionNumber });
      }

      // สร้าง StockTransaction ใหม่ทุกครั้ง
      const transaction = new StockTransaction({
        transactionNumber,
        userId: req.user._id,
        supplierId: lot.supplierId,
        lotId: updatedLot._id,
        productId: lot.productId,
        quantity: lot.quantity, // บันทึกจำนวนที่รับใหม่
        boxCount: lot.boxCount,
        qtyPerBox: lot.qtyPerBox,
        productionDate: lot.productionDate,
        expDate: lot.expDate,
        warehouse: lot.warehouse,
        type: 'receive',
        auditTrail: userTransaction._id
      });
      await transaction.save({ session });
      lastTransaction = transaction;
    }

    const notification = new Notification({
      userId: req.user._id,
      message: `Successfully received ${lots.length} lots of stock.`,
      type: 'success',
      relatedTransaction: lastTransaction._id
    });
    await notification.save({ session });

    await session.commitTransaction();
    logger.info('Transaction committed successfully');
    res.status(201).json({ message: 'Stock received successfully' });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Transaction failed', { error: error.message, stack: error.stack, body: req.body }); // เพิ่ม body ใน log
    res.status(400).json({ message: error.message || 'Validation or processing error occurred' });
  } finally {
    session.endSession();
  }
});










//Notifications
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).populate('relatedTransaction', 'transactionNumber');
    res.json(notifications);
  } catch (error) {
    logger.error('Error fetching notifications', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

router.put('/notifications/:id', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    logger.error('Error updating notification', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error updating notification' });
  }
});

// Receive History
router.get('/receive-history', authMiddleware, async (req, res) => {
  try {
    let {
      startDate, endDate,
      warehouse, searchQuery, userQuery,
      page = '1', limit = '25'
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    const skip = (page - 1) * limit;

    const query = {};

    if (startDate && endDate) {
      const parsedStart = parse(startDate, 'dd-MM-yyyy', new Date());
      const parsedEnd = parse(endDate, 'dd-MM-yyyy', new Date());

      query.createdAt = {
        $gte: startOfDay(parsedStart),
        $lte: endOfDay(parsedEnd),
      };
    } else {
      const today = new Date();
      query.createdAt = {
        $gte: startOfDay(today),
        $lte: endOfDay(today),
      };
    }

    if (warehouse && warehouse !== 'all') {
      query.warehouse = warehouse;
    }

    if (searchQuery) {
      query.$or = [
        { 'lotId.lotCode': { $regex: searchQuery, $options: 'i' } },
        { 'productId.name': { $regex: searchQuery, $options: 'i' } },
        { 'productId.productCode': { $regex: searchQuery, $options: 'i' } },
      ];
    }

    if (userQuery) {
      query['userId.username'] = { $regex: userQuery, $options: 'i' };
    }

    const [transactions, total] = await Promise.all([
      StockTransaction.find(query)
        .populate('userId', 'username')
        .populate('supplierId', 'name')
        .populate('productId', 'name productCode')
        .populate('lotId', 'lotCode productionDate expDate')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      StockTransaction.countDocuments(query),
    ]);

    if (transactions.length === 0) {
      return res.json({ data: [], total: 0, page, pages: 0 });
    }

    res.json({
      data: transactions,
      total,
      page,
      pages: Math.ceil(total / limit),
    });

  } catch (error) {
    logger.error('Error fetching receive history', {
      message: error.message,
      stack: error.stack,
      query: req.query,
    });
    res.status(500).json({
      message: 'Error fetching receive history',
      error: error.message,
    });
  }
});

// Receive History Export Excel
router.get('/receive-history/export', authMiddleware, async (req, res) => {
  try {
    logger.info('Exporting receive history', { user: req.user, query: req.query });
    const { startDate, endDate, warehouse, searchQuery, userQuery } = req.query;

    const query = {
      type: 'receive',
    };

    if (startDate && endDate) {
      const parsedStart = parse(startDate, 'dd-MM-yyyy', new Date());
      const parsedEnd = parse(endDate, 'dd-MM-yyyy', new Date());
      query.createdAt = {
        $gte: startOfDay(parsedStart),
        $lte: endOfDay(parsedEnd),
      };
    } else {
      const today = new Date();
      query.createdAt = {
        $gte: startOfDay(today),
        $lte: endOfDay(today),
      };
    }

    if (req.user.role !== 'admin' && req.user.warehouse) {
      query.warehouse = req.user.warehouse;
    } else if (warehouse && warehouse !== 'all') {
      query.warehouse = warehouse;
    }

    if (searchQuery) {
      query.$or = [
        { transactionNumber: { $regex: searchQuery, $options: 'i' } },
        { 'lotId.lotCode': { $regex: searchQuery, $options: 'i' } },
        { 'productId.name': { $regex: searchQuery, $options: 'i' } },
        { 'productId.productCode': { $regex: searchQuery, $options: 'i' } },
        { 'supplierId.name': { $regex: searchQuery, $options: 'i' } },
      ];
    }

    if (userQuery) {
      query['userId.username'] = { $regex: userQuery, $options: 'i' };
    }

    console.log('Export query:', query); // ดีบั๊ก query
    const transactions = await StockTransaction.find(query)
      .populate('userId', 'username lastName')
      .populate('supplierId', 'name')
      .populate('productId', 'name productCode')
      .populate('lotId', 'lotCode productionDate expDate')
      .lean();

    if (!transactions || transactions.length === 0) {
      logger.warn('No transactions found for export', { query });
      return res.status(400).json({ message: 'No data available for export' });
    }

    const worksheetData = transactions.map(trans => ({
      'Transaction #': trans.transactionNumber || 'N/A',
      'Date/Time': trans.createdAt ? format(new Date(trans.createdAt), 'dd-MM-yyyy HH:mm') : 'N/A',
      'User': `${trans.userId?.username || ''} ${trans.userId?.lastName || ''}`.trim() || 'N/A',
      'Supplier': trans.supplierId?.name || 'N/A',
      'Product Code': trans.productId?.productCode || 'N/A',
      'Product': trans.productId?.name || 'N/A',
      'Lot Code': trans.lotId?.lotCode || 'N/A',
      'Qty': trans.quantity || 0,
      'Warehouse': trans.warehouse || 'N/A',
      'Status': trans.status || 'N/A',
      'Production Date': trans.lotId?.productionDate ? format(new Date(trans.lotId.productionDate), 'dd-MM-yyyy') : 'N/A',
      'Expiration Date': trans.lotId?.expDate ? format(new Date(trans.lotId.expDate), 'dd-MM-yyyy') : 'N/A',
    }));

    if (worksheetData.length === 0) {
      logger.warn('Worksheet data is empty after mapping', { query });
      return res.status(400).json({ message: 'No data available for export after processing' });
    }

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receive History');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename=receive-history.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
  } catch (error) {
    logger.error('Error exporting receive history', { error: error.message, stack: error.stack, query: req.query });
    res.status(500).json({ message: 'Error exporting receive history', error: error.message });
  }
});




// Lot Management - Fetch Lots
router.get('/lot-management', authMiddleware, async (req, res) => {
  try {
    logger.info('Fetching lot management data', { user: req.user, query: req.query });

    const { searchQuery, warehouse, page = 1, limit = 25 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (warehouse && warehouse !== 'all') query.warehouse = warehouse;
    if (searchQuery) {
      query.$or = [
        { lotCode: { $regex: searchQuery, $options: 'i' } },
        { 'productId.productCode': { $regex: searchQuery, $options: 'i' } },
        { 'productId.name': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    const lots = await Lot.find(query)
      .populate('productId', 'productCode name') // ใช้ productId ถ้า schema ใช้ reference นี้
      .skip(skip)
      .limit(Number(limit))
      .sort({ lotCode: 1 });

    const total = await Lot.countDocuments(query);

    // ตรวจสอบและเพิ่ม expanded และ availableQty
    const enrichedLots = lots.map(lot => {
      if (!lot.productId) {
        console.warn('Lot without productId:', lot._id);
      } else {
        console.log('Lot product data:', lot.productId); // ดีบั๊กข้อมูล product
      }
      return {
        ...lot.toObject(),
        availableQty: lot.quantity - (lot.damaged || 0),
        expanded: true // ตั้งค่าเริ่มต้นเป็น true
      };
    });

    res.json({
      data: enrichedLots,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error fetching lot management data', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching lot management data', error: error.message });
  }
});





// Lot Management - Update Lot
router.put('/lot-management/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, damaged, productionDate, expDate } = req.body;
    if (!req.user.role === 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const lot = await Lot.findById(id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });

    if (quantity !== undefined) lot.quantity = Number(quantity);
    if (damaged !== undefined) lot.damaged = Number(damaged) >= 0 ? Number(damaged) : 0;
    if (productionDate) lot.productionDate = new Date(productionDate);
    if (expDate) lot.expDate = new Date(expDate);

    await lot.save();
    logger.info('Lot updated successfully', { lotId: id });
    res.json({ message: 'Lot updated successfully' });
  } catch (error) {
    logger.error('Error updating lot', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error updating lot', error: error.message });
  }
});


// Lot Management - Delete Lot
router.delete('/lot-management/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.user.role === 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const lot = await Lot.findByIdAndDelete(id);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });

    logger.info('Lot deleted successfully', { lotId: id });
    res.json({ message: 'Lot deleted successfully' });
  } catch (error) {
    logger.error('Error deleting lot', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error deleting lot', error: error.message });
  }
});


// Lot Management - Export to Excel
router.get('/lot-management/export', authMiddleware, async (req, res) => {
  try {
    logger.info('Exporting lot management data', { user: req.user, query: req.query });

    const { searchQuery, warehouse } = req.query;

    const query = {};
    if (warehouse && warehouse !== 'all') query.warehouse = warehouse;
    if (searchQuery) {
      query.$or = [
        { lotCode: { $regex: searchQuery, $options: 'i' } },
        { 'productId.productCode': { $regex: searchQuery, $options: 'i' } },
        { 'productId.name': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    const lots = await Lot.find(query)
      .populate('productId', 'productCode name')
      .lean();

    // ดีบั๊กข้อมูลที่ดึงมา
    logger.info('Fetched lots for export:', lots);

    const worksheetData = lots.map(lot => {
      if (!lot.productId) {
        logger.warn('Lot without productId:', lot._id);
        return {
          'Lot Code': lot.lotCode || 'N/A',
          'Code Product': 'N/A',
          'Product Name': 'Unknown',
          'Warehouse': lot.warehouse || 'N/A',
          'Production Date': lot.productionDate ? format(new Date(lot.productionDate), 'dd-MM-yyyy') : 'N/A',
          'Expiration Date': lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A',
          'Total Qty': lot.quantity || 0,
          'Damaged': lot.damaged || 0,
          'Available Qty': (lot.quantity || 0) - (lot.damaged || 0)
        };
      }
      return {
        'Lot Code': lot.lotCode || 'N/A',
        'Code Product': lot.productId.productCode || 'N/A',
        'Product Name': lot.productId.name || 'N/A',
        'Warehouse': lot.warehouse || 'N/A',
        'Production Date': lot.productionDate ? format(new Date(lot.productionDate), 'dd-MM-yyyy') : 'N/A',
        'Expiration Date': lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A',
        'Total Qty': lot.quantity || 0,
        'Damaged': lot.damaged || 0,
        'Available Qty': (lot.quantity || 0) - (lot.damaged || 0)
      };
    });

    // ตรวจสอบ worksheetData ก่อนสร้างไฟล์
    if (worksheetData.length === 0) {
      logger.warn('No data to export');
      return res.status(400).json({ message: 'No data available for export' });
    }

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lot Management');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', 'attachment; filename=lot-management.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
  } catch (error) {
    logger.error('Error exporting lot management data', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error exporting lot management data', error: error.message });
  }
});

module.exports = router;