const authService = require('../services/authService');

const signup = async (req, res) => {
    try {
        const { username, email, password, organization, role, cloudProvider, termsAccepted } = req.body;
        const result = await authService.signup({ username, email, password, organization, role, cloudProvider, termsAccepted });
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await authService.login(username, password);
        res.json(result);
    } catch (e) {
        res.status(401).json({ error: e.message });
    }
};

const logout = (req, res) => {
    const token = req.headers.authorization;
    authService.logout(token);
    res.json({ message: "Logged out" });
};

module.exports = {
    signup,
    login,
    logout
};
