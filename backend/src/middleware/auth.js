const jwt = require('jsonwebtoken');
const logger = require('../config/logger'); // เพิ่มการ import logger

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      _id: decoded.id, // กำหนด _id ชัดเจน
      role: decoded.role,
      username: decoded.username,
      warehouse: decoded.warehouse
    };
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message, stack: error.stack });
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;