import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import PasswordStrength from './PasswordStrength';

export default function PasswordInput({
    name,
    value,
    onChange,
    placeholder,
    label,
    required = false,
    validation,
    showStrengthIndicator = false,
    autoComplete,
    onBlur
}) {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = `input-${name}`;
    const isValid = validation?.isValid;
    const hasError = validation && !isValid && validation.message;

    return (
        <div style={{ width: '100%' }}>
            <label
                htmlFor={inputId}
                style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#2d3748',
                    marginBottom: '6px'
                }}
            >
                {label}
                {required && <span style={{ color: '#e53e3e' }}>*</span>}
            </label>
            <div style={{ position: 'relative' }}>
                <Lock
                    size={18}
                    style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#a0aec0'
                    }}
                />
                <input
                    id={inputId}
                    name={name}
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    required={required}
                    aria-invalid={hasError ? 'true' : 'false'}
                    aria-describedby={hasError ? `${inputId}-error` : undefined}
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '11px 42px 11px 42px',
                        border: `2px solid ${hasError ? '#fc8181' : isValid ? '#48bb78' : '#f0faf8'}`,
                        borderRadius: '10px',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'inherit',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        background: '#f0faf8'
                    }}
                    onFocus={(e) => {
                        if (!hasError && !isValid) {
                            e.target.style.borderColor = '#5bb8a8';
                            e.target.style.boxShadow = '0 0 0 3px rgba(91, 184, 168, 0.1)';
                        }
                    }}
                    onBlur={(e) => {
                        if (!hasError && !isValid) {
                            e.target.style.borderColor = '#f0faf8';
                            e.target.style.boxShadow = 'none';
                        }
                    }}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#5bb8a8',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1a7a6e'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#5bb8a8'}
                >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
            {hasError && (
                <p
                    id={`${inputId}-error`}
                    role="alert"
                    style={{
                        fontSize: '11px',
                        color: '#fc8181',
                        marginTop: '4px',
                        marginBottom: 0
                    }}
                >
                    {validation.message}
                </p>
            )}
            {showStrengthIndicator && value && (
                <PasswordStrength password={value} />
            )}
        </div>
    );
}
