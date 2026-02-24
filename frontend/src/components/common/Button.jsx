import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    onClick,
    className = '',
    icon: Icon,
    type = 'button',
    title,
}) {
    const variantCls = {
        primary: 'az-btn az-btn-primary',
        secondary: 'az-btn az-btn-secondary',
        outline: 'az-btn az-btn-secondary',
        ghost: 'az-btn az-btn-ghost',
        danger: 'az-btn az-btn-danger',
        link: 'az-btn az-btn-ghost',
    };

    const sizeCls = {
        sm: 'text-xs',
        md: '',
        lg: 'text-base px-5',
        icon: 'px-2',
    };

    return (
        <button
            type={type}
            title={title}
            className={`${variantCls[variant] || variantCls.primary} ${sizeCls[size] || ''} ${className}`}
            onClick={onClick}
            disabled={isLoading || disabled}
        >
            {isLoading
                ? <Loader2 className="az-spin" size={14} />
                : Icon && <Icon size={14} />
            }
            {children}
        </button>
    );
}
