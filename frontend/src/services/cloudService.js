import api from './api';

const saveConfig = (userId, provider, credentials) => {
    return api.post('/cloud/config', { userId, provider, credentials });
};

const syncResources = (userId) => {
    return api.post('/cloud/sync', { userId });
};

const disconnectConfig = (userId, provider) => {
    return api.delete('/cloud/config', { data: { userId, provider } });
};

const getResources = (userId) => {
    return api.get(`/cloud/resources/${userId}`);
};

const getStatus = (userId) => {
    return api.get(`/cloud/status/${userId}`);
};

const cloudService = {
    saveConfig,
    syncResources,
    disconnectConfig,
    getResources,
    getStatus
};

export default cloudService;
