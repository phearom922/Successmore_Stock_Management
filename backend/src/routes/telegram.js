require('dotenv').config();
const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../config/logger');
const authMiddleware = require('../middleware/auth');
const Setting = require('../models/Settings');

// Middleware to validate Telegram token
const validateTelegramToken = async (req, res, next) => {
  try {
    const settings = await Setting.findOne();
    if (!settings || !settings.telegramBotToken) {
      logger.error('Telegram Bot Token is not configured in settings');
      return res.status(500).json({ message: 'Telegram Bot Token is not configured in settings' });
    }
    req.telegramBotToken = settings.telegramBotToken;
    req.telegramChatId = settings.chatId || '-4871143154';
    next();
  } catch (err) {
    logger.error('Error fetching settings for Telegram:', { error: err.message, stack: err.stack });
    return res.status(500).json({ message: 'Error fetching Telegram settings', error: err.message });
  }
};

// Route to send Telegram message
router.post('/send', [authMiddleware, validateTelegramToken], async (req, res) => {
  try {
    const { chat_id, text, parse_mode } = req.body;

    // Validate required fields
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    // Use provided chat_id or default from settings
    const targetChatId = chat_id || req.telegramChatId;
    const telegramBotToken = req.telegramBotToken;

    // Telegram API URL
    const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

    // Send message to Telegram
    const response = await axios.post(url, {
      chat_id: targetChatId,
      text: text.trim(),
      parse_mode: parse_mode || 'Markdown',
    });

    logger.info('Telegram message sent successfully', {
      chat_id: targetChatId,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
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