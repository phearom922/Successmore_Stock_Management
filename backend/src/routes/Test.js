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
const updateUserSchema = User.updateUserSchema;

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
  assignedWarehouse: z.string().optional(), // เปลี่ยนเป็น Optional จริงๆ
  permissions: z.array(
    z.object({
      feature: z.enum(['lotManagement', 'manageDamage', 'category', 'products']),
      permissions: z.array(z.enum(['Show', 'Edit', 'Cancel'])).optional()
    })
  ).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  if (data.role === 'user' && !data.assignedWarehouse) {
    return false; // User role ต้องมี assignedWarehouse ถ้าไม่ใช่ Admin
  }
  return true;
}, {
  message: 'User role must have an assigned warehouse',
  path: ['assignedWarehouse'],
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

const issueSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  warehouse: z.string().min(1), // รับ _id
  issueType: z.enum(['normal', 'expired', 'waste']),
  lotId: z.string().optional(),
});

const supplierSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
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
    } else if (req.user.role !== 'admin' && req.user.assignedWarehouse) {
      query.warehouse = req.user.assignedWarehouse;
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