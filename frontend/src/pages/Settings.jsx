import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Building, Lock, Bell, Globe, Palette, Database,
    Shield, Key, Trash2, Save, Eye, EyeOff, CheckCircle2, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import Toast from '../components/common/Toast';

export default function Settings() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [toastState, setToastState] = useState(null);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Profile settings
    const [profileData, setProfileData] = useState({
        username: localStorage.getItem('user') || '',
        email: '',
        organization: '',
        role: 'Cloud Engineer',
    });

    // Password settings
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    // Notification settings
    const [notificationSettings, setNotificationSettings] = useState({
        emailNotifications: true,
        weeklyReports: true,
        savingsAlerts: true,
        securityAlerts: true,
    });

    // Preferences
    const [preferences, setPreferences] = useState({
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        theme: 'light',
        language: 'en',
    });

    const showToast = (message, type = 'success') => setToastState({ message, type });

    useEffect(() => {
        fetchUserSettings();
    }, []);

    const fetchUserSettings = async () => {
        try {
            const res = await api.get('/user/settings');
            if (res.data) {
                setProfileData(prev => ({ ...prev, ...res.data.profile }));
                setNotificationSettings(prev => ({ ...prev, ...res.data.notifications }));
                setPreferences(prev => ({ ...prev, ...res.data.preferences }));
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        }
    };

    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            await api.put('/user/profile', profileData);
            localStorage.setItem('user', profileData.username);
            showToast('Profile updated successfully');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        if (passwordData.newPassword.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
            return;
        }

        setLoading(true);
        try {
            await api.put('/user/password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            showToast('Password changed successfully');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to change password', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleNotificationUpdate = async () => {
        setLoading(true);
        try {
            await api.put('/user/notifications', notificationSettings);
            showToast('Notification settings updated');
        } catch (err) {
            showToast('Failed to update notifications', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handlePreferencesUpdate = async () => {
        setLoading(true);
        try {
            await api.put('/user/preferences', preferences);
            showToast('Preferences updated');
        } catch (err) {
            showToast('Failed to update preferences', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
        if (!window.confirm('This will permanently delete all your data, cloud connections, and reports. Continue?')) return;

        try {
            await api.delete('/user/account');
            localStorage.clear();
            navigate('/auth/signup');
            showToast('Account deleted successfully');
        } catch (err) {
            showToast('Failed to delete account', 'error');
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'preferences', label: 'Preferences', icon: Palette },
        { id: 'data', label: 'Data & Privacy', icon: Database },
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div>
                <h1 className="m-0 text-xl font-semibold text-gray-900">Settings</h1>
                <p className="mt-1 text-sm text-gray-600">
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 transition-all ${activeTab === id
                            ? 'border-teal-500 text-teal-600 font-semibold'
                            : 'border-transparent text-gray-600 font-normal hover:text-teal-500'
                            }`}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 gap-4">

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="m-0 mb-4 text-base font-semibold text-gray-900">
                            Profile Information
                        </h2>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Username
                                </label>
                                <div className="relative">
                                    <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={profileData.username}
                                        onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        value={profileData.email}
                                        onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="your.email@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Organization
                                </label>
                                <div className="relative">
                                    <Building size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={profileData.organization}
                                        onChange={e => setProfileData({ ...profileData, organization: e.target.value })}
                                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="Company name"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Role
                                </label>
                                <select
                                    value={profileData.role}
                                    onChange={e => setProfileData({ ...profileData, role: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option>Cloud Engineer</option>
                                    <option>DevOps Engineer</option>
                                    <option>System Administrator</option>
                                    <option>Developer</option>
                                    <option>Manager</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            <button
                                onClick={handleProfileUpdate}
                                disabled={loading}
                                className="self-start flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-md text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Save size={14} />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <div className="flex flex-col gap-4">
                        {/* Change Password */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h2 className="m-0 mb-4 text-base font-semibold text-gray-900">
                                Change Password
                            </h2>
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                        Current Password
                                    </label>
                                    <div className="relative">
                                        <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={passwordData.currentPassword}
                                            onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="w-full pl-8 pr-9 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0"
                                        >
                                            {showCurrentPassword ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="w-full pl-8 pr-9 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-0"
                                        >
                                            {showNewPassword ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                        Confirm New Password
                                    </label>
                                    <div className="relative">
                                        <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="password"
                                            value={passwordData.confirmPassword}
                                            onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handlePasswordChange}
                                    disabled={loading || !passwordData.currentPassword || !passwordData.newPassword}
                                    className="self-start flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-md text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Key size={14} />
                                    {loading ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </div>

                        {/* Security Info */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h2 className="m-0 mb-4 text-base font-semibold text-gray-900">
                                Security Information
                            </h2>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2 p-3 bg-green-50 rounded">
                                    <CheckCircle2 size={16} className="text-green-600" />
                                    <span className="text-sm text-green-700">Your account is secure</span>
                                </div>
                                <div className="text-sm text-gray-600 leading-relaxed">
                                    <p className="mb-2">Last login: {new Date().toLocaleString()}</p>
                                    <p className="m-0">We recommend changing your password every 90 days.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="m-0 mb-4 text-base font-semibold text-gray-900">
                            Notification Preferences
                        </h2>
                        <div className="flex flex-col gap-4">
                            {[
                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive email updates about your account' },
                                { key: 'weeklyReports', label: 'Weekly Reports', desc: 'Get weekly summary of your cloud optimization' },
                                { key: 'savingsAlerts', label: 'Savings Alerts', desc: 'Notify when new cost-saving opportunities are found' },
                                { key: 'securityAlerts', label: 'Security Alerts', desc: 'Important security and account notifications' },
                            ].map(({ key, label, desc }) => (
                                <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                                    <input
                                        type="checkbox"
                                        checked={notificationSettings[key]}
                                        onChange={e => setNotificationSettings({ ...notificationSettings, [key]: e.target.checked })}
                                        className="mt-0.5 accent-teal-500"
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-gray-900 mb-0.5">{label}</div>
                                        <div className="text-xs text-gray-600">{desc}</div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={handleNotificationUpdate}
                                disabled={loading}
                                className="self-start flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-md text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Save size={14} />
                                {loading ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Preferences Tab */}
                {activeTab === 'preferences' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <h2 className="m-0 mb-4 text-base font-semibold text-gray-900">
                            Application Preferences
                        </h2>
                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Currency
                                </label>
                                <select
                                    value={preferences.currency}
                                    onChange={e => setPreferences({ ...preferences, currency: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="JPY">JPY (¥)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Date Format
                                </label>
                                <select
                                    value={preferences.dateFormat}
                                    onChange={e => setPreferences({ ...preferences, dateFormat: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Theme
                                </label>
                                <select
                                    value={preferences.theme}
                                    onChange={e => setPreferences({ ...preferences, theme: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                    <option value="auto">Auto (System)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-900 mb-1.5">
                                    Language
                                </label>
                                <select
                                    value={preferences.language}
                                    onChange={e => setPreferences({ ...preferences, language: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                >
                                    <option value="en">English</option>
                                    <option value="es">Español</option>
                                    <option value="fr">Français</option>
                                    <option value="de">Deutsch</option>
                                    <option value="ja">日本語</option>
                                </select>
                            </div>

                            <button
                                onClick={handlePreferencesUpdate}
                                disabled={loading}
                                className="self-start flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-md text-sm font-semibold hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Save size={14} />
                                {loading ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Data & Privacy Tab */}
                {activeTab === 'data' && (
                    <div className="flex flex-col gap-4">
                        {/* Export Data */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <h2 className="m-0 mb-4 text-base font-semibold text-gray-900">
                                Export Your Data
                            </h2>
                            <p className="m-0 mb-4 text-sm text-gray-600">
                                Download a copy of your data including cloud connections, reports, and analysis history.
                            </p>
                            <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors">
                                <Database size={14} />
                                Export Data
                            </button>
                        </div>

                        {/* Delete Account */}
                        <div className="bg-white border border-red-500 rounded-lg p-6">
                            <h2 className="m-0 mb-4 text-base font-semibold text-red-600">
                                Delete Account
                            </h2>
                            <div className="flex items-start gap-3 p-3 bg-red-50 rounded mb-4">
                                <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-red-700">
                                    <strong>Warning:</strong> This action cannot be undone. All your data, cloud connections, and reports will be permanently deleted.
                                </div>
                            </div>
                            <button
                                onClick={handleDeleteAccount}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:bg-red-700 transition-colors"
                            >
                                <Trash2 size={14} />
                                Delete My Account
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {toastState && <Toast message={toastState.message} type={toastState.type} onClose={() => setToastState(null)} />}
        </div>
    );
}
