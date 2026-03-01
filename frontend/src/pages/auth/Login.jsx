import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import FormInput from './shared/FormInput';
import PasswordInput from './shared/PasswordInput';
import { validateEmail } from './shared/validationUtils';

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [validation, setValidation] = useState({
        email: { isValid: false, message: '' },
        password: { isValid: false, message: '' }
    });
    const [touched, setTouched] = useState({ email: false, password: false });

    useEffect(() => {
        if (localStorage.getItem('token')) navigate('/cloud/dashboard');
    }, [navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Real-time validation
        if (name === 'email' && touched.email) {
            setValidation(prev => ({ ...prev, email: validateEmail(value) }));
        }
    };

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }));

        if (field === 'email') {
            setValidation(prev => ({ ...prev, email: validateEmail(formData.email) }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setTouched({ email: true, password: true });

        // Validate all fields
        const emailValidation = validateEmail(formData.email);
        if (!emailValidation.isValid) {
            setValidation(prev => ({ ...prev, email: emailValidation }));
            setLoading(false);
            return;
        }

        if (!formData.password) {
            setError('Password is required');
            setLoading(false);
            return;
        }

        try {
            const res = await api.post('/auth/login', {
                username: formData.email,
                password: formData.password
            });

            const { token, username, userId } = res.data;
            localStorage.setItem('token', token);
            localStorage.setItem('user', username);
            localStorage.setItem('userId', userId);

            const returnUrl = searchParams.get('returnUrl');
            navigate(returnUrl ? decodeURIComponent(returnUrl) : '/mode');
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            background: '#ffffff',
            position: 'fixed',
            top: 0,
            left: 0,
            overflow: 'hidden'
        }}>
            {/* Left side - Form */}
            <div style={{
                width: '50%',
                padding: '60px 80px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
            }}>
                {/* Logo and title */}
                <div style={{ marginBottom: '40px' }}>
                    <img
                        src="/logo.png"
                        alt="Cloud Optimizer"
                        style={{
                            height: '60px',
                            marginBottom: '20px',
                            display: 'block'
                        }}
                    />
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: '600',
                        color: '#2d3748',
                        marginBottom: '6px',
                        marginTop: 0
                    }}>
                        Welcome back
                    </h1>
                    <p style={{
                        fontSize: '14px',
                        color: '#718096',
                        margin: 0
                    }}>
                        Sign in to continue to Cloud Optimizer
                    </p>
                </div>

                {/* Tab navigation */}
                <div style={{
                    display: 'flex',
                    gap: '60px',
                    marginBottom: '40px'
                }}>
                    <button style={{
                        background: 'none',
                        border: 'none',
                        padding: '0 0 12px 0',
                        fontSize: '22px',
                        fontWeight: '500',
                        color: '#1a7a6e',
                        borderBottom: '2px solid #1a7a6e',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                    }}>
                        Login
                    </button>
                    <button
                        onClick={() => navigate('/auth/signup')}
                        style={{
                            background: 'none',
                            border: 'none',
                            padding: '0 0 12px 0',
                            fontSize: '22px',
                            fontWeight: '500',
                            color: '#aaa',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#1a7a6e'}
                        onMouseLeave={(e) => e.target.style.color = '#aaa'}
                    >
                        Sign up
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    maxWidth: '480px'
                }}>
                    <FormInput
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={() => handleBlur('email')}
                        placeholder="Enter your email"
                        label="Email"
                        icon={Mail}
                        required
                        validation={touched.email ? validation.email : undefined}
                        autoComplete="email"
                    />

                    <PasswordInput
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={() => handleBlur('password')}
                        placeholder="Enter your password"
                        label="Password"
                        required
                        autoComplete="current-password"
                    />

                    {/* Forgot password and Submit button row */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '10px'
                    }}>
                        <button
                            type="button"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#5bb8a8',
                                fontSize: '13px',
                                fontWeight: '400',
                                cursor: 'pointer',
                                padding: 0,
                                fontFamily: 'inherit',
                                transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.color = '#2aa08a'}
                            onMouseLeave={(e) => e.target.style.color = '#5bb8a8'}
                        >
                            Forgot your password?
                        </button>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                padding: '14px 52px',
                                background: loading ? '#a0aec0' : 'linear-gradient(135deg, #4ec9b0, #2aa08a)',
                                border: 'none',
                                borderRadius: '30px',
                                color: '#ffffff',
                                fontSize: '16px',
                                fontWeight: '500',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                fontFamily: 'inherit',
                                boxShadow: '0 6px 20px rgba(78, 201, 176, 0.4)'
                            }}
                            onMouseEnter={(e) => {
                                if (!loading) {
                                    e.target.style.transform = 'translateY(-2px)';
                                    e.target.style.boxShadow = '0 10px 28px rgba(78, 201, 176, 0.5)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 6px 20px rgba(78, 201, 176, 0.4)';
                            }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Signing in...</span>
                                </>
                            ) : (
                                <span>Login</span>
                            )}
                        </button>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '14px 16px',
                            background: '#fff5f5',
                            border: '1px solid #fc8181',
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: '#c53030',
                            marginTop: '-10px'
                        }}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}
                </form>

            </div>

            {/* Right side - Illustration */}
            <div style={{
                width: '50%',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}>
                {/* Half-circle backgrounds extending from right edge - larger sizes */}
                <div style={{
                    position: 'absolute',
                    right: '-550px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '1200px',
                    height: '1200px',
                    borderRadius: '50%',
                    background: '#d4f4ed',
                    opacity: 0.5
                }} />
                <div style={{
                    position: 'absolute',
                    right: '-450px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '1050px',
                    height: '1050px',
                    borderRadius: '50%',
                    background: '#a8e6d7',
                    opacity: 0.6
                }} />
                <div style={{
                    position: 'absolute',
                    right: '-350px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '900px',
                    height: '900px',
                    borderRadius: '50%',
                    background: '#7dd9c3',
                    opacity: 0.7
                }} />

                {/* Laptop illustration only */}
                <div style={{
                    position: 'relative',
                    zIndex: 2
                }}>
                    <svg width="320" height="220" viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Laptop screen */}
                        <rect x="60" y="20" width="200" height="130" rx="8" fill="#4a5568" stroke="#2d3748" strokeWidth="4" />
                        {/* Screen bezel */}
                        <rect x="68" y="28" width="184" height="114" fill="#2d3748" />
                        {/* Screen content - teal grid pattern */}
                        <g opacity="0.8">
                            <line x1="80" y1="50" x2="160" y2="50" stroke="#5bb8a8" strokeWidth="3" />
                            <line x1="80" y1="65" x2="200" y2="65" stroke="#5bb8a8" strokeWidth="3" />
                            <line x1="80" y1="80" x2="180" y2="80" stroke="#5bb8a8" strokeWidth="3" />
                            <line x1="80" y1="95" x2="190" y2="95" stroke="#5bb8a8" strokeWidth="3" />
                            <line x1="80" y1="110" x2="170" y2="110" stroke="#5bb8a8" strokeWidth="3" />
                            <line x1="80" y1="125" x2="195" y2="125" stroke="#5bb8a8" strokeWidth="3" />
                        </g>
                        {/* Laptop base */}
                        <path d="M 30 150 L 50 158 L 270 158 L 290 150 Z" fill="#4a5568" stroke="#2d3748" strokeWidth="3" />
                        {/* Keyboard area */}
                        <rect x="65" y="162" width="190" height="30" rx="4" fill="#2d3748" />
                        {/* Trackpad */}
                        <rect x="130" y="170" width="60" height="18" rx="3" fill="#4a5568" stroke="#1a202c" strokeWidth="1" />
                    </svg>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
