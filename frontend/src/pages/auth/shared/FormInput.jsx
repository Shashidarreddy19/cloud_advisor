export default function FormInput({
    name,
    type = 'text',
    value,
    onChange,
    placeholder,
    label,
    icon: Icon,
    required = false,
    validation,
    autoComplete,
    onBlur
}) {
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
                {Icon && (
                    <Icon
                        size={18}
                        style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: '#5bb8a8'
                        }}
                    />
                )}
                <input
                    id={inputId}
                    name={name}
                    type={type}
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
                        padding: Icon ? '11px 14px 11px 42px' : '11px 14px',
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
            </div>
            {hasError && (
                <p
                    id={`${inputId}-error`}
                    role="alert"
                    style={{
                        fontSize: '11px',
                        color: '#fc8181',
                        marginTop: '4px',
                        marginBottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                    }}
                >
                    {validation.message}
                </p>
            )}
        </div>
    );
}
