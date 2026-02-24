import React from 'react';
import { Database, Calculator, Cloud } from 'lucide-react';

export default function PriceSourceBadge({ source, size = 'sm' }) {
    const src = (source || 'estimated').toLowerCase();

    const config = {
        database: {
            label: 'Database',
            icon: Database,
            bg: 'var(--az-blue-light)',
            color: 'var(--az-blue)',
            tooltip: 'Pricing from database',
        },
        api: {
            label: 'Cloud API',
            icon: Cloud,
            bg: 'var(--az-success-bg)',
            color: 'var(--az-success)',
            tooltip: 'Real-time pricing from cloud provider API',
        },
        estimated: {
            label: 'Estimated',
            icon: Calculator,
            bg: 'var(--az-warning-bg)',
            color: '#8A3707',
            tooltip: 'Estimated pricing (fallback)',
        },
        calculated: {
            label: 'Calculated',
            icon: Calculator,
            bg: 'var(--az-bg)',
            color: 'var(--az-text-2)',
            tooltip: 'Calculated from usage metrics',
        },
    };

    const { label, icon: Icon, bg, color, tooltip } = config[src] || config.estimated;

    const sizeStyles = {
        xs: { fontSize: 10, padding: '1px 6px', iconSize: 10 },
        sm: { fontSize: 11, padding: '2px 8px', iconSize: 12 },
        md: { fontSize: 12, padding: '3px 10px', iconSize: 14 },
    };

    const { fontSize, padding, iconSize } = sizeStyles[size] || sizeStyles.sm;

    return (
        <span
            title={tooltip}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: bg,
                color: color,
                padding: padding,
                borderRadius: 3,
                fontSize: fontSize,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
            }}
        >
            <Icon size={iconSize} strokeWidth={2} />
            {label}
        </span>
    );
}
