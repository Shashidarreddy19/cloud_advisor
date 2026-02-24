import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, Trash2, Calendar, Eye, TrendingUp, DollarSign, Activity } from 'lucide-react';
import Toast from '../../components/common/Toast';
import api from '../../services/api';

export default function Reports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toastState, setToastState] = useState(null);
    const navigate = useNavigate();
    const showToast = (message, type = 'success') => setToastState({ message, type });

    useEffect(() => { fetchReports(); }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const res = await api.get('/reports');
            setReports(res.data);
        } catch (err) {
            if (err.response?.status === 401) {
                showToast('Session expired. Please log in again.', 'error');
                setTimeout(() => navigate('/auth/login?returnUrl=/csv/reports'), 2000);
            } else showToast('Failed to load reports', 'error');
        } finally { setLoading(false); }
    };

    const handleDownload = async (report) => {
        try {
            const resp = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'text/csv' }));
            const a = document.createElement('a'); a.href = url; a.download = `${report.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
            showToast(`Downloading ${report.name}...`);
        } catch { showToast('Failed to download report', 'error'); }
    };

    const handleDelete = async (e, report) => {
        e.stopPropagation();
        if (!window.confirm(`Delete report "${report.name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/reports/${report.id}`);
            setReports(prev => prev.filter(r => r.id !== report.id));
            showToast('Report deleted successfully');
        } catch { showToast('Failed to delete report', 'error'); }
    };

    const handleViewReport = async (report) => {
        try {
            const resp = await api.get(`/reports/${report.id}`);
            navigate('/csv/recommendations', { state: { results: resp.data.recommendations, reportName: report.name, isViewingReport: true } });
        } catch { showToast('Failed to load report details', 'error'); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Saved Reports</h1>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>View and download your generated optimization reports</p>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6 }}>
                    <div style={{ width: 24, height: 24, border: '3px solid var(--az-blue-mid)', borderTopColor: 'var(--az-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 12 }} />
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: 0 }}>Loading reports...</p>
                </div>
            )}

            {/* Empty */}
            {!loading && !reports.length && (
                <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ width: 60, height: 60, background: 'var(--az-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <FileText size={28} style={{ color: 'var(--az-text-3)' }} />
                    </div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600, color: 'var(--az-text)' }}>No Reports Generated</h3>
                    <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--az-text-2)' }}>Generate reports from the Recommendations page to save and view them here.</p>
                    <button onClick={() => navigate('/csv/recommendations')} className="az-btn az-btn-primary"><FileText size={14} />Go to Recommendations</button>
                </div>
            )}

            {/* Report cards */}
            {!loading && reports.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {reports.map(report => (
                        <div key={report.id} onClick={() => handleViewReport(report)} style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '14px 16px', cursor: 'pointer', position: 'relative' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--az-blue)'; e.currentTarget.style.background = 'var(--az-blue-light)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--az-border)'; e.currentTarget.style.background = '#fff'; }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                {/* Icon */}
                                <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--az-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FileText size={18} style={{ color: 'var(--az-blue)' }} />
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--az-text)', marginBottom: 3 }}>{report.name}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--az-text-2)', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={11} />{report.date}</span>
                                        <span style={{ background: 'var(--az-bg)', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{report.type}</span>
                                        {report.size && <span>{report.size}</span>}
                                    </div>

                                    {/* Summary stats */}
                                    {report.summary && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
                                            {[
                                                { label: 'Total', value: report.summary.totalRecommendations, Icon: Activity, color: 'var(--az-text)', bg: 'var(--az-bg)' },
                                                { label: 'Savings', value: `$${report.summary.totalSavings?.toFixed(2)}`, Icon: DollarSign, color: 'var(--az-success)', bg: 'var(--az-success-bg)' },
                                                { label: 'Oversized', value: report.summary.oversizedCount, Icon: TrendingUp, color: '#8A3707', bg: 'var(--az-warning-bg)' },
                                                { label: 'Undersized', value: report.summary.undersizedCount, Icon: TrendingUp, color: 'var(--az-error)', bg: 'var(--az-error-bg)' },
                                            ].map(({ label, value, Icon, color, bg }) => (
                                                <div key={label} style={{ background: bg, borderRadius: 4, padding: '6px 8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                                                        <Icon size={10} style={{ color }} />
                                                        <span style={{ fontSize: 10, color, fontWeight: 600 }}>{label}</span>
                                                    </div>
                                                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                    <button onClick={() => handleViewReport(report)} className="az-btn az-btn-primary" style={{ fontSize: 12, padding: '5px 10px' }}><Eye size={13} />View</button>
                                    <button onClick={() => handleDownload(report)} className="az-btn az-btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }}><Download size={13} />Download</button>
                                    <button onClick={e => handleDelete(e, report)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px 8px', borderRadius: 4, color: 'var(--az-text-3)' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--az-error-bg)'; e.currentTarget.style.color = 'var(--az-error)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--az-text-3)'; }}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {toastState && <Toast message={toastState.message} type={toastState.type} onClose={() => setToastState(null)} />}
        </div>
    );
}
