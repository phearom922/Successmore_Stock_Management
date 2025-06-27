const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Warehouse = require('../src/models/Warehouse');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Lot = require('../src/models/Lot');

async function seedAdmin() {
  try {
    await mongoose.connect('mongodb://localhost:27017/stock-management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Clear existing data
      await User.deleteMany({}, { session });
      await Warehouse.deleteMany({}, { session });
      await Product.deleteMany({}, { session });
      await Category.deleteMany({}, { session });
      await Lot.deleteMany({}, { session });

      // Create admin user
      const hashedPassword = await bcrypt.hash('password123', 10);
      const admin = await User.create(
        [{ username: 'admin', password: hashedPassword, role: 'admin', assignedWarehouse: null }],
        { session }
      );

      // Create sample warehouse
      const bangkokWarehouse = await Warehouse.create(
        [{ name: 'Bangkok Main Warehouse', warehouseCode: 'BKK001', branch: 'Bangkok', assignedUser: null }],
        { session }
      );

      // Create sample category
      const category = await Category.create(
        [{ name: 'Personal Care', description: 'Personal hygiene products' }],
        { session }
      );

      // Create sample product
      const product = await Product.create(
        [{
          productCode: 'PROD001',
          name: 'Dove Soap 100g',
          category: category[0]._id,
          sku: null,
        }],
        { session }
      );

      // Create sample lot
      await Lot.create(
        [{
          lotCode: 'LOT001-240101',
          productId: product[0]._id,
          expDate: new Date('2025-12-31'),
          qtyOnHand: 40,
          warehouse: 'Bangkok Main Warehouse',
          status: 'active',
        }],
        { session }
      );

      await session.commitTransaction();
      console.log('Admin user and initial data created');
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedAdmin();