import axios from 'axios';

const API_URL = 'http://localhost:8081/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized errors
        if (error.response?.status === 401) {
            const currentPath = window.location.pathname;
            const token = localStorage.getItem('token');

            // Only redirect to login if:
            // 1. Not already on auth pages
            // 2. Not on landing/mode selection pages
            // 3. Token doesn't exist (truly unauthorized)
            const isAuthPage = currentPath.includes('/auth/');
            const isPublicPage = currentPath === '/' || currentPath === '/mode';

            if (!isAuthPage && !isPublicPage) {
                // Clear auth data
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');

                // Redirect to login with return URL
                const returnUrl = encodeURIComponent(currentPath);
                window.location.href = `/auth/login?returnUrl=${returnUrl}`;
            }
        }
        return Promise.reject(error);
    }
);

export default api;
