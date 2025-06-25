const express = require('express');
  const router = express.Router();
  const Product = require('../models/Product');
  const Lot = require('../models/Lot');
  const User = require('../models/User');
  const Warehouse = require('../models/Warehouse');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');

  // Seed Data
  const seedData = async () => {
    const users = await User.find();
    const products = await Product.find();
    if (users.length === 0 || products.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await User.deleteMany();
      await Product.deleteMany();
      await Lot.deleteMany();
      await Warehouse.deleteMany();

      const admin = await User.create({ username: 'admin', password: hashedPassword, role: 'admin', warehouse: 'All' });
      const user1 = await User.create({ username: 'user1', password: hashedPassword, role: 'user', warehouse: 'Bangkok Main Warehouse' });

      const bangkokWarehouse = await Warehouse.create({ name: 'Bangkok Main Warehouse', assignedUser: user1._id });
      await User.findByIdAndUpdate(user1._id, { assignedWarehouse: bangkokWarehouse._id });

      await Warehouse.create({ name: 'Silom Sub Warehouse' });

      const doveProduct = await Product.create({ name: 'Dove Soap 100g', sku: 'SKU001' });
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
      const products = await Product.find();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching products', error: error.message });
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
        console.log('Forbidden: User role:', user?.role);
        return res.status(403).json({ message: 'Only admins can create warehouses' });
      }

      const { name, assignedUser } = req.body;
      if (!name) {
        return res.status(400).json({ message: 'Warehouse name is required' });
      }

      let validAssignedUser = null;
      if (assignedUser) {
        validAssignedUser = await User.findById(assignedUser);
        if (!validAssignedUser) {
          return res.status(400).json({ message: 'Invalid assigned user' });
        }
        await User.findByIdAndUpdate(assignedUser, { warehouse: name, assignedWarehouse: null });
      }

      const warehouse = await Warehouse.create({ name, assignedUser: validAssignedUser ? validAssignedUser._id : null });
      res.json({ message: 'Warehouse created', warehouse });
    } catch (error) {
      console.error('Warehouse creation error:', error);
      res.status(500).json({ message: 'Error creating warehouse', error: error.message });
    }
  });

  module.exports = router;