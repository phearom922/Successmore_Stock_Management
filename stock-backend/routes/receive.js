
const router = require('express').Router();
const { z } = require('zod');
const Lot = require('../models/Lot');
const Transaction = require('../models/Transaction');
const schema = z.object({
  lotCode: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().positive(),
  mfgDate: z.string().optional(),
  expDate: z.string().optional()
});
router.post('/', async (req, res) => {
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error);
  const { lotCode, productId, warehouseId, quantity, mfgDate, expDate } = parse.data;
  const lot = await Lot.create({ lotCode, productId, warehouseId, qtyOnHand: quantity, mfgDate, expDate });
  await Transaction.create({ type: 'receive', lotId: lot._id, quantity });
  res.status(201).json(lot);
});
module.exports = router;
