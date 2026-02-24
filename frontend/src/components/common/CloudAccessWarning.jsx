import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';

export default function CloudAccessWarning({ provider, message, onReconnect }) {
    const navigate = useNavigate();

    const handleReconnect = () => {
        if (onReconnect) {
            onReconnect();
        } else {
            navigate('/cloud/connect');
        }
    };

    return (
        <div style={{
            background: '#FFF4CE',
            border: '2px solid var(--az-warning)',
            borderRadius: 8,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 20
        }}>
            <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: 'var(--az-warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <AlertTriangle size={20} style={{ color: '#fff' }} />
            </div>

            <div style={{ flex: 1 }}>
                <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--az-text)'
                }}>
                    {provider} Credentials Invalid
                </h3>
                <p style={{
                    margin: '0 0 16px 0',
                    fontSize: 14,
                    color: 'var(--az-text-2)',
                    lineHeight: 1.5
                }}>
                    {message || `Your ${provider} credentials are no longer valid. This could be because the IAM user/service principal was deleted, access keys were rotated, or permissions were revoked.`}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button onClick={handleReconnect} icon={RefreshCw} size="sm">
                        Reconnect {provider}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                        Refresh Page
                    </Button>
                </div>
            </div>
        </div>
    );
}
