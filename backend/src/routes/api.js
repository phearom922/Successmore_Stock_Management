const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Lot = require('../models/Lot');

// Seed Data
const seedData = async () => {
  const products = await Product.find();
  if (products.length === 0) {
    const doveProduct = await Product.create({ name: 'Dove Soap 100g', sku: 'SKU001' });
    const headShouldersProduct = await Product.create({ name: 'Head & Shoulders 200ml', sku: 'SKU002' });

    await Lot.create({
      lotCode: 'LOT001-240101',
      productId: doveProduct._id,
      expDate: new Date('2025-12-31'),
      qtyOnHand: 50,
      warehouse: 'Bangkok Main Warehouse',
    });
    await Lot.create({
      lotCode: 'LOT002-240101',
      productId: headShouldersProduct._id,
      expDate: '2026-01-15',
      qtyOnHand: 50,
      warehouse: 'Silom Sub Warehouse',
    });

    console.log('Seed data added');
  }
};
seedData();

// Get all products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
});

// Get all lots
router.get('/lots', async (req, res) => {
  try {
    const lots = await Lot.find().populate('productId');
    res.json(lots);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching lots', error });
  }
});

// Issue stock with FEFO
router.post('/issue', async (req, res) => {
  try {
    const { productId, quantity, warehouse } = req.body;

    if (!productId || !quantity || quantity <= 0 || !warehouse) {
      return res.status(400).json({ message: 'Product ID, valid quantity, and warehouse are required' });
    }

    // Check total available stock in the specified warehouse before issuing
    const lots = await Lot.find({ productId, warehouse, qtyOnHand: { $gt: 0 } }).sort({ expDate: 1 });
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

      // Update qtyOnHand
      lot.qtyOnHand -= qtyToIssue;
      await lot.save();

      issuedLots.push({
        lotCode: lot.lotCode,
        qtyIssued: qtyToIssue,
        remainingQty: lot.qtyOnHand,
      });
    }

    res.json({
      message: 'Stock issued successfully',
      issuedLots,
      totalIssued: quantity,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error issuing stock', error });
  }
});

module.exports = router;