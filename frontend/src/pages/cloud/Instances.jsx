import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, RefreshCw, Search, TrendingDown, AlertTriangle } from 'lucide-react';
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

export default function Instances() {
    const navigate = useNavigate();
    const [instances, setInstances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterOpt, setFilterOpt] = useState('all');
    const userId = localStorage.getItem('userId');

    useEffect(() => { fetchInstances(); }, []);

    const fetchInstances = async (shouldSync = false) => {
        setLoading(true);
        try {
            if (shouldSync) await api.post('/cloud/sync', { userId });
            const res = await api.get(`/cloud/resources/${userId}`);
            if (res.data.success) {
                setInstances(res.data.resources.filter(r =>
                    r.service === 'EC2' || r.service === 'Virtual Machine' || r.service === 'Compute Engine' ||
                    r.resourceType?.toLowerCase().includes('instance') || r.resourceType?.toLowerCase().includes('vm')
                ));
            }
        } catch (e) { console.error('Failed to fetch instances:', e); }
        finally { setLoading(false); }
    };

    const filtered = instances.filter(i => {
        const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.resourceId.toLowerCase().includes(search.toLowerCase()) || i.region.toLowerCase().includes(search.toLowerCase());
        const matchStatus = filterStatus === 'all' || (filterStatus === 'active' && i.status === 'running') || (filterStatus === 'stopped' && i.status === 'stopped');
        const matchOpt = filterOpt === 'all' || i.optimizationStatus?.toUpperCase() === filterOpt.toUpperCase();
        return matchSearch && matchStatus && matchOpt;
    });

    const totalSavings = filtered.reduce((s, i) => s + (i.estimatedSavings || 0), 0);
    const optimized = filtered.filter(i => i.optimizationStatus === 'OPTIMAL').length;
    const needsAttn = filtered.filter(i => i.optimizationStatus !== 'OPTIMAL').length;

    if (loading) return <Loader text="Loading instances..." />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Instances</h1>
                    <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>Manage and optimize your virtual machine instances</p>
                </div>
                <Button onClick={() => fetchInstances(true)} disabled={loading} icon={RefreshCw}>Sync Resources</Button>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <StatCard icon={Server} iconBg='#EFF6FF' iconColor='var(--az-blue)' label="Total Instances" value={filtered.length} sub={`${optimized} optimized`} />
                <StatCard icon={TrendingDown} iconBg='#DFF6DD' iconColor='var(--az-success)' label="Potential Savings" value={`$${totalSavings.toFixed(2)}`} sub="per month" />
                <StatCard icon={AlertTriangle} iconBg='#FFF4CE' iconColor='var(--az-warning)' label="Needs Attention" value={needsAttn} sub="instances to optimize" />
            </div>

            {/* Filter bar */}
            <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '10px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)', pointerEvents: 'none' }} />
                    <input className="az-input" style={{ width: '100%', paddingLeft: 28 }} placeholder="Search by name, ID, or region..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="az-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="stopped">Stopped</option>
                </select>
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
                                <th>Provider</th><th>Name / ID</th><th>Type</th><th>Region</th><th>Status</th><th>Optimization</th><th>Savings</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--az-text-2)' }}>
                                    <Server size={40} style={{ color: 'var(--az-border)', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                                    <div style={{ fontWeight: 500 }}>No instances found</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>Connect your cloud account to see instances</div>
                                </td></tr>
                            ) : filtered.map(i => (
                                <tr key={i.resourceId} onClick={() => navigate(`/cloud/resource/${i._id}`, { state: { resource: i } })} style={{ cursor: 'pointer' }}>
                                    <td><ProviderBadge p={i.provider} /></td>
                                    <td>
                                        <div style={{ fontWeight: 500, color: 'var(--az-blue)', fontSize: 13 }}>{i.name}</div>
                                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--az-text-3)' }}>{i.resourceId}</div>
                                    </td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{i.resourceType}</td>
                                    <td style={{ fontSize: 12, color: 'var(--az-text-2)' }}>{i.region}</td>
                                    <td><Badge variant="success">Active</Badge></td>
                                    <td><OptBadge s={i.optimizationStatus} /></td>
                                    <td style={{ fontWeight: 600, color: i.estimatedSavings > 0 ? 'var(--az-success)' : 'var(--az-text-3)' }}>
                                        {i.estimatedSavings > 0 ? `$${i.estimatedSavings.toFixed(2)}/mo` : '—'}
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
