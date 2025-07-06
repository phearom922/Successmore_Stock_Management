const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

require('dotenv').config();

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${message}${stack ? `\n${stack}` : ''}`;
});

const logDirectory = process.env.LOG_DIR || path.join(__dirname, '../../logs');

const logger = createLogger({
  level: 'info',
  format: combine(
    errors({ stack: true }), // เพิ่มการจัดการ Error Stack
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

logger.info('Logger initialized successfully');

module.exports = logger;