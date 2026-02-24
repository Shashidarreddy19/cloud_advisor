const { validateToken } = require('../services/authService');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        console.log('Auth failed: No authorization header');
        return res.status(401).json({
            error: 'Unauthorized: Missing authorization header',
            message: 'Please log in to continue'
        });
    }

    if (!authHeader.startsWith('Bearer ')) {
        console.log('Auth failed: Invalid authorization format');
        return res.status(401).json({
            error: 'Unauthorized: Invalid authorization format',
            message: 'Authorization header must start with "Bearer "'
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        console.log('Auth failed: Empty token');
        return res.status(401).json({
            error: 'Unauthorized: Empty token',
            message: 'Please log in to continue'
        });
    }

    const user = validateToken(token);

    if (!user) {
        console.log('Auth failed: Invalid or expired token');
        return res.status(401).json({
            error: 'Unauthorized: Invalid or expired token',
            message: 'Your session has expired. Please log in again.'
        });
    }

    req.user = user;
    next();
};

module.exports = authMiddleware;
