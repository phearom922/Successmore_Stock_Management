const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Lot = require('../models/Lot');
const IssueTransaction = require('../models/IssueTransaction');
const Warehouse = require('../models/Warehouse');
const authMiddleware = require('../middleware/auth');
const logger = require('../config/logger');

router.get('/lots', authMiddleware, async (req, res) => {
  try {
    const { productId, warehouse } = req.query;
    const user = req.user;
    const query = {};
    if (productId) {
      query.productId = new mongoose.Types.ObjectId(productId);
    }
    if (warehouse) {
      query.warehouse = new mongoose.Types.ObjectId(warehouse);
    } else if (user.role !== 'admin' && user.warehouse) {
      query.warehouse = new mongoose.Types.ObjectId(user.warehouse);
    }
    const lots = await Lot.find(query)
      .populate('productId')
      .populate('warehouse')
      .lean();
    res.json(lots);
  } catch (error) {
    logger.error('Error fetching lots:', error);
    res.status(500).json({ message: 'Error fetching lots', error: error.message });
  }
});





router.post('/issue', authMiddleware, async (req, res) => {
  try {
    const { lots, type, destinationWarehouseId, note } = req.body;
    const user = req.user;
    const warehouseId = user.role !== 'admin' ? user.warehouse : req.body.warehouse;

    if (!warehouseId || !type || !lots || lots.length === 0) {
      return res.status(400).json({ message: 'Warehouse, type, and lots are required' });
    }

    const warehouse = await Warehouse.findById(warehouseId);
    if (!warehouse) {
      return res.status(400).json({ message: 'Warehouse not found' });
    }

    // Generate Transaction Number
    const count = await IssueTransaction.countDocuments({ warehouseId });
    const transactionNumber = `ISS-${warehouse.warehouseCode}-${String(count + 1).padStart(5, '0')}`;

    const transaction = new IssueTransaction({
      transactionNumber,
      type,
      warehouseId: new mongoose.Types.ObjectId(warehouseId),
      destinationWarehouseId: destinationWarehouseId ? new mongoose.Types.ObjectId(destinationWarehouseId) : null,
      lots: lots.map(l => ({
        lotId: new mongoose.Types.ObjectId(l.lotId),
        quantity: Number(l.quantity)
      })),
      userId: user._id,
      note
    });

    for (const lot of transaction.lots) {
      const dbLot = await Lot.findById(lot.lotId);
      if (!dbLot || dbLot.qtyOnHand < lot.quantity) {
        return res.status(400).json({ message: `Insufficient stock for lot ${lot.lotId}` });
      }
      dbLot.qtyOnHand -= lot.quantity;
      dbLot.transactions.push({
        userId: user._id,
        reason: `Issued (${type})`,
        quantityAdjusted: -lot.quantity,
        beforeQty: dbLot.qtyOnHand + lot.quantity,
        afterQty: dbLot.qtyOnHand,
        transactionType: 'Issue',
        warehouseId
      });
      await dbLot.save();
    }

    if (destinationWarehouseId) {
      // Transfer logic (to be implemented later)
      logger.info('Transfer logic to be implemented');
    }

    await transaction.save();
    logger.info('Issue transaction created', { transactionNumber });
    res.json({ message: 'Stock issued successfully', transactionNumber });
  } catch (error) {
    logger.error('Error issuing stock:', error);
    res.status(500).json({ message: 'Error issuing stock', error: error.message });
  }
});

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
      .lean();
    res.json(history);
  } catch (error) {
    logger.error('Error fetching issue history:', error);
    res.status(500).json({ message: 'Error fetching issue history', error: error.message });
  }
});

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

module.exports = router;