const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../config/logger');
const authMiddleware = require('../middleware/auth');

// Load environment variables
require('dotenv').config();




const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = '-4871143154'; // Chat ID เริ่มต้นตามที่ระบุ

// Middleware to validate Telegram token
const validateTelegramToken = (req, res, next) => {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.error('Telegram Bot Token is not configured');
    return res.status(500).json({ message: 'Telegram Bot Token is not configured' });
  }
  next();
};

// Route to send Telegram message
router.post('/telegram/send', [authMiddleware, validateTelegramToken], async (req, res) => {
  try {
    const { chat_id, text, parse_mode } = req.body;

    // Validate required fields
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    // Use provided chat_id or default
    const targetChatId = chat_id || DEFAULT_CHAT_ID;

    // Telegram API URL
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    // Send message to Telegram
    const response = await axios.post(url, {
      chat_id: targetChatId,
      text: text.trim(),
      parse_mode: parse_mode || 'Markdown', // Default to Markdown
    });

    logger.info('Telegram message sent successfully', {
      chat_id: targetChatId,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), // Log partial text
      telegramResponse: response.data,
    });
    res.json({ message: 'Telegram notification sent successfully', chat_id: targetChatId });
  } catch (error) {
    logger.error('Error sending Telegram message:', {
      error: error.message,
      stack: error.stack,
      details: req.body,
      response: error.response?.data,
    });

    if (error.response) {
      return res.status(error.response.status).json({
        message: 'Failed to send Telegram notification',
        error: error.response.data.description || error.message,
      });
    }
    res.status(500).json({ message: 'Error sending Telegram notification', error: error.message });
  }
});

module.exports = router;