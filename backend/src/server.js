require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { startCleanupJob } = require('./services/cleanupService');
const { startPolling: startInstanceStatePolling } = require('./services/instanceStatePollingService');
const { startPeriodicValidation, stopPeriodicValidation } = require('./services/credentialValidationService');
const geminiService = require('./services/geminiService');

// Routes
const authRoutes = require('./routes/authRoutes');
const cloudRoutes = require('./routes/cloudRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const optimizationRoutes = require('./routes/optimizationRoutes');
const csvRoutes = require('./routes/csvRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS Configuration - Allow frontend to access backend
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5174'],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    logger.logRequest(req, 'Incoming request');
    next();
});

// Database Connection
connectDB();

// Route Mounting
app.use('/api/auth', authRoutes);
app.use('/api/cloud', cloudRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/optimize', optimizationRoutes);
app.use('/api/csv', csvRoutes);
app.use('/api/user', userRoutes);


// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'UP', platform: 'Node.js' });
});

// Auth Test Endpoint
app.get('/api/auth/test', require('./middleware/authMiddleware'), (req, res) => {
    res.json({
        success: true,
        message: 'Authentication successful',
        user: req.user
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Error handler middleware (must be last)
app.use(errorHandler);

// Start Server
const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);

    // Initialize Gemini AI service
    geminiService.initialize();

    // Start background cleanup job
    startCleanupJob();

    // Start instance state polling (every 30 seconds)
    startInstanceStatePolling();
    logger.info('Instance state polling service started');

    // Start periodic credential validation (every 5 minutes)
    startPeriodicValidation();
    logger.info('Credential validation service started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    stopPeriodicValidation();
    server.close(() => {
        logger.info('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    stopPeriodicValidation();
    server.close(() => {
        logger.info('HTTP server closed');
    });
});
