import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Plug, Server, Archive, UploadCloud,
    Lightbulb, FileText, Settings, LogOut, ChevronDown, HelpCircle
} from 'lucide-react';

const NAV_SECTIONS = [
    {
        label: 'Cloud Management',
        items: [
            { label: 'Dashboard', icon: LayoutDashboard, path: '/cloud/dashboard' },
            { label: 'Connect Cloud', icon: Plug, path: '/cloud/connect' },
            { label: 'Instances', icon: Server, path: '/cloud/instances' },
            { label: 'Buckets', icon: Archive, path: '/cloud/buckets' },
        ],
    },
    {
        label: 'CSV Analysis',
        items: [
            { label: 'Dashboard', icon: LayoutDashboard, path: '/csv/dashboard' },
            { label: 'Upload CSV', icon: UploadCloud, path: '/csv/upload' },
            { label: 'Recommendations', icon: Lightbulb, path: '/csv/recommendations' },
            { label: 'Reports', icon: FileText, path: '/csv/reports' },
        ],
    },
];

export default function UnifiedSidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const username = localStorage.getItem('user') || 'User';
    const [userOpen, setUserOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        navigate('/auth/login');
    };

    const isActive = (path) => location.pathname === path;

    return (
        <aside style={{
            width: 'var(--az-sidebar-w)',
            background: '#fff',
            borderRight: '1px solid var(--az-border)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            flexShrink: 0,
            userSelect: 'none',
        }}>

            {/* Brand */}
            <div
                onClick={() => navigate('/')}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--az-border)',
                    minHeight: 52,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--az-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
                <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: 'var(--az-blue)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="white" />
                    </svg>
                </div>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--az-text)', lineHeight: 1.2 }}>
                        Cloud Optimizer
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--az-text-2)', marginTop: 1 }}>
                        ML-Powered Platform
                    </div>
                </div>
            </div>

            {/* Nav Sections */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {NAV_SECTIONS.map((section) => (
                    <div key={section.label} style={{ marginBottom: 4 }}>
                        <div style={{
                            padding: '10px 16px 4px 16px',
                            fontSize: 10, fontWeight: 600, letterSpacing: '0.07em',
                            color: 'var(--az-text-3)', textTransform: 'uppercase',
                        }}>
                            {section.label}
                        </div>
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                            {section.items.map(({ label, icon: Icon, path }) => {
                                const active = isActive(path);
                                return (
                                    <li key={path}>
                                        <button
                                            onClick={() => navigate(path)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                                                padding: '7px 16px 7px 12px',
                                                border: 'none',
                                                borderLeft: `3px solid ${active ? 'var(--az-blue)' : 'transparent'}`,
                                                background: active ? 'var(--az-blue-light)' : 'transparent',
                                                color: active ? 'var(--az-blue)' : 'var(--az-text)',
                                                cursor: 'pointer', textAlign: 'left',
                                                fontSize: 13, fontWeight: active ? 600 : 400,
                                                transition: 'background 0.12s',
                                            }}
                                            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#F3F2F1'; } }}
                                            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; } }}
                                        >
                                            <Icon size={15} style={{ color: active ? 'var(--az-blue)' : 'var(--az-text-2)', flexShrink: 0 }} />
                                            {label}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}

                {/* Settings at bottom of nav */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--az-border)' }}>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        <li>
                            <button
                                onClick={() => navigate('/help')}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                                    padding: '7px 16px 7px 12px',
                                    border: 'none',
                                    borderLeft: `3px solid ${isActive('/help') ? 'var(--az-blue)' : 'transparent'}`,
                                    background: isActive('/help') ? 'var(--az-blue-light)' : 'transparent',
                                    color: isActive('/help') ? 'var(--az-blue)' : 'var(--az-text)',
                                    cursor: 'pointer', textAlign: 'left',
                                    fontSize: 13, fontWeight: isActive('/help') ? 600 : 400,
                                    transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => { if (!isActive('/help')) { e.currentTarget.style.background = '#F3F2F1'; } }}
                                onMouseLeave={e => { if (!isActive('/help')) { e.currentTarget.style.background = 'transparent'; } }}
                            >
                                <HelpCircle size={15} style={{ color: isActive('/help') ? 'var(--az-blue)' : 'var(--az-text-2)', flexShrink: 0 }} />
                                Help
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => navigate('/settings')}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                                    padding: '7px 16px 7px 12px',
                                    border: 'none',
                                    borderLeft: `3px solid ${isActive('/settings') ? 'var(--az-blue)' : 'transparent'}`,
                                    background: isActive('/settings') ? 'var(--az-blue-light)' : 'transparent',
                                    color: isActive('/settings') ? 'var(--az-blue)' : 'var(--az-text)',
                                    cursor: 'pointer', textAlign: 'left',
                                    fontSize: 13, fontWeight: isActive('/settings') ? 600 : 400,
                                    transition: 'background 0.12s',
                                }}
                                onMouseEnter={e => { if (!isActive('/settings')) { e.currentTarget.style.background = '#F3F2F1'; } }}
                                onMouseLeave={e => { if (!isActive('/settings')) { e.currentTarget.style.background = 'transparent'; } }}
                            >
                                <Settings size={15} style={{ color: isActive('/settings') ? 'var(--az-blue)' : 'var(--az-text-2)', flexShrink: 0 }} />
                                Settings
                            </button>
                        </li>
                    </ul>
                </div>
            </nav>

            {/* User */}
            <div style={{ borderTop: '1px solid var(--az-border)', padding: '10px 12px', position: 'relative' }}>
                <button
                    onClick={() => setUserOpen(!userOpen)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                        padding: '7px 8px', borderRadius: 4, border: 'none',
                        background: 'transparent', cursor: 'pointer', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F3F2F1')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--az-blue)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 12, textTransform: 'uppercase', flexShrink: 0,
                    }}>
                        {username.charAt(0)}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>{username}</div>
                        <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>Engineer</div>
                    </div>
                    <ChevronDown size={13} style={{ color: 'var(--az-text-3)' }} />
                </button>

                {userOpen && (
                    <div style={{
                        position: 'absolute', bottom: 'calc(100% + 4px)', left: 12, right: 12,
                        background: '#fff', borderRadius: 4, border: '1px solid var(--az-border)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', zIndex: 100,
                    }}>
                        <button
                            onClick={() => { navigate('/settings'); setUserOpen(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                width: '100%', padding: '9px 14px',
                                border: 'none', background: 'transparent',
                                color: 'var(--az-text)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--az-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <Settings size={14} /> Settings
                        </button>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                width: '100%', padding: '9px 14px',
                                border: 'none', background: 'transparent',
                                color: 'var(--az-error)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--az-error-bg)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <LogOut size={14} /> Sign Out
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
