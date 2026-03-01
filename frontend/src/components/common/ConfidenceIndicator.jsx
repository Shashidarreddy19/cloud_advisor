import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import Badge from './Badge';

/**
 * ConfidenceIndicator Component
 * 
 * Displays confidence score as percentage with color coding and optional warning.
 * Requirements 10.1, 10.2, 10.3, 10.4, 14.7
 */
export default function ConfidenceIndicator({ confidence, showLabel = true, size = 'md' }) {
    // Requirement 10.3: Do not display if confidence < 0.50
    if (confidence === null || confidence === undefined || confidence < 0.50) {
        return null;
    }

    const conf = parseFloat(confidence) || 0;

    let level, color, bg, icon, label, showWarning = false;

    // Requirement 10.1: High confidence (≥ 0.75) - no warnings
    if (conf >= 0.75) {
        level = 'high';
        color = 'var(--az-success)';
        bg = 'var(--az-success-bg)';
        icon = CheckCircle2;
        label = 'High Confidence';
        showWarning = false;
    }
    // Requirement 10.2: Medium confidence (≥ 0.50 and < 0.75) - show "Low confidence" warning
    else if (conf >= 0.50) {
        level = 'medium';
        color = '#8A3707';
        bg = 'var(--az-warning-bg)';
        icon = AlertCircle;
        label = 'Medium Confidence';
        showWarning = true;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
            {/* Requirement 10.2: Show "Low confidence" warning for medium confidence */}
            {showWarning && (
                <Badge color="warning" size="small">
                    Low confidence
                </Badge>
            )}
        </div>
    );
}
