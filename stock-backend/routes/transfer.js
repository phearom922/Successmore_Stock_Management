
const router = require('express').Router();
const { z } = require('zod');
const mongoose = require('mongoose');
const Lot = require('../models/Lot');
const Transaction = require('../models/Transaction');
const { pickLots } = require('../utils/fefoPicker');
const schema = z.object({
  productId: z.string(),
  fromWh: z.string(),
  toWh: z.string(),
  quantity: z.number().positive(),
  remark: z.string().optional()
});
router.post('/', async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const { productId, fromWh, toWh, quantity, remark } = p.data;
  if (fromWh === toWh) return res.status(400).json({ message: 'Same warehouse' });
  const picked = await pickLots(productId, fromWh, quantity);
  if (!picked) return res.status(409).json({ message: 'Not enough stock' });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const { lot, quantity: qty } of picked) {
        lot.qtyOnHand -= qty;
        await lot.save({ session });
        let dest = await Lot.findOne({ lotCode: lot.lotCode, productId, warehouseId: toWh }).session(session);
        if (!dest) dest = new Lot({ lotCode: lot.lotCode, productId, warehouseId: toWh, qtyOnHand: 0, mfgDate: lot.mfgDate, expDate: lot.expDate });
        dest.qtyOnHand += qty;
        await dest.save({ session });
        await Transaction.create([{ type: 'transfer', lotId: lot._id, fromWh, toWh, quantity: qty, reason: remark }], { session });
      }
    });
    res.json({ success: true });
  } finally {
    session.endSession();
  }
});
module.exports = router;
