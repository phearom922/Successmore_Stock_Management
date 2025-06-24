
const Lot=require('../models/Lot');
async function pickLots(productId, warehouseId, quantity){
  const lots = await Lot.find({ productId, warehouseId, qtyOnHand: { $gt: 0 } }).sort({ expDate: 1 });
  const picked = [];
  let remaining = quantity;
  for (const lot of lots){
    if (remaining <= 0) break;
    const take = Math.min(remaining, lot.qtyOnHand);
    picked.push({ lot, quantity: take });
    remaining -= take;
  }
  return remaining > 0 ? null : picked;
}
module.exports = { pickLots };
