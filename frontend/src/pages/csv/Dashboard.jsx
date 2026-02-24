import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertTriangle, DollarSign, Filter, X, ArrowRight, Server, LayoutDashboard, ChevronDown } from 'lucide-react';

function StatusBadge({ status }) {
  const s = status ? status.toLowerCase() : 'optimal';
  if (s === 'oversized') return <span style={{ background: 'var(--az-warning-bg)', color: '#8A3707', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Oversized</span>;
  if (s === 'undersized') return <span style={{ background: 'var(--az-error-bg)', color: 'var(--az-error)', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Undersized</span>;
  return <span style={{ background: 'var(--az-success-bg)', color: 'var(--az-success)', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Optimal</span>;
}

function ProviderBadge({ provider }) {
  const p = (provider || 'aws').toLowerCase();
  const m = { aws: ['#FFF4E5', '#D47A00'], azure: ['var(--az-blue-light)', 'var(--az-blue)'], gcp: ['#F0FDF4', 'var(--az-success)'] };
  const [bg, color] = m[p] || ['var(--az-bg)', 'var(--az-text-2)'];
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{p}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState(null);
  const [filterProvider, setFilterProvider] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterRegion, setFilterRegion] = useState('All');

  useEffect(() => { checkData(); }, []);

  const checkData = () => {
    const offlineData = localStorage.getItem('offlineAnalysis');
    if (offlineData) {
      try {
        const parsed = JSON.parse(offlineData);
        if (Array.isArray(parsed) && parsed.length > 0) { processData(parsed); setLoading(false); return; }
      } catch (e) { console.error('CSV Dashboard - Failed to parse offline data', e); }
    }
    setLoading(false);
  };

  const processData = (data) => {
    setResources(data.map((r, i) => ({
      ...r,
      id: r.id || r.resourceId || r.resource_id || r.name || `csv-resource-${i + 1}`,
      cloud: (r.cloud || r.cloud_provider || 'AWS').toUpperCase(),
      region: r.region || 'us-east-1',
      finding: r.finding || 'Optimal',
      savings: parseFloat(r.savings || 0),
      currentType: r.instanceType || r.currentType || r.current_vm || r.instance_type || 'm5.large',
      recommendedType: r.recommendedType || r.recommended_vm || r.recommended_type || r.instanceType || 't3.medium',
      cpuUsage: parseFloat(r.cpuUsage || r.cpu_usage_percent || r.cpuAvg || r.cpu_avg || 0),
      memUsage: parseFloat(r.memUsage || r.memory_usage_percent || r.memoryAvg || r.memory_avg || 0),
      recommendation: r.recommendation || r.reason || (
        r.finding === 'Oversized' ? `Downsize to ${r.recommendedType || r.recommended_vm || 'smaller instance'}` :
          r.finding === 'Undersized' ? `Upsize to ${r.recommendedType || r.recommended_vm || 'larger instance'}` : 'No action required'
      ),
    })));
  };

  const totalResources = resources.length;
  const optimizedCount = resources.filter(r => r.finding?.toLowerCase() === 'optimal').length;
  const needsActionCount = resources.filter(r => ['oversized', 'undersized'].includes(r.finding?.toLowerCase())).length;
  const totalSavings = resources.reduce((sum, r) => sum + (r.savings > 0 ? r.savings : 0), 0);

  const filteredResources = resources.filter(r => {
    if (filterProvider !== 'All' && r.cloud.toLowerCase() !== filterProvider.toLowerCase()) return false;
    if (filterStatus !== 'All' && r.finding.toLowerCase() !== filterStatus.toLowerCase()) return false;
    if (filterRegion !== 'All' && r.region.toLowerCase() !== filterRegion.toLowerCase()) return false;
    return true;
  });

  const getReason = (res) => {
    if (res.finding === 'Oversized') return `This resource has utilized less than ${res.cpuUsage || 5}% CPU over the last 30 days. Switching to a smaller instance type will maintain performance while reducing your monthly invoice.`;
    if (res.finding === 'Undersized') return `This resource is consistently operating above 90% CPU utilization. Upsizing will improve performance and reliability.`;
    return 'This resource is correctly provisioned for its current workload.';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Executive Dashboard</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>High-level overview of cloud infrastructure efficiency, identifying cost-saving opportunities and optimization status.</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Resources', value: totalResources.toLocaleString(), Icon: Server, iconBg: 'var(--az-bg)', iconColor: 'var(--az-text-2)', bg: '#fff' },
          { label: 'Optimized', value: optimizedCount.toLocaleString(), Icon: CheckCircle, iconBg: 'var(--az-success-bg)', iconColor: 'var(--az-success)', bg: '#fff' },
          { label: 'Needs Action', value: needsActionCount.toLocaleString(), Icon: AlertTriangle, iconBg: 'var(--az-warning-bg)', iconColor: '#8A3707', bg: '#fff' },
          { label: 'Est. Monthly Savings', value: `$${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, Icon: DollarSign, iconBg: 'var(--az-blue-light)', iconColor: 'var(--az-blue)', bg: 'var(--az-blue-light)', valueColor: 'var(--az-blue)' },
        ].map(({ label, value, Icon, iconBg, iconColor, bg, valueColor }) => (
          <div key={label} style={{ background: bg, border: '1px solid var(--az-border)', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 4, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} style={{ color: iconColor }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--az-text-2)', fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: valueColor || 'var(--az-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--az-text-3)' }} />
        {[
          { value: filterProvider, setter: setFilterProvider, options: [['All', 'Provider: All'], ['AWS', 'AWS'], ['Azure', 'Azure'], ['GCP', 'GCP']] },
          { value: filterStatus, setter: setFilterStatus, options: [['All', 'Status: All'], ['Oversized', 'Oversized'], ['Undersized', 'Undersized'], ['Optimal', 'Optimal']] },
          { value: filterRegion, setter: setFilterRegion, options: [['All', 'Region: All'], ['us-east-1', 'us-east-1'], ['us-west-2', 'us-west-2'], ['europe-west1', 'europe-west1']] },
        ].map(({ value, setter, options }, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <select value={value} onChange={e => setter(e.target.value)} className="az-select">
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <button onClick={() => { setFilterProvider('All'); setFilterStatus('All'); setFilterRegion('All'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--az-blue)', fontWeight: 500, padding: '0 4px' }}>Clear Filters</button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, overflow: 'hidden' }}>
        <table className="az-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Resource ID</th>
              <th>Provider</th>
              <th>Region</th>
              <th>Status</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--az-text-2)', fontSize: 13 }}>Loading resources...</td></tr>
            ) : resources.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--az-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LayoutDashboard size={24} style={{ color: 'var(--az-text-3)' }} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--az-text)' }}>No Data Available</h3>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--az-text-2)' }}>Upload a CSV file to see optimization recommendations</p>
                    <button onClick={() => navigate('/csv/upload')} className="az-btn az-btn-primary">Upload CSV</button>
                  </div>
                </td>
              </tr>
            ) : filteredResources.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--az-text-2)', fontSize: 13 }}>No resources found matching filters.</td></tr>
            ) : filteredResources.map(res => (
              <tr key={res.id} onClick={() => setSelectedResource(res)} style={{ cursor: 'pointer', background: selectedResource?.id === res.id ? 'var(--az-blue-light)' : undefined }}>
                <td style={{ color: 'var(--az-blue)', fontFamily: 'monospace', fontSize: 12 }}>{res.id}</td>
                <td><ProviderBadge provider={res.cloud} /></td>
                <td style={{ fontSize: 13, color: 'var(--az-text-2)' }}>{res.region}</td>
                <td><StatusBadge status={res.finding} /></td>
                <td style={{ fontSize: 13, color: res.finding === 'Optimal' ? 'var(--az-text-3)' : 'var(--az-text-2)', fontStyle: res.finding === 'Optimal' ? 'italic' : 'normal' }}>
                  {res.finding === 'Optimal' ? 'No Action Required' : res.recommendation}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Right slide-over panel */}
      {selectedResource && (
        <>
          <div onClick={() => setSelectedResource(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: 430, background: '#fff', zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', overflowY: 'auto', borderLeft: '1px solid var(--az-border)' }}>
            {/* Panel header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--az-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>Resource Detail</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--az-text-3)', fontFamily: 'monospace' }}>ID: {selectedResource.id}</p>
              </div>
              <button onClick={() => setSelectedResource(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--az-text-3)', display: 'flex', borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--az-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Status + Savings */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <StatusBadge status={selectedResource.finding} />
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--az-text-3)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Est. Savings</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: 18, fontWeight: 700, color: 'var(--az-success)' }}>${selectedResource.savings.toFixed(2)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--az-text-3)' }}>/mo</span></p>
                </div>
              </div>

              {/* Reason */}
              <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue-mid)', borderRadius: 4, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--az-blue)' }} />
                  <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--az-blue)' }}>Why are we recommending this?</h4>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.5 }}>{getReason(selectedResource)}</p>
              </div>

              {/* Technical details */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 11, fontWeight: 600, color: 'var(--az-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Technical Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['Provider', selectedResource.cloud.toUpperCase()], ['Region', selectedResource.region], ['Current Type', selectedResource.currentType || selectedResource.current_vm || 'm5.large'], ['Recommended Type', selectedResource.recommendedType || selectedResource.recommended_vm || 't3.medium']].map(([l, v], i) => (
                    <div key={l}>
                      <p style={{ margin: '0 0 2px 0', fontSize: 11, color: 'var(--az-text-3)' }}>{l}</p>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: i === 3 ? 'var(--az-blue)' : 'var(--az-text)', fontFamily: i >= 2 ? 'monospace' : 'inherit' }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Spec change */}
              {selectedResource.finding !== 'Optimal' && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 11, fontWeight: 600, color: 'var(--az-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Specification Change</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, background: 'var(--az-bg)', border: '1px solid var(--az-border)', borderRadius: 4, padding: '10px 12px' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--az-text-3)' }}>Current</p>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--az-text)' }}>{Math.ceil(selectedResource.cpuUsage / 20) * 2 || 4} vCPU</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--az-text-2)' }}>{(Math.ceil(selectedResource.memUsage / 20) * 4) || 16} GiB RAM</p>
                    </div>
                    <ArrowRight size={16} style={{ color: 'var(--az-text-3)', flexShrink: 0 }} />
                    <div style={{ flex: 1, background: 'var(--az-success-bg)', border: '1px solid var(--az-success)', borderRadius: 4, padding: '10px 12px' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: 11, color: 'var(--az-success)' }}>Recommended</p>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--az-success)' }}>{Math.max(1, Math.ceil((selectedResource.cpuUsage / 20) * 2) / 2) || 2} vCPU</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--az-success)' }}>{Math.max(1, Math.ceil(selectedResource.memUsage / 20) * 4 / 2) || 8} GiB RAM</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
