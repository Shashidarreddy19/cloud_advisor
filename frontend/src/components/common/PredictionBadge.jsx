import React from 'react';
import { TrendingDown, TrendingUp, CheckCircle } from 'lucide-react';

export default function PredictionBadge({ prediction, size = 'md' }) {
    const pred = (prediction || 'optimal').toLowerCase();

    const config = {
        oversized: {
            label: 'Oversized',
            icon: TrendingDown,
            bg: 'var(--az-warning-bg)',
            color: '#8A3707',
            border: '#F4C896',
        },
        undersized: {
            label: 'Undersized',
            icon: TrendingUp,
            bg: 'var(--az-error-bg)',
            color: 'var(--az-error)',
            border: '#F4B3B5',
        },
        optimal: {
            label: 'Optimal',
            icon: CheckCircle,
            bg: 'var(--az-success-bg)',
            color: 'var(--az-success)',
            border: '#A7E3A5',
        },
        downsize: {
            label: 'Downsize',
            icon: TrendingDown,
            bg: 'var(--az-warning-bg)',
            color: '#8A3707',
            border: '#F4C896',
        },
        upsize: {
            label: 'Upsize',
            icon: TrendingUp,
            bg: 'var(--az-error-bg)',
            color: 'var(--az-error)',
            border: '#F4B3B5',
        },
    };

    const { label, icon: Icon, bg, color, border } = config[pred] || config.optimal;

    const sizeStyles = {
        sm: { fontSize: 11, padding: '2px 8px', iconSize: 12 },
        md: { fontSize: 12, padding: '3px 10px', iconSize: 14 },
        lg: { fontSize: 13, padding: '4px 12px', iconSize: 16 },
    };

    const { fontSize, padding, iconSize } = sizeStyles[size] || sizeStyles.md;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: bg,
                color: color,
                padding: padding,
                borderRadius: 12,
                fontSize: fontSize,
                fontWeight: 600,
                border: `1px solid ${border}`,
            }}
        >
            <Icon size={iconSize} strokeWidth={2.5} />
            {label}
        </span>
    );
}
