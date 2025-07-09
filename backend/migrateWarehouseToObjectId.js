const mongoose = require('mongoose');
const Lot = require('./src/models/Lot');
const StockTransaction = require('./src/models/StockTransactions');
const Warehouse = require('./src/models/Warehouse');
const User = require('./src/models/User');

mongoose.connect('mongodb://localhost:27017/stock-management', { // ใช้ Database ชื่อ 'stock-management'
}).then(async () => {
  console.log('Connected to MongoDB');

  // ดึง Warehouse ทั้งหมดเพื่อใช้ในการแมป
  const warehouses = await Warehouse.find().lean();
  const warehouseMap = {};
  warehouses.forEach(w => {
    warehouseMap[w.name] = w._id;
  });
  console.log('Warehouse Map:', warehouseMap); // Debug

  // Migrate Lot
  const lots = await Lot.find();
  for (const lot of lots) {
    const warehouseValue = lot.warehouse ? lot.warehouse.toString() : 'undefined';
    console.log(`Processing lot ${lot.lotCode}, warehouse: "${warehouseValue}"`);
    if (mongoose.Types.ObjectId.isValid(lot.warehouse)) {
      const warehouse = await Warehouse.findById(lot.warehouse);
      if (warehouse) {
        console.log(`Lot ${lot.lotCode} already has valid warehouse ${warehouse.name}`);
      } else {
        console.log(`Invalid ObjectId ${lot.warehouse} for lot ${lot.lotCode}`);
      }
    } else if (lot.warehouse && lot.warehouse.toString().trim()) {
      const warehouse = await Warehouse.findOne({ name: lot.warehouse.toString().trim() });
      if (warehouse) {
        await Lot.updateOne({ _id: lot._id }, { $set: { warehouse: warehouse._id } });
        console.log(`Updated lot ${lot.lotCode} with warehouse ${warehouse.name}`);
      } else {
        console.log(`Warehouse "${lot.warehouse}" not found for lot ${lot.lotCode}`);
      }
    } else {
      // ใช้ค่าเริ่มต้นจาก User ถ้าไม่มี warehouse
      const user = await User.findOne({ assignedWarehouse: { $exists: true } }).lean();
      if (user && user.assignedWarehouse) {
        await Lot.updateOne({ _id: lot._id }, { $set: { warehouse: user.assignedWarehouse } });
        const defaultWarehouse = warehouses.find(w => w._id.toString() === user.assignedWarehouse.toString());
        console.log(`Assigned default warehouse ${defaultWarehouse ? defaultWarehouse.name : user.assignedWarehouse} to lot ${lot.lotCode}`);
      } else {
        console.log(`No default warehouse found for lot ${lot.lotCode}`);
      }
    }
  }

  // Migrate StockTransaction
  const transactions = await StockTransaction.find();
  for (const transaction of transactions) {
    const warehouseValue = transaction.warehouse ? transaction.warehouse.toString() : 'undefined';
    console.log(`Processing transaction ${transaction.transactionNumber}, warehouse: "${warehouseValue}"`);
    if (mongoose.Types.ObjectId.isValid(transaction.warehouse)) {
      const warehouse = await Warehouse.findById(transaction.warehouse);
      if (warehouse) {
        console.log(`Transaction ${transaction.transactionNumber} already has valid warehouse ${warehouse.name}`);
      } else {
        console.log(`Invalid ObjectId ${transaction.warehouse} for transaction ${transaction.transactionNumber}`);
      }
    } else if (transaction.warehouse && transaction.warehouse.toString().trim()) {
      const warehouse = await Warehouse.findOne({ name: transaction.warehouse.toString().trim() });
      if (warehouse) {
        await StockTransaction.updateOne({ _id: transaction._id }, { $set: { warehouse: warehouse._id } });
        console.log(`Updated transaction ${transaction.transactionNumber} with warehouse ${warehouse.name}`);
      } else {
        console.log(`Warehouse "${transaction.warehouse}" not found for transaction ${transaction.transactionNumber}`);
      }
    } else {
      // แมป warehouse จาก transactionNumber
      if (transaction.transactionNumber && transaction.transactionNumber.startsWith('PNH')) {
        const warehouse = warehouses.find(w => w.name === 'Phnom Penh Warehouse');
        if (warehouse) {
          await StockTransaction.updateOne({ _id: transaction._id }, { $set: { warehouse: warehouse._id } });
          console.log(`Assigned Phnom Penh Warehouse to transaction ${transaction.transactionNumber}`);
        }
      } else if (transaction.transactionNumber && transaction.transactionNumber.startsWith('KCH')) {
        const warehouse = warehouses.find(w => w.name === 'Kampong Cham Warehouse');
        if (warehouse) {
          await StockTransaction.updateOne({ _id: transaction._id }, { $set: { warehouse: warehouse._id } });
          console.log(`Assigned Kampong Cham Warehouse to transaction ${transaction.transactionNumber}`);
        }
      } else {
        const lot = await Lot.findById(transaction.lotId).lean();
        if (lot && lot.warehouse && mongoose.Types.ObjectId.isValid(lot.warehouse)) {
          await StockTransaction.updateOne({ _id: transaction._id }, { $set: { warehouse: lot.warehouse } });
          const warehouse = await Warehouse.findById(lot.warehouse);
          console.log(`Assigned warehouse ${warehouse ? warehouse.name : lot.warehouse} from lot ${lot.lotCode} to transaction ${transaction.transactionNumber}`);
        } else {
          const user = await User.findById(transaction.userId).lean();
          if (user && user.assignedWarehouse) {
            await StockTransaction.updateOne({ _id: transaction._id }, { $set: { warehouse: user.assignedWarehouse } });
            const defaultWarehouse = warehouses.find(w => w._id.toString() === user.assignedWarehouse.toString());
            console.log(`Assigned default warehouse ${defaultWarehouse ? defaultWarehouse.name : user.assignedWarehouse} to transaction ${transaction.transactionNumber}`);
          } else {
            console.log(`No default warehouse found for transaction ${transaction.transactionNumber}`);
          }
        }
      }
    }
  }

  console.log('Migration completed');
  mongoose.connection.close();
}).catch(err => console.error('Migration error:', err));