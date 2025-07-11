const mongoose = require('mongoose');
const User = require('./src/models/User');
const Warehouse = require('./src/models/Warehouse');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/stock-management')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

async function migrateWarehouseField() {
  try {
    // ดึงทุก User ที่มี assignedWarehouse ไม่ว่าจะมี warehouse หรือไม่
    const users = await User.find({ assignedWarehouse: { $exists: true } });

    for (const user of users) {
      console.log(`Migrating user ${user.username} (ID: ${user._id})`);

      let warehouseId = user.assignedWarehouse;
      let updatedWarehouse = false;

      if (warehouseId) {
        // ตรวจสอบว่า Warehouse ยังคงมีอยู่
        const warehouse = await Warehouse.findById(warehouseId);
        if (!warehouse) {
          console.warn(`Warehouse not found for user ${user.username}, attempting to assign default`);
          if (user.role === 'user') {
            const defaultWarehouse = await Warehouse.findOne({ warehouseCode: 'PNH-WH-01' });
            if (defaultWarehouse) {
              warehouseId = defaultWarehouse._id;
              console.log(`Assigned default warehouse PNH-WH-01 to user ${user.username}`);
              updatedWarehouse = true;
            } else {
              console.error('Default warehouse PNH-WH-01 not found, skipping warehouse update');
            }
          } else {
            warehouseId = null; // สำหรับ Admin สามารถเป็น null ได้
            updatedWarehouse = true;
          }
        } else {
          updatedWarehouse = true;
        }
      } else if (user.role === 'user') {
        // กรณีที่ assignedWarehouse ไม่มีและเป็น Role user
        const defaultWarehouse = await Warehouse.findOne({ warehouseCode: 'PNH-WH-01' });
        if (defaultWarehouse) {
          warehouseId = defaultWarehouse._id;
          console.log(`Assigned default warehouse PNH-WH-01 to user ${user.username} (no previous warehouse)`);
          updatedWarehouse = true;
        } else {
          console.error('Default warehouse PNH-WH-01 not found, skipping user');
          continue;
        }
      }

      // อัปเดต warehouse และลบ assignedWarehouse
      const updateObj = { $unset: { assignedWarehouse: "" } };
      if (updatedWarehouse) {
        updateObj.$set = { warehouse: warehouseId };
      }

      await User.updateOne({ _id: user._id }, updateObj);
      console.log(`Migrated user ${user.username} successfully, removed assignedWarehouse`);
    }

    // ตรวจสอบและลบ assignedWarehouse ที่อาจหลงเหลือ
    const remainingUsers = await User.find({ assignedWarehouse: { $exists: true } });
    if (remainingUsers.length > 0) {
      console.log(`Found ${remainingUsers.length} users with remaining assignedWarehouse, performing cleanup...`);
      await User.updateMany({ assignedWarehouse: { $exists: true } }, { $unset: { assignedWarehouse: "" } });
      console.log('Cleanup completed for remaining assignedWarehouse');
    } else {
      console.log('No remaining assignedWarehouse found, cleanup skipped');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    mongoose.disconnect();
  }
}

migrateWarehouseField();