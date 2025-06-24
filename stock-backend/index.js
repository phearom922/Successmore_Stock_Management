
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Mongo connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log('Server running on', PORT));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
