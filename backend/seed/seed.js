const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// 👇 แก้ไข path model ให้ตรงกับโปรเจกต์คุณ
const User = require('../src/models/User'); // ปรับตามโครงสร้างจริง

mongoose.connect('mongodb://localhost:27017/stock-management').then(async () => {
    const passwordHash = await bcrypt.hash('123456', 10);

    await User.create({
        username: 'superadmin',
        lastName: 'Seeded',
        password: passwordHash,
        role: 'admin',
        isActive: true,
        permissions: [],
    });

    console.log('✅ User seeded');
    process.exit();
}).catch(err => {
    console.error('❌ Failed to connect MongoDB', err);
    process.exit(1);
});
