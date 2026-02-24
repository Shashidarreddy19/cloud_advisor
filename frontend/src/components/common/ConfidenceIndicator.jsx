import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export default function ConfidenceIndicator({ confidence, showLabel = true, size = 'md' }) {
    const conf = parseFloat(confidence) || 0;

    let level, color, bg, icon, label;

    if (conf >= 0.8) {
        level = 'high';
        color = 'var(--az-success)';
        bg = 'var(--az-success-bg)';
        icon = CheckCircle2;
        label = 'High Confidence';
    } else if (conf >= 0.5) {
        level = 'medium';
        color = 'var(--az-blue)';
        bg = 'var(--az-blue-light)';
        icon = Info;
        label = 'Medium Confidence';
    } else {
        level = 'low';
        color = '#8A3707';
        bg = 'var(--az-warning-bg)';
        icon = AlertCircle;
        label = 'Low Confidence';
    }

    const Icon = icon;
    const percentage = Math.round(conf * 100);

    const sizeStyles = {
        sm: { fontSize: 11, iconSize: 12, barHeight: 4 },
        md: { fontSize: 12, iconSize: 14, barHeight: 6 },
        lg: { fontSize: 13, iconSize: 16, barHeight: 8 },
    };

    const { fontSize, iconSize, barHeight } = sizeStyles[size] || sizeStyles.md;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon size={iconSize} style={{ color }} />
                    <span style={{ fontSize, fontWeight: 600, color }}>
                        {label}
                    </span>
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: showLabel ? 0 : 1 }}>
                <div
                    style={{
                        width: showLabel ? 60 : 100,
                        height: barHeight,
                        background: 'var(--az-bg)',
                        borderRadius: barHeight / 2,
                        overflow: 'hidden',
                        border: '1px solid var(--az-border)',
                    }}
                >
                    <div
                        style={{
                            width: `${percentage}%`,
                            height: '100%',
                            background: color,
                            transition: 'width 0.3s ease',
                        }}
                    />
                </div>
                <span style={{ fontSize, fontWeight: 600, color: 'var(--az-text-2)', minWidth: 32 }}>
                    {percentage}%
                </span>
            </div>
        </div>
    );
}
