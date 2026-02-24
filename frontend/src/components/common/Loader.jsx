import React from 'react';

export default function Loader({ text = 'Loading...' }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '240px', gap: 12,
        }}>
            <div style={{
                width: 28, height: 28, border: '3px solid var(--az-blue-mid)',
                borderTopColor: 'var(--az-blue)', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
            }} />
            <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: 0 }}>{text}</p>
        </div>
    );
}
