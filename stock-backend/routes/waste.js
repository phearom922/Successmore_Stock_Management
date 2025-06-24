
const router = require('express').Router();
const { z } = require('zod');
const Lot = require('../models/Lot');
const Transaction = require('../models/Transaction');
const schema = z.object({
  lotId: z.string(),
  quantity: z.number().positive(),
  reason: z.string()
});
router.post('/', async (req, res) => {
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error);
  const { lotId, quantity, reason } = p.data;
  const lot = await Lot.findById(lotId);
  if (!lot || lot.qtyOnHand < quantity) return res.status(409).json({ message: 'Not enough stock' });
  lot.qtyOnHand -= quantity;
  await lot.save();
  await Transaction.create({ type: 'waste', lotId, quantity, reason });
  res.json({ success: true });
});
module.exports = router;
