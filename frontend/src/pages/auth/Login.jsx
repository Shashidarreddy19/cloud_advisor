import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (localStorage.getItem('token')) navigate('/mode');
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); setError(null);
        if (!username.trim()) { setError('Username is required'); setLoading(false); return; }
        if (!password) { setError('Password is required'); setLoading(false); return; }
        try {
            const res = await api.post('/auth/login', { username, password });
            const { token, username: user, userId } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user', user);
            localStorage.setItem('userId', userId);
            const returnUrl = searchParams.get('returnUrl');
            navigate(returnUrl ? decodeURIComponent(returnUrl) : '/mode');
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally { setLoading(false); }
    };

    return (
        <>
            <style>{`
                @media (max-width: 768px) {
                    .auth-card {
                        flex-direction: column !important;
                        width: 95% !important;
                        max-width: 500px !important;
                    }
                    .auth-right-visual {
                        display: none !important;
                    }
                    .auth-left-form {
                        width: 100% !important;
                        padding: 40px 30px !important;
                    }
                }
                @media (max-width: 480px) {
                    .auth-left-form {
                        padding: 30px 20px !important;
                    }
                }
            `}</style>

            {/* Full page background with layered circles */}
            <div style={{
                height: '100vh', width: '100vw', position: 'fixed', top: 0, left: 0,
                background: 'linear-gradient(135deg, #A8DDD8 0%, #B8E5E1 50%, #C8EDE9 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden'
            }}>
                {/* Background decorative circles - top left */}
                <div style={{
                    position: 'absolute', width: 600, height: 600, borderRadius: '50%',
                    background: 'rgba(139, 207, 200, 0.3)', top: -300, left: -200
                }} />
                <div style={{
                    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                    background: 'rgba(139, 207, 200, 0.2)', top: -150, left: -50
                }} />

                {/* Main card container */}
                <div className="auth-card" style={{
                    width: '85%', maxWidth: 1100, height: 'auto', minHeight: 550,
                    background: '#fff', borderRadius: 20,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    display: 'flex', overflow: 'hidden', position: 'relative'
                }}>
                    {/* Left side - Form */}
                    <div className="auth-left-form" style={{
                        width: '45%', padding: '60px 50px', display: 'flex',
                        flexDirection: 'column', justifyContent: 'center'
                    }}>
                        {/* Logo */}
                        <div style={{ marginBottom: 40 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 8,
                                    background: 'linear-gradient(135deg, #3ABFB0 0%, #2DA89C 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="white" />
                                    </svg>
                                </div>
                                <span style={{ fontSize: 20, fontWeight: 700, color: '#2D3748' }}>Cloud Optimizer</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 40, marginBottom: 35, borderBottom: '3px solid #F0F0F0' }}>
                            <button style={{
                                background: 'none', border: 'none', padding: '12px 0', fontSize: 18, fontWeight: 600,
                                color: '#3ABFB0', borderBottom: '3px solid #3ABFB0', marginBottom: -3,
                                cursor: 'pointer', fontFamily: 'inherit'
                            }}>
                                Login
                            </button>
                            <button onClick={() => navigate('/auth/signup')} style={{
                                background: 'none', border: 'none', padding: '12px 0', fontSize: 18, fontWeight: 400,
                                color: '#CBD5E0', cursor: 'pointer', fontFamily: 'inherit'
                            }}>
                                Sign up
                            </button>
                        </div>

                        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                            {/* Username */}
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#718096', marginBottom: 10 }}>
                                    Email or phone number
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#3ABFB0' }} />
                                    <input
                                        type="text" value={username} onChange={e => setUsername(e.target.value)}
                                        style={{
                                            width: '100%', boxSizing: 'border-box', padding: '15px 15px 15px 48px',
                                            border: 'none', borderRadius: 10, fontSize: 15, outline: 'none',
                                            background: '#F7FAFC', fontFamily: 'inherit'
                                        }}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#718096', marginBottom: 10 }}>
                                    Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#3ABFB0' }} />
                                    <input
                                        type="password" value={password} onChange={e => setPassword(e.target.value)}
                                        style={{
                                            width: '100%', boxSizing: 'border-box', padding: '15px 15px 15px 48px',
                                            border: 'none', borderRadius: 10, fontSize: 15, outline: 'none',
                                            background: '#F7FAFC', fontFamily: 'inherit'
                                        }}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Forgot Password */}
                            <div style={{ textAlign: 'left', marginTop: -8 }}>
                                <button type="button" style={{
                                    background: 'none', border: 'none', color: '#3ABFB0',
                                    fontSize: 14, cursor: 'pointer', padding: 0, fontFamily: 'inherit'
                                }}>
                                    Forget your password?
                                </button>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                                    background: '#FEE', border: '1px solid #FCC', borderRadius: 8,
                                    fontSize: 13, color: '#C33'
                                }}>
                                    <AlertCircle size={16} />{error}
                                </div>
                            )}

                            {/* Submit */}
                            <button
                                type="submit" disabled={loading}
                                style={{
                                    width: '100%', padding: '16px', marginTop: 10,
                                    background: 'linear-gradient(135deg, #3ABFB0 0%, #2DA89C 100%)',
                                    border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    transition: 'transform 0.2s', fontFamily: 'inherit',
                                    boxShadow: '0 4px 12px rgba(58, 191, 176, 0.3)'
                                }}
                                onMouseEnter={e => !loading && (e.target.style.transform = 'translateY(-2px)')}
                                onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
                            >
                                {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />Signing in...</> : 'Login'}
                            </button>
                        </form>
                    </div>

                    {/* Right side - Visual with circles and cloud logos */}
                    <div className="auth-right-visual" style={{
                        width: '55%', position: 'relative', overflow: 'hidden',
                        background: 'linear-gradient(135deg, #B8E5E1 0%, #7DD3C0 100%)'
                    }}>
                        {/* Layered half circles - exact from image */}
                        <div style={{
                            position: 'absolute', width: 700, height: 700, borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.15)', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }} />
                        <div style={{
                            position: 'absolute', width: 550, height: 550, borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.12)', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }} />
                        <div style={{
                            position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.1)', top: '50%', left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }} />

                        {/* Cloud logos container */}
                        <div style={{
                            position: 'relative', zIndex: 1, height: '100%',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', gap: 35, padding: '40px'
                        }}>
                            <h2 style={{
                                fontSize: 26, fontWeight: 600, color: '#2D3748',
                                marginBottom: 10, textAlign: 'center'
                            }}>
                                Multi-Cloud Support
                            </h2>

                            {/* AWS */}
                            <div style={{
                                background: '#fff', padding: '22px 45px', borderRadius: 14,
                                boxShadow: '0 6px 20px rgba(0,0,0,0.1)', minWidth: 220
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 48" width="110">
                                    <path fill="#FF9900" d="M22.9 18.9c0 .9.1 1.7.3 2.3.2.6.5 1.3.9 2 .1.2.2.4.2.6 0 .3-.2.5-.5.8l-1.7 1.1c-.2.1-.5.2-.7.2-.3 0-.5-.1-.8-.3-.4-.4-.7-.8-1-1.3-.3-.4-.5-.9-.8-1.5-2 2.4-4.5 3.5-7.5 3.5-2.1 0-3.8-.6-5-1.8-1.2-1.2-1.8-2.8-1.8-4.8 0-2.1.7-3.8 2.2-5.1 1.5-1.2 3.5-1.9 6-1.9.8 0 1.7.1 2.6.2.9.1 1.8.3 2.8.6v-1.8c0-1.9-.4-3.2-1.2-4-.8-.8-2.1-1.2-4-1.2-.9 0-1.7.1-2.6.3-.9.2-1.8.5-2.6.8-.4.2-.7.3-.8.3-.1 0-.3.1-.4.1-.3 0-.5-.2-.5-.7v-1.2c0-.4.1-.6.2-.8.1-.2.4-.3.7-.5.9-.5 1.9-.9 3.2-1.2 1.2-.3 2.5-.5 3.9-.5 3 0 5.2.7 6.6 2 1.4 1.3 2.1 3.4 2.1 6v7.9zM12.8 23c.8 0 1.7-.1 2.6-.4.9-.3 1.7-.8 2.4-1.5.4-.5.7-1 .9-1.6.1-.6.2-1.3.2-2.2v-1c-.7-.2-1.4-.3-2.2-.4-.7-.1-1.5-.1-2.2-.1-1.6 0-2.7.3-3.5.9-.8.6-1.2 1.5-1.2 2.7 0 1.1.3 1.9.8 2.4.6.8 1.4 1.2 2.2 1.2zm18.9 2.6c-.4 0-.7-.1-.9-.2-.2-.1-.4-.5-.5-.9l-5.7-18.8c-.1-.5-.2-.8-.2-1 0-.4.2-.6.6-.6h2.4c.4 0 .7.1.9.2.2.1.3.5.5.9l4.1 16.1 3.8-16.1c.1-.5.3-.8.5-.9.2-.1.5-.2 1-.2h1.9c.4 0 .7.1 1 .2.2.1.4.5.5.9l3.8 16.3 4.2-16.3c.1-.5.3-.8.5-.9.2-.1.5-.2.9-.2h2.3c.4 0 .6.2.6.6 0 .1 0 .3-.1.5l-.1.5-5.8 18.8c-.1.5-.3.8-.5.9-.2.1-.5.2-.9.2h-2c-.4 0-.7-.1-1-.2-.2-.1-.4-.5-.5-1L40.4 9.6l-3.7 15.8c-.1.5-.3.8-.5 1-.2.1-.5.2-1 .2h-2.5zm30.9.6c-1.2 0-2.4-.1-3.5-.4-1.1-.3-2-.6-2.6-1-.4-.2-.6-.5-.7-.7-.1-.2-.1-.5-.1-.7v-1.3c0-.5.2-.7.5-.7.1 0 .3 0 .4.1.1.1.3.1.5.2.7.3 1.4.5 2.2.7.8.2 1.5.2 2.3.2 1.2 0 2.2-.2 2.8-.6.7-.4 1-1 1-1.8 0-.5-.2-1-.5-1.4-.4-.4-1-.8-2-1.1l-2.9-.9c-1.5-.5-2.5-1.2-3.2-2.1-.7-.9-1-1.9-1-3 0-.9.2-1.6.5-2.3.4-.7.8-1.3 1.4-1.7.6-.5 1.3-.8 2.1-1.1.8-.2 1.6-.4 2.5-.4.4 0 .9 0 1.3.1.5.1.9.2 1.3.3.4.1.8.2 1.1.3.4.1.6.2.8.3.3.2.5.3.6.5.1.2.2.4.2.7v1.2c0 .5-.2.7-.5.7-.2 0-.5-.1-.9-.3-.6-.3-1.3-.5-2.1-.7-.8-.2-1.5-.3-2.3-.3-1.1 0-2 .2-2.6.5-.6.3-.9.9-.9 1.6 0 .5.2 1 .5 1.4.4.4 1.1.8 2.2 1.2l2.8.9c1.5.5 2.5 1.2 3.2 2 .6.8.9 1.8.9 2.9 0 .9-.2 1.7-.5 2.4-.4.7-.8 1.3-1.5 1.8-.6.5-1.4.8-2.2 1.1-.9.2-1.8.4-2.9.4z" />
                                    <path fill="#FF9900" d="M59.8 32.5c-7.2 5.3-17.7 8.1-26.7 8.1-12.6 0-24-4.7-32.6-12.5-.7-.6-.1-1.4.7-1 9.3 5.4 20.7 8.6 32.6 8.6 8 0 16.7-1.7 24.8-5.1 1.2-.5 2.2.8 1.2 1.9z" />
                                    <path fill="#FF9900" d="M62.7 29.2c-.9-1.2-6.1-.6-8.5-.3-.7.1-.8-.5-.2-.9 4.2-2.9 11-2.1 11.8-1.1.8 1-.2 7.7-4.1 10.9-.6.5-1.2.2-.9-.4.9-2.2 2.8-7 1.9-8.2z" />
                                </svg>
                            </div>

                            {/* Azure */}
                            <div style={{
                                background: '#fff', padding: '22px 45px', borderRadius: 14,
                                boxShadow: '0 6px 20px rgba(0,0,0,0.1)', minWidth: 220
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 59.242 47.271" width="100">
                                    <path d="M20.495 1.577L.233 35.736l6.838 9.958h46.173l5.998-9.958-19.55-26.8z" fill="#0089D6" />
                                    <path d="M33.576 3.389L20.02 33.964 26.274 45.2l33.136.494-19.552-26.8z" fill="#0053A0" />
                                    <path d="M.233 45.694l6.571-9.958 13.45-3.77L26.274 45.2z" fill="#005FA6" />
                                </svg>
                            </div>

                            {/* GCP */}
                            <div style={{
                                background: '#fff', padding: '22px 45px', borderRadius: 14,
                                boxShadow: '0 6px 20px rgba(0,0,0,0.1)', minWidth: 220
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 212" width="95">
                                    <path fill="#EA4335" d="M170.2 24.2l-43.8 43.8-27.6-27.6L128 11.2z" />
                                    <path fill="#4285F4" d="M40.4 84.4l43.8 43.8-27.6 27.6L27.4 128z" />
                                    <path fill="#34A853" d="M215.6 127.6l-43.8 43.8 27.6 27.6 29.2-29.2z" />
                                    <path fill="#FBBC05" d="M128 40.4L84.2 84.2l27.6 27.6L170.2 53z" />
                                    <circle cx="128" cy="128" r="40" fill="#4285F4" />
                                    <circle cx="128" cy="128" r="24" fill="white" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
