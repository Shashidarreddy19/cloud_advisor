import { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const currentUser = authService.getCurrentUser();
            if (currentUser) {
                setUser(currentUser);
            }
        } catch (error) {
            console.error('Error loading user:', error);
            // Clear invalid data
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
        } finally {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        const data = await authService.login(email, password);
        setUser(data);
        return data;
    };

    const signup = async (name, email, password) => {
        const data = await authService.signup(name, email, password);
        setUser(data);
        return data;
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
