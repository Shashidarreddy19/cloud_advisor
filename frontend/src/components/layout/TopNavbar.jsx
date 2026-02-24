import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, LogOut, ChevronDown } from 'lucide-react';

const TITLES = {
    '/cloud/dashboard': 'Cloud Overview',
    '/cloud/connect': 'Connect Cloud',
    '/cloud/instances': 'Instances',
    '/cloud/buckets': 'Storage Buckets',
    '/csv/dashboard': 'CSV Dashboard',
    '/csv/upload': 'Upload CSV',
    '/csv/recommendations': 'Recommendations',
    '/csv/reports': 'Reports',
    '/csv/settings': 'Settings',
};

export default function TopNavbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const username = localStorage.getItem('user') || 'User';
    const [showUser, setShowUser] = useState(false);
    const [search, setSearch] = useState('');

    const pageTitle = TITLES[location.pathname] || 'Cloud Optimizer';

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        navigate('/auth/login');
    };

    return (
        <header style={{
            height: 'var(--az-navbar-h)',
            background: '#fff',
            borderBottom: '1px solid var(--az-border)',
            display: 'flex', alignItems: 'center',
            padding: '0 16px 0 20px',
            gap: 16, flexShrink: 0, zIndex: 50, position: 'relative',
        }}>
            {/* Page title / breadcrumb */}
            <div style={{ flex: '0 0 auto', minWidth: 140 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)' }}>
                    {pageTitle}
                </span>
            </div>

            {/* Azure-style search bar */}
            <div style={{
                flex: 1, maxWidth: 480,
                position: 'relative', display: 'flex', alignItems: 'center',
            }}>
                <Search size={14} style={{ position: 'absolute', left: 9, color: 'var(--az-text-3)', pointerEvents: 'none' }} />
                <input
                    type="text"
                    placeholder="Search resources, instances, buckets..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: '100%', height: 30, padding: '0 10px 0 30px',
                        border: '1px solid var(--az-border-dark)', borderRadius: 4,
                        fontSize: 13, color: 'var(--az-text)', background: 'var(--az-bg)',
                        outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--az-blue)'; e.target.style.boxShadow = '0 0 0 2px var(--az-blue-mid)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--az-border-dark)'; e.target.style.boxShadow = 'none'; }}
                />
            </div>

            <div style={{ flex: 1 }} />

            {/* Notification bell */}
            <button
                style={{
                    width: 32, height: 32, borderRadius: 4, border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--az-text-2)', transition: 'background 0.12s',
                    position: 'relative',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--az-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="Notifications"
            >
                <Bell size={16} />
            </button>

            {/* User avatar */}
            <div style={{ position: 'relative' }}>
                <button
                    onClick={() => setShowUser(!showUser)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '4px 8px', borderRadius: 4, border: 'none',
                        background: 'transparent', cursor: 'pointer', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--az-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: 'var(--az-blue)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 12, textTransform: 'uppercase', flexShrink: 0,
                    }}>
                        {username.charAt(0)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--az-text)' }}>{username}</span>
                    <ChevronDown size={12} style={{ color: 'var(--az-text-3)' }} />
                </button>

                {showUser && (
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                        background: '#fff', borderRadius: 4, border: '1px solid var(--az-border)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 200, overflow: 'hidden',
                    }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--az-border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>{username}</div>
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>Cloud Engineer</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px',
                                border: 'none', background: 'transparent', color: 'var(--az-error)',
                                fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'background 0.12s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--az-error-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <LogOut size={14} /> Sign Out
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
