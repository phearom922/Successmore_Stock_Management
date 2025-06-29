const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

require('dotenv').config();

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logDirectory = process.env.LOG_DIR || path.join(__dirname, '../../logs');

const logger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new DailyRotateFile({
      filename: `${logDirectory}/error-%DATE%.log`,
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      zippedArchive: true
    }),
    new DailyRotateFile({
      filename: `${logDirectory}/combined-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      zippedArchive: true
    }),
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