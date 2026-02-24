import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, RefreshCw, Search, TrendingDown, HardDrive } from 'lucide-react';
import api from '../../services/api';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';

function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub }) {
    return (
        <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 6, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={17} style={{ color: iconColor }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--az-text-2)', fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: iconColor, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--az-text-3)', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

function OptBadge({ s }) {
    if (s === 'OPTIMAL') return <Badge variant="success">Optimal</Badge>;
    if (s === 'OVERSIZED') return <Badge variant="warning">Oversized</Badge>;
    if (s === 'UNDERSIZED') return <Badge variant="danger">Undersized</Badge>;
    return <Badge variant="neutral">Unknown</Badge>;
}

function ProviderBadge({ p }) {
    const m = { AWS: '#FFF4E5,#D47A00', Azure: 'var(--az-blue-light),var(--az-blue)', GCP: '#F0FDF4,var(--az-success)' };
    const [bg, color] = (m[p] || '#F3F2F1,var(--az-text-2)').split(',');
    return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{p}</span>;
}

const formatSize = (bytes) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 1) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (gb < 1024) return `${gb.toFixed(2)} GB`;
    return `${(gb / 1024).toFixed(2)} TB`;
};

export default function Buckets() {
    const navigate = useNavigate();
    const [buckets, setBuckets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterOpt, setFilterOpt] = useState('all');
    const userId = localStorage.getItem('userId');

    useEffect(() => { fetchBuckets(); }, []);

    const fetchBuckets = async (shouldSync = false) => {
        setLoading(true);
        try {
            if (shouldSync) await api.post('/cloud/sync', { userId });
            const res = await api.get(`/cloud/resources/${userId}`);
            if (res.data.success) {
                setBuckets(res.data.resources.filter(r =>
                    r.service === 'S3' || r.service === 'Storage Account' || r.service === 'Cloud Storage' ||
                    r.resourceType?.toLowerCase().includes('bucket') || r.resourceType?.toLowerCase().includes('storage')
                ));
            }
        } catch (e) { console.error('Failed to fetch buckets:', e); }
        finally { setLoading(false); }
    };

    const filtered = buckets.filter(b => {
        const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.resourceId.toLowerCase().includes(search.toLowerCase()) || b.region.toLowerCase().includes(search.toLowerCase());
        const matchOpt = filterOpt === 'all' || b.optimizationStatus?.toUpperCase() === filterOpt.toUpperCase();
        return matchSearch && matchOpt;
    });

    const totalSavings = filtered.reduce((s, b) => s + (b.estimatedSavings || 0), 0);
    const totalSize = filtered.reduce((s, b) => s + (b.size || 0), 0);

    if (loading) return <Loader text="Loading storage buckets..." />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Storage Buckets</h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>Manage and optimize your cloud storage resources</p>
                </div>
                <Button onClick={() => fetchBuckets(true)} disabled={loading} icon={RefreshCw}>Sync Resources</Button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <StatCard icon={Archive} iconBg='#EFF6FF' iconColor='var(--az-blue)' label="Total Buckets" value={filtered.length} sub={`${formatSize(totalSize)} total`} />
                <StatCard icon={TrendingDown} iconBg='#DFF6DD' iconColor='var(--az-success)' label="Potential Savings" value={`$${totalSavings.toFixed(2)}`} sub="per month" />
                <StatCard icon={HardDrive} iconBg='#F6F0FF' iconColor='#7B2FBE' label="Total Storage" value={formatSize(totalSize)} sub="across all buckets" />
            </div>

            {/* Filter bar */}
            <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '10px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)', pointerEvents: 'none' }} />
                    <input className="az-input" style={{ width: '100%', paddingLeft: 28 }} placeholder="Search by name, ID, or region..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="az-select" value={filterOpt} onChange={e => setFilterOpt(e.target.value)}>
                    <option value="all">All Optimization</option>
                    <option value="OPTIMAL">Optimal</option>
                    <option value="OVERSIZED">Oversized</option>
                    <option value="UNDERSIZED">Undersized</option>
                </select>
            </div>

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="az-table">
                        <thead>
                            <tr>
                                <th>Provider</th><th>Name / ID</th><th>Type</th><th>Region</th><th>Size</th><th>Status</th><th>Optimization</th><th>Savings</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--az-text-2)' }}>
                                    <Archive size={40} style={{ color: 'var(--az-border)', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                                    <div style={{ fontWeight: 500 }}>No storage buckets found</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>Connect your cloud account to see storage buckets</div>
                                </td></tr>
                            ) : filtered.map(b => (
                                <tr key={b.resourceId} onClick={() => navigate(`/cloud/resource/${b._id}`, { state: { resource: b } })} style={{ cursor: 'pointer' }}>
                                    <td><ProviderBadge p={b.provider} /></td>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--az-blue)', fontSize: 13 }}>{b.name}</div>
                                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--az-text-3)' }}>{b.resourceId}</div>
                                    </td>
                                    <td style={{ fontSize: 12 }}>{b.storageClass || 'Standard'}</td>
                                    <td style={{ fontSize: 12, color: 'var(--az-text-2)' }}>{b.region}</td>
                                    <td style={{ fontSize: 12 }}>{formatSize(b.size)}</td>
                                    <td><Badge variant="success">Active</Badge></td>
                                    <td><OptBadge s={b.optimizationStatus} /></td>
                                    <td style={{ fontWeight: 600, color: b.estimatedSavings > 0 ? 'var(--az-success)' : 'var(--az-text-3)' }}>
                                        {b.estimatedSavings > 0 ? `$${b.estimatedSavings.toFixed(2)}/mo` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
