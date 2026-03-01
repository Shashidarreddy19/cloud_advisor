import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Plug, Server, Archive,
  Lightbulb, FileText, UploadCloud, Settings, LogOut, ChevronDown
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
      { label: 'Recommendations', icon: Lightbulb, path: '/csv/recommendations' },
      { label: 'Reports', icon: FileText, path: '/csv/reports' },
      { label: 'Upload CSV', icon: UploadCloud, path: '/csv/upload' },
      { label: 'Settings', icon: Settings, path: '/csv/settings' },
    ],
  },
];

export default function CloudSidebar() {
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 14px 16px',
        borderBottom: '1px solid var(--az-border)',
        minHeight: 52,
      }}>
        <img
          src="/logo.png"
          alt="Cloud Optimizer"
          style={{
            height: '32px',
            width: 'auto',
            objectFit: 'contain'
          }}
        />
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
