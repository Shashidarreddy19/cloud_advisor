import React from 'react';
import logoImage from '/logo.png';

export default function Logo({ className = "", showText = false, size = "md" }) {
    // Size variants - optimized for different placements
    const sizes = {
        xs: { width: 50, height: 'auto' },  // Extra small for compact spaces
        sm: { width: 90, height: 'auto' },  // Small for sidebar - increased for better visibility
        md: { width: 100, height: 'auto' },  // Medium for auth pages
        lg: { width: 140, height: 'auto' },  // Large for dashboard headers
        xl: { width: 175, height: 'auto' }   // Extra large for hero sections
    };

    const currentSize = sizes[size] || sizes.md;

    return (
        <div className={`flex items-center justify-center ${className}`}>
            <img
                src={logoImage}
                alt="Cloud Optimizer"
                style={{ width: currentSize.width, height: currentSize.height, maxWidth: '100%' }}
                className="object-contain"
            />
        </div>
    );
}
