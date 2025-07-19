const express = require('express');
const router = express.Router();
const Setting = require('../models/Settings');
const IssueTransaction = require('../models/IssueTransaction'); // สมมติ Model
const Lot = require('../models/Lot'); // สมมติ Model
const Counter = require('../models/Counter'); // สมมติ Model
const Warehouse = require('../models/Warehouse'); // สมมติ Model
const logger = require('../config/logger');
const authMiddleware = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const axios = require('axios'); // เพิ่มสำหรับเรียก Telegram

// Get or update settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({
        expirationWarningDays: 15,
        lowStockThreshold: 10,
        issueStockNotificationEnabled: true,
        issueHistoryNotificationEnabled: true,
        telegramBotToken: '',
        chatId: '-4871143154',
      });
    }
    logger.info('Fetched settings', { setting });
    res.json(setting);
  } catch (error) {
    logger.error('Error fetching settings:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching settings', error: error.message });
  }
});

router.put('/settings/notification', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    const { expirationWarningDays, lowStockThreshold, issueStockNotificationEnabled, issueHistoryNotificationEnabled } = req.body;
    if (expirationWarningDays <= 0 || lowStockThreshold <= 0) {
      return res.status(400).json({ message: 'Expiration warning days and low stock threshold must be positive numbers' });
    }
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({
        expirationWarningDays,
        lowStockThreshold,
        issueStockNotificationEnabled,
        issueHistoryNotificationEnabled,
        telegramBotToken: '',
        chatId: '-4871143154',
      });
    } else {
      setting.expirationWarningDays = expirationWarningDays;
      setting.lowStockThreshold = lowStockThreshold;
      setting.issueStockNotificationEnabled = issueStockNotificationEnabled;
      setting.issueHistoryNotificationEnabled = issueHistoryNotificationEnabled;
      await setting.save();
    }
    logger.info('Updated notification settings', { expirationWarningDays, lowStockThreshold, issueStockNotificationEnabled, issueHistoryNotificationEnabled });
    res.json({ message: 'Notification settings updated successfully', setting });
  } catch (error) {
    logger.error('Error updating notification settings:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error updating notification settings', error: error.message });
  }
});

router.put('/settings/telegram', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    const { telegramBotToken, chatId } = req.body;
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({
        expirationWarningDays: 15,
        lowStockThreshold: 10,
        issueStockNotificationEnabled: true,
        issueHistoryNotificationEnabled: true,
        telegramBotToken,
        chatId,
      });
    } else {
      setting.telegramBotToken = telegramBotToken;
      setting.chatId = chatId;
      await setting.save();
    }
    logger.info('Updated telegram settings', { telegramBotToken, chatId });
    res.json({ message: 'Telegram configuration updated successfully', setting });
  } catch (error) {
    logger.error('Error updating telegram settings:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error updating telegram settings', error: error.message });
  }
});

// Get stock summary by product code
router.get('/stock-reports/summary-by-product', authMiddleware, async (req, res) => {
  try {
    const { productCode } = req.query;
    if (!productCode) {
      return res.status(400).json({ message: 'Product code is required' });
    }

    // Fetch all stock data
    const stockData = await Lot.find()
      .populate('warehouse')
      .populate('productId')
      .lean();

    // Filter and group by warehouse and product code
    const summaryMap = {};
    stockData.forEach(lot => {
      const warehouseName = lot.warehouse?.name || 'Unknown Warehouse';
      const prodCode = lot.productId?.productCode || lot.productCode || 'N/A';
      if (prodCode === productCode) {
        if (!summaryMap[warehouseName]) {
          summaryMap[warehouseName] = 0;
        }
        summaryMap[warehouseName] += lot.qtyOnHand || 0;
      }
    });

    // Prepare response
    const response = [];
    let index = 1;
    for (const [warehouse, qtyOnHand] of Object.entries(summaryMap)) {
      response.push({
        index: index++,
        warehouse,
        productCode,
        qtyOnHand,
      });
    }

    if (response.length === 0) {
      return res.json({ message: `No stock found for product code ${productCode}` });
    }

    res.json(response);
  } catch (error) {
    logger.error('Error fetching stock summary by product:', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error fetching stock summary', error: error.message });
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

    // Fetch latest settings to ensure updated values
    const settings = await Setting.findOne().lean(); // Use lean to avoid mongoose overhead
    console.log('Current Settings for Issue:', settings); // Debug
    if (settings && settings.issueStockNotificationEnabled === true) { // Strict check for true
      try {
        const telegramResponse = await axios.post(
          'http://localhost:3000/api/telegram/send',
          {
            chat_id: settings.chatId,
            text: `
*Transaction Notification*
- Transaction #: ${transactionNumber}
- Warehouse: ${warehouse.name}
- Issue Type: ${type}
- Total Qty: ${lots.reduce((sum, lot) => sum + lot.quantity, 0)}
- User: ${user.username || user._id.toString()}
- Status: 'Active'
- Date/Time: ${new Date().toLocaleString()}
            `.trim(),
            parse_mode: 'Markdown',
            telegramBotToken: settings.telegramBotToken, // Pass token from settings
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        logger.info('Telegram notification sent for issue', { transactionNumber, telegramResponse: telegramResponse.data });
      } catch (telegramError) {
        logger.error('Failed to send Telegram notification for issue:', {
          error: telegramError.message,
          details: telegramError.response?.data,
          transactionNumber,
        });
      }
    } else {
      logger.info('Issue Stock notification skipped due to disabled setting', { settings });
    }

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

    // Fetch latest settings to ensure updated values
    const settings = await Setting.findOne().lean(); // Use lean to avoid mongoose overhead
    console.log('Current Settings for Cancellation:', settings); // Debug
    if (settings && settings.issueHistoryNotificationEnabled === true) { // Strict check for true
      try {
        const telegramResponse = await axios.post(
          'http://localhost:3000/api/telegram/send',
          {
            chat_id: settings.chatId,
            text: `
*Transaction Notification*
- Transaction #: ${transaction.transactionNumber}
- Warehouse: ${transaction.warehouseId.name}
- Issue Type: ${transaction.type}
- Total Qty: ${transaction.lots.reduce((sum, lot) => sum + lot.quantity, 0)}
- User: ${transaction.userId.username || transaction.userId._id.toString()}
- Status: ${transaction.status}
- Date/Time: ${new Date(cancelledDate).toLocaleString()}
            `.trim(),
            parse_mode: 'Markdown',
            telegramBotToken: settings.telegramBotToken, // Pass token from settings
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        logger.info('Telegram notification sent for cancellation', { transactionId: id, telegramResponse: telegramResponse.data });
      } catch (telegramError) {
        logger.error('Failed to send Telegram notification for cancellation:', {
          error: telegramError.message,
          details: telegramError.response?.data,
          transactionId: id,
        });
      }
    } else {
      logger.info('Issue History notification skipped due to disabled setting', { settings });
    }

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

// Handle Telegram stock check command
router.post('/telegram/check-stock', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const settings = await Setting.findOne().lean();
    if (!settings || !settings.telegramBotToken || !settings.chatId) {
      return res.status(400).json({ message: 'Telegram settings not configured' });
    }

    // Extract product code from message (simple parsing, adjust as needed)
    const productCodeMatch = message.text.match(/\b(\d{4}[A-Z]{2})\b/); // Match format like 2019KH
    if (!productCodeMatch) {
      return res.status(400).json({ message: 'Invalid or no product code provided' });
    }
    const productCode = productCodeMatch[1];

    // Fetch stock summary for the product code
    const stockSummary = await axios.get(
      'http://localhost:3000/api/stock-reports/summary-by-product',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { productCode }
      }
    );

    const responseText = stockSummary.data.length > 0
      ? stockSummary.data.map(item => `${item.index}. Warehouse: ${item.warehouse}\n   Product Code: ${item.productCode}\n   qtyOnHand: ${item.qtyOnHand} ชิ้น`).join('\n')
      : `No stock found for product code ${productCode}`;

    // Send response back to Telegram
    await axios.post(
      'http://localhost:3000/api/telegram/send',
      {
        chat_id: settings.chatId,
        text: responseText,
        parse_mode: 'Markdown',
        telegramBotToken: settings.telegramBotToken,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logger.info('Stock check response sent via Telegram', { productCode, chatId: settings.chatId });
    res.json({ message: 'Stock check processed successfully' });
  } catch (error) {
    logger.error('Error processing stock check via Telegram:', {
      error: error.message,
      stack: error.stack,
      details: error.response?.data,
    });
    res.status(500).json({ message: 'Error processing stock check', error: error.message });
  }
});

module.exports = router;