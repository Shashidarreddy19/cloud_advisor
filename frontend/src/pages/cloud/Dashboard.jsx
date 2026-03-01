import { useState, useEffect } from 'react';
import { Server, Archive, RefreshCw, Trash2, AlertTriangle, ArrowUpRight, TrendingDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import * as localStorageService from '../../services/localStorageService';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import CloudAccessWarning from '../../components/common/CloudAccessWarning';

const AZ = {
    stat: {
        wrapper: {
            background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6,
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8,
        },
        icon: (color) => ({
            width: 36, height: 36, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', background: color, flexShrink: 0,
        }),
        label: { fontSize: 12, fontWeight: 400, color: 'var(--az-text-2)', margin: 0 },
        value: { fontSize: 28, fontWeight: 600, color: 'var(--az-text)', margin: 0, lineHeight: 1.1 },
        sub: { fontSize: 12, color: 'var(--az-text-3)', margin: 0 },
    },
};

function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub, badge }) {
    return (
        <div style={AZ.stat.wrapper}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={AZ.stat.icon(iconBg)}>
                    <Icon size={18} style={{ color: iconColor }} />
                </div>
                {badge && <span style={{ fontSize: 11, background: 'var(--az-success-bg)', color: 'var(--az-success)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{badge}</span>}
            </div>
            <p style={AZ.stat.label}>{label}</p>
            <p style={AZ.stat.value}>{value}</p>
            {sub && <p style={AZ.stat.sub}>{sub}</p>}
        </div>
    );
}

export default function CloudDashboard() {
    const navigate = useNavigate();
    const [resources, setResources] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncProgress, setSyncProgress] = useState({ elapsed: 0, status: '' });
    const [activeTab, setActiveTab] = useState('instances');
    const [userId] = useState(localStorage.getItem('userId'));
    const [searchParams] = useSearchParams();
    const [cloudConfigs, setCloudConfigs] = useState([]);
    const [invalidCredentials, setInvalidCredentials] = useState([]);

    useEffect(() => {
        const initializePage = async () => {
            // SECURITY: Migrate old shared data to user-specific storage
            localStorageService.migrateToUserSpecificStorage();

            const tab = searchParams.get('tab');
            if (tab) setActiveTab(tab);

            // Check cloud configs first
            await checkCloudConfigs();

            // Load from localStorage
            loadResourcesFromLocalStorage();

            // Check if we need to auto-fetch
            const existingData = localStorageService.getResources();
            const needsRefresh = localStorageService.needsRefresh(5); // 5 minutes threshold

            // Auto-fetch immediately if (no data OR stale data)
            if (existingData.length === 0 || needsRefresh) {
                console.log('[Dashboard] Auto-fetching resources immediately...', {
                    noData: existingData.length === 0,
                    stale: needsRefresh
                });
                fetchResources(true); // No delay - fetch immediately
            }
        };

        initializePage();
    }, [searchParams]);

    const checkCloudConfigs = async () => {
        try {
            const res = await api.get(`/cloud/config/${userId}`);
            setCloudConfigs(res.data);

            // Check for invalid credentials
            const invalid = res.data.filter(config => config.status === 'INVALID');
            setInvalidCredentials(invalid);
        } catch (e) {
            console.error('Failed to fetch cloud configs:', e);
        }
    };

    const loadResourcesFromLocalStorage = () => {
        setLoading(true);
        try {
            const fetchedResources = localStorageService.getResources();
            console.log('[Dashboard] Loaded from localStorage:', fetchedResources.length, 'resources');

            setResources(fetchedResources);

            // Generate recommendations from resources that need optimization
            const recs = fetchedResources
                .filter(r => r.optimizationStatus && r.optimizationStatus !== 'OPTIMAL' && r.estimatedSavings > 0)
                .map(r => ({
                    id: r.resourceId,
                    name: r.name,
                    region: r.region,
                    finding: r.optimizationStatus === 'OVERSIZED' ? 'Oversized' : 'Undersized',
                    savings: r.estimatedSavings || 0
                }))
                .sort((a, b) => b.savings - a.savings);

            setRecommendations(recs);
        } catch (e) {
            console.error('[Dashboard] Failed to load from localStorage:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchResources = async (shouldSync = false) => {
        setLoading(true);

        if (shouldSync) {
            setSyncProgress({ elapsed: 0, status: 'Initializing...' });

            // Start timer
            const startTime = Date.now();
            const progressInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const status = elapsed < 10 ? 'Connecting to cloud...' :
                    elapsed < 20 ? 'Fetching instances...' :
                        elapsed < 40 ? 'Collecting metrics...' :
                            elapsed < 60 ? 'Running ML predictions...' :
                                'Almost done...';
                setSyncProgress({ elapsed, status });
            }, 1000);

            try {
                console.log('[Dashboard] Calling /api/cloud/fetch...');
                const syncRes = await api.post('/cloud/fetch', { userId });

                clearInterval(progressInterval);

                if (syncRes.data.success) {
                    const resources = syncRes.data.resources || [];
                    console.log('[Dashboard] Fetched', resources.length, 'resources from cloud');

                    setSyncProgress({
                        elapsed: Math.floor((Date.now() - startTime) / 1000),
                        status: `Saving ${resources.length} resources...`
                    });

                    // Save to localStorage
                    localStorageService.saveResources(resources);

                    // Reload from localStorage
                    loadResourcesFromLocalStorage();
                } else {
                    console.error('[Dashboard] Sync failed:', syncRes.data.error);
                    // Check if error is credential-related
                    if (syncRes.data.error?.includes('credentials') || syncRes.data.error?.includes('invalid')) {
                        await checkCloudConfigs();
                    }
                }
            } catch (e) {
                clearInterval(progressInterval);
                console.error('Failed to fetch dashboard data:', e);
                // Check if error is credential-related
                if (e.response?.data?.error?.includes('credentials') || e.response?.data?.error?.includes('invalid')) {
                    await checkCloudConfigs();
                }
            } finally {
                setSyncProgress({ elapsed: 0, status: '' });
            }
        } else {
            // Just reload from localStorage
            loadResourcesFromLocalStorage();
        }

        setLoading(false);
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect? This will remove all synced data.')) return;
        try {
            await api.delete('/cloud/config', { data: { userId, provider: 'AWS' } });
            await api.delete('/cloud/config', { data: { userId, provider: 'Azure' } });
            await api.delete('/cloud/config', { data: { userId, provider: 'GCP' } });

            // Clear localStorage
            localStorageService.clearResources();

            navigate('/cloud/connect');
        } catch { alert('Failed to disconnect. Please try again.'); }
    };

    const instances = resources.filter(r => r.service === 'EC2' || r.service === 'Virtual Machine' || r.service === 'Compute Engine');
    const buckets = resources.filter(r => r.service === 'S3' || r.service === 'Storage Account' || r.service === 'Cloud Storage');
    const totalSavings = resources.reduce((acc, r) => acc + (r.estimatedSavings || 0), 0);

    // Get all unique connected providers
    const connectedProviders = [...new Set(resources.map(r => r.provider))].filter(Boolean);
    const connectedProviderText = connectedProviders.length > 0
        ? connectedProviders.length === 1
            ? `${connectedProviders[0]} Connected`
            : `${connectedProviders.length} Clouds Connected`
        : 'No Cloud Connected';

    const TABS = ['instances', 'buckets'];
    const tableData = activeTab === 'instances' ? instances : buckets;

    // Check if we're currently syncing (recently connected and have few/no resources)
    const isSyncing = connectedProviders.length > 0 && resources.length < 5;
    const [autoRefresh, setAutoRefresh] = useState(false); // Disabled by default for localStorage

    // Note: Auto-refresh disabled for localStorage mode
    // Users must manually click "Sync Resources" to fetch fresh data

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Syncing Banner */}
            {(isSyncing || syncProgress.elapsed > 0) && (
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 6, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <RefreshCw size={16} style={{ color: 'var(--az-blue)', animation: 'spin 2s linear infinite' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 2 }}>
                            {syncProgress.status || 'Syncing resources from all regions...'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)' }}>
                            {syncProgress.elapsed > 0 ? (
                                <>
                                    Time elapsed: <span style={{ fontWeight: 600 }}>{syncProgress.elapsed}s</span>
                                    {syncProgress.elapsed < 60 && <span> / Estimated: 30-60s</span>}
                                    {syncProgress.elapsed > 60 && <span style={{ color: 'var(--az-warning)' }}> - Taking longer than expected</span>}
                                </>
                            ) : (
                                'This may take a few minutes. Resources will appear here as they\'re discovered.'
                            )}
                        </div>
                        {syncProgress.elapsed > 0 && (
                            <div style={{
                                width: '100%',
                                height: 4,
                                background: '#E1DFDD',
                                borderRadius: 2,
                                overflow: 'hidden',
                                marginTop: 8
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (syncProgress.elapsed / 60) * 100)}%`,
                                    background: 'var(--az-blue)',
                                    transition: 'width 1s linear',
                                    borderRadius: 2
                                }} />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        style={{
                            background: autoRefresh ? 'var(--az-blue)' : '#fff',
                            color: autoRefresh ? '#fff' : 'var(--az-blue)',
                            border: `1px solid var(--az-blue)`,
                            borderRadius: 4,
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {autoRefresh ? 'Auto-refreshing' : 'Paused'}
                    </button>
                </div>
            )}
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Cloud Overview</h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>
                        Real-time usage and optimization insights
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid var(--az-border)', borderRadius: 4, padding: '5px 12px', fontSize: 12 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--az-success)', display: 'inline-block' }} />
                        <span style={{ fontWeight: 600, color: 'var(--az-text)' }}>{connectedProviderText}</span>
                        <span style={{ color: 'var(--az-text-3)' }}>· Auto-sync active</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => fetchResources(true)} disabled={loading} title="Refresh">
                        <RefreshCw size={14} className={loading ? 'az-spin' : ''} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDisconnect} className="az-btn-danger" title="Disconnect">
                        <Trash2 size={14} />
                    </Button>
                </div>
            </div>

            {/* Invalid Credentials Warning */}
            {invalidCredentials.length > 0 && invalidCredentials.map(config => (
                <CloudAccessWarning
                    key={config.provider}
                    provider={config.provider}
                    message={config.lastError}
                    onReconnect={() => navigate('/cloud/connect')}
                />
            ))}

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <StatCard icon={Server} iconBg='#EFF6FF' iconColor='var(--az-blue)' label="Active Instances" value={instances.length} sub={`${instances.filter(i => i.optimizationStatus === 'OPTIMAL').length} optimized`} badge="Auto-Synced" />
                <StatCard icon={Archive} iconBg='#F0FDF4' iconColor='var(--az-success)' label="Storage Buckets" value={buckets.length} sub="Total assets" badge="Auto-Synced" />
                <div style={{ ...AZ.stat.wrapper, background: 'var(--az-blue)', borderColor: 'var(--az-blue)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <TrendingDown size={16} style={{ color: 'rgba(255,255,255,0.8)' }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Potential Savings</span>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1 }}>${totalSavings.toFixed(0)}<span style={{ fontSize: 16, fontWeight: 400 }}>/mo</span></div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '4px 0 8px 0' }}>Based on current utilization</p>
                    <button style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        View Details →
                    </button>
                </div>
            </div>

            {/* Content grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
                {/* Resource table */}
                <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, overflow: 'hidden' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--az-border)', background: 'var(--az-surface)' }}>
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                                    fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                                    color: activeTab === tab ? 'var(--az-blue)' : 'var(--az-text-2)',
                                    borderBottom: `2px solid ${activeTab === tab ? 'var(--az-blue)' : 'transparent'}`,
                                    transition: 'color 0.12s', marginBottom: -1,
                                }}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="az-table">
                            <thead>
                                <tr>
                                    <th>Name / ID</th>
                                    <th>Provider</th>
                                    <th>Type</th>
                                    <th>Region</th>
                                    <th>Status</th>
                                    <th>Optimization</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--az-text-2)' }}>Loading...</td></tr>
                                ) : tableData.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--az-text-2)' }}>
                                        No resources found. Connect your cloud account to sync.
                                    </td></tr>
                                ) : tableData.map(res => (
                                    <tr key={res.resourceId} onClick={() => navigate(`/cloud/resource/${res._id}`, { state: { resource: res } })} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <div style={{ fontWeight: 500, color: 'var(--az-blue)', fontSize: 13 }}>{res.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--az-text-3)', fontFamily: 'monospace' }}>{res.resourceId}</div>
                                        </td>
                                        <td><ProviderBadge p={res.provider} /></td>
                                        <td style={{ fontSize: 13, fontFamily: 'monospace' }}>{res.resourceType}</td>
                                        <td style={{ fontSize: 12, color: 'var(--az-text-2)' }}>{res.region}</td>
                                        <td><Badge variant="success">Active</Badge></td>
                                        <td><OptBadge s={res.optimizationStatus} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recommendations panel */}
                <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--az-border)', background: 'var(--az-surface)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>Optimization Highlights</span>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                        {recommendations.length > 0 ? recommendations.slice(0, 6).map((rec, i) => {
                            // Find the full resource object to get _id
                            const fullResource = resources.find(r => r.resourceId === rec.id);
                            return (
                                <div
                                    key={i}
                                    onClick={() => fullResource && navigate(`/cloud/resource/${fullResource._id}`, { state: { resource: fullResource } })}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 16px', cursor: 'pointer', transition: 'background 0.12s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--az-bg)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <AlertTriangle size={14} style={{ color: 'var(--az-warning)', marginTop: 2, flexShrink: 0 }} />
                                    <div style={{ overflow: 'hidden' }}>
                                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--az-blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.finding || 'Optimization Opportunity'}</p>
                                        <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--az-text-2)' }}>{rec.name} · {rec.region}</p>
                                        <p style={{ margin: '2px 0 0 0', fontSize: 11, fontWeight: 600, color: 'var(--az-success)' }}>Save ${rec.savings?.toFixed(2)}/mo</p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div style={{ textAlign: 'center', padding: '20px 16px', fontSize: 13, color: 'var(--az-text-2)' }}>No optimization opportunities found.</div>
                        )}
                    </div>
                    {recommendations.length > 0 && (
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--az-border)' }}>
                            <button style={{ fontSize: 12, fontWeight: 600, color: 'var(--az-blue)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                View All <ArrowUpRight size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProviderBadge({ p }) {
    const map = { AWS: { bg: '#FFF4E5', color: '#D47A00' }, Azure: { bg: 'var(--az-blue-light)', color: 'var(--az-blue)' }, GCP: { bg: '#F0FDF4', color: 'var(--az-success)' } };
    const s = map[p] || { bg: '#F3F2F1', color: 'var(--az-text-2)' };
    return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{p}</span>;
}

function OptBadge({ s }) {
    if (s === 'OPTIMAL') return <Badge variant="success">Optimal</Badge>;
    if (s === 'OVERSIZED') return <Badge variant="warning">Oversized</Badge>;
    if (s === 'UNDERSIZED') return <Badge variant="danger">Undersized</Badge>;
    return <Badge variant="neutral">—</Badge>;
}
