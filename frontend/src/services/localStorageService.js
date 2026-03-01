/**
 * LocalStorage Service for Cloud Resources
 * Stores cloud instances, metrics, and recommendations in browser localStorage
 * Replaces MongoDB storage for cloud connect method
 * CRITICAL: User-specific storage to prevent data leakage between users
 */

/**
 * Get user-specific storage keys
 * SECURITY: Each user gets their own isolated storage namespace
 */
const getStorageKeys = () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        console.warn('[LocalStorage] No userId found - using default keys');
        return {
            RESOURCES: 'cloud_resources',
            LAST_SYNC: 'cloud_last_sync',
            CONNECTIONS: 'cloud_connections'
        };
    }

    // User-specific keys to prevent data leakage
    return {
        RESOURCES: `cloud_resources_${userId}`,
        LAST_SYNC: `cloud_last_sync_${userId}`,
        CONNECTIONS: `cloud_connections_${userId}`
    };
};

/**
 * Save resources to localStorage
 * @param {Array} resources - Array of resource objects
 */
export const saveResources = (resources) => {
    try {
        const STORAGE_KEYS = getStorageKeys();
        localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(resources));
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        console.log(`[LocalStorage] Saved ${resources.length} resources for user ${localStorage.getItem('userId')}`);
        return true;
    } catch (error) {
        console.error('[LocalStorage] Failed to save resources:', error);
        // Handle quota exceeded error
        if (error.name === 'QuotaExceededError') {
            console.error('[LocalStorage] Storage quota exceeded. Clearing old data...');
            clearResources();
        }
        return false;
    }
};

/**
 * Get all resources from localStorage
 * @returns {Array} Array of resource objects
 */
export const getResources = () => {
    try {
        const STORAGE_KEYS = getStorageKeys();
        const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
        if (!data) {
            return [];
        }
        const resources = JSON.parse(data);
        console.log(`[LocalStorage] Loaded ${resources.length} resources for user ${localStorage.getItem('userId')}`);
        return resources;
    } catch (error) {
        console.error('[LocalStorage] Failed to load resources:', error);
        return [];
    }
};

/**
 * Get a single resource by ID
 * @param {string} id - Resource ID
 * @returns {Object|null} Resource object or null if not found
 */
export const getResourceById = (id) => {
    try {
        const resources = getResources();
        const resource = resources.find(r => r._id === id || r.instance_id === id);
        if (resource) {
            console.log(`[LocalStorage] Found resource: ${id}`);
        } else {
            console.warn(`[LocalStorage] Resource not found: ${id}`);
        }
        return resource || null;
    } catch (error) {
        console.error('[LocalStorage] Failed to get resource by ID:', error);
        return null;
    }
};

/**
 * Clear all resources from localStorage
 */
export const clearResources = () => {
    try {
        const STORAGE_KEYS = getStorageKeys();
        localStorage.removeItem(STORAGE_KEYS.RESOURCES);
        localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
        console.log(`[LocalStorage] Cleared all resources for user ${localStorage.getItem('userId')}`);
        return true;
    } catch (error) {
        console.error('[LocalStorage] Failed to clear resources:', error);
        return false;
    }
};

/**
 * Clear all user-specific data on logout
 * SECURITY: Ensures no data persists after logout
 */
export const clearUserData = () => {
    try {
        const userId = localStorage.getItem('userId');
        if (userId) {
            // Clear user-specific keys
            localStorage.removeItem(`cloud_resources_${userId}`);
            localStorage.removeItem(`cloud_last_sync_${userId}`);
            localStorage.removeItem(`cloud_connections_${userId}`);
            console.log(`[LocalStorage] Cleared all data for user ${userId}`);
        }
        return true;
    } catch (error) {
        console.error('[LocalStorage] Failed to clear user data:', error);
        return false;
    }
};

/**
 * Get last sync timestamp
 * @returns {Date|null} Last sync date or null if never synced
 */
export const getLastSyncTime = () => {
    try {
        const STORAGE_KEYS = getStorageKeys();
        const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
        return timestamp ? new Date(timestamp) : null;
    } catch (error) {
        console.error('[LocalStorage] Failed to get last sync time:', error);
        return null;
    }
};

/**
 * Get formatted last sync time (e.g., "5 minutes ago")
 * @returns {string} Formatted time string
 */
export const getLastSyncTimeFormatted = () => {
    const lastSync = getLastSyncTime();
    if (!lastSync) {
        return 'Never';
    }

    const now = new Date();
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

/**
 * Check if resources need refresh (older than X minutes)
 * @param {number} maxAgeMinutes - Maximum age in minutes (default: 30)
 * @returns {boolean} True if refresh needed
 */
export const needsRefresh = (maxAgeMinutes = 30) => {
    const lastSync = getLastSyncTime();
    if (!lastSync) {
        return true;
    }

    const now = new Date();
    const diffMs = now - lastSync;
    const diffMins = Math.floor(diffMs / 60000);

    return diffMins >= maxAgeMinutes;
};

/**
 * Get storage usage statistics
 * @returns {Object} Storage stats
 */
export const getStorageStats = () => {
    try {
        const STORAGE_KEYS = getStorageKeys();
        const resources = getResources();
        const resourcesSize = new Blob([localStorage.getItem(STORAGE_KEYS.RESOURCES) || '']).size;
        const totalSize = new Blob([JSON.stringify(localStorage)]).size;

        return {
            resourceCount: resources.length,
            resourcesSize: (resourcesSize / 1024).toFixed(2) + ' KB',
            totalSize: (totalSize / 1024).toFixed(2) + ' KB',
            lastSync: getLastSyncTimeFormatted()
        };
    } catch (error) {
        console.error('[LocalStorage] Failed to get storage stats:', error);
        return {
            resourceCount: 0,
            resourcesSize: '0 KB',
            totalSize: '0 KB',
            lastSync: 'Never'
        };
    }
};

/**
 * Filter resources by criteria
 * @param {Object} filters - Filter criteria
 * @returns {Array} Filtered resources
 */
export const filterResources = (filters = {}) => {
    try {
        let resources = getResources();

        // Filter by cloud provider
        if (filters.cloud) {
            resources = resources.filter(r => r.cloud === filters.cloud);
        }

        // Filter by status
        if (filters.status) {
            resources = resources.filter(r => r.status?.toLowerCase() === filters.status.toLowerCase());
        }

        // Filter by optimization status
        if (filters.optimization) {
            resources = resources.filter(r => r.prediction?.toLowerCase() === filters.optimization.toLowerCase());
        }

        // Filter by search term
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            resources = resources.filter(r =>
                r.instance_id?.toLowerCase().includes(searchLower) ||
                r.instance_type?.toLowerCase().includes(searchLower) ||
                r.region?.toLowerCase().includes(searchLower)
            );
        }

        return resources;
    } catch (error) {
        console.error('[LocalStorage] Failed to filter resources:', error);
        return [];
    }
};

/**
 * Get dashboard statistics from localStorage
 * @returns {Object} Dashboard stats
 */
export const getDashboardStats = () => {
    try {
        const resources = getResources();

        const stats = {
            totalInstances: resources.length,
            runningInstances: resources.filter(r => r.status?.toLowerCase() === 'running').length,
            stoppedInstances: resources.filter(r => r.status?.toLowerCase() === 'stopped').length,
            oversizedInstances: resources.filter(r => r.prediction?.toLowerCase() === 'oversized').length,
            undersizedInstances: resources.filter(r => r.prediction?.toLowerCase() === 'undersized').length,
            optimalInstances: resources.filter(r => r.prediction?.toLowerCase() === 'optimal').length,
            totalMonthlyCost: resources.reduce((sum, r) => sum + (r.currentCostPerMonth || 0), 0),
            potentialSavings: resources.reduce((sum, r) => sum + (r.savings || 0), 0),
            byCloud: {
                aws: resources.filter(r => r.cloud === 'aws').length,
                azure: resources.filter(r => r.cloud === 'azure').length,
                gcp: resources.filter(r => r.cloud === 'gcp').length
            }
        };

        return stats;
    } catch (error) {
        console.error('[LocalStorage] Failed to get dashboard stats:', error);
        return {
            totalInstances: 0,
            runningInstances: 0,
            stoppedInstances: 0,
            oversizedInstances: 0,
            undersizedInstances: 0,
            optimalInstances: 0,
            totalMonthlyCost: 0,
            potentialSavings: 0,
            byCloud: { aws: 0, azure: 0, gcp: 0 }
        };
    }
};

/**
 * Migrate old shared data to user-specific storage
 * MIGRATION: Run once to move existing data to user-specific keys
 */
export const migrateToUserSpecificStorage = () => {
    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            console.warn('[LocalStorage] Cannot migrate - no userId found');
            return false;
        }

        // Check if old shared data exists
        const oldResources = localStorage.getItem('cloud_resources');
        const oldLastSync = localStorage.getItem('cloud_last_sync');

        if (oldResources || oldLastSync) {
            console.log('[LocalStorage] Migrating shared data to user-specific storage...');

            // Move to user-specific keys
            if (oldResources) {
                localStorage.setItem(`cloud_resources_${userId}`, oldResources);
                localStorage.removeItem('cloud_resources');
            }
            if (oldLastSync) {
                localStorage.setItem(`cloud_last_sync_${userId}`, oldLastSync);
                localStorage.removeItem('cloud_last_sync');
            }

            console.log('[LocalStorage] Migration complete');
            return true;
        }

        return false;
    } catch (error) {
        console.error('[LocalStorage] Migration failed:', error);
        return false;
    }
};

export default {
    saveResources,
    getResources,
    getResourceById,
    clearResources,
    clearUserData,
    getLastSyncTime,
    getLastSyncTimeFormatted,
    needsRefresh,
    getStorageStats,
    filterResources,
    getDashboardStats,
    migrateToUserSpecificStorage
};
