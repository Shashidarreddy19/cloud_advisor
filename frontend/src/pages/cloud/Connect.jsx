import { useState, useEffect } from 'react';
import { Cloud, CheckCircle, AlertCircle, Shield, Server, Database, X, Trash2, Loader2 } from 'lucide-react';
import api, { cloudApi } from '../../services/api';
import Toast from '../../components/common/Toast';
import ErrorModal from '../../components/common/ErrorModal';
import { useNavigate } from 'react-router-dom';

/* ─── Reusable Azure modal field ─── */
function ModalField({ label, children }) {
    return (
        <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--az-text-2)', marginBottom: 5 }}>{label}</label>
            {children}
        </div>
    );
}

/* ─── Provider Card ─── */
function ProviderCard({ icon: Icon, iconBg, iconColor, name, description, isConnected, connectionStatus, missingPermissions, impact, accentColor, onConnect, onDisconnect, isConnecting }) {
    const isPartialAccess = connectionStatus === 'partial';
    const isFailed = connectionStatus === 'failed';

    return (
        <div style={{ background: '#fff', border: `1px solid ${isConnected ? accentColor : 'var(--az-border)'}`, borderRadius: 6, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onMouseEnter={e => { if (!isConnected) { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; } }}
            onMouseLeave={e => { if (!isConnected) { e.currentTarget.style.borderColor = 'var(--az-border)'; e.currentTarget.style.boxShadow = 'none'; } }}>
            {/* Card body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1 }}>
                <div style={{ position: 'relative', marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={28} style={{ color: iconColor }} />
                    </div>
                    {isConnected && (
                        <div style={{ position: 'absolute', top: -2, right: -4, width: 18, height: 18, background: isPartialAccess ? 'var(--az-warning)' : 'var(--az-success)', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isPartialAccess ? <AlertCircle size={10} style={{ color: '#fff' }} /> : <CheckCircle size={10} style={{ color: '#fff' }} />}
                        </div>
                    )}
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 600, color: 'var(--az-text)' }}>{name}</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.5 }}>{description}</p>
                {isConnected && (
                    <>
                        <span style={{
                            marginTop: 10,
                            background: isPartialAccess ? 'var(--az-warning-bg)' : 'var(--az-success-bg)',
                            color: isPartialAccess ? 'var(--az-warning)' : 'var(--az-success)',
                            padding: '2px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                        }}>
                            {isPartialAccess ? <><AlertCircle size={10} />Partial Access</> : <><CheckCircle size={10} />Full Access</>}
                        </span>
                        {isPartialAccess && missingPermissions && missingPermissions.length > 0 && (
                            <div style={{ marginTop: 10, width: '100%', background: 'var(--az-warning-bg)', border: '1px solid var(--az-warning)', borderRadius: 4, padding: '8px 10px', textAlign: 'left' }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--az-warning)', marginBottom: 4 }}>Missing Permissions:</div>
                                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: 'var(--az-text-2)', lineHeight: 1.4 }}>
                                    {missingPermissions.slice(0, 3).map((perm, idx) => (
                                        <li key={idx}>{perm}</li>
                                    ))}
                                    {missingPermissions.length > 3 && <li>+{missingPermissions.length - 3} more...</li>}
                                </ul>
                                {impact && impact.length > 0 && (
                                    <div style={{ marginTop: 6, fontSize: 10, color: 'var(--az-text-3)' }}>
                                        <strong>Impact:</strong> {impact.slice(0, 2).join(', ')}
                                        {impact.length > 2 && `, +${impact.length - 2} more`}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            {/* Card footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--az-border)', background: 'var(--az-bg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={onConnect} disabled={isConnecting} className="az-btn az-btn-primary" style={{ width: '100%', justifyContent: 'center', background: accentColor, borderColor: accentColor }}>
                    {isConnecting ? <><Loader2 size={13} className="az-spin" />Connecting...</> : isConnected ? 'Manage Connection' : `Connect ${name}`}
                </button>
                {isConnected && (
                    <button onClick={onDisconnect} disabled={isConnecting} className="az-btn az-btn-danger" style={{ width: '100%', justifyContent: 'center' }}>
                        <Trash2 size={13} />Disconnect
                    </button>
                )}
            </div>
        </div>
    );
}

/* ─── Azure-style modal wrapper ─── */
function Modal({ onClose, title, icon: Icon, iconBg, iconColor, children }) {
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 6, width: '100%', maxWidth: 440, border: '1px solid var(--az-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.16)', position: 'relative' }} className="animate-fade-in-up">
                {/* Modal header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--az-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 4, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={16} style={{ color: iconColor }} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--az-text)' }}>{title}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--az-text-3)', padding: 4, borderRadius: 4, display: 'flex' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--az-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <X size={16} />
                    </button>
                </div>
                <div style={{ padding: '20px' }}>{children}</div>
            </div>
        </div>
    );
}

function ConnectedBanner({ data }) {
    if (!data || data.status !== 'CONNECTED') return null;
    return (
        <div style={{ background: 'var(--az-success-bg)', border: '1px solid var(--az-success)', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <CheckCircle size={13} style={{ color: 'var(--az-success)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--az-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Already Connected</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--az-text-2)' }}>Submitting the form will update your credentials.</p>
        </div>
    );
}

export default function CloudConnect() {
    const navigate = useNavigate();
    const [connecting, setConnecting] = useState(null);
    const [toastState, setToastState] = useState(null);
    const [connectedConfig, setConnectedConfig] = useState({});
    const [errorModal, setErrorModal] = useState(null); // { error, provider }
    const [validating, setValidating] = useState(false);

    const [showAwsModal, setShowAwsModal] = useState(false);
    const [awsCredentials, setAwsCredentials] = useState({ accessKeyId: '', secretAccessKey: '', region: 'us-east-1' });
    const [availableRegions, setAvailableRegions] = useState([]);
    const [fetchingRegions, setFetchingRegions] = useState(false);
    const [regionsFetched, setRegionsFetched] = useState(false);

    const [showAzureModal, setShowAzureModal] = useState(false);
    const [azureCredentials, setAzureCredentials] = useState({ tenantId: '', clientId: '', clientSecret: '', subscriptionId: '' });

    const [showGcpModal, setShowGcpModal] = useState(false);
    const [gcpCredentials, setGcpCredentials] = useState({ serviceAccountJson: '', fileName: '' });

    useEffect(() => { fetchConfig(); }, []);

    // Poll for connection status changes every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchConfig();
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, []);

    // Auto-fetch regions when both access key and secret key are provided
    useEffect(() => {
        const fetchRegions = async () => {
            if (awsCredentials.accessKeyId && awsCredentials.secretAccessKey &&
                awsCredentials.accessKeyId.trim().length >= 16 && awsCredentials.secretAccessKey.trim().length >= 30 &&
                !regionsFetched) {

                setFetchingRegions(true);
                try {
                    const response = await api.post('/cloud/aws/regions', {
                        accessKeyId: awsCredentials.accessKeyId.trim(),
                        secretAccessKey: awsCredentials.secretAccessKey.trim()
                    });

                    if (response.data.success && response.data.regions) {
                        setAvailableRegions(response.data.regions);
                        setRegionsFetched(true);

                        // Auto-select first region if current region is not in the list
                        if (response.data.regions.length > 0) {
                            const regionNames = response.data.regions.map(r => r.regionName);
                            if (!regionNames.includes(awsCredentials.region)) {
                                setAwsCredentials(prev => ({ ...prev, region: response.data.regions[0].regionName }));
                            }
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch regions:', error);
                    // Silently fail - user can still proceed with default regions
                    // The actual credential validation will happen during connection
                } finally {
                    setFetchingRegions(false);
                }
            }
        };

        fetchRegions();
    }, [awsCredentials.accessKeyId, awsCredentials.secretAccessKey, regionsFetched]);

    const fetchConfig = async () => {
        try {
            const res = await api.get('/cloud/config');
            const configMap = {};
            res.data.forEach(c => { configMap[c.provider] = c; });

            // Check if any previously connected providers are now missing (auto-disconnected)
            const previousProviders = Object.keys(connectedConfig);
            const currentProviders = Object.keys(configMap);
            const disconnectedProviders = previousProviders.filter(p => !currentProviders.includes(p));

            if (disconnectedProviders.length > 0) {
                disconnectedProviders.forEach(provider => {
                    setToastState({
                        message: `🔒 ${provider} credentials have been deleted or revoked and were automatically disconnected`,
                        type: 'error'
                    });
                });
            }

            setConnectedConfig(configMap);
        } catch (e) { console.error('Failed to fetch config', e); }
    };

    const handleValidateCredentials = async () => {
        setValidating(true);
        try {
            const response = await api.post('/cloud/validate');
            const { valid, invalid, disconnected } = response.data;

            if (disconnected.length > 0) {
                const providers = disconnected.map(d => d.provider).join(', ');
                setToastState({
                    message: `🔒 ${providers} credentials have been deleted or revoked and were automatically disconnected`,
                    type: 'error'
                });
                await fetchConfig();
            } else if (invalid.length > 0) {
                const providers = invalid.map(i => i.provider).join(', ');
                setToastState({
                    message: `${providers} credentials have validation issues`,
                    type: 'warning'
                });
            } else if (valid.length > 0) {
                setToastState({
                    message: 'All credentials are valid',
                    type: 'success'
                });
            } else {
                setToastState({
                    message: 'No connected cloud accounts to validate',
                    type: 'info'
                });
            }
        } catch (e) {
            setToastState({
                message: e.response?.data?.error || 'Failed to validate credentials',
                type: 'error'
            });
        } finally {
            setValidating(false);
        }
    };

    const handleConnect = (p) => {
        if (p === 'aws') {
            // Reset regions state when opening modal
            setRegionsFetched(false);
            setAvailableRegions([]);
            setShowAwsModal(true);
        }
        else if (p === 'azure') setShowAzureModal(true);
        else if (p === 'gcp') setShowGcpModal(true);
    };

    const handleDisconnect = async (provider) => {
        if (!window.confirm(`Disconnect ${provider}? All synced resources will be removed.`)) return;
        try {
            const userId = localStorage.getItem('userId');
            await api.post('/cloud/disconnect', { userId, provider });
            setToastState({ message: `${provider} disconnected`, type: 'success' });
            await fetchConfig();
        } catch (e) {
            setToastState({ message: e.response?.data?.error || `Failed to disconnect ${provider}`, type: 'error' });
        }
    };

    const submitAwsCredentials = async (e) => {
        e.preventDefault();
        setConnecting('aws');
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) { setToastState({ message: 'Session expired. Please log in.', type: 'error' }); setTimeout(() => navigate('/auth/login'), 2000); return; }

            // Trim credentials to remove any accidental whitespace
            const trimmedCredentials = {
                accessKeyId: awsCredentials.accessKeyId.trim(),
                secretAccessKey: awsCredentials.secretAccessKey.trim(),
                region: awsCredentials.region
            };

            // Use cloudApi with longer timeout for cloud connections
            await cloudApi.post('/cloud/config', { userId, provider: 'AWS', credentials: trimmedCredentials });
            setToastState({ message: 'AWS connected! Fetching resources from all regions...', type: 'success' });
            setShowAwsModal(false);
            // Redirect immediately - resources will appear as they're fetched
            setTimeout(() => navigate('/cloud/dashboard'), 1500);
        } catch (e) {
            // Show detailed error modal instead of toast
            setErrorModal({ error: e.response?.data?.error || e.message, provider: 'AWS' });
            setShowAwsModal(false);
        } finally { setConnecting(null); }
    };

    const submitCredentials = async (e, provider, credentials, setModal) => {
        e.preventDefault();
        setConnecting(provider.toLowerCase());
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) { setToastState({ message: 'Session expired. Please log in.', type: 'error' }); setTimeout(() => navigate('/auth/login'), 2000); return; }

            // Use cloudApi with longer timeout for cloud connections
            const response = await cloudApi.post('/cloud/config', { userId, provider, credentials });
            const { message, warnings, limitedAccess } = response.data;
            let msg = message || `Successfully connected to ${provider}!`;
            if (limitedAccess && warnings?.length > 0) {
                const req = warnings.filter(w => w.required);
                if (req.length > 0) msg = `Connected with limited access. ${req.length} required API(s) unavailable.`;
            }
            setToastState({ message: msg, type: limitedAccess ? 'warning' : 'success' });
            setModal(false);
            setTimeout(() => navigate('/cloud/dashboard'), 1500);
        } catch (e) {
            // Show detailed error modal instead of toast
            setErrorModal({ error: e.response?.data?.error || e.message, provider });
            setModal(false);
        } finally { setConnecting(null); }
    };

    const inputStyle = { width: '100%', boxSizing: 'border-box' };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--az-success-bg)', border: '1px solid var(--az-success)', borderRadius: 12, padding: '3px 12px', fontSize: 12, fontWeight: 600, color: 'var(--az-success)', marginBottom: 12 }}>
                    <Shield size={12} />Secure Connection
                </div>
                <h1 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 600, color: 'var(--az-text)' }}>Connect Your Cloud</h1>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--az-text-2)' }}>Select a provider to start monitoring your infrastructure. We only request <strong>read-only</strong> permissions.</p>

                {/* Validation button */}
                {Object.keys(connectedConfig).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <button
                            onClick={handleValidateCredentials}
                            disabled={validating}
                            className="az-btn az-btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            {validating ? (
                                <>
                                    <Loader2 size={13} className="az-spin" />
                                    Validating...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={13} />
                                    Validate All Credentials
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Provider cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <ProviderCard
                    icon={Server}
                    iconBg="#FFF4E5"
                    iconColor="#FF9900"
                    name="Amazon Web Services"
                    description="Connect via IAM Role or Access Keys."
                    isConnected={connectedConfig['AWS']?.status === 'CONNECTED'}
                    connectionStatus={connectedConfig['AWS']?.connection_status}
                    missingPermissions={connectedConfig['AWS']?.missing_permissions}
                    impact={connectedConfig['AWS']?.impact}
                    accentColor="#FF9900"
                    onConnect={() => handleConnect('aws')}
                    onDisconnect={() => handleDisconnect('AWS')}
                    isConnecting={connecting === 'aws'}
                />
                <ProviderCard
                    icon={Database}
                    iconBg="var(--az-blue-light)"
                    iconColor="var(--az-blue)"
                    name="Microsoft Azure"
                    description="Connect via Service Principal."
                    isConnected={connectedConfig['Azure']?.status === 'CONNECTED'}
                    connectionStatus={connectedConfig['Azure']?.connection_status}
                    missingPermissions={connectedConfig['Azure']?.missing_permissions}
                    impact={connectedConfig['Azure']?.impact}
                    accentColor="var(--az-blue)"
                    onConnect={() => handleConnect('azure')}
                    onDisconnect={() => handleDisconnect('Azure')}
                    isConnecting={connecting === 'azure'}
                />
                <ProviderCard
                    icon={Cloud}
                    iconBg="#EEF2FF"
                    iconColor="#4285F4"
                    name="Google Cloud"
                    description="Connect via Service Account JSON."
                    isConnected={connectedConfig['GCP']?.status === 'CONNECTED'}
                    connectionStatus={connectedConfig['GCP']?.connection_status}
                    missingPermissions={connectedConfig['GCP']?.missing_permissions}
                    impact={connectedConfig['GCP']?.impact}
                    accentColor="#4285F4"
                    onConnect={() => handleConnect('gcp')}
                    onDisconnect={() => handleDisconnect('GCP')}
                    isConnecting={connecting === 'gcp'}
                />
            </div>

            {/* Security info bar */}
            <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--az-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CheckCircle size={18} style={{ color: 'var(--az-success)' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>SOC2 Type II Compliant</h4>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--az-text-2)' }}>Your data is encrypted at rest and in transit. We adhere to the principle of least privilege.</p>
                </div>
                <button className="az-btn az-btn-secondary" style={{ flexShrink: 0 }}>View Security Docs</button>
            </div>

            {toastState && <Toast message={toastState.message} type={toastState.type} onClose={() => setToastState(null)} />}

            {/* Error Modal */}
            {errorModal && (
                <ErrorModal
                    error={errorModal.error}
                    provider={errorModal.provider}
                    onClose={() => setErrorModal(null)}
                    onRetry={() => {
                        setErrorModal(null);
                        // Re-open the appropriate modal
                        if (errorModal.provider === 'AWS') setShowAwsModal(true);
                        else if (errorModal.provider === 'Azure') setShowAzureModal(true);
                        else if (errorModal.provider === 'GCP') setShowGcpModal(true);
                    }}
                />
            )}

            {/* AWS Modal */}
            {showAwsModal && (
                <Modal onClose={() => setShowAwsModal(false)} title="Connect AWS" icon={Server} iconBg="#FFF4E5" iconColor="#FF9900">
                    <ConnectedBanner data={connectedConfig['AWS']} />

                    {/* Info box for credentials */}
                    <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue-mid)', borderRadius: 4, padding: '10px 12px', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <AlertCircle size={14} style={{ color: 'var(--az-blue)', marginTop: 1, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 6px 0', fontSize: 12, fontWeight: 600, color: 'var(--az-blue)' }}>How to get AWS credentials:</p>
                                <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: 'var(--az-text-2)', lineHeight: 1.5 }}>
                                    <li>Go to AWS Console → IAM → Users</li>
                                    <li>Create a new user or select existing user</li>
                                    <li>Go to "Security credentials" tab</li>
                                    <li>Click "Create access key"</li>
                                    <li>Copy Access Key ID and Secret Access Key</li>
                                </ol>
                                <p style={{ margin: '6px 0 0 0', fontSize: 11, color: 'var(--az-text-3)' }}>
                                    <strong>Note:</strong> Ensure the IAM user has read-only permissions for EC2, CloudWatch, and S3.
                                </p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={submitAwsCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <ModalField label="Access Key ID"><input type="text" name="accessKeyId" value={awsCredentials.accessKeyId} onChange={e => setAwsCredentials({ ...awsCredentials, accessKeyId: e.target.value })} className="az-input" style={inputStyle} placeholder="AKIA..." required /></ModalField>
                        <ModalField label="Secret Access Key"><input type="password" name="secretAccessKey" value={awsCredentials.secretAccessKey} onChange={e => setAwsCredentials({ ...awsCredentials, secretAccessKey: e.target.value })} className="az-input" style={inputStyle} required /></ModalField>
                        <ModalField label={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>Region</span>
                                {fetchingRegions && <Loader2 size={12} className="az-spin" style={{ color: 'var(--az-blue)' }} />}
                                {regionsFetched && availableRegions.length > 0 && (
                                    <span style={{ fontSize: 10, color: 'var(--az-success)', fontWeight: 600 }}>
                                        ✓ {availableRegions.length} regions available
                                    </span>
                                )}
                            </div>
                        }>
                            <select name="region" value={awsCredentials.region} onChange={e => setAwsCredentials({ ...awsCredentials, region: e.target.value })} className="az-select" style={inputStyle} disabled={fetchingRegions}>
                                {fetchingRegions ? (
                                    <option>Loading available regions...</option>
                                ) : availableRegions.length > 0 ? (
                                    // Show fetched regions grouped by continent
                                    <>
                                        {/* Group regions by prefix */}
                                        {availableRegions.filter(r => r.regionName.startsWith('us-')).length > 0 && (
                                            <optgroup label="United States">
                                                {availableRegions.filter(r => r.regionName.startsWith('us-')).map(region => (
                                                    <option key={region.regionName} value={region.regionName}>
                                                        {region.regionName}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {availableRegions.filter(r => r.regionName.startsWith('ap-')).length > 0 && (
                                            <optgroup label="Asia Pacific">
                                                {availableRegions.filter(r => r.regionName.startsWith('ap-')).map(region => (
                                                    <option key={region.regionName} value={region.regionName}>
                                                        {region.regionName}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {availableRegions.filter(r => r.regionName.startsWith('ca-')).length > 0 && (
                                            <optgroup label="Canada">
                                                {availableRegions.filter(r => r.regionName.startsWith('ca-')).map(region => (
                                                    <option key={region.regionName} value={region.regionName}>
                                                        {region.regionName}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {availableRegions.filter(r => r.regionName.startsWith('eu-')).length > 0 && (
                                            <optgroup label="Europe">
                                                {availableRegions.filter(r => r.regionName.startsWith('eu-')).map(region => (
                                                    <option key={region.regionName} value={region.regionName}>
                                                        {region.regionName}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {availableRegions.filter(r => r.regionName.startsWith('sa-')).length > 0 && (
                                            <optgroup label="South America">
                                                {availableRegions.filter(r => r.regionName.startsWith('sa-')).map(region => (
                                                    <option key={region.regionName} value={region.regionName}>
                                                        {region.regionName}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {availableRegions.filter(r => r.regionName.startsWith('me-') || r.regionName.startsWith('il-')).length > 0 && (
                                            <optgroup label="Middle East">
                                                {availableRegions.filter(r => r.regionName.startsWith('me-') || r.regionName.startsWith('il-')).map(region => (
                                                    <option key={region.regionName} value={region.regionName}>
                                                        {region.regionName}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {availableRegions.filter(r => r.regionName.startsWith('af-')).length > 0 && (
                                            <optgroup label="Africa">
                                                {availableRegions.filter(r => r.regionName.startsWith('af-')).map(region => (
                                                    <option key={region.regionName} value={region.regionName}>
                                                        {region.regionName}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </>
                                ) : (
                                    // Show default regions if not fetched yet
                                    <>
                                        <optgroup label="United States">
                                            <option value="us-east-1">N. Virginia (us-east-1)</option>
                                            <option value="us-east-2">Ohio (us-east-2)</option>
                                            <option value="us-west-1">N. California (us-west-1)</option>
                                            <option value="us-west-2">Oregon (us-west-2)</option>
                                        </optgroup>
                                        <optgroup label="Asia Pacific">
                                            <option value="ap-south-1">Mumbai (ap-south-1)</option>
                                            <option value="ap-northeast-3">Osaka (ap-northeast-3)</option>
                                            <option value="ap-northeast-2">Seoul (ap-northeast-2)</option>
                                            <option value="ap-southeast-1">Singapore (ap-southeast-1)</option>
                                            <option value="ap-southeast-2">Sydney (ap-southeast-2)</option>
                                            <option value="ap-northeast-1">Tokyo (ap-northeast-1)</option>
                                        </optgroup>
                                        <optgroup label="Canada">
                                            <option value="ca-central-1">Central (ca-central-1)</option>
                                        </optgroup>
                                        <optgroup label="Europe">
                                            <option value="eu-central-1">Frankfurt (eu-central-1)</option>
                                            <option value="eu-west-1">Ireland (eu-west-1)</option>
                                            <option value="eu-west-2">London (eu-west-2)</option>
                                            <option value="eu-west-3">Paris (eu-west-3)</option>
                                            <option value="eu-north-1">Stockholm (eu-north-1)</option>
                                        </optgroup>
                                        <optgroup label="South America">
                                            <option value="sa-east-1">São Paulo (sa-east-1)</option>
                                        </optgroup>
                                    </>
                                )}
                            </select>
                        </ModalField>
                        <button type="submit" disabled={connecting === 'aws'} className="az-btn az-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8, background: '#FF9900', borderColor: '#FF9900' }}>
                            {connecting === 'aws' ? <><Loader2 size={14} className="az-spin" />Verifying credentials (may take up to 45s)...</> : 'Connect AWS Account'}
                        </button>
                    </form>
                </Modal>
            )}

            {/* Azure Modal */}
            {showAzureModal && (
                <Modal onClose={() => setShowAzureModal(false)} title="Connect Azure" icon={Database} iconBg="var(--az-blue-light)" iconColor="var(--az-blue)">
                    <ConnectedBanner data={connectedConfig['Azure']} />
                    <form onSubmit={(e) => submitCredentials(e, 'Azure', azureCredentials, setShowAzureModal)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <ModalField label="Tenant ID"><input type="text" name="tenantId" value={azureCredentials.tenantId} onChange={e => setAzureCredentials({ ...azureCredentials, tenantId: e.target.value })} className="az-input" style={inputStyle} required /></ModalField>
                        <ModalField label="Client ID"><input type="text" name="clientId" value={azureCredentials.clientId} onChange={e => setAzureCredentials({ ...azureCredentials, clientId: e.target.value })} className="az-input" style={inputStyle} required /></ModalField>
                        <ModalField label="Client Secret"><input type="password" name="clientSecret" value={azureCredentials.clientSecret} onChange={e => setAzureCredentials({ ...azureCredentials, clientSecret: e.target.value })} className="az-input" style={inputStyle} required /></ModalField>
                        <ModalField label="Subscription ID"><input type="text" name="subscriptionId" value={azureCredentials.subscriptionId} onChange={e => setAzureCredentials({ ...azureCredentials, subscriptionId: e.target.value })} className="az-input" style={inputStyle} required /></ModalField>
                        <button type="submit" disabled={connecting === 'azure'} className="az-btn az-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                            {connecting === 'azure' ? <><Loader2 size={14} className="az-spin" />Verifying credentials (may take up to 45s)...</> : 'Connect Azure Account'}
                        </button>
                    </form>
                </Modal>
            )}

            {/* GCP Modal */}
            {showGcpModal && (
                <Modal onClose={() => setShowGcpModal(false)} title="Connect GCP" icon={Cloud} iconBg="#EEF2FF" iconColor="#4285F4">
                    <ConnectedBanner data={connectedConfig['GCP']} />
                    <form onSubmit={(e) => submitCredentials(e, 'GCP', gcpCredentials, setShowGcpModal)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <ModalField label="Service Account JSON">
                            <div style={{ border: `2px dashed ${gcpCredentials.fileName ? 'var(--az-success)' : 'var(--az-border-dark)'}`, borderRadius: 4, padding: '20px', textAlign: 'center', transition: 'border-color 0.15s', cursor: 'pointer' }}>
                                <div style={{ marginBottom: 8 }}>
                                    {gcpCredentials.fileName ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--az-success)' }}>
                                            <CheckCircle size={16} />
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{gcpCredentials.fileName}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Cloud size={28} style={{ color: 'var(--az-text-3)', marginBottom: 8 }} />
                                            <p style={{ margin: 0, fontSize: 13, color: 'var(--az-text-2)' }}>Click to upload or drag & drop</p>
                                            <p style={{ margin: '4px 0 0 0', fontSize: 11, color: 'var(--az-text-3)' }}>JSON file up to 100KB</p>
                                        </>
                                    )}
                                </div>
                                <input type="file" accept=".json" style={{ display: 'none' }} id="gcp-json" onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) { const r = new FileReader(); r.onload = (ev) => setGcpCredentials({ ...gcpCredentials, serviceAccountJson: ev.target.result, fileName: file.name }); r.readAsText(file); }
                                }} />
                                <label htmlFor="gcp-json" className="az-btn az-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', marginTop: 8 }}>
                                    {gcpCredentials.fileName ? 'Change File' : 'Browse File'}
                                </label>
                            </div>
                        </ModalField>
                        <button type="submit" disabled={connecting === 'gcp' || !gcpCredentials.serviceAccountJson} className="az-btn az-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8, background: '#4285F4', borderColor: '#4285F4' }}>
                            {connecting === 'gcp' ? <><Loader2 size={14} className="az-spin" />Verifying credentials (may take up to 45s)...</> : 'Connect GCP Account'}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}
