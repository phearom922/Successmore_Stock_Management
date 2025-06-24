
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const auth = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/receive', auth, require('./routes/receive'));
app.use('/api/issue', auth, require('./routes/issue'));
app.use('/api/transfer', auth, require('./routes/transfer'));
app.use('/api/waste', auth, require('./routes/waste'));
app.use('/api/products', require('./routes/products'));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Mongo connected');
  app.listen(process.env.PORT || 5000, () => console.log('Backend ready'));
})();
