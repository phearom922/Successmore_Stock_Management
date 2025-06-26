const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Lot = require('../models/Lot');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Category = require('../models/Category');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Seed Data
const seedData = async () => {
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

    const admin = await User.create({ username: 'admin', password: hashedPassword, role: 'admin', warehouse: 'All' });
    const user1 = await User.create({ username: 'user1', password: hashedPassword, role: 'user', warehouse: 'Bangkok Main Warehouse' });

    const bangkokWarehouse = await Warehouse.create({ name: 'Bangkok Main Warehouse', assignedUser: user1._id });
    await User.findByIdAndUpdate(user1._id, { assignedWarehouse: bangkokWarehouse._id });

    await Warehouse.create({ name: 'Silom Sub Warehouse' });

    const category1 = await Category.create({ name: 'Personal Care', description: 'Personal hygiene products' });
    const category2 = await Category.create({ name: 'Household', description: 'Household items' });

    const doveProduct = await Product.create({
      productCode: 'PROD001',
      name: 'Dove Soap 100g',
      category: category1._id,
      sku: null,
    });
    await Product.create({
      productCode: 'PROD002',
      name: 'Shampoo 200ml',
      category: category1._id,
      sku: null,
    });
    await Lot.create({
      lotCode: 'LOT001-240101',
      productId: doveProduct._id,
      expDate: new Date('2025-12-31'),
      qtyOnHand: 40,
      warehouse: 'Bangkok Main Warehouse',
      status: 'active',
    });
    await Lot.create({
      lotCode: 'LOT002-240101',
      productId: doveProduct._id,
      expDate: new Date('2024-12-31'),
      qtyOnHand: 30,
      warehouse: 'Bangkok Main Warehouse',
      status: 'active',
    });
    await Lot.create({
      lotCode: 'LOT003-240101',
      productId: doveProduct._id,
      expDate: new Date('2025-12-31'),
      qtyOnHand: 20,
      warehouse: 'Silom Sub Warehouse',
      status: 'active',
    });
    console.log('Seed data added, users:', await User.find(), 'warehouses:', await Warehouse.find());
  }
};
seedData().catch(console.error);

// Login Endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password });
  const user = await User.findOne({ username }).populate('assignedWarehouse');

  if (!user) {
    console.log('User not found:', username);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (!(await bcrypt.compare(password, user.password))) {
    console.log('Password mismatch for:', username);
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({
    id: user._id,
    role: user.role,
    warehouse: user.assignedWarehouse ? user.assignedWarehouse.name : user.warehouse
  }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
  res.json({ token });
});

// Get all products
router.get('/products', async (req, res) => {
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

// Get all warehouses
router.get('/warehouses', async (req, res) => {
  try {
    const warehouses = await Warehouse.find();
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching warehouses', error: error.message });
  }
});

// Get all lots
router.get('/lots', async (req, res) => {
  try {
    const user = req.user;
    const query = user.role === 'admin' ? {} : { warehouse: user.warehouse };
    const lots = await Lot.find(query).populate('productId');
    res.json(lots);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lots', error: error.message });
  }
});

// Get all users (for Admin)
router.get('/users', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      console.log('Forbidden: User role:', user?.role);
      return res.status(403).json({ message: 'Only admins can view users' });
    }
    const users = await User.find().select('-password').populate('assignedWarehouse');
    console.log('Fetched users:', users);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Issue stock with FEFO based on issueType
router.post('/issue', async (req, res) => {
  try {
    const user = req.user;
    const { productId, quantity, warehouse, issueType, lotId } = req.body;

    if (!productId || !quantity || quantity <= 0 || !issueType) {
      return res.status(400).json({ message: 'Product ID, quantity, and issue type are required' });
    }

    let lots = [];
    if (issueType === 'expired') {
      lots = await Lot.find({ productId, qtyOnHand: { $gt: 0 }, expDate: { $lt: new Date() } }).sort({ expDate: 1 });
    } else if (issueType === 'waste' && !lotId) {
      return res.status(400).json({ message: 'Lot ID is required for waste issue' });
    } else if (issueType === 'waste') {
      const lot = await Lot.findOne({ _id: lotId });
      console.log('Waste lot check:', lot); // Debug
      if (!lot) {
        return res.status(400).json({ message: 'Lot not found' });
      }
      if (lot.qtyOnHand < quantity) {
        return res.status(400).json({
          message: 'Insufficient stock available',
          availableStock: lot.qtyOnHand,
        });
      }
      lot.qtyOnHand -= quantity; // ลดสต็อกทันที
      const updatedLot = await lot.save(); // บันทึกการเปลี่ยนแปลง
      console.log('Updated lot after save:', updatedLot); // Debug
      lots = [updatedLot]; // ใช้ Lot ที่อัปเดตแล้ว
    } else {
      lots = await Lot.find({ productId, qtyOnHand: { $gt: 0 }, status: 'active' }).sort({ expDate: 1 });
    }

    if (user.role !== 'admin') {
      lots = lots.filter(lot => lot.warehouse === warehouse);
    }
    console.log('Lots found:', lots); // Debug
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
      remainingQty -= qtyToIssue;

      lot.qtyOnHand -= qtyToIssue; // ลดสต็อกทันที
      const updatedLot = await lot.save(); // บันทึกการเปลี่ยนแปลง
      console.log(`Saved lot ${lot.lotCode}, qtyOnHand: ${updatedLot.qtyOnHand}`); // Debug

      issuedLots.push({
        lotCode: lot.lotCode,
        qtyIssued: qtyToIssue,
        remainingQty: updatedLot.qtyOnHand,
      });
    }

    res.json({
      message: 'Stock issued successfully',
      issuedLots,
      totalIssued: quantity,
    });
  } catch (error) {
    console.error('Error issuing stock:', error); // Debug
    res.status(500).json({ message: 'Error issuing stock', error: error.message });
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


// Create Warehouse (Admin only)
router.post('/warehouses', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create warehouses' });
    }

    const { warehouseCode, name, branch, assignedUser } = req.body;

    if (!warehouseCode || !name || !branch) {
      return res.status(400).json({ message: 'warehouseCode, name, and branch are required' });
    }

    const exists = await Warehouse.findOne({ warehouseCode });
    if (exists) {
      return res.status(400).json({ message: 'Warehouse code already exists' });
    }

    let validAssignedUser = null;
    if (assignedUser) {
      validAssignedUser = await User.findById(assignedUser);
      if (!validAssignedUser) {
        return res.status(400).json({ message: 'Invalid assigned user' });
      }

      await User.findByIdAndUpdate(assignedUser, {
        assignedWarehouse: null,
        warehouse: name,
      });
    }

    const warehouse = await Warehouse.create({
      warehouseCode,
      name,
      branch,
      assignedUser: validAssignedUser ? validAssignedUser._id : null,
      status: 'Active',
      hasAssignedUserHistory: !!validAssignedUser,
    });

    res.json({ message: 'Warehouse created successfully', warehouse });
  } catch (error) {
    console.error('Warehouse creation error:', error);
    res.status(500).json({ message: 'Error creating warehouse', error: error.message });
  }
});

// Update Warehouse (Admin only)
router.put('/warehouses/:id', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update warehouses' });
    }

    const { warehouseCode, name, branch, status, assignedUser } = req.body;

    if (!warehouseCode || !name || !branch) {
      return res.status(400).json({ message: 'warehouseCode, name, and branch are required' });
    }

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

    warehouse.warehouseCode = warehouseCode;
    warehouse.name = name;
    warehouse.branch = branch;
    warehouse.status = status || 'Active';

    if (assignedUser) {
      const userToAssign = await User.findById(assignedUser);
      if (!userToAssign) {
        return res.status(400).json({ message: 'Invalid assigned user' });
      }

      warehouse.assignedUser = userToAssign._id;
      warehouse.hasAssignedUserHistory = true;

      await User.findByIdAndUpdate(userToAssign._id, {
        assignedWarehouse: warehouse._id,
        warehouse: name,
      });
    } else {
      warehouse.assignedUser = null;
    }

    const updated = await warehouse.save();
    res.json({ message: 'Warehouse updated successfully', warehouse: updated });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(500).json({ message: 'Error updating warehouse', error: error.message });
  }
});

// Delete Warehouse (Admin only)
router.delete('/warehouses/:id', async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete warehouses' });
    }

    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: 'Warehouse not found' });
    }

    if (warehouse.hasAssignedUserHistory) {
      return res.status(400).json({ message: 'Cannot delete warehouse: It was previously assigned to a user' });
    }

    const lotsUsingWarehouse = await Lot.countDocuments({ warehouse: warehouse.name });
    if (lotsUsingWarehouse > 0) {
      return res.status(400).json({ message: 'Cannot delete warehouse: It is in use by lots' });
    }

    await Warehouse.findByIdAndDelete(req.params.id);
    res.json({ message: 'Warehouse deleted successfully' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ message: 'Error deleting warehouse', error: error.message });
  }
});




module.exports = router;