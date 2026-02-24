import api from './api';

const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', response.data.username || response.data.user || email);
        localStorage.setItem('userId', response.data.userId || response.data.id);
    }
    return response.data;
};

const signup = async (name, email, password) => {
    const response = await api.post('/auth/signup', { name, email, password });
    if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', response.data.username || response.data.user || name);
        localStorage.setItem('userId', response.data.userId || response.data.id);
    }
    return response.data;
};

const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
};

const getCurrentUser = () => {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    if (!user || !token) {
        return null;
    }

    // Return user object
    return {
        username: user,
        token: token,
        userId: userId
    };
};

const authService = {
    login,
    signup,
    logout,
    getCurrentUser
};

export default authService;
