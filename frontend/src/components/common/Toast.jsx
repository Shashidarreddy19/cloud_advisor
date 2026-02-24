import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// Note: For a real enterprise app, this should be a Context/Provider.
// This is a presentational component to be used within pages or a simpler wrapper.

export default function Toast({ message, type = "success", onClose, duration = 3000 }) {
    useEffect(() => {
        if (duration && onClose) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const styles = {
        success: "bg-green-50 text-green-800 border-green-200",
        error: "bg-red-50 text-red-800 border-red-200",
        warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
        info: "bg-blue-50 text-blue-800 border-blue-200"
    };

    const Icons = {
        success: CheckCircle,
        error: AlertTriangle,
        warning: AlertTriangle,
        info: Info
    };

    const Icon = Icons[type];

    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-fade-in-up md:min-w-[300px] ${styles[type]}`}>
            <Icon size={18} />
            <span className="text-sm font-bold flex-1">{message}</span>
            {onClose && (
                <button onClick={onClose} className="hover:opacity-70 transition-opacity">
                    <X size={14} />
                </button>
            )}
        </div>
    );
}
