require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');
const axios = require('axios');
const logger = require('./config/logger');
const apiRoutes = require('./routes/api');
const telegramRoutes = require('./routes/telegram');

const app = express();

// Middleware
const allowedOrigins = [
  'http://178.128.60.193:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());
app.use((req, res, next) => {
  logger.info(`Received ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api', apiRoutes);
app.use('/api/telegram', telegramRoutes);

// MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stock-management')
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => {
    logger.error('Connection error:', { error: err.message });
    process.exit(1);
  });

// Validate Env Vars
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is missing');
  process.exit(1);
}
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.warn('TELEGRAM_BOT_TOKEN is missing; Telegram Bot will not start');
}

// Telegram Bot Setup
if (process.env.TELEGRAM_BOT_TOKEN && process.env.SERVICE_USER && process.env.SERVICE_PASS && process.env.WEBHOOK_URL) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const API_BASE_URL = process.env.API_BASE_URL.replace('localhost', '127.0.0.1');
  const SERVICE_USER = process.env.SERVICE_USER;
  const SERVICE_PASS = process.env.SERVICE_PASS;
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  const bot = new Telegraf(BOT_TOKEN);
  let serviceToken = null;
  const hookPath = `/bot${BOT_TOKEN}`;

  async function loginService() {
    const res = await axios.post(
      `${API_BASE_URL}/api/login`,
      { username: SERVICE_USER, password: SERVICE_PASS }
    );
    serviceToken = res.data.token;
    logger.info('Service logged in (Bot)');
  }

  async function fetchSummary(code) {
    if (!serviceToken) await loginService();
    try {
      return await axios.get(
        `${API_BASE_URL}/api/stock-reports`,
        {
          params: { type: 'summary', search: code },
          headers: { Authorization: `Bearer ${serviceToken}` },
          timeout: 5000
        }
      );
    } catch (err) {
      if (err.response?.status === 401) {
        await loginService();
        return await axios.get(
          `${API_BASE_URL}/api/stock-reports`,
          {
            params: { type: 'summary', search: code },
            headers: { Authorization: `Bearer ${serviceToken}` },
            timeout: 5000
          }
        );
      }
      throw err;
    }
  }

  (async () => {
    try {
      await bot.telegram.setMyCommands([
        { command: 'help', description: 'Show usage instructions' },
      ]);
      logger.info('Telegram bot commands set');
    } catch (err) {
      logger.error('Failed to set bot commands', err);
    }
  })();

  bot.command('help', ctx => {
    ctx.reply(
      'សូមវាយលេខកូດផលិតផលដែលអ្នកចង់ដឹង\nហាមដកឃ្លា ឬអក្សរតូច\nឧទាហរណ៍: 1015KH'
    );
  });

  function formatSummaryMessage(rows, code) {
    if (!rows.length) {
      return `❌ មិនមានផលិតផលកូដ \`${code}\``;
    }

    const totals = {};
    rows.forEach(r => {
      const wh = r.warehouse || 'Unknown';
      const q = Number(r.qtyOnHand) || 0;
      totals[wh] = (totals[wh] || 0) + q;
    });

    const productName = rows[0].productId?.name || 'Unknown';
    let msg = `📦 Summary for *${code}* — _${productName}_\n\n`;
    for (const [warehouse, sum] of Object.entries(totals)) {
      msg += `🏭 _${warehouse}_\n   👉 ${productName} : *${sum}*\n`;
    }
    return msg;
  }

  bot.on('text', async ctx => {
    const code = ctx.message.text.trim();
    if (!/^[A-Z0-9]+$/.test(code) || code === '/help') {
      return ctx.reply('សូមវាយលេខកូដ...');
    }
    try {
      const resp = await fetchSummary(code);
      const rows = resp.data.data || [];
      const reply = formatSummaryMessage(rows, code);
      return ctx.replyWithMarkdown(reply);
    } catch (err) {
      return ctx.reply('❗ មានបញ្ហាកើតឡើង សូមព្យាយាមម្តងទៀត');
    }
  });

  app.use(bot.webhookCallback(hookPath));

  (async () => {
    try {
      await bot.telegram.setWebhook(`${WEBHOOK_URL}${hookPath}`);
      logger.info('Telegram webhook set to ' + `${WEBHOOK_URL}${hookPath}`);
    } catch (err) {
      logger.error('Failed to set webhook', err);
      process.exit(1);
    }
  })();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server + Bot listening on port ${PORT}`);
});