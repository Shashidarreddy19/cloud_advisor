const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

const signup = async (userData) => {
    const { username, email, password } = userData;
    const existing = await User.findOne({
        $or: [{ username }, { email }]
    });
    if (existing) {
        throw new Error("User with this username or email already exists");
    }
    const user = new User(userData);
    await user.save();
    return login(username, password);
};

const login = async (username, password) => {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
        throw new Error("Invalid username or password");
    }

    // Generate JWT
    const token = jwt.sign(
        { userId: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    return { token, username, userId: user._id };
};

const logout = (token) => {
    // Stateless JWTs cannot be invalidated without a blacklist.
    // Client-side removal is sufficient for now.
};

const validateToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return { _id: decoded.userId, username: decoded.username };
    } catch (err) {
        return null;
    }
};

module.exports = {
    signup,
    login,
    logout,
    validateToken
};
