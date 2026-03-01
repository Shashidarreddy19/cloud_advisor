import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, TrendingDown, AlertTriangle, ArrowRight, Download, RefreshCw, Search, DollarSign, Activity, UploadCloud, FileText, ChevronDown, ChevronUp, Cpu, MemoryStick, Target, Filter, Trash2, Clock } from 'lucide-react';
import Toast from '../../components/common/Toast';
import AIAnalysisPanel from '../../components/common/AIAnalysisPanel';
import api from '../../services/api';

// Format timestamp for display
function formatTimestamp(timestamp) {
  if (!timestamp) return 'No timestamp';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'No timestamp';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return 'No timestamp';
  }
}

function ProvBadge({ c }) {
  const m = { aws: '#FFF4E5,#D47A00', azure: 'var(--az-blue-light),var(--az-blue)', gcp: '#F0FDF4,var(--az-success)' };
  const [bg, color] = (m[c] || '#F3F2F1,var(--az-text-2)').split(',');
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{c}</span>;
}

function StatusBadge({ status }) {
  if (status === 'Oversized') return <span style={{ background: 'var(--az-error-bg)', color: 'var(--az-error)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><TrendingDown size={11} />{status}</span>;
  if (status === 'Undersized') return <span style={{ background: 'var(--az-warning-bg)', color: '#8A3707', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} />{status}</span>;
  return <span style={{ background: 'var(--az-success-bg)', color: 'var(--az-success)', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} />{status}</span>;
}

function ConfBadge({ c }) {
  const pct = Math.round(c > 1 ? c : c * 100);
  const [bg, color] = pct >= 80 ? ['var(--az-success-bg)', 'var(--az-success)'] : pct >= 60 ? ['var(--az-warning-bg)', '#8A3707'] : ['var(--az-error-bg)', 'var(--az-error)'];
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12 }}>{pct >= 80 ? 'High' : pct >= 60 ? 'Mid' : 'Low'} {pct}%</span>;
}

export default function Recommendations() {
  // Currency conversion rate (USD to INR)
  const USD_TO_INR = 83.5; // Update this rate as needed

  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [sortBy, setSortBy] = useState('savings');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [toastState, setToastState] = useState(null);
  const [hasMLError, setHasMLError] = useState(false);
  const navigate = useNavigate();
  const { state } = useLocation();
  const showToast = (message, type = 'success') => setToastState({ message, type });

  const clearCacheAndRetry = () => {
    // Clear localStorage
    localStorage.removeItem('offlineAnalysis');
    // Clear current state
    setRecs([]);
    setExpandedRow(null);
    setReportSaved(false);
    setFilter('all');
    setProviderFilter('all');
    setSearchQuery('');
    setHasMLError(false);
    // Show success message and redirect to upload page
    showToast('Cache cleared! Please upload your CSV again.', 'success');
    setTimeout(() => navigate('/csv/upload'), 1500);
  };

  useEffect(() => {
    // Mark page as visited for cleanup prompt
    sessionStorage.setItem('visitedRecommendations', 'true');

    console.log('[Recommendations] useEffect triggered', { hasState: !!state?.results, state });
    if (state?.results) {
      console.log('[Recommendations] Processing state.results', state.results);
      processData(state.results);
      return;
    }
    const stored = localStorage.getItem('offlineAnalysis');
    console.log('[Recommendations] Checking localStorage', { hasStored: !!stored });
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('[Recommendations] Processing localStorage data', parsed);
        processData(parsed);
      } catch (e) {
        console.error('[Recommendations] Failed to parse localStorage', e);
        setLoading(false);
      }
    }
    else setLoading(false);
  }, [state]);

  const processData = (data) => {
    // Handle both array format and object format { results: [...] }
    let resultsArray = data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      resultsArray = data.results || [];
    }

    if (!resultsArray || !Array.isArray(resultsArray) || resultsArray.length === 0) {
      setRecs([]);
      setLoading(false);
      return;
    }

    // Check if any recommendations have ML errors
    const hasErrors = resultsArray.some(r =>
      r.recommendation?.includes('ML service') ||
      r.recommendation?.includes('unavailable') ||
      (r.cpuUsage === 0 && r.memUsage === 0 && r.costPerMonth === 0)
    );

    // AUTOMATIC FIX: If ML errors detected, clear cache and show message
    if (hasErrors) {
      console.warn('[Recommendations] ML error data detected - auto-clearing cache');
      localStorage.removeItem('offlineAnalysis');
      setHasMLError(true);
    } else {
      setHasMLError(false);
    }

    setRecs(resultsArray.map((r, i) => {
      console.log(`[Recommendations] Processing VM ${i}:`, {
        name: r.name,
        hasAiAnalysis: !!r.aiAnalysis,
        aiAnalysisType: r.aiAnalysis?.type
      });

      return {
        id: r.id || `res-${i}`,
        name: r.name || `Resource ${i + 1}`,
        cloud: (r.cloud || 'aws').toLowerCase(),
        region: r.region || 'us-east-1',
        finding: r.finding || 'Optimal',
        instanceType: r.instanceType || r.current_vm || '—',
        recommendedType: r.recommendedType || r.recommended_vm || '—',
        cpuUsage: parseFloat(r.cpuUsage || r.cpu_usage_percent || 0),
        memUsage: parseFloat(r.memUsage || r.memory_usage_percent || 0),
        savings: parseFloat(r.savings || 0),
        confidence: parseFloat(r.confidence || 0),
        costPerMonth: parseFloat(r.costPerMonth || r.cost_per_month || 0),
        optimizedCostPerMonth: parseFloat(r.optimizedCostPerMonth ?? r.costPerMonth ?? 0),
        recommendation: r.recommendation || r.reason || 'Resource is optimally provisioned.',
        aiAnalysis: r.aiAnalysis || null,
        timestamp: r.timestamp || r.createdAt || r.updatedAt || null,
        dataQuality: r.dataQuality || 'medium',
      };
    }));
    setLoading(false);
  };

  const oversizedCount = recs.filter(r => r.finding === 'Oversized').length;
  const undersizedCount = recs.filter(r => r.finding === 'Undersized').length;
  const optimalCount = recs.filter(r => r.finding === 'Optimal').length;
  const totalSavings = recs.filter(r => r.finding === 'Oversized').reduce((s, r) => s + (r.savings || 0), 0);
  const totalSavingsINR = totalSavings * USD_TO_INR;

  // Check if timestamp column is missing
  const hasTimestamps = recs.some(r => r.timestamp && r.timestamp !== null);
  const hasDataQuality = recs.some(r => r.dataQuality && r.dataQuality !== 'medium');

  const filtered = recs.filter(r => {
    const ms = filter === 'all' || r.finding === filter;
    const mp = providerFilter === 'all' || r.cloud === providerFilter;
    const mq = !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.region.toLowerCase().includes(searchQuery.toLowerCase());
    return ms && mp && mq;
  }).sort((a, b) => sortBy === 'savings' ? b.savings - a.savings : sortBy === 'confidence' ? b.confidence - a.confidence : a.name.localeCompare(b.name));

  const handleGenerateReport = async () => {
    if (!recs.length) { showToast('No recommendations to save', 'error'); return; }
    setSavingReport(true);
    try {
      const name = `Optimization Report — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      await api.post('/reports/generate', { name, type: 'CSV', recommendations: recs });
      setReportSaved(true);
      showToast('Report saved! View it in the Reports page.', 'success');
    } catch (err) {
      if (err.response?.status === 401) { showToast('Session expired. Please log in again.', 'error'); setTimeout(() => navigate('/auth/login'), 2000); }
      else showToast('Failed to save report.', 'error');
    } finally { setSavingReport(false); }
  };

  const handleClear = () => {
    setRecs([]);
    setExpandedRow(null);
    setReportSaved(false);
    setFilter('all');
    setProviderFilter('all');
    setSearchQuery('');
    localStorage.removeItem('offlineAnalysis');
    showToast('Recommendations cleared', 'success');
  };

  const handleExport = () => {
    if (!filtered.length) return;
    const rows = [['Provider', 'Resource', 'Region', 'Status', 'Current Type', 'Recommended Type', 'CPU %', 'Memory %', 'Savings/mo', 'Confidence'],
    ...filtered.map(r => [r.cloud, r.name, r.region, r.finding, r.instanceType, r.recommendedType, r.cpuUsage, r.memUsage, r.savings.toFixed(2), Math.round(r.confidence > 1 ? r.confidence : r.confidence * 100)])
    ].map(row => row.join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' })); a.download = `recommendations-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    showToast('Exported successfully', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Optimization Recommendations</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>AI-powered right-sizing insights from your uploaded CSV data</p>
        </div>
        {recs.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleGenerateReport} disabled={savingReport || reportSaved} className="az-btn" style={{ background: reportSaved ? 'var(--az-success-bg)' : 'var(--az-blue)', color: reportSaved ? 'var(--az-success)' : '#fff', border: 'none' }}>
              <FileText size={14} />{savingReport ? 'Saving...' : reportSaved ? 'Saved ✓' : 'Save Report'}
            </button>
            <button onClick={handleExport} disabled={!filtered.length} className="az-btn az-btn-secondary">
              <Download size={14} />Export CSV
            </button>
            <button onClick={handleClear} className="az-btn az-btn-secondary" style={{ color: 'var(--az-error)', borderColor: 'var(--az-error-bg)' }}>
              <Trash2 size={14} />Clear
            </button>
          </div>
        )}
      </div>

      {/* ML Error Warning */}
      {hasMLError && recs.length > 0 && (
        <div style={{ background: '#FFF4CE', border: '2px solid var(--az-warning)', borderRadius: 8, padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <AlertTriangle size={24} style={{ color: 'var(--az-warning)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: 'var(--az-text)' }}>⚠️ ML Service Not Running</h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
              The recommendations show errors because the <strong>ML service was not running</strong> when you uploaded the CSV.
              You're seeing cached error data with 0% CPU/memory and $0.00 costs.
            </p>
            <div style={{ background: '#fff', border: '1px solid var(--az-warning)', borderRadius: 6, padding: '12px 16px', marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>To fix this:</p>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                <li>Open PowerShell and run: <code style={{ background: 'var(--az-bg)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace', fontSize: 12 }}>cd D:\cloud\ml</code></li>
                <li>Start ML service: <code style={{ background: 'var(--az-bg)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace', fontSize: 12 }}>python -m uvicorn app:app --host 0.0.0.0 --port 5000</code></li>
                <li>Keep the terminal window open (ML service must stay running)</li>
                <li>Click the button below to clear cache and re-upload your CSV</li>
              </ol>
            </div>
            <button onClick={clearCacheAndRetry} className="az-btn az-btn-primary" style={{ fontSize: 14, padding: '10px 20px', fontWeight: 600 }}>
              <RefreshCw size={16} />Clear Cache & Re-upload CSV
            </button>
          </div>
        </div>
      )}

      {/* Missing Timestamp Info */}
      {!hasMLError && !hasTimestamps && recs.length > 0 && (
        <div style={{ background: '#E3F2FD', border: '1px solid #2196F3', borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Clock size={20} style={{ color: '#2196F3', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--az-text)' }}>ℹ️ Timestamp Column Not Found</h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.5 }}>
              Your CSV doesn't include a timestamp column. Recommendations are based on default 30-day data coverage assumption.
              For more accurate predictions, include a <code style={{ background: 'var(--az-bg)', padding: '1px 4px', borderRadius: 2, fontFamily: 'monospace', fontSize: 11 }}>timestamp</code> column in your CSV.
            </p>
          </div>
        </div>
      )}

      {/* Empty / Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6 }}>
          <div style={{ width: 22, height: 22, border: '3px solid var(--az-blue-mid)', borderTopColor: 'var(--az-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 10 }} />
          <span style={{ fontSize: 13, color: 'var(--az-text-2)' }}>Loading recommendations…</span>
        </div>
      )}
      {!loading && !recs.length && (
        <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--az-bg)', border: '2px dashed var(--az-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <UploadCloud size={28} style={{ color: 'var(--az-text-3)' }} />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>No Data Yet</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--az-text-2)' }}>Upload a CSV with your infrastructure metrics to get ML-powered right-sizing recommendations.</p>
          <button onClick={() => navigate('/csv/upload')} className="az-btn az-btn-primary"><UploadCloud size={14} />Upload CSV</button>
        </div>
      )}

      {/* Results */}
      {!loading && recs.length > 0 && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total VMs', value: recs.length, sub: 'analyzed by ML model', bg: '#fff', color: 'var(--az-text)', iconBg: 'var(--az-bg)', Icon: Activity },
              { label: 'Oversized', value: oversizedCount, sub: 'can be downsized', bg: 'var(--az-error-bg)', color: 'var(--az-error)', iconBg: '#F9B5B7', Icon: TrendingDown },
              { label: 'Undersized', value: undersizedCount, sub: 'need more capacity', bg: 'var(--az-warning-bg)', color: '#8A3707', iconBg: '#FFCC80', Icon: AlertTriangle },
              { label: 'Est. Monthly Savings', value: `$${totalSavings.toFixed(0)}`, sub: `₹${totalSavingsINR.toFixed(0)}/mo · $${(totalSavings * 12).toFixed(0)}/yr`, bg: 'var(--az-success-bg)', color: 'var(--az-success)', iconBg: '#A7D5A7', Icon: DollarSign },
            ].map(({ label, value, sub, bg, color, iconBg, Icon }) => (
              <div key={label} style={{ background: bg, border: '1px solid var(--az-border)', borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                  <div style={{ width: 26, height: 26, borderRadius: 4, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color, marginTop: 3, opacity: 0.7 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '10px 14px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--az-text-3)', pointerEvents: 'none' }} />
              <input className="az-input" style={{ width: '100%', paddingLeft: 28 }} placeholder="Search instance, region…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div style={{ display: 'flex', background: 'var(--az-bg)', borderRadius: 4, padding: 2 }}>
              {['all', 'Oversized', 'Undersized', 'Optimal'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ padding: '4px 10px', borderRadius: 3, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: filter === f ? 600 : 400, background: filter === f ? '#fff' : 'transparent', color: filter === f ? 'var(--az-text)' : 'var(--az-text-2)', boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
            <select className="az-select" value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
              <option value="all">All Clouds</option>
              <option value="aws">AWS</option>
              <option value="azure">Azure</option>
              <option value="gcp">GCP</option>
            </select>
            <select className="az-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="savings">Sort: Savings</option>
              <option value="confidence">Sort: Confidence</option>
              <option value="name">Sort: Name</option>
            </select>
            <button onClick={() => navigate('/csv/upload')} className="az-btn az-btn-secondary" style={{ fontSize: 12 }}>
              <UploadCloud size={13} />New Upload
            </button>
          </div>

          {/* No filter results */}
          {!filtered.length && (
            <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '40px', textAlign: 'center' }}>
              <Filter size={28} style={{ color: 'var(--az-border)', marginBottom: 8 }} />
              <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: '0 0 8px 0' }}>No results match your filters.</p>
              <button onClick={() => { setFilter('all'); setProviderFilter('all'); setSearchQuery(''); }} style={{ fontSize: 12, color: 'var(--az-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear filters</button>
            </div>
          )}

          {/* Recommendation list */}
          {filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Table Header */}
              <div style={{ background: 'var(--az-surface)', border: '1px solid var(--az-border)', borderRadius: 6, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 60, fontSize: 11, fontWeight: 600, color: 'var(--az-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--az-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instance / Type</div>
                <div style={{ width: 100, fontSize: 11, fontWeight: 600, color: 'var(--az-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
                <div style={{ width: 90, fontSize: 11, fontWeight: 600, color: 'var(--az-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</div>
                <div style={{ width: 90, fontSize: 11, fontWeight: 600, color: 'var(--az-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Current Cost</div>
                <div style={{ width: 140, fontSize: 11, fontWeight: 600, color: 'var(--az-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Savings</div>
                <div style={{ width: 26 }}></div>
              </div>

              {filtered.map((rec, idx) => {
                const isExpanded = expandedRow === idx;
                // Use the real optimized cost from the ML endpoint.
                // For Oversized: cost of cheaper recommended instance.
                // For Undersized: cost of the bigger recommended instance (higher than current).
                // For Optimal: same as current cost.
                const optimizedCost = rec.optimizedCostPerMonth > 0
                  ? rec.optimizedCostPerMonth
                  : rec.finding === 'Oversized'
                    ? rec.costPerMonth - rec.savings
                    : rec.costPerMonth;
                return (
                  <div key={rec.id} style={{ background: '#fff', border: `1px solid ${isExpanded ? 'var(--az-blue)' : 'var(--az-border)'}`, borderRadius: 6, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                    <div onClick={() => setExpandedRow(isExpanded ? null : idx)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }} onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--az-bg)'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
                      <ProvBadge c={rec.cloud} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--az-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{rec.name}</span>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--az-text-3)' }}>{rec.instanceType}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--az-text-3)' }}>
                          <span>{rec.region}</span>
                          <span>•</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={10} />
                            {formatTimestamp(rec.timestamp)}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={rec.finding} />
                      <ConfBadge c={rec.confidence} />
                      {rec.costPerMonth > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)', whiteSpace: 'nowrap' }}>${rec.costPerMonth.toFixed(2)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--az-text-3)' }}>/mo</span></span>}
                      {rec.finding === 'Oversized' && rec.savings > 0 && <span style={{ background: 'var(--az-success-bg)', color: 'var(--az-success)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, whiteSpace: 'nowrap' }}>Save ${rec.savings.toFixed(0)}/mo (₹{(rec.savings * USD_TO_INR).toFixed(0)})</span>}
                      {rec.finding === 'Undersized' && <span style={{ background: 'var(--az-warning-bg)', color: '#8A3707', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}>Upgrade</span>}
                      {rec.finding === 'Optimal' && <span style={{ background: 'var(--az-success-bg)', color: 'var(--az-success)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12 }}>Optimal ✓</span>}
                      <div style={{ width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isExpanded ? 'var(--az-blue-light)' : 'transparent', color: isExpanded ? 'var(--az-blue)' : 'var(--az-text-3)', flexShrink: 0 }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--az-border)', padding: '14px 16px', background: 'var(--az-bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ background: rec.finding === 'Optimal' ? 'var(--az-success-bg)' : 'var(--az-blue-light)', border: `1px solid ${rec.finding === 'Optimal' ? 'var(--az-success-bg)' : 'var(--az-blue-mid)'}`, borderRadius: 4, padding: '10px 12px', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, color: rec.finding === 'Optimal' ? 'var(--az-success)' : 'var(--az-blue)', marginBottom: 3 }}>{rec.finding === 'Optimal' ? '✓ No action required' : '⚡ Recommendation'}</div>
                          <div style={{ color: 'var(--az-text-2)' }}>{rec.recommendation}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                          {[['CPU Usage', `${rec.cpuUsage.toFixed(0)}%`, Cpu], ['Memory Usage', `${rec.memUsage.toFixed(0)}%`, MemoryStick], ['Current Cost', `$${rec.costPerMonth.toFixed(2)}`, DollarSign]].map(([l, v, Icon]) => (
                            <div key={l} style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 4, padding: '8px', textAlign: 'center' }}>
                              <Icon size={13} style={{ color: 'var(--az-text-3)', marginBottom: 3 }} />
                              <div style={{ fontSize: 11, color: 'var(--az-text-3)', marginBottom: 2 }}>{l}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--az-text)' }}>{v}</div>
                            </div>
                          ))}
                          {rec.finding !== 'Optimal' && (
                            <div style={{ background: rec.finding === 'Oversized' ? 'var(--az-success-bg)' : 'var(--az-warning-bg)', border: '1px solid var(--az-border)', borderRadius: 4, padding: '8px', textAlign: 'center' }}>
                              <Target size={13} style={{ color: 'var(--az-text-3)', marginBottom: 3 }} />
                              <div style={{ fontSize: 11, color: 'var(--az-text-3)', marginBottom: 2 }}>
                                {rec.finding === 'Oversized' ? 'Optimized Cost' : 'Upgrade Cost'}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: rec.finding === 'Oversized' ? 'var(--az-success)' : '#8A3707' }}>
                                {rec.finding === 'Undersized' && optimizedCost > rec.costPerMonth && <span style={{ fontSize: 10, fontWeight: 400, marginRight: 3 }}>↑</span>}
                                ${optimizedCost > 0 ? optimizedCost.toFixed(2) : '—'}
                              </div>
                            </div>
                          )}
                        </div>
                        {rec.finding !== 'Optimal' && rec.instanceType !== '—' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--az-border)', borderRadius: 4, padding: '8px 12px', fontSize: 12 }}>
                            <span style={{ fontFamily: 'monospace', background: 'var(--az-bg)', padding: '2px 8px', borderRadius: 3, fontWeight: 600 }}>{rec.instanceType}</span>
                            <ArrowRight size={13} style={{ color: 'var(--az-text-3)' }} />
                            <span style={{ fontFamily: 'monospace', background: 'var(--az-blue-light)', color: 'var(--az-blue)', padding: '2px 8px', borderRadius: 3, fontWeight: 600 }}>{rec.recommendedType}</span>
                            {rec.finding === 'Oversized' && rec.savings > 0 && <span style={{ marginLeft: 'auto', color: 'var(--az-success)', fontWeight: 700 }}>Save ${rec.savings.toFixed(2)}/mo (₹{(rec.savings * USD_TO_INR).toFixed(2)})</span>}
                            {rec.finding === 'Undersized' && optimizedCost > rec.costPerMonth && (
                              <span style={{ marginLeft: 'auto', color: '#8A3707', fontWeight: 700 }}>+${(optimizedCost - rec.costPerMonth).toFixed(2)}/mo</span>
                            )}
                          </div>
                        )}

                        {/* AI Analysis Panel */}
                        <AIAnalysisPanel aiAnalysis={rec.aiAnalysis} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {toastState && <Toast message={toastState.message} type={toastState.type} onClose={() => setToastState(null)} />}
    </div>
  );
}
