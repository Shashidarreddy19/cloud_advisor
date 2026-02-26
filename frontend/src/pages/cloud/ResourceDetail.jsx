import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Server, Cpu, HardDrive, CheckCircle, AlertTriangle, TrendingDown, DollarSign, Activity, Info, ChevronDown, ChevronUp } from 'lucide-react';
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

// Helper function to format relative time
const getRelativeTime = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
};

const BAR = ({ label, value, isRunning, showTooltip = false }) => {
    // Check for null/undefined explicitly (not just falsy)
    const isNull = value === null || value === undefined;

    if (!isRunning || isNull) {
        return (
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--az-text-2)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--az-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        N/A
                        {isNull && showTooltip && (
                            <span title="Memory metrics require CloudWatch Agent inside the instance." style={{ cursor: 'help' }}>
                                <Info size={12} style={{ color: 'var(--az-text-3)' }} />
                            </span>
                        )}
                    </span>
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
    const [savingsExpanded, setSavingsExpanded] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Fetch resource data
    const fetchResource = async () => {
        try {
            const res = await api.get(`/cloud/resource/${id}`);
            if (res.data.success) {
                setResource(res.data.resource);
            }
        } catch (e) {
            console.error('Failed to load resource', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!resource) {
            fetchResource();
        }
    }, [id, resource]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;

        const intervalId = setInterval(() => {
            console.log('[Auto-refresh] Fetching latest resource data...');
            fetchResource();
        }, 30000); // 30 seconds

        return () => clearInterval(intervalId);
    }, [id, autoRefresh]);

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

    // Check if instance is running/stopped/terminated
    const instanceState = (resource.state || '').toLowerCase();
    const isRunning = instanceState === 'running' || instanceState === 'active';
    const isStopped = instanceState === 'stopped' || instanceState === 'deallocated';
    const isTerminated = instanceState === 'terminated' || instanceState === 'deleted';

    // Pricing source information
    const priceSource = resource.price_source || resource.priceSource || 'cached';
    const priceLastUpdated = resource.price_last_updated || resource.priceLastUpdated;
    const isLivePricing = priceSource === 'live';

    // Prediction confidence (convert to percentage if needed)
    const predictionConfidence = resource.prediction_confidence || resource.predictionConfidence || 0;
    const confidencePercent = predictionConfidence > 1 ? predictionConfidence : predictionConfidence * 100;
    const isHighConfidence = confidencePercent >= 75;
    const isLowConfidence = confidencePercent < 50;

    // Architecture & compatibility info
    const architecture = resource.architecture || 'x86_64';
    const instanceFamily = resource.instance_family || resource.instanceFamily;
    const isAvailableInRegion = resource.available_in_region !== false;

    // Calculate if Apply button should be disabled
    const disableApply = isStopped || isLowConfidence || !isAvailableInRegion;

    // Get disable reason for tooltip
    const getDisableReason = () => {
        if (isStopped) return 'Instance is currently stopped';
        if (isLowConfidence) return `Prediction confidence too low (${confidencePercent.toFixed(0)}%)`;
        if (!isAvailableInRegion) return 'Recommended instance not available in this region';
        return '';
    };

    // Determine status badge
    const getStatusBadge = () => {
        if (isStopped) return { variant: 'default', text: 'Stopped' };
        if (isTerminated) return { variant: 'default', text: 'Terminated' };
        // Check for null explicitly - CPU is required, memory is optional
        if (cpuAvg === null || cpuAvg === undefined) return { variant: 'default', text: 'Insufficient Data' };
        if (isOptimal) return { variant: 'success', text: 'Optimized' };
        // Allow "Needs Optimization" even if memory is null (as long as CPU is present)
        if (isRunning && confidencePercent >= 50) return { variant: 'warning', text: 'Needs Optimization' };
        return { variant: 'default', text: 'Insufficient Data' };
    };

    const statusBadge = getStatusBadge();

    // Calculate costs for stopped instances
    const displayCurrentCost = isStopped ? 0 : currentCost;
    const recommendedCost = displayCurrentCost - savings;

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
                        {resource.os_type && (
                            <span style={{ fontSize: 12, color: 'var(--az-text-2)' }} title={resource.os_type === 'unknown' ? 'OS: Unknown (unable to detect from cloud)' : ''}>
                                <b style={{ color: 'var(--az-text)' }}>OS:</b> {resource.os_type === 'unknown' ? 'Unknown' : resource.os_type}
                            </span>
                        )}
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
                <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
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
                            {[['vCPU', resource.vCpu || resource.vcpu || resource.vcpuCount || 'N/A', 'var(--az-blue)', Cpu], ['Memory', `${resource.memoryGb || resource.memory || resource.ramGb || 'N/A'} GB`, '#7B2FBE', HardDrive]].map(([l, v, c, Icon]) => (
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
                            <BAR label="CPU Utilization" value={cpuAvg} isRunning={isRunning} showTooltip={false} />
                            <BAR label="Memory Utilization" value={memAvg} isRunning={isRunning} showTooltip={true} />
                        </div>

                        {/* Cost */}
                        <div style={{ background: '#1B1A19', color: '#fff', borderRadius: 4, padding: '12px 14px' }}>
                            <div style={{ fontSize: 11, color: '#A19F9D', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Current Monthly Cost</div>
                            <div style={{ fontSize: 28, fontWeight: 700 }}>${displayCurrentCost.toFixed(2)}</div>
                            {isStopped && (
                                <div style={{ fontSize: 11, color: '#A19F9D', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Info size={12} />
                                    <span>Instance stopped - no active charges</span>
                                </div>
                            )}
                        </div>

                        {/* Pricing Source Transparency */}
                        {!isStopped && (
                            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--az-surface)', borderRadius: 4, fontSize: 11, color: 'var(--az-text-2)' }}>
                                <div style={{ marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600 }}>Price source:</span>{' '}
                                    {isLivePricing ? (
                                        <span style={{ color: 'var(--az-success)' }}>Live cloud pricing (On-Demand)</span>
                                    ) : (
                                        <span>Cached pricing</span>
                                    )}
                                </div>
                                {priceLastUpdated && (
                                    <div>
                                        <span style={{ fontWeight: 600 }}>Last updated:</span>{' '}
                                        {isLivePricing ? getRelativeTime(priceLastUpdated) : new Date(priceLastUpdated).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        )}
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
                                {/* Stopped instance warning */}
                                {isStopped && (
                                    <div style={{ background: 'var(--az-warning-bg)', border: '1px solid var(--az-warning)', borderRadius: 4, padding: '10px 14px', display: 'flex', gap: 8 }}>
                                        <AlertTriangle size={14} style={{ color: 'var(--az-warning)', marginTop: 1, flexShrink: 0 }} />
                                        <div style={{ fontSize: 12, color: 'var(--az-text)' }}>
                                            {cpuAvg || memAvg ? (
                                                <>Instance is currently stopped. Cost and recommendations are based on the last active usage period.</>
                                            ) : (
                                                <>Start the instance to receive live optimization recommendations.</>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Recommended type */}
                                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 4, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 11, color: 'var(--az-blue)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Recommended Type</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: 'var(--az-blue)' }}>{resource.recommendedType || resource.recommended_instance || 'N/A'}</div>
                                </div>

                                {/* Architecture & Compatibility Confirmation */}
                                <div style={{ background: 'var(--az-success-bg)', border: '1px solid var(--az-success)', borderRadius: 4, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--az-success)', marginBottom: 6 }}>Compatibility Check</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--az-text)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle size={12} style={{ color: 'var(--az-success)' }} />
                                            <span>Same architecture ({architecture})</span>
                                        </div>
                                        {instanceFamily && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <CheckCircle size={12} style={{ color: 'var(--az-success)' }} />
                                                <span>Same instance family category</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {isAvailableInRegion ? (
                                                <>
                                                    <CheckCircle size={12} style={{ color: 'var(--az-success)' }} />
                                                    <span>Available in {resource.region}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <AlertTriangle size={12} style={{ color: 'var(--az-error)' }} />
                                                    <span style={{ color: 'var(--az-error)' }}>Not available in {resource.region}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Specs grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    {[['vCPU', resource.recommendedVcpu || resource.vCpu || resource.vcpu || 'N/A', Cpu], ['Memory', `${resource.recommendedMemory || resource.memoryGb || resource.memory || 'N/A'} GB`, HardDrive]].map(([l, v, Icon]) => (
                                        <div key={l} style={{ border: '1px solid var(--az-blue-mid)', borderRadius: 4, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <Icon size={14} style={{ color: 'var(--az-blue)' }} />
                                            <div>
                                                <div style={{ fontSize: 11, color: 'var(--az-text-3)' }}>{l}</div>
                                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--az-blue)' }}>{v}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Savings card with expandable breakdown */}
                                <div style={{ background: 'var(--az-success)', color: '#fff', borderRadius: 4, padding: '14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                        <DollarSign size={14} />
                                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Estimated Monthly Savings</span>
                                    </div>
                                    <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>${savings.toFixed(2)}</div>
                                    <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.8)' }}>Annual: ${(savings * 12).toFixed(2)}</div>

                                    {/* Expandable breakdown */}
                                    <button
                                        onClick={() => setSavingsExpanded(!savingsExpanded)}
                                        style={{
                                            marginTop: 8,
                                            background: 'rgba(255,255,255,0.2)',
                                            border: 'none',
                                            color: '#fff',
                                            padding: '6px 10px',
                                            borderRadius: 3,
                                            fontSize: 11,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            fontFamily: 'inherit'
                                        }}
                                    >
                                        {savingsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        {savingsExpanded ? 'Hide' : 'Show'} breakdown
                                    </button>

                                    {savingsExpanded && (
                                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: 11 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span>Current cost:</span>
                                                <span style={{ fontWeight: 600 }}>${displayCurrentCost.toFixed(2)} / month</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span>Recommended cost:</span>
                                                <span style={{ fontWeight: 600 }}>${recommendedCost.toFixed(2)} / month</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                                                <span style={{ fontWeight: 600 }}>Estimated savings:</span>
                                                <span style={{ fontWeight: 700 }}>${savings.toFixed(2)} / month</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Pricing Source Transparency for recommendations */}
                                {!isStopped && (
                                    <div style={{ padding: '10px 12px', background: 'var(--az-surface)', borderRadius: 4, fontSize: 11, color: 'var(--az-text-2)' }}>
                                        <div style={{ marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600 }}>Price source:</span>{' '}
                                            {isLivePricing ? (
                                                <span style={{ color: 'var(--az-success)' }}>Live cloud pricing (On-Demand)</span>
                                            ) : (
                                                <span>Cached pricing</span>
                                            )}
                                        </div>
                                        {priceLastUpdated && (
                                            <div>
                                                <span style={{ fontWeight: 600 }}>Last updated:</span>{' '}
                                                {isLivePricing ? getRelativeTime(priceLastUpdated) : new Date(priceLastUpdated).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                )}

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

                                {/* ML Prediction Confidence */}
                                {confidencePercent > 0 && (
                                    <div style={{
                                        background: isHighConfidence ? 'var(--az-success-bg)' : 'var(--az-warning-bg)',
                                        border: `1px solid ${isHighConfidence ? 'var(--az-success)' : 'var(--az-warning)'}`,
                                        borderRadius: 4,
                                        padding: '10px 14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                    }}>
                                        {isHighConfidence ? (
                                            <CheckCircle size={14} style={{ color: 'var(--az-success)', flexShrink: 0 }} />
                                        ) : (
                                            <AlertTriangle size={14} style={{ color: 'var(--az-warning)', flexShrink: 0 }} />
                                        )}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--az-text)', marginBottom: 2 }}>
                                                Prediction confidence: {confidencePercent.toFixed(0)}%
                                                {isHighConfidence && ' ✅'}
                                                {!isHighConfidence && !isLowConfidence && ' ⚠️ Low confidence'}
                                            </div>
                                            {isLowConfidence && (
                                                <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>
                                                    Insufficient confidence to safely recommend changes.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Apply button with tooltip */}
                                <div style={{ position: 'relative' }}>
                                    <Button
                                        className="w-full"
                                        disabled={disableApply}
                                        title={disableApply ? getDisableReason() : ''}
                                        style={{
                                            opacity: disableApply ? 0.5 : 1,
                                            cursor: disableApply ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        Apply Recommendation
                                    </Button>
                                    {disableApply && (
                                        <div style={{
                                            marginTop: 6,
                                            fontSize: 11,
                                            color: 'var(--az-error)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4
                                        }}>
                                            <Info size={12} />
                                            <span>{getDisableReason()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
