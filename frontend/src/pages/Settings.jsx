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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Settings</h1>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>
                    Manage your account settings and preferences
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--az-border)', overflowX: 'auto' }}>
                {tabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '10px 16px', border: 'none', background: 'transparent',
                            borderBottom: `2px solid ${activeTab === id ? 'var(--az-blue)' : 'transparent'}`,
                            color: activeTab === id ? 'var(--az-blue)' : 'var(--az-text-2)',
                            fontSize: 13, fontWeight: activeTab === id ? 600 : 400,
                            cursor: 'pointer', transition: 'all 0.12s', marginBottom: -1,
                        }}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: 24 }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>
                            Profile Information
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Username
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <User size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)' }} />
                                    <input
                                        type="text"
                                        value={profileData.username}
                                        onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                                        className="az-input"
                                        style={{ width: '100%', paddingLeft: 32 }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Email Address
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)' }} />
                                    <input
                                        type="email"
                                        value={profileData.email}
                                        onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                                        className="az-input"
                                        style={{ width: '100%', paddingLeft: 32 }}
                                        placeholder="your.email@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Organization
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Building size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)' }} />
                                    <input
                                        type="text"
                                        value={profileData.organization}
                                        onChange={e => setProfileData({ ...profileData, organization: e.target.value })}
                                        className="az-input"
                                        style={{ width: '100%', paddingLeft: 32 }}
                                        placeholder="Company name"
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Role
                                </label>
                                <select
                                    value={profileData.role}
                                    onChange={e => setProfileData({ ...profileData, role: e.target.value })}
                                    className="az-select"
                                    style={{ width: '100%' }}
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
                                className="az-btn az-btn-primary"
                                style={{ alignSelf: 'flex-start' }}
                            >
                                <Save size={14} />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Change Password */}
                        <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: 24 }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>
                                Change Password
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                        Current Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)' }} />
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={passwordData.currentPassword}
                                            onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="az-input"
                                            style={{ width: '100%', paddingLeft: 32, paddingRight: 36 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {showCurrentPassword ? <EyeOff size={14} style={{ color: 'var(--az-text-3)' }} /> : <Eye size={14} style={{ color: 'var(--az-text-3)' }} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                        New Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)' }} />
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={passwordData.newPassword}
                                            onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="az-input"
                                            style={{ width: '100%', paddingLeft: 32, paddingRight: 36 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                        >
                                            {showNewPassword ? <EyeOff size={14} style={{ color: 'var(--az-text-3)' }} /> : <Eye size={14} style={{ color: 'var(--az-text-3)' }} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                        Confirm New Password
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)' }} />
                                        <input
                                            type="password"
                                            value={passwordData.confirmPassword}
                                            onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="az-input"
                                            style={{ width: '100%', paddingLeft: 32 }}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handlePasswordChange}
                                    disabled={loading || !passwordData.currentPassword || !passwordData.newPassword}
                                    className="az-btn az-btn-primary"
                                    style={{ alignSelf: 'flex-start' }}
                                >
                                    <Key size={14} />
                                    {loading ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </div>

                        {/* Security Info */}
                        <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: 24 }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>
                                Security Information
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--az-success-bg)', borderRadius: 4 }}>
                                    <CheckCircle2 size={16} style={{ color: 'var(--az-success)' }} />
                                    <span style={{ fontSize: 13, color: 'var(--az-success)' }}>Your account is secure</span>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                                    <p style={{ margin: '0 0 8px 0' }}>Last login: {new Date().toLocaleString()}</p>
                                    <p style={{ margin: 0 }}>We recommend changing your password every 90 days.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: 24 }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>
                            Notification Preferences
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive email updates about your account' },
                                { key: 'weeklyReports', label: 'Weekly Reports', desc: 'Get weekly summary of your cloud optimization' },
                                { key: 'savingsAlerts', label: 'Savings Alerts', desc: 'Notify when new cost-saving opportunities are found' },
                                { key: 'securityAlerts', label: 'Security Alerts', desc: 'Important security and account notifications' },
                            ].map(({ key, label, desc }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: 'var(--az-bg)', borderRadius: 4 }}>
                                    <input
                                        type="checkbox"
                                        checked={notificationSettings[key]}
                                        onChange={e => setNotificationSettings({ ...notificationSettings, [key]: e.target.checked })}
                                        style={{ marginTop: 2, accentColor: 'var(--az-blue)' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 2 }}>{label}</div>
                                        <div style={{ fontSize: 12, color: 'var(--az-text-2)' }}>{desc}</div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={handleNotificationUpdate}
                                disabled={loading}
                                className="az-btn az-btn-primary"
                                style={{ alignSelf: 'flex-start' }}
                            >
                                <Save size={14} />
                                {loading ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Preferences Tab */}
                {activeTab === 'preferences' && (
                    <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: 24 }}>
                        <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>
                            Application Preferences
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Currency
                                </label>
                                <select
                                    value={preferences.currency}
                                    onChange={e => setPreferences({ ...preferences, currency: e.target.value })}
                                    className="az-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="JPY">JPY (¥)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Date Format
                                </label>
                                <select
                                    value={preferences.dateFormat}
                                    onChange={e => setPreferences({ ...preferences, dateFormat: e.target.value })}
                                    className="az-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Theme
                                </label>
                                <select
                                    value={preferences.theme}
                                    onChange={e => setPreferences({ ...preferences, theme: e.target.value })}
                                    className="az-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="light">Light</option>
                                    <option value="dark">Dark</option>
                                    <option value="auto">Auto (System)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>
                                    Language
                                </label>
                                <select
                                    value={preferences.language}
                                    onChange={e => setPreferences({ ...preferences, language: e.target.value })}
                                    className="az-select"
                                    style={{ width: '100%' }}
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
                                className="az-btn az-btn-primary"
                                style={{ alignSelf: 'flex-start' }}
                            >
                                <Save size={14} />
                                {loading ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Data & Privacy Tab */}
                {activeTab === 'data' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Export Data */}
                        <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: 24 }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>
                                Export Your Data
                            </h2>
                            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--az-text-2)' }}>
                                Download a copy of your data including cloud connections, reports, and analysis history.
                            </p>
                            <button className="az-btn az-btn-secondary">
                                <Database size={14} />
                                Export Data
                            </button>
                        </div>

                        {/* Delete Account */}
                        <div style={{ background: '#fff', border: '1px solid var(--az-error)', borderRadius: 6, padding: 24 }}>
                            <h2 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-error)' }}>
                                Delete Account
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, background: 'var(--az-error-bg)', borderRadius: 4, marginBottom: 16 }}>
                                <AlertCircle size={16} style={{ color: 'var(--az-error)', marginTop: 2, flexShrink: 0 }} />
                                <div style={{ fontSize: 13, color: 'var(--az-error)' }}>
                                    <strong>Warning:</strong> This action cannot be undone. All your data, cloud connections, and reports will be permanently deleted.
                                </div>
                            </div>
                            <button
                                onClick={handleDeleteAccount}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '8px 16px', borderRadius: 4, border: '1px solid var(--az-error)',
                                    background: 'var(--az-error)', color: '#fff', fontSize: 13, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.12s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#C42B1C')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--az-error)')}
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
