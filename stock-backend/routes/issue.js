
const router = require('express').Router();
const { z } = require('zod');
const mongoose = require('mongoose');
const Lot = require('../models/Lot');
const Transaction = require('../models/Transaction');
const { pickLots } = require('../utils/fefoPicker');
const schema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().positive(),
  reason: z.string().optional()
});
router.post('/', async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const { productId, warehouseId, quantity, reason } = p.data;
  const picked = await pickLots(productId, warehouseId, quantity);
  if (!picked) return res.status(409).json({ message: 'Not enough stock' });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const { lot, quantity: qty } of picked) {
        lot.qtyOnHand -= qty;
        await lot.save({ session });
        await Transaction.create([{ type: 'issue', lotId: lot._id, quantity: qty, reason }], { session });
      }
    });
    res.json({ success: true });
  } finally {
    session.endSession();
  }
});
module.exports = router;
