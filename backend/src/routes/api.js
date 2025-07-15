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
const { format, parse, startOfDay, endOfDay, differenceInDays } = require('date-fns');
const DamagedAuditTrail = require('../models/DamagedAuditTrail');
const Setting = require('../models/Settings');
const { updateUserSchema } = require('../models/User');
const IssueTransaction = require('../models/IssueTransaction');
const Counter = require('../models/Counter');
const TransferTransaction = require('../models/TransferTransaction');
const { v4: uuidv4 } = require('uuid');


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
      warehouse: z.string().min(1), // รับ _id
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
  assignedUsers: z.array(z.string()).optional(), // เปลี่ยนเป็น Array
});

const userSchema = z.object({
  username: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']),
  warehouse: z.string().optional(), // เปลี่ยนจาก assignedWarehouse
  permissions: z.array(
    z.object({
      feature: z.enum(['lotManagement', 'manageDamage', 'category', 'products']),
      permissions: z.array(z.enum(['Show', 'Edit', 'Cancel'])).optional()
    })
  ).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  if (data.role === 'user' && !data.warehouse) { // เปลี่ยนจาก assignedWarehouse
    return false;
  }
  return true;
}, {
  message: 'User role must have a warehouse',
  path: ['warehouse'],
});

const lotSchema = z.object({
  lotCode: z.string().min(1),
  productId: z.string().min(1),
  productionDate: z.string().datetime(),
  expDate: z.string().datetime(),
  quantity: z.number().positive(),
  boxCount: z.number().positive(),
  qtyPerBox: z.number().positive(),
  qtyOnHand: z.number().positive(),
  warehouse: z.string().min(1), // รับ _id
  supplierId: z.string().min(1),
});

const supplierSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
});

// Login Endpoint
router.post('/login', async (req, res) => {
  try {
    logger.info('Login attempt:', req.body.username);
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      logger.warn('User not found:', { username });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      logger.warn('Invalid password for user:', { username });
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      logger.warn('User is disabled:', { username });
      return res.status(403).json({ message: 'User is disabled' });
    }

    // ตั้งค่าเริ่มต้น warehouse เป็น PNH-WH-01 ถ้าไม่มี
    if (!user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      const defaultWarehouse = await Warehouse.findOne({ warehouseCode: 'PNH-WH-01' });
      if (defaultWarehouse) {
        await User.findByIdAndUpdate(user._id, { warehouse: defaultWarehouse._id }, { runValidators: true }); // เปลี่ยนจาก assignedWarehouse
        user.warehouse = defaultWarehouse._id;
        logger.info('Assigned default warehouse PNH-WH-01 to user:', { username, userId: user._id });
      } else {
        logger.error('Default warehouse PNH-WH-01 not found');
        return res.status(500).json({ message: 'Default warehouse not found' });
      }
    }

    // ดึงข้อมูล warehouse ด้วย ObjectId
    const warehouseDoc = await Warehouse.findById(user.warehouse); // เปลี่ยนจาก assignedWarehouse
    if (!warehouseDoc) {
      logger.warn('Warehouse not found:', { warehouseId: user.warehouse });
      return res.status(400).json({ message: 'Warehouse not found' });
    }

    // สร้าง token พร้อมข้อมูลครบถ้วน
    const token = jwt.sign({
      id: user._id,
      role: user.role,
      username: user.username,
      lastName: user.lastName || '',
      warehouseCode: warehouseDoc.warehouseCode || '',
      warehouseName: warehouseDoc.name || '',
      branch: warehouseDoc.branch || '',
      warehouse: user.warehouse.toString(), // เปลี่ยนจาก assignedWarehouse
      permissions: user.permissions || [],
      isActive: user.isActive,
    }, process.env.JWT_SECRET, { expiresIn: '1h' });

    logger.info('Login successful:', { username, userId: user._id, token });
    res.json({ token });
  } catch (error) {
    logger.error('Error during login:', { error: error.message, stack: error.stack, details: req.body });
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
});

// Create User
router.post('/users', authMiddleware, async (req, res) => {
  try {
    console.log('Creating user:', req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create users' });
    }
    const data = userSchema.parse(req.body);
    const { username, lastName, password, role, warehouse, permissions, isActive } = data; // เปลี่ยนจาก assignedWarehouse

    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      lastName,
      password: hashedPassword,
      role,
      warehouse: warehouse || (await Warehouse.findOne({ warehouseCode: 'PNH-WH-01' })?._id), // เปลี่ยนจาก assignedWarehouse
      permissions,
      isActive: isActive !== undefined ? isActive : true,
    });

    // อัปเดต Warehouse ถ้ามี warehouse
    if (user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      await Warehouse.updateOne(
        { _id: user.warehouse },
        { $addToSet: { assignedUsers: user._id }, $set: { hasAssignedUserHistory: true } }
      );
    }

    res.status(201).json({ message: 'User created successfully', user });
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
    console.log('Updating user:', req.params.id, req.body);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update users' });
    }
    const data = updateUserSchema.parse(req.body);
    const { username, lastName, password, role, warehouse, permissions, isActive } = data;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const exists = await User.findOne({ username, _id: { $ne: user._id } });
    if (exists) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    user.username = username || user.username;
    user.lastName = lastName || user.lastName;
    user.role = role || user.role;
    user.permissions = permissions || user.permissions;
    user.isActive = isActive !== undefined ? isActive : user.isActive;

    // อัปเดต warehouse
    if (warehouse !== undefined) {
      if (warehouse && warehouse !== 'None' && warehouse !== user.warehouse) { // เพิ่มการตรวจสอบ "None"
        // ตรวจสอบว่า warehouse เป็น ObjectId ที่ถูกต้อง
        if (!mongoose.Types.ObjectId.isValid(warehouse)) {
          return res.status(400).json({ message: 'Invalid warehouse ID' });
        }
        // ลบ User ออกจาก Warehouse เดิม
        if (user.warehouse) {
          await Warehouse.updateOne(
            { _id: user.warehouse },
            { $pull: { assignedUsers: user._id } }
          );
        }
        // เพิ่ม User ไปยัง Warehouse ใหม่
        await Warehouse.updateOne(
          { _id: warehouse },
          { $addToSet: { assignedUsers: user._id }, $set: { hasAssignedUserHistory: true } }
        );
        user.warehouse = warehouse;
      } else if (warehouse === null || warehouse === '' || warehouse === 'None') {
        // ตั้งค่า warehouse เป็น null ถ้าถูกลบหรือเป็น "None"
        if (user.warehouse) {
          await Warehouse.updateOne(
            { _id: user.warehouse },
            { $pull: { assignedUsers: user._id } }
          );
        }
        user.warehouse = null;
      }
    }

    await user.save();

    res.json({ message: 'User updated successfully', user });
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

    // ตรวจสอบว่า User ยังอยู่ใน assignedUsers ของ Warehouse
    if (user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      const warehouse = await Warehouse.findById(user.warehouse); // เปลี่ยนจาก assignedWarehouse
      if (warehouse && warehouse.assignedUsers.includes(user._id)) {
        return res.status(400).json({ message: 'Cannot delete user. Please remove from Warehouse Management first.' });
      }
    }

    // ลบ User
    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      message: 'Error deleting user',
      error: error.message
    });
  }
});

// Get all users
router.get('/users', authMiddleware, async (req, res) => {
  try {
    logger.info('Fetching users for:', req.user);
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view users' });
    }
    const users = await User.find().select('-password');
    res.json(users); // ส่งข้อมูลดิบของ users โดยไม่เพิ่ม warehouseMap
  } catch (error) {
    logger.error('Error fetching users:', { error: error.message, stack: error.stack });
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
    const { lotCode, productId, expDate, qtyOnHand, warehouse } = data; // เปลี่ยนจาก assignedWarehouse

    const existingLot = await Lot.findOne({ lotCode });
    if (existingLot) {
      return res.status(400).json({ message: 'Lot code already exists' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ message: 'Invalid product' });
    }

    const warehouseDoc = await Warehouse.findById(warehouse); // เปลี่ยนจาก name
    if (!warehouseDoc) {
      return res.status(400).json({ message: 'Invalid warehouse' });
    }

    const lot = await Lot.create({
      lotCode,
      productId,
      expDate: new Date(expDate),
      qtyOnHand,
      warehouse, // ใช้ _id
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
    const { productId, warehouse } = req.query;
    const user = req.user;
    const query = {};
    if (productId) {
      query.productId = mongoose.Types.ObjectId.isValid(productId) ? new mongoose.Types.ObjectId(productId) : productId;
    }
    if (warehouse) {
      query.warehouse = new mongoose.Types.ObjectId(warehouse); // ใช้ _id แทน name
    } else if (user.role !== 'admin' && user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      query.warehouse = new mongoose.Types.ObjectId(user.warehouse);
    }
    console.log('Lot query:', query);
    const lots = await Lot.find(query).populate('productId');
    console.log('Lots found:', lots.length);
    res.json(lots);
  } catch (error) {
    logger.error('Error fetching lots:', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching lots', error: error.message });
  }
});

// Get all products (ปรับให้ใช้ Lot เพื่อกรองตาม Warehouse)
router.get('/products', authMiddleware, async (req, res) => {
  try {
    console.log('Fetching products for user:', req.user);
    const { warehouse } = req.query;
    let products;
    if (warehouse && warehouse !== 'all') {
      // ใช้ new mongoose.Types.ObjectId เพื่อแปลง warehouse เป็น ObjectId
      const warehouseId = new mongoose.Types.ObjectId(warehouse);
      const lots = await Lot.find({ warehouse: warehouseId }).select('productId').lean();
      const productIds = [...new Set(lots.map(l => l.productId?.toString()).filter(Boolean))];
      if (productIds.length === 0) {
        return res.status(200).json([]); // ไม่มี Product ใน Warehouse นี้
      }
      products = await Product.find({ _id: { $in: productIds } }).populate('category', 'name description').lean();

      // Admin สามารถดู Product ทั้งหมดได้ 
      // } else if (req.user.role !== 'admin' && req.user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      //   const warehouseId = new mongoose.Types.ObjectId(req.user.warehouse);
      //   const lots = await Lot.find({ warehouse: warehouseId }).select('productId').lean();
      //   const productIds = [...new Set(lots.map(l => l.productId?.toString()).filter(Boolean))];
      //   if (productIds.length === 0) {
      //     return res.status(200).json([]); // ไม่มี Product ใน Warehouse นี้
      //   }
      //   products = await Product.find({ _id: { $in: productIds } }).populate('category', 'name description').lean();


    } else {
      products = await Product.find().populate('category', 'name description').lean();
    }
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


    // ตรวจสอบว่า category ถูกต้อง
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: 'Invalid category' });
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
    const { warehouseCode, name, branch, status, assignedUsers } = data;

    const exists = await Warehouse.findOne({ warehouseCode });
    if (exists) {
      return res.status(400).json({ message: 'Warehouse code already exists' });
    }

    let validAssignedUsers = [];
    if (assignedUsers && assignedUsers.length > 0) {
      for (const userId of assignedUsers) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({ message: `Invalid assigned user ID format: ${userId}` });
        }
        const user = await User.findById(userId);
        if (!user) {
          return res.status(400).json({ message: `Invalid assigned user: ${userId}` });
        }
        validAssignedUsers.push(user._id);
      }
    }

    const warehouse = await Warehouse.create({
      warehouseCode,
      name,
      branch,
      status: status || 'Active',
      assignedUsers: validAssignedUsers,
      hasAssignedUserHistory: validAssignedUsers.length > 0,
    });

    // อัปเดต warehouse ให้ User
    if (validAssignedUsers.length > 0) { // เปลี่ยนจาก assignedWarehouse
      await User.updateMany(
        { _id: { $in: validAssignedUsers } },
        { $set: { warehouse: warehouse._id } }, // เปลี่ยนจาก assignedWarehouse
        { runValidators: true }
      );
    }

    res.status(201).json({ message: 'Warehouse created successfully', warehouse });
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
    const { warehouseCode, name, branch, status, assignedUsers } = data;

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

    let validAssignedUsers = [];
    if (assignedUsers && assignedUsers.length > 0) {
      for (const userId of assignedUsers) {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({ message: `Invalid assigned user ID format: ${userId}` });
        }
        const user = await User.findById(userId);
        if (!user) {
          console.warn(`User ${userId} not found, skipping...`);
          continue;
        }
        validAssignedUsers.push(user._id);
      }
    }

    // อัปเดต warehouse ของ User เดิม
    if (warehouse.assignedUsers && warehouse.assignedUsers.length > 0) {
      const usersToRemove = warehouse.assignedUsers.filter(userId => !validAssignedUsers.includes(userId));
      if (usersToRemove.length > 0) {
        await User.updateMany(
          { _id: { $in: usersToRemove }, warehouse: warehouse._id },
          { $set: { warehouse: null } }, // ตั้งค่า warehouse เป็น null สำหรับ User ที่ถูกลบ
          { runValidators: false } // ปิด Validation ชั่วคราว
        );
        await Warehouse.updateOne(
          { _id: warehouse._id },
          { $pullAll: { assignedUsers: usersToRemove } }
        );
      }
    }

    // อัปเดตข้อมูล Warehouse
    warehouse.warehouseCode = warehouseCode;
    warehouse.name = name;
    warehouse.branch = branch;
    warehouse.status = status || 'Active';
    warehouse.assignedUsers = validAssignedUsers;
    warehouse.hasAssignedUserHistory = validAssignedUsers.length > 0;

    const updated = await warehouse.save();

    // อัปเดต warehouse ให้ User ใหม่
    if (validAssignedUsers.length > 0) {
      await User.updateMany(
        { _id: { $in: validAssignedUsers }, warehouse: { $ne: warehouse._id } },
        { $set: { warehouse: warehouse._id } },
        { runValidators: true }
      );
    }

    res.json({ message: 'Warehouse updated successfully', warehouse: updated });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(error instanceof z.ZodError ? 400 : 500).json({
      message: error instanceof z.ZodError ? 'Invalid input' : 'Error updating warehouse',
      error: error.message,
      stack: error.stack
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

    if (warehouse.assignedUsers.length > 0) {
      return res.status(400).json({ message: 'Cannot delete warehouse with assigned users' });
    }

    await Warehouse.findByIdAndDelete(req.params.id);
    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({
      message: 'Error deleting warehouse',
      error: error.message,
      stack: error.stack
    });
  }
});

// Get all warehouses
router.get('/warehouses', authMiddleware, async (req, res) => {
  try {
    const warehouses = await Warehouse.find();
    res.json(warehouses);
  } catch (error) {
    logger.error('Error fetching warehouses:', { message: error.message, stack: error.stack });
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
    if (req.user.role !== 'admin' && lot.warehouse.toString() !== req.user.warehouse) { // เปลี่ยนจาก assignedWarehouse
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
    if (req.user.role !== 'admin' && lot.warehouse.toString() !== req.user.warehouse) { // เปลี่ยนจาก assignedWarehouse
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
  try {
    const result = receiveSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.errors[0].message });
    }

    const { lots } = result.data;
    const userId = req.user._id;

    const transactions = await Promise.all(lots.map(async (lot) => {
      // ตรวจสอบและแปลง warehouse เป็น _id
      const warehouse = await Warehouse.findOne({ _id: lot.warehouse });
      if (!warehouse) {
        return res.status(400).json({ message: `Warehouse ${lot.warehouse} not found` });
      }
      const warehouseCode = warehouse.warehouseCode;

      // เพิ่ม Transaction Counter ตาม Warehouse
      const transactionCounter = await TransactionCounter.findOneAndUpdate(
        { warehouseCode },
        { $inc: { sequence: 1 } },
        { new: true, upsert: true }
      );
      if (!transactionCounter || transactionCounter.sequence === undefined) {
        throw new Error(`Failed to generate sequence for warehouse ${warehouseCode}`);
      }
      const transactionNumber = `${warehouseCode}-${format(new Date(), 'yyyyMMdd')}-${String(transactionCounter.sequence).padStart(3, '0')}`;

      // ตรวจสอบ Lot เดิม
      let existingLot = await Lot.findOne({ lotCode: lot.lotCode });
      let lotId;
      if (existingLot) {
        existingLot.qtyOnHand += lot.quantity;
        await existingLot.save();
        lotId = existingLot._id;
      } else {
        const newLot = await Lot.create({
          lotCode: lot.lotCode,
          productId: lot.productId,
          productionDate: new Date(lot.productionDate),
          expDate: new Date(lot.expDate),
          quantity: lot.quantity,
          boxCount: lot.boxCount,
          qtyPerBox: lot.qtyPerBox,
          qtyOnHand: lot.quantity,
          warehouse: lot.warehouse, // ใช้ _id
          supplierId: lot.supplierId,
          transactionNumber,
          status: 'active',
        });
        lotId = newLot._id;
      }

      // สร้าง Stock Transaction
      const transaction = new StockTransaction({
        transactionNumber,
        userId,
        supplierId: lot.supplierId,
        lotId,
        productId: lot.productId,
        quantity: lot.quantity,
        boxCount: lot.boxCount,
        qtyPerBox: lot.qtyPerBox,
        productionDate: new Date(lot.productionDate),
        expDate: new Date(lot.expDate),
        warehouse: lot.warehouse, // ใช้ _id
        type: 'receive',
        status: 'completed',
      });
      await transaction.save();

      return transaction;
    }));

    const transactionNumbers = transactions.map(t => t.transactionNumber);
    const summaryTransactionNumber = transactionNumbers[0];

    await UserTransaction.create({
      userId,
      action: 'receive',
      description: `Received stock with transaction number(s) ${transactionNumbers.join(', ')}`,
      details: { transactionNumbers },
      timestamp: new Date(),
    });

    await Notification.create({
      userId,
      message: `Stock received successfully with transaction number(s) ${transactionNumbers.join(', ')}`,
      type: 'success',
      timestamp: new Date(),
    });

    res.json({ message: 'Stock received successfully', transactionNumbers });
  } catch (error) {
    logger.error('Error receiving stock:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: 'Error receiving stock', error: error.message });
  }
});

// Notifications
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

// Receive History Export Excel
router.get('/receive-history/export', authMiddleware, async (req, res) => {
  try {
    logger.info('Exporting receive history', { user: req.user, query: req.query });
    const { startDate, endDate, warehouse, searchQuery, userQuery } = req.query;

    const query = {
      type: 'receive',
    };

    if (startDate && endDate) {
      const parsedStart = parse(startDate, 'dd/MM/yyyy', new Date());
      const parsedEnd = parse(endDate, 'dd/MM/yyyy', new Date());
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

    if (warehouse && warehouse !== '') { // เปลี่ยนจาก 'all' เป็น ''
      const warehouseDoc = await Warehouse.findOne({ _id: warehouse }); // ใช้ _id
      if (warehouseDoc) {
        query.warehouse = warehouseDoc._id;
      } else {
        return res.status(400).json({ message: 'Warehouse not found' });
      }
    } else if (req.user.role !== 'admin' && req.user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      query.warehouse = req.user.warehouse; // ใช้ _id
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
      const user = await User.findOne({ username: { $regex: userQuery, $options: 'i' } });
      if (user) {
        query.userId = user._id;
      } else {
        return res.status(400).json({ message: 'User not found' });
      }
    }

    console.log('Export query:', query);
    const transactions = await StockTransaction.find(query)
      .populate('userId', 'username lastName')
      .populate('supplierId', 'name')
      .populate('productId', 'name productCode')
      .populate('lotId', 'lotCode productionDate expDate')
      .populate('warehouse', 'name') // เพิ่ม populate สำหรับ warehouse
      .lean();

    if (!transactions || transactions.length === 0) {
      logger.warn('No transactions found for export', { query });
      return res.status(400).json({ message: 'No data available for export' });
    }

    const worksheetData = transactions.map(trans => ({
      'Transaction #': trans.transactionNumber || 'N/A',
      'Date/Time': trans.createdAt ? format(new Date(trans.createdAt), 'dd/MM/yyyy HH:mm') : 'N/A',
      'User': `${trans.userId?.username || ''} ${trans.userId?.lastName || ''}`.trim() || 'N/A',
      'Supplier': trans.supplierId?.name || 'N/A',
      'Product Code': trans.productId?.productCode || 'N/A',
      'Product': trans.productId?.name || 'N/A',
      'Lot Code': trans.lotId?.lotCode || 'N/A',
      'Qty': trans.quantity || 0,
      'Warehouse': trans.warehouse?.name || 'N/A',
      'Status': trans.status || 'N/A',
      'Production Date': trans.lotId?.productionDate ? format(new Date(trans.lotId.productionDate), 'dd/MM/yyyy') : 'N/A',
      'Expiration Date': trans.lotId?.expDate ? format(new Date(trans.lotId.expDate), 'dd/MM/yyyy') : 'N/A',
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

    // ถ้ามี searchQuery ให้ใช้ aggregate เพื่อค้นหา productCode หรือ productName
    if (searchQuery) {
      // ใช้ aggregate เพื่อ join กับ product แล้ว match
      const matchStage = {};
      if (warehouse && warehouse !== 'all') matchStage.warehouse = new mongoose.Types.ObjectId(warehouse);
      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'productObj'
          }
        },
        { $unwind: '$productObj' },
        {
          $match: {
            $or: [
              { lotCode: { $regex: searchQuery, $options: 'i' } },
              { 'productObj.productCode': { $regex: searchQuery, $options: 'i' } },
              { 'productObj.name': { $regex: searchQuery, $options: 'i' } }
            ]
          }
        },
        { $sort: { lotCode: 1 } },
        { $skip: Number(skip) },
        { $limit: Number(limit) }
      ];
      const lots = await Lot.aggregate(pipeline);
      // นับจำนวนทั้งหมด (ไม่ใช้ limit/skip)
      const countPipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'productObj'
          }
        },
        { $unwind: '$productObj' },
        {
          $match: {
            $or: [
              { lotCode: { $regex: searchQuery, $options: 'i' } },
              { 'productObj.productCode': { $regex: searchQuery, $options: 'i' } },
              { 'productObj.name': { $regex: searchQuery, $options: 'i' } }
            ]
          }
        },
        { $count: 'total' }
      ];
      const totalResult = await Lot.aggregate(countPipeline);
      const total = totalResult[0]?.total || 0;
      // แปลง productObj -> productId ให้เหมือน populate
      const enrichedLots = lots.map(lot => ({
        ...lot,
        productId: lot.productObj,
        availableQty: lot.quantity - (lot.damaged || 0),
        expanded: true
      }));
      res.json({
        data: enrichedLots,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit)
      });
      return;
    }
    // ...เดิม: ถ้าไม่มี searchQuery ใช้ populate ปกติ...
    const query = {};
    if (warehouse && warehouse !== 'all') query.warehouse = new mongoose.Types.ObjectId(warehouse);
    else if (req.user.role !== 'admin' && req.user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      query.warehouse = new mongoose.Types.ObjectId(req.user.warehouse);
    }
    const lots = await Lot.find(query)
      .populate('productId', 'productCode name')
      .skip(skip)
      .limit(Number(limit))
      .sort({ lotCode: 1 });
    const total = await Lot.countDocuments(query);
    const enrichedLots = lots.map(lot => ({
      ...lot.toObject(),
      availableQty: lot.quantity - (lot.damaged || 0),
      expanded: true
    }));
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
    if (warehouse && warehouse !== 'all') query.warehouse = new mongoose.Types.ObjectId(warehouse); // ใช้ _id
    if (searchQuery) {
      query.$or = [
        { lotCode: { $regex: searchQuery, $options: 'i' } },
        { 'productId.productCode': { $regex: searchQuery, $options: 'i' } },
        { 'productId.name': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    // ดึงข้อมูลล่าสุดจาก MongoDB พร้อม populate warehouse
    const lots = await Lot.find(query)
      .populate('productId', 'productCode name')
      .populate('warehouse', 'name') // เพิ่ม populate สำหรับ warehouse
      .lean();

    // ดีบั๊กข้อมูลที่ดึงมา
    logger.info('Fetched lots for export:', lots);

    const worksheetData = lots.map(lot => {
      if (!lot.productId) {
        logger.warn('Lot without productId:', lot._id);
        const qtyOnHand = lot.qtyOnHand || 0;
        const damaged = lot.damaged || 0;
        const total = qtyOnHand + damaged;
        logger.debug('Calculated values for lot without productId:', { lotId: lot._id, total, damaged, qtyOnHand });
        return {
          'Lot Code': lot.lotCode || 'N/A',
          'Code Product': 'N/A',
          'Product Name': 'Unknown',
          'Warehouse': lot.warehouse?.name || 'N/A', // ใช้ lot.warehouse.name
          'Production Date': lot.productionDate ? format(new Date(lot.productionDate), 'dd-MM-yyyy') : 'N/A',
          'Expiration Date': lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A',
          'Total': total,
          'Damaged': damaged,
          'qtyOnHand': qtyOnHand
        };
      }
      const qtyOnHand = lot.qtyOnHand || 0;
      const damaged = lot.damaged || 0;
      const total = qtyOnHand + damaged;
      logger.debug('Calculated values for lot:', { lotId: lot._id, total, damaged, qtyOnHand });
      return {
        'Lot Code': lot.lotCode || 'N/A',
        'Code Product': lot.productId.productCode || 'N/A',
        'Product Name': lot.productId.name || 'N/A',
        'Warehouse': lot.warehouse?.name || 'N/A', // ใช้ lot.warehouse.name
        'Production Date': lot.productionDate ? format(new Date(lot.productionDate), 'dd-MM-yyyy') : 'N/A',
        'Expiration Date': lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A',
        'Total': total,
        'Damaged': damaged,
        'qtyOnHand': qtyOnHand
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

    if (warehouse && warehouse !== '') { // เปลี่ยนจาก 'all' เป็น ''
      const warehouseDoc = await Warehouse.findOne({ _id: warehouse }); // ใช้ _id
      if (warehouseDoc) {
        query.warehouse = warehouseDoc._id;
      } else {
        return res.status(400).json({ message: 'Warehouse not found' });
      }
    } else if (req.user.role !== 'admin' && req.user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      query.warehouse = req.user.warehouse; // ใช้ _id
    }

    if (searchQuery) {
      query.$or = [
        { transactionNumber: { $regex: searchQuery, $options: 'i' } },
        { 'lotId.lotCode': { $regex: searchQuery, $options: 'i' } },
        { 'productId.name': { $regex: searchQuery, $options: 'i' } },
        { 'productId.productCode': { $regex: searchQuery, $options: 'i' } },
      ];
    }

    if (userQuery) {
      const user = await User.findOne({ username: { $regex: userQuery, $options: 'i' } });
      if (user) {
        query.userId = user._id;
      } else {
        return res.json({ data: [], total: 0, page, pages: 0 });
      }
    }

    console.log('Query:', query); // ดีบั๊ก query
    const [transactions, total] = await Promise.all([
      StockTransaction.find(query)
        .populate({
          path: 'userId',
          select: 'username -_id',
          match: { username: { $exists: true, $ne: null } }
        })
        .populate('supplierId', 'name')
        .populate('productId', 'name productCode')
        .populate('lotId', 'lotCode productionDate expDate')
        .populate('warehouse', 'name') // เพิ่ม populate สำหรับ warehouse
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      StockTransaction.countDocuments(query),
    ]);

    const validTransactions = transactions.filter(trans => trans.userId && trans.userId.username);
    if (transactions.length > validTransactions.length) {
      console.warn('Some transactions have invalid userId data, filtered out:', transactions.length - validTransactions.length);
    }

    const formattedTransactions = validTransactions.map(trans => ({
      ...trans,
      warehouse: trans.warehouse ? trans.warehouse.name : null
    }));

    res.json({
      data: formattedTransactions,
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

// Manage Damage
router.post('/manage-damage', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { lotId, quantity, reason } = req.body;
    const userId = req.user._id;
    const warehouseId = req.user.warehouse ? req.user.warehouse.toString() : null;

    console.log('Received payload:', { lotId, quantity, reason, userId, warehouseId });

    if (!warehouseId && req.user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Warehouse is required for non-admin users' });
    }
    if (req.user.role !== 'admin' && warehouseId) {
      const lot = await Lot.findById(lotId).session(session);
      if (!lot || lot.warehouse.toString() !== warehouseId) {
        await session.abortTransaction();
        return res.status(403).json({ message: 'Access denied to this warehouse' });
      }
    }

    const lot = await Lot.findById(lotId).session(session);
    if (!lot) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Lot not found' });
    }
    const remainingStock = lot.qtyOnHand - lot.damaged;
    logger.info('Checking remaining stock', { lotId, qtyOnHand: lot.qtyOnHand, damaged: lot.damaged, remainingStock });
    if (quantity <= 0 || quantity > remainingStock) {
      await session.abortTransaction();
      return res.status(400).json({ message: `Invalid quantity. Remaining stock: ${remainingStock}` });
    }

    const warehouse = await Warehouse.findById(warehouseId).session(session);
    const counter = await DamagedAuditTrail.countDocuments({ warehouseId: new mongoose.Types.ObjectId(warehouseId) }).session(session);
    const transactionNumber = `DAM-${warehouse.warehouseCode}-${req.user.role}-${String(counter + 1).padStart(5, '0')}`;
    console.log('Generated transactionNumber:', transactionNumber);

    // อัปเดต Lot
    lot.damaged += quantity;
    lot.qtyOnHand -= quantity;
    await lot.save({ session });
    logger.info('Updated lot', { lotId, newQtyOnHand: lot.qtyOnHand, newDamaged: lot.damaged });

    // บันทึกประวัติโดยใช้ Array ตามคำแนะนำของ Mongoose
    await DamagedAuditTrail.create([
      {
        transactionNumber,
        lotId: new mongoose.Types.ObjectId(lotId),
        userId: new mongoose.Types.ObjectId(userId),
        quantity,
        reason,
        warehouseId: new mongoose.Types.ObjectId(warehouseId)
      }
    ], { session });

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Damage recorded successfully', remainingStock: lot.qtyOnHand, transactionNumber });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error managing damage:', {
      message: error.message,
      stack: error.stack,
      details: error.toString()
    });
    res.status(500).json({ message: 'Error managing damage', error: error.message, details: error.toString() });
  }
});

// Endpoint ใหม่สำหรับดึงประวัติ
router.get('/manage-damage/history', authMiddleware, async (req, res) => {
  try {
    const { warehouse, startDate, endDate, user, transaction } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.warehouse) {
      query['lotId.warehouse'] = new mongoose.Types.ObjectId(req.user.warehouse);
    } else if (warehouse && warehouse !== 'all') {
      query['lotId.warehouse'] = new mongoose.Types.ObjectId(warehouse);
    }

    if (startDate && endDate) {
      query.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (user) {
      query['userId.username'] = { $regex: user, $options: 'i' };
    }
    if (transaction) {
      query.transactionNumber = { $regex: transaction, $options: 'i' };
    }

    const history = await DamagedAuditTrail.find(query)
      .populate({
        path: 'lotId',
        populate: [
          { path: 'productId', select: 'name productCode' },
          { path: 'warehouse', select: 'name warehouseCode' }
        ]
      })
      .populate('userId', 'username')
      .lean();

    res.json(history);
  } catch (error) {
    logger.error('Error fetching damage history:', error);
    res.status(500).json({ message: 'Error fetching damage history', error: error.message });
  }
});


// Configurable expiration warning days (default to 15 days)
router.get('/lot-management/expiring', authMiddleware, async (req, res) => {
  try {
    logger.info('Fetching expiring lots', { user: req.user });

    const user = req.user;
    // อนุญาตให้ User เห็นทุกคลัง (เหมือน Admin) หากต้องการ
    const query = {};
    if (req.user.role !== 'admin' && req.user.warehouse) { // เปลี่ยนจาก assignedWarehouse
      query.warehouse = new mongoose.Types.ObjectId(req.user.warehouse);
    }

    const setting = await Setting.findOne();
    const warningDays = setting ? setting.expirationWarningDays : 15;

    const today = new Date();
    const lots = await Lot.find(query)
      .populate('productId', 'productCode name')
      .lean();

    const expiringLots = lots.filter(lot => {
      if (!lot.expDate) return false;
      const expDate = new Date(lot.expDate);
      const daysLeft = differenceInDays(expDate, today);
      return daysLeft <= warningDays && daysLeft > 0;
    });

    logger.info('Expiring lots found:', expiringLots);
    res.json({ expiringLots, warningDays });
  } catch (error) {
    logger.error('Error fetching expiring lots:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching expiring lots', error: error.message });
  }
});

// Get or update settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({ expirationWarningDays: 15, lowStockThreshold: 10 });
    }
    logger.info('Fetched settings', { setting });
    res.json(setting);
  } catch (error) {
    logger.error('Error fetching settings:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
});

router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    const { expirationWarningDays, lowStockThreshold } = req.body;
    if (!expirationWarningDays || !lowStockThreshold || expirationWarningDays <= 0 || lowStockThreshold <= 0) {
      return res.status(400).json({ message: 'Expiration warning days and low stock threshold must be positive numbers' });
    }
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({ expirationWarningDays, lowStockThreshold });
    } else {
      setting.expirationWarningDays = expirationWarningDays;
      setting.lowStockThreshold = lowStockThreshold;
      await setting.save();
    }
    logger.info('Updated settings', { expirationWarningDays, lowStockThreshold });
    res.json({ message: 'Settings updated successfully', setting });
  } catch (error) {
    logger.error('Error updating settings:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error updating settings', error: error.message });
  }
});


// stock-reports
router.get('/stock-reports', authMiddleware, async (req, res) => {
  try {
    logger.info('Fetching stock reports', { user: req.user, query: req.query });

    const { type, warehouse, search } = req.query;
    const user = req.user;
    const query = {};

    // Admin: ดูได้ทุกคลัง, User: ดูได้เฉพาะคลังตัวเองเท่านั้น
    if (user.role !== 'admin') {
      let assignedWarehouse = user.warehouse; // ใช้ user.warehouse
      logger.debug('User warehouse from token:', { assignedWarehouse, type: typeof assignedWarehouse });

      // ตรวจสอบและแปลง assignedWarehouse ให้เป็น _id
      if (!assignedWarehouse) {
        logger.warn('User not assigned to a warehouse', { userId: user._id });
        return res.status(400).json({ message: 'User must be assigned to a warehouse' });
      }
      let warehouseId;
      if (typeof assignedWarehouse === 'object' && assignedWarehouse._id) {
        warehouseId = assignedWarehouse._id.toString();
      } else if (assignedWarehouse instanceof mongoose.Types.ObjectId) {
        warehouseId = assignedWarehouse.toString();
      } else if (typeof assignedWarehouse === 'string') {
        warehouseId = assignedWarehouse;
      } else {
        logger.warn('Invalid warehouse format', { assignedWarehouse });
        return res.status(400).json({ message: 'User assigned warehouse is in an invalid format' });
      }

      const warehouseIdObj = new mongoose.Types.ObjectId(warehouseId);
      const warehouseDoc = await Warehouse.findById(warehouseIdObj);
      if (!warehouseDoc) {
        logger.warn('Assigned warehouse not found', { warehouseId: warehouseId });
        return res.status(400).json({ message: 'Assigned warehouse not found' });
      }
      query.warehouse = warehouseIdObj;
      logger.debug('User warehouse query set', { warehouseId });
    } else if (warehouse && warehouse !== 'all') {
      const warehouseId = new mongoose.Types.ObjectId(warehouse);
      const warehouseDoc = await Warehouse.findById(warehouseId);
      if (!warehouseDoc) {
        logger.warn('Requested warehouse not found', { warehouseId: warehouse });
        return res.status(400).json({ message: 'Warehouse not found' });
      }
      query.warehouse = warehouseId;
    }

    if (search) {
      query.$or = [
        { lotCode: { $regex: search, $options: 'i' } },
        { 'productId.productCode': { $regex: search, $options: 'i' } },
        { 'productId.name': { $regex: search, $options: 'i' } }
      ];
    }

    const setting = await Setting.findOne();
    const warningDays = setting ? setting.expirationWarningDays : 15;
    const lowStockThreshold = setting ? setting.lowStockThreshold : 10;

    const lots = await Lot.find(query)
      .populate('warehouse', 'name')
      .populate('productId', 'productCode name')
      .lean();

    if (lots.length === 0) {
      logger.warn('No lots found for the query', { query });
    }

    let reportData = [];
    const today = new Date();

    switch (type) {
      case 'expiring-soon':
        reportData = lots.filter(lot => {
          if (!lot.expDate) return false;
          const expDate = new Date(lot.expDate);
          const daysLeft = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
          return daysLeft <= warningDays && daysLeft > 0;
        });
        break;
      case 'damaged':
        reportData = lots.filter(lot => (lot.damaged || 0) > 0);
        break;
      case 'low-stock':
        reportData = lots.filter(lot => (lot.qtyOnHand || 0) < lowStockThreshold);
        break;
      case 'all-stock':
      default:
        reportData = lots;
        break;
    }

    // แปลง warehouse object กลับเป็นชื่อสำหรับ response
    reportData = reportData.map(lot => ({
      ...lot,
      warehouse: lot.warehouse ? lot.warehouse.name : null
    }));

    logger.info('Stock report data:', { count: reportData.length, sample: reportData.slice(0, 2) });
    res.json({ data: reportData, warningDays, lowStockThreshold });
  } catch (error) {
    logger.error('Error fetching stock reports:', { error: error.message, stack: error.stack, query: req.query });
    res.status(500).json({ message: 'Error fetching stock reports', error: error.message });
  }
});


// เพิ่ม endpoint สำหรับ Export Stock Reports
router.get('/stock-reports/export', authMiddleware, async (req, res) => {
  try {
    logger.info('Exporting stock reports', { user: req.user, query: req.query });

    const { type, warehouse, search } = req.query;
    const user = req.user;
    const query = user.role === 'admin' ? {} : { warehouse: new mongoose.Types.ObjectId(user.warehouse) }; // เปลี่ยนจาก assignedWarehouse
    if (warehouse && warehouse !== 'all') query.warehouse = new mongoose.Types.ObjectId(warehouse);

    const setting = await Setting.findOne();
    const warningDays = setting ? setting.expirationWarningDays : 15;
    const lowStockThreshold = setting ? setting.lowStockThreshold : 10;

    if (search) {
      query.$or = [
        { lotCode: { $regex: search, $options: 'i' } },
        { 'productId.productCode': { $regex: search, $options: 'i' } },
        { 'productId.name': { $regex: search, $options: 'i' } }
      ];
    }

    const lots = await Lot.find(query)
      .populate('productId', 'productCode name')
      .populate('warehouse', 'name') // Populate warehouse name
      .lean();

    let reportData = [];
    const today = new Date();

    switch (type) {
      case 'expiring-soon':
        reportData = lots.filter(lot => {
          if (!lot.expDate) return false;
          const expDate = new Date(lot.expDate);
          const daysLeft = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
          return daysLeft <= warningDays && daysLeft > 0;
        });
        break;
      case 'damaged':
        reportData = lots.filter(lot => (lot.damaged || 0) > 0);
        break;
      case 'low-stock':
        reportData = lots.filter(lot => (lot.qtyOnHand || 0) < lowStockThreshold);
        break;
      case 'all-stock':
      default:
        reportData = lots;
        break;
    }

    const worksheetData = reportData.map(lot => ({
      'Lot Code': lot.lotCode || 'N/A',
      'Product Name': lot.productId?.name || 'N/A',
      'Warehouse': lot.warehouse?.name || 'N/A', // ใช้ lot.warehouse.name
      'Product Code': lot.productId?.productCode || 'N/A',
      'qtyOnHand': lot.qtyOnHand || 0,
      'Damaged': lot.damaged || 0,
      'Expiration Date': lot.expDate ? format(new Date(lot.expDate), 'dd-MM-yyyy') : 'N/A'
    }));

    if (worksheetData.length === 0) {
      logger.warn('No data to export');
      return res.status(400).json({ message: 'No data available for export' });
    }

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${type || 'all-stock'}-report`);
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename=${type || 'all-stock'}-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
  } catch (error) {
    logger.error('Error exporting stock reports:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error exporting stock reports', error: error.message });
  }
});

// Issue Stock
router.post('/issue', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { lots, type, destinationWarehouseId, note } = req.body;
    const user = req.user;
    const warehouseId = user.role !== 'admin' ? user.warehouse : req.body.warehouse;

    if (!warehouseId || !type || !lots || lots.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Warehouse, type, and lots are required' });
    }

    const warehouse = await Warehouse.findById(warehouseId).session(session);
    if (!warehouse) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Warehouse not found' });
    }

    // Generate Transaction Number with Counter
    let counter = await Counter.findOneAndUpdate(
      { warehouseId: new mongoose.Types.ObjectId(warehouseId) },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, session }
    );
    const transactionNumber = `ISS-${warehouse.warehouseCode}-${String(counter.sequence).padStart(5, '0')}`;
    console.log('Generated transactionNumber:', transactionNumber); // Debug

    // Check for duplicate transactionNumber
    const existingTransaction = await IssueTransaction.findOne({ transactionNumber }).session(session);
    if (existingTransaction) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Duplicate transaction number detected', transactionNumber });
    }

    // Prepare Issue Transaction
    const issueTransaction = new IssueTransaction({
      transactionNumber,
      type,
      warehouseId: new mongoose.Types.ObjectId(warehouseId),
      destinationWarehouseId: destinationWarehouseId ? new mongoose.Types.ObjectId(destinationWarehouseId) : null,
      lots: lots.map(lot => ({
        lotId: new mongoose.Types.ObjectId(lot.lotId),
        quantity: lot.quantity
      })),
      userId: new mongoose.Types.ObjectId(user._id),
      note: note || ''
    });

    // Update Lots
    for (const lot of lots) {
      const dbLot = await Lot.findById(lot.lotId).session(session);
      if (!dbLot) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Lot ${lot.lotId} not found` });
      }

      let quantityToDeduct = lot.quantity;
      let remainingQuantity = quantityToDeduct;

      if (type === 'Waste' && lot.fromDamaged) {
        if (dbLot.damaged >= remainingQuantity) {
          dbLot.damaged -= remainingQuantity;
          remainingQuantity = 0;
        } else {
          remainingQuantity -= dbLot.damaged;
          dbLot.damaged = 0;
          if (dbLot.qtyOnHand >= remainingQuantity) {
            dbLot.qtyOnHand -= remainingQuantity;
            remainingQuantity = 0;
          } else {
            await session.abortTransaction();
            return res.status(400).json({ message: `Insufficient stock for lot ${lot.lotId}` });
          }
        }
      } else {
        if (dbLot.qtyOnHand < quantityToDeduct) {
          await session.abortTransaction();
          return res.status(400).json({ message: `Insufficient stock for lot ${lot.lotId}` });
        }
        dbLot.qtyOnHand -= quantityToDeduct;
      }

      // บันทึก Transaction
      dbLot.transactions.push({
        timestamp: new Date(),
        userId: new mongoose.Types.ObjectId(user._id),
        reason: `Issued (${type})`,
        quantityAdjusted: -lot.quantity,
        beforeQty: dbLot.qtyOnHand + lot.quantity,
        afterQty: dbLot.qtyOnHand,
        transactionType: type === 'Waste' ? 'Waste' : type,
        warehouseId: new mongoose.Types.ObjectId(warehouseId)
      });

      if (destinationWarehouseId) {
        dbLot.transactions.push({
          timestamp: new Date(),
          userId: new mongoose.Types.ObjectId(user._id),
          reason: `Transferred to ${destinationWarehouseId}`,
          quantityAdjusted: -lot.quantity,
          beforeQty: dbLot.qtyOnHand + lot.quantity,
          afterQty: dbLot.qtyOnHand,
          transactionType: 'Transfer',
          warehouseId: new mongoose.Types.ObjectId(warehouseId),
          destinationWarehouseId: new mongoose.Types.ObjectId(destinationWarehouseId)
        });
      }

      await dbLot.save({ session });
    }

    // Save Issue Transaction
    await issueTransaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info('Issue transaction created', { transactionNumber });
    res.json({ message: 'Stock issued successfully', transactionNumber });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error issuing stock:', error);
    res.status(500).json({ message: 'Error issuing stock', error: error.message });
  }
});


// Issue History
router.get('/issue-history', authMiddleware, async (req, res) => {
  try {
    const { type, warehouse, startDate, endDate } = req.query;
    const user = req.user;
    const query = {};

    if (user.role !== 'admin' && user.warehouse) {
      query.warehouseId = new mongoose.Types.ObjectId(user.warehouse);
    } else if (warehouse && warehouse !== 'all') {
      query.warehouseId = new mongoose.Types.ObjectId(warehouse);
    }

    if (type) query.type = type;
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const history = await IssueTransaction.find(query)
      .populate('warehouseId')
      .populate('userId')
      .populate('cancelledBy') // เพิ่มการ Populate cancelledBy
      .lean();
    res.json(history);
  } catch (error) {
    logger.error('Error fetching issue history:', error);
    res.status(500).json({ message: 'Error fetching issue history', error: error.message });
  }
});

// Cancel Issue Transaction
router.patch('/issue-history/:id/cancel', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { cancelledBy, cancelledDate } = req.body;
    const user = req.user;

    console.log('Cancel Request Body:', req.body); // Debug req.body

    if (user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Only admin can cancel transactions' });
    }

    if (!cancelledBy || !cancelledDate) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'cancelledBy and cancelledDate are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(cancelledBy)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid cancelledBy ID' });
    }

    const transaction = await IssueTransaction.findById(id)
      .populate('cancelledBy')
      .session(session);
    if (!transaction || transaction.status === 'Cancelled') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Transaction not found or already cancelled' });
    }

    for (const lot of transaction.lots) {
      const dbLot = await Lot.findById(lot.lotId).session(session);
      if (!dbLot) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Lot ${lot.lotId} not found` });
      }
      dbLot.qtyOnHand += lot.quantity;
      dbLot.transactions.push({
        timestamp: new Date(),
        userId: new mongoose.Types.ObjectId(cancelledBy),
        reason: 'Cancelled Issue',
        quantityAdjusted: lot.quantity,
        beforeQty: dbLot.qtyOnHand - lot.quantity,
        afterQty: dbLot.qtyOnHand,
        transactionType: 'Cancel',
        warehouseId: transaction.warehouseId
      });
      await dbLot.save({ session });
    }

    transaction.status = 'Cancelled';
    transaction.cancelledBy = new mongoose.Types.ObjectId(cancelledBy);
    transaction.cancelledDate = new Date(cancelledDate);
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    const updatedTransaction = await IssueTransaction.findById(id)
      .populate('cancelledBy')
      .populate('userId')
      .lean();
    logger.info('Transaction cancelled', { transactionId: id });
    res.json({ message: 'Transaction cancelled successfully', transaction: updatedTransaction });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error cancelling transaction:', error);
    res.status(500).json({ message: 'Error cancelling transaction', error: error.message });
  }
});


// Lot ID
router.get('/lots/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const lot = await Lot.findById(id)
      .populate('productId')
      .lean();
    if (!lot) {
      return res.status(404).json({ message: 'Lot not found' });
    }
    res.json({
      ...lot,
      productCode: lot.productId.productCode,
      productName: lot.productId.name,
      lotCode: lot.lotCode,
      productionDate: lot.productionDate,
      expDate: lot.expDate
    });
  } catch (error) {
    logger.error('Error fetching lot:', error);
    res.status(500).json({ message: 'Error fetching lot', error: error.message });
  }
});

// Adjust Stock
router.post('/adjust-stock', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can adjust stock' });
    }
    const { lotId, quantity, reason } = req.body;
    const lot = await Lot.findById(lotId);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });

    const beforeQty = lot.qtyOnHand;
    lot.qtyOnHand += Number(quantity);
    const afterQty = lot.qtyOnHand;

    lot.transactions.push({
      userId: req.user._id,
      reason,
      quantityAdjusted: quantity,
      beforeQty,
      afterQty,
      transactionType: 'Adjust',
      warehouseId: lot.warehouse
    });

    await lot.save();
    logger.info('Stock adjusted', { lotId, quantity, reason });
    res.json({ message: 'Stock adjusted successfully', newQtyOnHand: afterQty });
  } catch (error) {
    logger.error('Error adjusting stock:', error);
    res.status(500).json({ message: 'Error adjusting stock', error: error.message });
  }
});

///////////////////Transfer Order Management///////////////////

// Transfer Order
router.post('/transfer', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { lots, sourceWarehouseId, destinationWarehouseId, note } = req.body;
    const user = req.user;

    if (!sourceWarehouseId || !destinationWarehouseId || !lots || lots.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Source warehouse, destination warehouse, and lots are required' });
    }

    const sourceWarehouse = await Warehouse.findById(sourceWarehouseId).session(session);
    const destWarehouse = await Warehouse.findById(destinationWarehouseId).session(session);
    if (!sourceWarehouse || !destWarehouse) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Warehouse not found' });
    }

    // Generate Transfer Number with Counter
    let counter = await Counter.findOneAndUpdate(
      { warehouseId: new mongoose.Types.ObjectId(sourceWarehouseId) },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, session }
    );
    const transferNumber = `TRF-${sourceWarehouse.warehouseCode}-${String(counter.sequence).padStart(5, '0')}`;
    console.log('Generated transferNumber:', transferNumber);

    // Prepare Transfer Transaction with trackingNumber
    const transferTransaction = new TransferTransaction({
      transferNumber,
      sourceWarehouseId: new mongoose.Types.ObjectId(sourceWarehouseId),
      destinationWarehouseId: new mongoose.Types.ObjectId(destinationWarehouseId),
      lots: lots.map(lot => ({
        lotId: new mongoose.Types.ObjectId(lot.lotId),
        quantity: lot.quantity
      })),
      userId: new mongoose.Types.ObjectId(user._id),
      note: note || '',
      trackingNumber: uuidv4() // สร้าง Tracking Number ที่ไม่ซ้ำกัน
    });

    // Update Lots
    for (const lot of lots) {
      const sourceLot = await Lot.findOne({ _id: lot.lotId, warehouse: sourceWarehouseId }).session(session);
      if (!sourceLot || sourceLot.qtyOnHand < lot.quantity) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Insufficient stock for lot ${lot.lotId} in source warehouse` });
      }

      // ลด qtyOnHand ของ Source ทันที
      sourceLot.qtyOnHand -= lot.quantity;
      sourceLot.transactions.push({
        timestamp: new Date(),
        userId: new mongoose.Types.ObjectId(user._id),
        reason: `Transferred to ${destinationWarehouseId} (Pending)`,
        quantityAdjusted: -lot.quantity,
        beforeQty: sourceLot.qtyOnHand + lot.quantity,
        afterQty: sourceLot.qtyOnHand,
        transactionType: 'TransferOut',
        warehouseId: new mongoose.Types.ObjectId(sourceWarehouseId)
      });
      await sourceLot.save({ session });

      // สร้างหรืออัปเดต destLot ในสถานะ Pending
      let destLot = await Lot.findOne({ lotCode: sourceLot.lotCode, warehouse: destinationWarehouseId }).session(session);
      if (destLot) {
        // ถ้ามีอยู่แล้ว เพิ่ม Transaction Pending
        destLot.transactions.push({
          timestamp: new Date(),
          userId: new mongoose.Types.ObjectId(user._id),
          reason: `Pending transfer from ${sourceWarehouseId}`,
          quantityAdjusted: lot.quantity,
          beforeQty: destLot.qtyOnHand,
          afterQty: destLot.qtyOnHand,
          transactionType: 'TransferInPending',
          warehouseId: new mongoose.Types.ObjectId(destinationWarehouseId)
        });
        console.log(`Added pending transfer to existing destLot with lotCode: ${sourceLot.lotCode}`);
      } else {
        // สร้าง destLot ใหม่ แต่ไม่เพิ่ม qtyOnHand จนกว่าจะ Confirm
        destLot = new Lot({
          lotCode: sourceLot.lotCode,
          productId: sourceLot.productId,
          productionDate: sourceLot.productionDate,
          expDate: sourceLot.expDate,
          transactionNumber: sourceLot.transactionNumber,
          supplierId: sourceLot.supplierId,
          qtyPerBox: sourceLot.qtyPerBox,
          boxCount: sourceLot.boxCount,
          quantity: sourceLot.quantity,
          warehouse: new mongoose.Types.ObjectId(destinationWarehouseId),
          qtyOnHand: 0,
          damaged: 0,
          status: 'pending',
          transactions: [{
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(user._id),
            reason: `Pending transfer from ${sourceWarehouseId}`,
            quantityAdjusted: lot.quantity,
            beforeQty: 0,
            afterQty: 0,
            transactionType: 'TransferInPending',
            warehouseId: new mongoose.Types.ObjectId(destinationWarehouseId)
          }]
        });
        console.log(`Created new pending destLot with lotCode: ${sourceLot.lotCode}, qtyOnHand: 0`);
      }
      await destLot.save({ session });
    }

    // Save Transfer Transaction
    await transferTransaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info('Transfer transaction created', { transferNumber, trackingNumber: transferTransaction.trackingNumber });
    res.json({ message: 'Stock transfer initiated (Pending confirmation)', transferNumber, trackingNumber: transferTransaction.trackingNumber });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error transferring stock:', {
      message: error.message,
      stack: error.stack,
      details: error.toString()
    });
    res.status(500).json({ message: 'Error transferring stock', error: error.message, details: error.toString() });
  }
});

// Endpoint สำหรับการ Confirm
router.patch('/transfer/:transferId/confirm', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transferId } = req.params;
    const user = req.user;
    const warehouseId = user.warehouse ? user.warehouse.toString() : null;

    const transfer = await TransferTransaction.findById(transferId).session(session);
    if (!transfer || transfer.status !== 'Pending' || transfer.destinationWarehouseId.toString() !== warehouseId) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Unauthorized or invalid transfer status' });
    }

    for (const lot of transfer.lots) {
      const sourceLot = await Lot.findOne({ _id: lot.lotId, warehouse: transfer.sourceWarehouseId }).session(session);
      const destLot = await Lot.findOne({ lotCode: sourceLot.lotCode, warehouse: transfer.destinationWarehouseId }).session(session);

      if (destLot) {
        destLot.qtyOnHand += lot.quantity;
        destLot.status = 'active';
        destLot.transactions.push({
          timestamp: new Date(),
          userId: new mongoose.Types.ObjectId(user._id),
          reason: 'Transfer confirmed',
          quantityAdjusted: lot.quantity,
          beforeQty: destLot.qtyOnHand - lot.quantity,
          afterQty: destLot.qtyOnHand,
          transactionType: 'TransferIn',
          warehouseId: new mongoose.Types.ObjectId(warehouseId)
        });
        await destLot.save({ session });
      }
    }

    transfer.status = 'Confirmed';
    transfer.completedAt = new Date();
    await transfer.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info('Transfer confirmed', { transferId });
    res.json({ message: 'Transfer confirmed successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error confirming transfer:', error);
    res.status(500).json({ message: 'Error confirming transfer', error: error.message });
  }
});

// Endpoint สำหรับการ Reject
router.patch('/transfer/:transferId/reject', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transferId } = req.params;
    const user = req.user;
    const warehouseId = user.warehouse ? user.warehouse.toString() : null;

    const transfer = await TransferTransaction.findById(transferId).session(session);
    if (!transfer || transfer.status !== 'Pending' || transfer.destinationWarehouseId.toString() !== warehouseId) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Unauthorized or invalid transfer status' });
    }

    for (const lot of transfer.lots) {
      const sourceLot = await Lot.findOne({ _id: lot.lotId, warehouse: transfer.sourceWarehouseId }).session(session);
      const destLot = await Lot.findOne({ lotCode: sourceLot.lotCode, warehouse: transfer.destinationWarehouseId }).session(session);

      if (sourceLot) {
        sourceLot.qtyOnHand += lot.quantity;
        sourceLot.transactions.push({
          timestamp: new Date(),
          userId: new mongoose.Types.ObjectId(user._id),
          reason: 'Transfer rejected',
          quantityAdjusted: lot.quantity,
          beforeQty: sourceLot.qtyOnHand - lot.quantity,
          afterQty: sourceLot.qtyOnHand,
          transactionType: 'TransferInRejected',
          warehouseId: new mongoose.Types.ObjectId(transfer.sourceWarehouseId)
        });
        await sourceLot.save({ session });
      }

      if (destLot) {
        await Lot.deleteOne({ _id: destLot._id }).session(session);
      }
    }

    transfer.status = 'Rejected';
    transfer.completedAt = new Date();
    await transfer.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info('Transfer rejected', { transferId });
    res.json({ message: 'Transfer rejected successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Error rejecting transfer:', error);
    res.status(500).json({ message: 'Error rejecting transfer', error: error.message });
  }
});


// transfer history
router.get('/transfer-history', authMiddleware, async (req, res) => {
  try {
    const { status, warehouse, startDate, endDate } = req.query;
    const query = {};

    if (req.user.role !== 'admin' && req.user.warehouse) {
      query.$or = [
        { sourceWarehouseId: new mongoose.Types.ObjectId(req.user.warehouse) },
        { destinationWarehouseId: new mongoose.Types.ObjectId(req.user.warehouse) }
      ];
    } else if (warehouse && warehouse !== 'all') {
      query.$or = [
        { sourceWarehouseId: new mongoose.Types.ObjectId(warehouse) },
        { destinationWarehouseId: new mongoose.Types.ObjectId(warehouse) }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const history = await TransferTransaction.find(query)
      .populate({
        path: 'sourceWarehouseId',
        select: 'name warehouseCode'
      })
      .populate({
        path: 'destinationWarehouseId',
        select: 'name warehouseCode'
      })
      .populate('userId', 'username')
      .populate({
        path: 'lots.lotId',
        select: 'lotCode productId productionDate expDate',
        populate: {
          path: 'productId',
          select: 'name productCode' // ตรวจสอบว่า productId มีข้อมูลเหล่านี้
        }
      })
      .lean();

    res.json(history);
  } catch (error) {
    logger.error('Error fetching transfer history:', error);
    res.status(500).json({ message: 'Error fetching transfer history', error: error.message });
  }
});

module.exports = router;