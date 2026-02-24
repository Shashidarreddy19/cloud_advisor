const winston = require('winston');
const path = require('path');

// Simple console logger for now to avoid file system issues
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                })
            )
        })
    ]
});

// Add helper methods for structured logging
logger.logRequest = (req, message) => {
    logger.info(`${message} | Method: ${req.method} | Path: ${req.path} | IP: ${req.ip}`);
};

logger.logError = (error, context = {}) => {
    logger.error(`${error.message} | Context: ${JSON.stringify(context)}`);
};

logger.logServiceCall = (service, method, params) => {
    logger.debug(`Service Call: ${service}.${method} | Params: ${JSON.stringify(params)}`);
};

module.exports = logger;
