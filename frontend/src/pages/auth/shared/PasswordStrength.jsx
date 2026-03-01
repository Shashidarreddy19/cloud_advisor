import { CheckCircle2, Circle } from 'lucide-react';

export default function PasswordStrength({ password }) {
    const requirements = {
        minLength: password.length >= 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasNumber: /[0-9]/.test(password)
    };

    const RequirementItem = ({ met, text }) => (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: met ? '#48bb78' : '#a0aec0',
            transition: 'color 0.2s'
        }}>
            {met ? (
                <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            ) : (
                <Circle size={14} style={{ flexShrink: 0 }} />
            )}
            <span>{text}</span>
        </div>
    );

    return (
        <div style={{
            marginTop: '8px',
            padding: '10px 12px',
            background: '#f7fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
        }}>
            <p style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#2d3748',
                marginBottom: '6px',
                marginTop: 0
            }}>
                Password must contain:
            </p>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <RequirementItem
                    met={requirements.minLength}
                    text="At least 8 characters"
                />
                <RequirementItem
                    met={requirements.hasUpperCase}
                    text="One uppercase letter"
                />
                <RequirementItem
                    met={requirements.hasNumber}
                    text="One number"
                />
            </div>
        </div>
    );
}
