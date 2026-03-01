import axios from 'axios';

const API_URL = 'http://localhost:8081/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 120000, // 120 second timeout (2 minutes) for cloud operations
});

// Create a separate instance for cloud connection requests with longer timeout
export const cloudApi = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 45000, // 45 second timeout for cloud connections
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

// Add request interceptor to cloudApi as well
cloudApi.interceptors.request.use(
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
        // Handle timeout errors
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
            error.response = {
                data: {
                    error: 'Connection timed out. Please check your network connection and try again.'
                },
                status: 408
            };
        }

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

// Add response interceptor to cloudApi as well
cloudApi.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle timeout errors with more specific message for cloud connections
        if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
            error.response = {
                data: {
                    error: 'Cloud connection timed out after 45 seconds. Please verify your credentials and network connection, then try again.'
                },
                status: 408
            };
        }

        // Handle 401 Unauthorized errors
        if (error.response?.status === 401) {
            const currentPath = window.location.pathname;

            const isAuthPage = currentPath.includes('/auth/');
            const isPublicPage = currentPath === '/' || currentPath === '/mode';

            if (!isAuthPage && !isPublicPage) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('userId');

                const returnUrl = encodeURIComponent(currentPath);
                window.location.href = `/auth/login?returnUrl=${returnUrl}`;
            }
        }
        return Promise.reject(error);
    }
);

export default api;
