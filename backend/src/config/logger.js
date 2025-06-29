const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.File({ filename: 'E:/Personal Documents/Stock-Management/backend/logs/error.log', level: 'error' }),
    new transports.File({ filename: 'E:/Personal Documents/Stock-Management/backend/logs/combined.log' }),
    new transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    })
  ]
});

// ทดสอบการ log ทันทีที่โหลดไฟล์
logger.info('Logger initialized successfully');

module.exports = logger;