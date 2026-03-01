import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Cloud, Shield, LayoutGrid, Zap, CheckCircle, LogOut, Link as LinkIcon,
    BarChart3, Lock, Globe, TrendingUp
} from "lucide-react";

export default function ModeSelection() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("token");
        const username = localStorage.getItem("user");
        if (token && username) {
            setUser({ username });
        }

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes slideRight {
                from {
                    opacity: 0;
                    transform: translateX(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @keyframes bounceSlow {
                0%, 100% {
                    transform: translateY(0);
                }
                50% {
                    transform: translateY(-10px);
                }
            }

            .animate-fade-up {
                animation: fadeUp 0.8s ease-out forwards;
            }

            .animate-slide-right {
                animation: slideRight 0.8s ease-out forwards;
                opacity: 0;
            }

            .animate-bounce-slow {
                animation: bounceSlow 2s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("userId");
        setUser(null);
        navigate("/auth/login");
    };

    const handleGetStarted = () => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/auth/signup');
        } else {
            navigate('/cloud/dashboard');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 font-sans text-gray-900">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <img
                            src="/logo.png"
                            alt="Cloud Optimizer"
                            style={{
                                height: '40px',
                                width: 'auto'
                            }}
                        />
                    </div>

                    {/* Nav Links - Center */}
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
                        <a href="#features" className="hover:text-cyan-600 transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-cyan-600 transition-colors">How it Works</a>
                        <a href="#pricing" className="hover:text-cyan-600 transition-colors">Pricing</a>
                        <a href="#security" className="hover:text-cyan-600 transition-colors">Security</a>
                    </nav>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="relative">
                                <button
                                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-gray-300 transition-all shadow-sm"
                                >
                                    <div className="w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                                        {user.username.charAt(0)}
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 hidden lg:block">{user.username}</span>
                                </button>

                                {userMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 overflow-hidden z-50">
                                        <button onClick={() => navigate('/cloud/dashboard')} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                            <Cloud size={16} />
                                            Dashboard
                                        </button>
                                        <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                                            <LogOut size={16} />
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/auth/login')}
                                    className="text-sm font-semibold text-gray-700 hover:text-cyan-600 transition-colors"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => navigate('/auth/signup')}
                                    className="bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all"
                                >
                                    Get Started Free
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-16 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    {/* LEFT SIDE - Content */}
                    <div className="text-left animate-fade-up">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-semibold mb-6 border border-cyan-100">
                            <span className="bg-cyan-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">NEW</span>
                            AI-POWERED CLOUD OPTIMIZATION
                        </div>

                        {/* Headline */}
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-[1.1] text-gray-900">
                            Cloud Advisor &<br />
                            <span className="text-cyan-500">Cost Optimizer</span>
                        </h1>

                        {/* Subhead */}
                        <p className="text-lg md:text-xl text-gray-600 font-normal mb-10 leading-relaxed">
                            CloudOptimizer helps teams reduce waste and improve performance across AWS, Azure, and Google Cloud in minutes.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-start gap-4 mb-12">
                            <button
                                onClick={handleGetStarted}
                                className="bg-cyan-500 hover:bg-cyan-600 text-white text-base font-semibold px-8 py-3.5 rounded-lg transition-all shadow-lg shadow-cyan-200/50 hover:shadow-xl"
                            >
                                Get Started Free
                            </button>
                            <button
                                onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
                                className="bg-white hover:bg-gray-50 text-gray-900 text-base font-semibold px-8 py-3.5 rounded-lg transition-all border border-gray-300 flex items-center gap-2"
                            >
                                View Sample Report
                                <span>→</span>
                            </button>
                        </div>

                        {/* Trust Badges */}
                        <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500 font-medium uppercase tracking-wider">
                            <span>USED BY 2,500+ ENGINEERING TEAMS</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span>SOC 2 TYPE II</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span>GDPR COMPLIANT</span>
                        </div>
                    </div>

                    {/* RIGHT SIDE - Cloud Provider Cards */}
                    <div className="relative">
                        {/* Floating Savings Badge */}
                        <div className="absolute -top-4 -right-4 z-10 bg-gradient-to-br from-green-500 to-emerald-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-sm font-bold animate-bounce-slow">
                            <span className="text-lg">💰</span>
                            Avg 34% savings found
                        </div>

                        {/* Cloud Cards Stack */}
                        <div className="space-y-4">
                            {/* AWS Card */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-lg hover:border-cyan-400 hover:translate-x-2 transition-all duration-300 group animate-slide-right" style={{ animationDelay: '0.1s' }}>
                                <div className="flex items-center gap-4">
                                    {/* AWS Logo */}
                                    <div className="flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 48" width="60" height="36">
                                            <path fill="#FF9900" d="M22.9 18.9c0 .9.1 1.7.3 2.3.2.6.5 1.3.9 2 .1.2.2.4.2.6 0 .3-.2.5-.5.8l-1.7 1.1c-.2.1-.5.2-.7.2-.3 0-.5-.1-.8-.3-.4-.4-.7-.8-1-1.3-.3-.4-.5-.9-.8-1.5-2 2.4-4.5 3.5-7.5 3.5-2.1 0-3.8-.6-5-1.8-1.2-1.2-1.8-2.8-1.8-4.8 0-2.1.7-3.8 2.2-5.1 1.5-1.2 3.5-1.9 6-1.9.8 0 1.7.1 2.6.2.9.1 1.8.3 2.8.6v-1.8c0-1.9-.4-3.2-1.2-4-.8-.8-2.1-1.2-4-1.2-.9 0-1.7.1-2.6.3-.9.2-1.8.5-2.6.8-.4.2-.7.3-.8.3-.1 0-.3.1-.4.1-.3 0-.5-.2-.5-.7v-1.2c0-.4.1-.6.2-.8.1-.2.4-.3.7-.5.9-.5 1.9-.9 3.2-1.2 1.2-.3 2.5-.5 3.9-.5 3 0 5.2.7 6.6 2 1.4 1.3 2.1 3.4 2.1 6v7.9zM12.8 23c.8 0 1.7-.1 2.6-.4.9-.3 1.7-.8 2.4-1.5.4-.5.7-1 .9-1.6.1-.6.2-1.3.2-2.2v-1c-.7-.2-1.4-.3-2.2-.4-.7-.1-1.5-.1-2.2-.1-1.6 0-2.7.3-3.5.9-.8.6-1.2 1.5-1.2 2.7 0 1.1.3 1.9.8 2.4.6.8 1.4 1.2 2.2 1.2zm18.9 2.6c-.4 0-.7-.1-.9-.2-.2-.1-.4-.5-.5-.9l-5.7-18.8c-.1-.5-.2-.8-.2-1 0-.4.2-.6.6-.6h2.4c.4 0 .7.1.9.2.2.1.3.5.5.9l4.1 16.1 3.8-16.1c.1-.5.3-.8.5-.9.2-.1.5-.2 1-.2h1.9c.4 0 .7.1 1 .2.2.1.4.5.5.9l3.8 16.3 4.2-16.3c.1-.5.3-.8.5-.9.2-.1.5-.2.9-.2h2.3c.4 0 .6.2.6.6 0 .1 0 .3-.1.5l-.1.5-5.8 18.8c-.1.5-.3.8-.5.9-.2.1-.5.2-.9.2h-2c-.4 0-.7-.1-1-.2-.2-.1-.4-.5-.5-1L40.4 9.6l-3.7 15.8c-.1.5-.3.8-.5 1-.2.1-.5.2-1 .2h-2.5zm30.9.6c-1.2 0-2.4-.1-3.5-.4-1.1-.3-2-.6-2.6-1-.4-.2-.6-.5-.7-.7-.1-.2-.1-.5-.1-.7v-1.3c0-.5.2-.7.5-.7.1 0 .3 0 .4.1.1.1.3.1.5.2.7.3 1.4.5 2.2.7.8.2 1.5.2 2.3.2 1.2 0 2.2-.2 2.8-.6.7-.4 1-1 1-1.8 0-.5-.2-1-.5-1.4-.4-.4-1-.8-2-1.1l-2.9-.9c-1.5-.5-2.5-1.2-3.2-2.1-.7-.9-1-1.9-1-3 0-.9.2-1.6.5-2.3.4-.7.8-1.3 1.4-1.7.6-.5 1.3-.8 2.1-1.1.8-.2 1.6-.4 2.5-.4.4 0 .9 0 1.3.1.5.1.9.2 1.3.3.4.1.8.2 1.1.3.4.1.6.2.8.3.3.2.5.3.6.5.1.2.2.4.2.7v1.2c0 .5-.2.7-.5.7-.2 0-.5-.1-.9-.3-.6-.3-1.3-.5-2.1-.7-.8-.2-1.5-.3-2.3-.3-1.1 0-2 .2-2.6.5-.6.3-.9.9-.9 1.6 0 .5.2 1 .5 1.4.4.4 1.1.8 2.2 1.2l2.8.9c1.5.5 2.5 1.2 3.2 2 .6.8.9 1.8.9 2.9 0 .9-.2 1.7-.5 2.4-.4.7-.8 1.3-1.5 1.8-.6.5-1.4.8-2.2 1.1-.9.2-1.8.4-2.9.4z" />
                                            <path fill="#FF9900" d="M59.8 32.5c-7.2 5.3-17.7 8.1-26.7 8.1-12.6 0-24-4.7-32.6-12.5-.7-.6-.1-1.4.7-1 9.3 5.4 20.7 8.6 32.6 8.6 8 0 16.7-1.7 24.8-5.1 1.2-.5 2.2.8 1.2 1.9z" />
                                            <path fill="#FF9900" d="M62.7 29.2c-.9-1.2-6.1-.6-8.5-.3-.7.1-.8-.5-.2-.9 4.2-2.9 11-2.1 11.8-1.1.8 1-.2 7.7-4.1 10.9-.6.5-1.2.2-.9-.4.9-2.2 2.8-7 1.9-8.2z" />
                                        </svg>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-gray-900 mb-0.5">Amazon Web Services</h3>
                                        <p className="text-xs text-gray-500">EC2, S3, RDS, Lambda</p>
                                    </div>

                                    {/* Metric */}
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-cyan-600">247</div>
                                        <div className="text-xs text-gray-500 font-medium">VMs analyzed</div>
                                    </div>

                                    {/* Connected Indicator */}
                                    <div className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                </div>
                            </div>

                            {/* Azure Card */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-lg hover:border-cyan-400 hover:translate-x-2 transition-all duration-300 group animate-slide-right" style={{ animationDelay: '0.2s' }}>
                                <div className="flex items-center gap-4">
                                    {/* Azure Logo */}
                                    <div className="flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 59.242 47.271" width="50" height="38">
                                            <path d="M20.495 1.577L.233 35.736l6.838 9.958h46.173l5.998-9.958-19.55-26.8z" fill="#0089D6" />
                                            <path d="M33.576 3.389L20.02 33.964 26.274 45.2l33.136.494-19.552-26.8z" fill="#0053A0" />
                                            <path d="M.233 45.694l6.571-9.958 13.45-3.77L26.274 45.2z" fill="#005FA6" />
                                        </svg>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-gray-900 mb-0.5">Microsoft Azure</h3>
                                        <p className="text-xs text-gray-500">VMs, Storage, SQL, Functions</p>
                                    </div>

                                    {/* Metric */}
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-cyan-600">189</div>
                                        <div className="text-xs text-gray-500 font-medium">VMs analyzed</div>
                                    </div>

                                    {/* Connected Indicator */}
                                    <div className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                </div>
                            </div>

                            {/* GCP Card */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-lg hover:border-cyan-400 hover:translate-x-2 transition-all duration-300 group animate-slide-right" style={{ animationDelay: '0.3s' }}>
                                <div className="flex items-center gap-4">
                                    {/* GCP Logo */}
                                    <div className="flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 212" width="50" height="41">
                                            <path fill="#EA4335" d="M170.2 24.2l-43.8 43.8-27.6-27.6L128 11.2z" />
                                            <path fill="#4285F4" d="M40.4 84.4l43.8 43.8-27.6 27.6L27.4 128z" />
                                            <path fill="#34A853" d="M215.6 127.6l-43.8 43.8 27.6 27.6 29.2-29.2z" />
                                            <path fill="#FBBC05" d="M128 40.4L84.2 84.2l27.6 27.6L170.2 53z" />
                                            <circle cx="128" cy="128" r="40" fill="#4285F4" />
                                            <circle cx="128" cy="128" r="24" fill="white" />
                                        </svg>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="text-base font-bold text-gray-900 mb-0.5">Google Cloud</h3>
                                        <p className="text-xs text-gray-500">Compute, Storage, BigQuery</p>
                                    </div>

                                    {/* Metric */}
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-cyan-600">156</div>
                                        <div className="text-xs text-gray-500 font-medium">VMs analyzed</div>
                                    </div>

                                    {/* Connected Indicator */}
                                    <div className="absolute top-3 right-3 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Logo Cloud */}
            <section className="py-12 px-6 border-y border-gray-200 bg-white">
                <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-12 opacity-40 grayscale">
                    <div className="w-24 h-12 bg-gray-300 rounded"></div>
                    <div className="w-24 h-12 bg-gray-300 rounded"></div>
                    <div className="w-24 h-12 bg-gray-300 rounded"></div>
                    <div className="w-24 h-12 bg-gray-300 rounded"></div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="how-it-works" className="py-20 px-6 md:px-12 max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-black text-gray-900 mb-4">How it Works</h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Three simple steps to uncover cloud inefficiency and take action in a matter of days
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Step 1 */}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600 mx-auto mb-6">
                            <LinkIcon size={28} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">1. Connect Cloud Accounts</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Link your AWS, Azure, or GCP accounts with read-only access. We never ask for write permissions.
                        </p>
                    </div>

                    {/* Step 2 */}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600 mx-auto mb-6">
                            <BarChart3 size={28} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">2. AI Analysis</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Our AI scans your infrastructure, analyzing usage patterns and identifying optimization opportunities.
                        </p>
                    </div>

                    {/* Step 3 */}
                    <div className="text-center">
                        <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600 mx-auto mb-6">
                            <TrendingUp size={28} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">3. Get Recommendations</h3>
                        <p className="text-gray-600 leading-relaxed">
                            Receive actionable insights with projected savings and step-by-step implementation guides.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 px-6 md:px-12 bg-white">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Feature 1 */}
                    <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
                        <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mb-6">
                            <Shield size={24} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Secure & Read-Only</h3>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            We never ask for write access. Our platform operates on read-only permissions, ensuring your infrastructure stays exactly as you intend.
                        </p>
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm text-gray-700">
                                <CheckCircle size={16} className="text-cyan-500" />
                                <span>Get data-only integration</span>
                            </li>
                            <li className="flex items-center gap-2 text-sm text-gray-700">
                                <CheckCircle size={16} className="text-cyan-500" />
                                <span>SOC 2 Type II certified</span>
                            </li>
                        </ul>
                    </div>

                    {/* Feature 2 */}
                    <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
                        <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mb-6">
                            <LayoutGrid size={24} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Multi-Cloud Unified</h3>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            Stop switching tabs. View your AWS, Azure, and Google Cloud spend in a single, high-fidelity dashboard with normalized data.
                        </p>
                        <div className="flex items-center gap-3 mt-4">
                            <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                                <Cloud size={16} className="text-orange-600" />
                            </div>
                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                <Cloud size={16} className="text-blue-600" />
                            </div>
                            <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                                <Cloud size={16} className="text-green-600" />
                            </div>
                        </div>
                    </div>

                    {/* Feature 3 */}
                    <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border border-gray-200 hover:shadow-lg transition-shadow">
                        <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mb-6">
                            <Zap size={24} strokeWidth={2} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">AI Recommendations</h3>
                        <p className="text-gray-600 leading-relaxed mb-4">
                            Our proprietary AI scans for unused instances, mismatched tiers, and reserved instance opportunities automatically.
                        </p>
                        <p className="text-sm text-cyan-600 font-semibold">
                            Continuously scan for opportunities →
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6 md:px-12 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-black mb-4">Actionable savings delivered to your inbox.</h2>
                        <p className="text-lg text-gray-300">
                            Our AI analyzes all of your cloud accounts every 72 hours, then delivers a prioritized list of savings opportunities right to your inbox.
                        </p>
                    </div>

                    <div className="space-y-4 max-w-2xl mx-auto">
                        <div className="flex items-start gap-4 bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                1
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-white mb-1">Terminate all oversized instances</h4>
                                <p className="text-sm text-gray-400">Estimated savings: $2,340/month</p>
                            </div>
                            <button className="text-cyan-400 text-sm font-semibold hover:text-cyan-300">
                                Learn More →
                            </button>
                        </div>

                        <div className="flex items-start gap-4 bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                2
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-white mb-1">Upgrade to reserved or on-demand</h4>
                                <p className="text-sm text-gray-400">Estimated savings: $1,890/month</p>
                            </div>
                            <button className="text-cyan-400 text-sm font-semibold hover:text-cyan-300">
                                Learn More →
                            </button>
                        </div>

                        <div className="flex items-start gap-4 bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10">
                            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                                3
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-white mb-1">Identify all idle or underutilized</h4>
                                <p className="text-sm text-gray-400">Estimated savings: $1,450/month</p>
                            </div>
                            <button className="text-cyan-400 text-sm font-semibold hover:text-cyan-300">
                                Learn More →
                            </button>
                        </div>
                    </div>

                    <div className="text-center mt-12">
                        <button
                            onClick={handleGetStarted}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white text-base font-semibold px-8 py-3.5 rounded-lg transition-all shadow-lg"
                        >
                            Join Resource Scheduler
                        </button>
                        <p className="text-sm text-gray-400 mt-4">
                            Get started in under 5 minutes. No credit card required.
                        </p>
                    </div>
                </div>
            </section>

            {/* Security Section */}
            <section id="security" className="py-20 px-6 md:px-12 bg-white">
                <div className="max-w-6xl mx-auto text-center">
                    <h2 className="text-4xl font-black text-gray-900 mb-4">
                        Enterprise-grade security is our baseline.
                    </h2>
                    <p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto">
                        Everything you need to stay compliant and protected at scale.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mx-auto mb-4">
                                <Shield size={24} />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">Security Attestations</h4>
                            <p className="text-sm text-gray-600">SOC 2 Type II certified</p>
                        </div>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mx-auto mb-4">
                                <Lock size={24} />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">End-to-end Encryption</h4>
                            <p className="text-sm text-gray-600">Data encrypted at rest and in transit</p>
                        </div>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mx-auto mb-4">
                                <Globe size={24} />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">GDPR Compliant</h4>
                            <p className="text-sm text-gray-600">Full compliance with EU regulations</p>
                        </div>

                        <div className="text-center">
                            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 mx-auto mb-4">
                                <CheckCircle size={24} />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">No Vendor Lock-in</h4>
                            <p className="text-sm text-gray-600">Export your data anytime</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12 px-6 md:px-12">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                        <div>
                            <h5 className="text-white font-bold mb-4">PLATFORM</h5>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">AWS Insights</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Azure Insights</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">GCP Insights</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                            </ul>
                        </div>

                        <div>
                            <h5 className="text-white font-bold mb-4">COMPANY</h5>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                            </ul>
                        </div>

                        <div>
                            <h5 className="text-white font-bold mb-4">RESOURCES</h5>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
                            </ul>
                        </div>

                        <div>
                            <h5 className="text-white font-bold mb-4">LEGAL</h5>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                                <li><a href="#" className="hover:text-white transition-colors">GDPR</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <img
                                src="/logo.png"
                                alt="Cloud Optimizer"
                                style={{
                                    height: '35px',
                                    width: 'auto'
                                }}
                            />
                        </div>

                        <p className="text-sm">
                            © {new Date().getFullYear()} CloudOptimizer Inc. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
