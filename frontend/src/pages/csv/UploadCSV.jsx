import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Toast from '../../components/common/Toast';
import api from '../../services/api';

export default function CsvUpload() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [toastState, setToastState] = useState(null);

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles?.length > 0) { setFile(acceptedFiles[0]); setError(null); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1, multiple: false,
  });

  const handleUpload = async () => {
    if (!file) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to upload files');
      setToastState({ message: 'Authentication required', type: 'error' });
      setTimeout(() => navigate('/auth/login?returnUrl=/csv/upload'), 2000);
      return;
    }
    setAnalyzing(true); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/csv/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setToastState({ message: 'Analysis complete!', type: 'success' });
      // Handle new response format: { success: true, count: X, results: [...] }
      const results = res.data.results || res.data;
      localStorage.setItem('offlineAnalysis', JSON.stringify(results));
      navigate('/csv/recommendations', { state: { results } });
    } catch (err) {
      if (err.response?.status === 503) {
        const instructions = err.response?.data?.instructions || [];
        let msg = '⚠️ ML Service is not running. The ML service is required but not currently available.';
        if (instructions.length > 0) msg += '\n\nQuick Fix:\n' + instructions.slice(0, 7).join('\n') + '\n\nOr run: start_all_services.bat';
        setError(msg);
        setToastState({ message: 'ML Service Required — See error message', type: 'error' });
      } else if (err.response?.status === 401) {
        const msg = err.response?.data?.message || 'Your session has expired';
        setError(`${msg}. Please log in again.`);
        setToastState({ message: 'Session expired — Please log in', type: 'error' });
        setTimeout(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('userId'); navigate('/auth/login?returnUrl=/csv/upload'); }, 2500);
      } else if (err.response?.status === 400) {
        const msg = err.response?.data?.error || 'Invalid file format';
        setError(msg); setToastState({ message: msg, type: 'error' });
      } else {
        const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to analyze CSV. Please ensure the format is correct.';
        setError(msg); setToastState({ message: 'Upload failed', type: 'error' });
      }
    } finally { setAnalyzing(false); }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Upload CSV</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>Upload cloud infrastructure metrics CSV to get AI-powered right-sizing recommendations.</p>
      </div>

      {/* Drop zone */}
      <div style={{ background: '#fff', border: `2px dashed ${isDragActive ? 'var(--az-blue)' : 'var(--az-border)'}`, borderRadius: 6, padding: '32px 24px', transition: 'border-color 0.15s, background 0.15s', background: isDragActive ? 'var(--az-blue-light)' : '#fff' }}>
        {!file ? (
          <div {...getRootProps()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', outline: 'none', padding: '24px 0' }}>
            <input {...getInputProps()} />
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: isDragActive ? 'var(--az-blue)' : 'var(--az-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, transition: 'background 0.15s' }}>
              <UploadCloud size={32} style={{ color: isDragActive ? '#fff' : 'var(--az-text-3)', transition: 'color 0.15s' }} />
            </div>
            <p style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 600, color: 'var(--az-text)' }}>
              {isDragActive ? 'Drop the CSV here' : 'Drag & drop your CSV file'}
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--az-text-3)' }}>or click to browse from your computer</p>
            <span style={{ background: 'var(--az-bg)', border: '1px solid var(--az-border)', padding: '3px 12px', borderRadius: 12, fontSize: 12, color: 'var(--az-text-2)' }}>Supported format: .csv</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--az-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <FileText size={28} style={{ color: 'var(--az-success)' }} />
            </div>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: 14, color: 'var(--az-text)' }}>{file.name}</p>
            <p style={{ margin: '0 0 20px 0', fontSize: 12, color: 'var(--az-text-3)' }}>{(file.size / 1024).toFixed(2)} KB</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleUpload} disabled={analyzing} className="az-btn az-btn-primary">
                {analyzing ? <><Loader2 size={14} className="az-spin" />Analyzing...</> : <><CheckCircle size={14} />Run Optimization</>}
              </button>
              <button onClick={() => setFile(null)} disabled={analyzing} className="az-btn az-btn-secondary"><X size={14} />Change File</button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--az-error-bg)', border: '1px solid var(--az-error)', borderRadius: 4, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ color: 'var(--az-error)', marginTop: 1, flexShrink: 0 }} />
            <pre style={{ margin: 0, fontSize: 12, color: 'var(--az-error)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{error}</pre>
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { step: '1', title: 'Export Metrics', desc: 'Export CPU, Memory, and Network metrics from your cloud provider console.' },
          { step: '2', title: 'Upload CSV', desc: 'Drag and drop the file above. Our privacy-first model runs locally.' },
          { step: '3', title: 'Get Insights', desc: 'View detailed right-sizing recommendations and estimated savings.' },
        ].map(({ step, title, desc }) => (
          <div key={step} style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--az-blue)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)' }}>{title}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--az-text-2)' }}>{desc}</p>
          </div>
        ))}
      </div>

      {toastState && <Toast message={toastState.message} type={toastState.type} onClose={() => setToastState(null)} />}
    </div>
  );
}