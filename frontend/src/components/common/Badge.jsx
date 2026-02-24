import React from 'react';

const DOT = () => (
    <span style={{ width: 6, height: 6, borderRadius: '50%', display: 'inline-block', marginRight: 4, flexShrink: 0 }} />
);

export default function Badge({ children, variant = 'neutral', className = '' }) {
    const cls = {
        neutral: 'az-badge az-badge-neutral',
        success: 'az-badge az-badge-success',
        warning: 'az-badge az-badge-warning',
        danger: 'az-badge az-badge-error',
        info: 'az-badge az-badge-info',
        primary: 'az-badge az-badge-primary',
    };

    const dotColor = {
        neutral: '#A19F9D',
        success: '#107C10',
        warning: '#D47A00',
        danger: '#D13438',
        info: '#0078D4',
        primary: '#3ABFB0',
    };

    return (
        <span className={`${cls[variant] || cls.neutral} ${className}`}>
            <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: dotColor[variant] || dotColor.neutral,
                display: 'inline-block', flexShrink: 0
            }} />
            {children}
        </span>
    );
}
