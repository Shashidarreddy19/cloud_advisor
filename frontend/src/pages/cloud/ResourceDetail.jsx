import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Server, Cpu, HardDrive, CheckCircle, AlertTriangle, TrendingDown, DollarSign, Activity } from 'lucide-react';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';
import api from '../../services/api';

const ROW = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--az-border)' }}>
        <span style={{ fontSize: 12, color: 'var(--az-text-2)' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--az-text)', fontFamily: typeof value === 'string' && value.includes('-') ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
);

const BAR = ({ label, value, isRunning }) => {
    if (!isRunning) {
        return (
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--az-text-2)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--az-text-3)' }}>N/A</span>
                </div>
                <div style={{ height: 6, background: 'var(--az-border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '0%', background: 'var(--az-border)', borderRadius: 3 }} />
                </div>
            </div>
        );
    }

    const pct = Math.min(100, Math.max(0, parseFloat(value) || 0));
    const color = pct > 80 ? 'var(--az-error)' : pct > 60 ? 'var(--az-warning)' : 'var(--az-blue)';
    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--az-text-2)' }}>{label}</span>
                <span style={{ fontWeight: 600, color }}>{pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--az-border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
        </div>
    );
};

export default function ResourceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { state } = useLocation();
    const [resource, setResource] = useState(state?.resource || null);
    const [loading, setLoading] = useState(!state?.resource);

    useEffect(() => {
        if (!resource) {
            api.get(`/cloud/resource/${id}`) // Changed from /cloud/resources/${id}
                .then(res => { if (res.data.success) setResource(res.data.resource); })
                .catch(e => console.error('Failed to load resource', e))
                .finally(() => setLoading(false));
        }
    }, [id, resource]);

    if (loading) return <Loader text="Loading resource details..." />;
    if (!resource) return (
        <div style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ color: 'var(--az-text-2)', marginBottom: 12 }}>Resource not found.</p>
            <Button onClick={() => navigate('/cloud/dashboard')}>← Back to Dashboard</Button>
        </div>
    );

    const isOptimal = resource.optimizationStatus === 'OPTIMAL' || resource.optimizationStatus === 'optimal' || resource.finding === 'Optimal';
    const savings = resource.estimatedSavings || resource.savings || 0;
    const currentCost = resource.estimatedMonthlyCost || resource.currentCost || resource.cost || 0;
    const cpuAvg = resource.avgCpuUtilization || resource.cpuAvg || resource.cpu_avg || 0;
    const memAvg = resource.avgMemoryUtilization || resource.memoryAvg || resource.memory_avg || 0;

    // Check if instance is running
    const isRunning = resource.state && (
        resource.state.toLowerCase() === 'running' ||
        resource.state.toLowerCase() === 'active'
    );
    const isTerminated = resource.state && (
        resource.state.toLowerCase() === 'terminated' ||
        resource.state.toLowerCase() === 'deleted'
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => navigate('/cloud/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--az-blue)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
                    <ArrowLeft size={14} /> Dashboard
                </button>
                <span style={{ color: 'var(--az-text-3)', fontSize: 13 }}>/ {resource.name}</span>
            </div>

            {/* Page header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>{resource.name}</h1>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                        {[['ID', resource.resourceId], ['Provider', resource.provider], ['Region', resource.region], ['Type', resource.resourceType]].map(([k, v]) => (
                            <span key={k} style={{ fontSize: 12, color: 'var(--az-text-2)' }}><b style={{ color: 'var(--az-text)' }}>{k}:</b> {v}</span>
                        ))}
                        {resource.state && (
                            <span style={{ fontSize: 12, color: 'var(--az-text-2)' }}>
                                <b style={{ color: 'var(--az-text)' }}>State:</b>{' '}
                                <span style={{
                                    padding: '2px 6px',
                                    borderRadius: 3,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: isRunning ? 'var(--az-success-bg)' : isTerminated ? '#f3f2f1' : 'var(--az-warning-bg)',
                                    color: isRunning ? 'var(--az-success)' : isTerminated ? 'var(--az-text-3)' : 'var(--az-warning)'
                                }}>
                                    {resource.state}
                                </span>
                            </span>
                        )}
                    </div>
                </div>
                <Badge variant={isOptimal ? 'success' : 'warning'}>{isOptimal ? 'Optimal' : 'Needs Optimization'}</Badge>
            </div>

            {/* Content grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Current Instance */}
                <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--az-border)', background: 'var(--az-surface)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Server size={15} style={{ color: 'var(--az-text-2)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>Current Configuration</span>
                    </div>
                    <div style={{ padding: '16px' }}>
                        {/* Highlight type */}
                        <div style={{ background: 'var(--az-bg)', border: '1px solid var(--az-border)', borderRadius: 4, padding: '10px 14px', marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: 'var(--az-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Instance Type</div>
                            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: 'var(--az-text)' }}>{resource.resourceType || resource.instanceType}</div>
                        </div>

                        {/* Specs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                            {[['vCPU', resource.vcpu || resource.vcpuCount || '2', 'var(--az-blue)', Cpu], ['Memory', `${resource.memory || resource.ramGb || 8} GB`, '#7B2FBE', HardDrive]].map(([l, v, c, Icon]) => (
                                <div key={l} style={{ border: '1px solid var(--az-border)', borderRadius: 4, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 4, background: c + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Icon size={14} style={{ color: c }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--az-text-3)' }}>{l}</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--az-text)' }}>{v}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Usage bars */}
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--az-text-3)', letterSpacing: '0.05em', marginBottom: 8 }}>
                                Current Usage
                                {!isRunning && (
                                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: 'var(--az-warning)', background: 'var(--az-warning-bg)', padding: '2px 6px', borderRadius: 3 }}>
                                        Instance {isTerminated ? 'Terminated' : 'Stopped'}
                                    </span>
                                )}
                            </div>
                            <BAR label="CPU Utilization" value={cpuAvg} isRunning={isRunning} />
                            <BAR label="Memory Utilization" value={memAvg} isRunning={isRunning} />
                        </div>

                        {/* Cost */}
                        <div style={{ background: '#1B1A19', color: '#fff', borderRadius: 4, padding: '12px 14px' }}>
                            <div style={{ fontSize: 11, color: '#A19F9D', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Current Monthly Cost</div>
                            <div style={{ fontSize: 28, fontWeight: 700 }}>${currentCost.toFixed(2)}</div>
                        </div>
                    </div>
                </div>

                {/* Recommendation */}
                <div style={{ background: '#fff', border: `1px solid ${isOptimal ? '#107C10' : 'var(--az-blue)'}`, borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--az-border)', background: isOptimal ? 'var(--az-success-bg)' : 'var(--az-blue-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isOptimal ? <CheckCircle size={15} style={{ color: 'var(--az-success)' }} /> : <TrendingDown size={15} style={{ color: 'var(--az-blue)' }} />}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>{isOptimal ? 'Already Optimized' : 'Recommendation'}</span>
                    </div>
                    <div style={{ padding: '16px' }}>
                        {isOptimal ? (
                            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                                <CheckCircle size={48} style={{ color: 'var(--az-success)', marginBottom: 12 }} />
                                <h3 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 600, color: 'var(--az-text)' }}>Perfect Configuration</h3>
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--az-text-2)' }}>This instance is optimally sized for its workload. No changes recommended.</p>
                                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--az-success-bg)', borderRadius: 4, fontSize: 12, color: 'var(--az-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Activity size={13} /> Utilization within optimal range. Continue monitoring.
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Recommended type */}
                                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 4, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 11, color: 'var(--az-blue)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Recommended Type</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: 'var(--az-blue)' }}>{resource.recommendedType || resource.recommended_instance || 't3.medium'}</div>
                                </div>

                                {/* Specs grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {[['vCPU', resource.recommendedVcpu || Math.ceil((resource.vcpu || 2) * 0.75), Cpu], ['Memory', `${resource.recommendedMemory || Math.ceil((resource.memory || 8) * 0.75)} GB`, HardDrive]].map(([l, v, Icon]) => (
                                        <div key={l} style={{ border: '1px solid var(--az-blue-mid)', borderRadius: 4, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <Icon size={14} style={{ color: 'var(--az-blue)' }} />
                                            <div>
                                                <div style={{ fontSize: 11, color: 'var(--az-text-3)' }}>{l}</div>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--az-blue)' }}>{v}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Savings card */}
                                <div style={{ background: 'var(--az-success)', color: '#fff', borderRadius: 4, padding: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <DollarSign size={14} />
                                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Estimated Monthly Savings</span>
                                    </div>
                                    <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>${savings.toFixed(2)}</div>
                                    <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.8)' }}>Annual: ${(savings * 12).toFixed(2)}</div>
                                </div>

                                {/* Reason */}
                                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue-mid)', borderRadius: 4, padding: '10px 14px', display: 'flex', gap: 8 }}>
                                    <AlertTriangle size={14} style={{ color: 'var(--az-blue)', marginTop: 1, flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 2 }}>Why this recommendation?</div>
                                        <div style={{ fontSize: 12, color: 'var(--az-text-2)' }}>
                                            {resource.reason || 'Based on current usage patterns, downsizing will maintain performance while reducing costs.'}
                                        </div>
                                    </div>
                                </div>

                                <Button className="w-full">Apply Recommendation</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
