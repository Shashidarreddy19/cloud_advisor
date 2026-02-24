import React from 'react';

export default function Card({ children, title, subtitle, action, className = '', noPadding = false }) {
    return (
        <div
            style={{
                background: 'var(--az-card)',
                border: '1px solid var(--az-border)',
                borderRadius: 6,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            className={className}
        >
            {(title || action) && (
                <div
                    style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--az-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--az-surface)',
                        borderRadius: '6px 6px 0 0',
                    }}
                >
                    <div>
                        {title && <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--az-text)' }}>{title}</h3>}
                        {subtitle && <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--az-text-2)' }}>{subtitle}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div style={noPadding ? {} : { padding: '16px' }}>
                {children}
            </div>
        </div>
    );
}
