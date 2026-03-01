import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Shield, Eye, CheckCircle, Cloud, BarChart3, Activity, Lock, FileText, ArrowRight, AlertCircle, Cpu, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (token && user) {
            setIsAuthenticated(true);
            setUsername(user);
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        };

        if (userMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [userMenuOpen]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        setIsAuthenticated(false);
        setUsername('');
        setUserMenuOpen(false);
        navigate('/');
    };

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="bg-white min-h-screen">
            {/* Navigation */}
            <nav className="flex justify-between items-center px-16 py-4 bg-white border-b border-gray-200">
                <div onClick={() => navigate('/')} className="cursor-pointer">
                    <img src="/logo.png" alt="Cloud Optimizer" className="h-10" />
                </div>

                <div className="flex gap-8 items-center">
                    <button onClick={() => scrollToSection('features')} className="text-gray-600 text-sm font-medium hover:text-teal-600 transition-colors">Features</button>
                    <button onClick={() => scrollToSection('how-it-works')} className="text-gray-600 text-sm font-medium hover:text-teal-600 transition-colors">How It Works</button>
                    <button onClick={() => navigate('/help')} className="text-gray-600 text-sm font-medium hover:text-teal-600 transition-colors">Docs</button>
                    <button onClick={() => scrollToSection('blog')} className="text-gray-600 text-sm font-medium hover:text-teal-600 transition-colors">Blog</button>
                </div>

                <div className="flex gap-3 items-center">
                    {isAuthenticated ? (
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-full hover:border-teal-500 transition-all shadow-sm"
                            >
                                <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm uppercase">
                                    {username.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-gray-900">{username}</span>
                                <ChevronDown size={16} className="text-gray-500" />
                            </button>

                            {userMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 overflow-hidden z-50">
                                    <div className="px-4 py-3 border-b border-gray-100">
                                        <p className="text-sm font-semibold text-gray-900">{username}</p>
                                        <p className="text-xs text-gray-500">Cloud Engineer</p>
                                    </div>
                                    <button
                                        onClick={() => { navigate('/cloud/dashboard'); setUserMenuOpen(false); }}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        <LayoutDashboard size={16} />
                                        Dashboard
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut size={16} />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <button onClick={() => navigate('/auth/login')} className="px-5 py-2 text-gray-700 text-sm font-medium hover:text-teal-600 transition-colors">
                                Sign In
                            </button>
                            <button onClick={() => navigate('/auth/signup')} className="px-5 py-2 bg-teal-500 rounded-md text-white text-sm font-semibold hover:bg-teal-600 transition-all">
                                Get Started Free
                            </button>
                        </>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <section className="px-16 py-16 bg-white">
                <div className="max-w-7xl mx-auto grid grid-cols-2 gap-12 items-center">
                    <div>
                        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            Smarter cloud cost optimization with{' '}
                            <span className="text-teal-500">ML-powered insights</span>
                        </h1>
                        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                            Analyze AWS, Azure, and GCP resources using real usage data to identify waste, right-size instances, and reduce cloud spend — safely and transparently.
                        </p>
                        <button onClick={() => navigate('/auth/signup')} className="px-7 py-3 bg-teal-500 rounded-md text-white text-base font-semibold hover:bg-teal-600 transition-all">
                            Get Started
                        </button>
                    </div>
                    <div className="flex justify-center">
                        <img src="/Illustration.png" alt="Cloud Optimization" className="w-full max-w-md" />
                    </div>
                </div>
            </section>

            {/* Clients Section */}
            <section className="px-16 py-12 bg-gray-50">
                <div className="max-w-7xl mx-auto text-center">
                    <p className="text-sm text-gray-500 mb-8 font-medium">Trusted by cloud teams worldwide</p>
                    <div className="flex justify-center items-center gap-16 opacity-40">
                        <Cloud size={40} className="text-gray-600" />
                        <BarChart3 size={40} className="text-gray-600" />
                        <Activity size={40} className="text-gray-600" />
                        <Shield size={40} className="text-gray-600" />
                        <Cpu size={40} className="text-gray-600" />
                    </div>
                </div>
            </section>

            {/* Trust & Safety Section - 3 Cards */}
            <section className="px-16 py-16 bg-white">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
                        Built for Secure Cloud Analysis
                    </h2>

                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock size={32} className="text-teal-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-3">Read-Only Access</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                We require only read-only IAM permissions. We never modify, stop, resize, or delete cloud resources.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <BarChart3 size={32} className="text-blue-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-3">Confidence-Based</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Recommendations shown only when model confidence is high. Low confidence → no action suggested.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Eye size={32} className="text-purple-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-3">Transparent Logic</h3>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Every recommendation explains why it was generated. You always stay in control.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="px-16 py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-4xl font-bold text-gray-900 text-center mb-4">
                        How It Works
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-16 max-w-3xl mx-auto">
                        A transparent, step-by-step process from connection to actionable insights
                    </p>

                    <div className="space-y-12">
                        {/* Step 1 */}
                        <div className="flex gap-8 items-start">
                            <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                    1
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">Connect or Upload</h3>
                                <p className="text-gray-600 mb-4">Choose your preferred ingestion method:</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-3 mb-3">
                                            <Cloud size={24} className="text-teal-600" />
                                            <h4 className="font-semibold text-gray-900">Cloud Connect</h4>
                                        </div>
                                        <p className="text-sm text-gray-600">Connect cloud account using read-only IAM permissions</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-3 mb-3">
                                            <FileText size={24} className="text-blue-600" />
                                            <h4 className="font-semibold text-gray-900">CSV Upload</h4>
                                        </div>
                                        <p className="text-sm text-gray-600">Upload CSV/JSON usage files for offline analysis</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex gap-8 items-start">
                            <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                    2
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">Resource Discovery</h3>
                                <p className="text-gray-600 mb-4">Automatically discovers running and stopped instances</p>
                                <div className="bg-white p-6 rounded-lg border border-gray-200">
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-3 text-gray-700">
                                            <CheckCircle size={18} className="text-teal-600 flex-shrink-0" />
                                            <span>Fetches instance type, region, OS, vCPU, memory</span>
                                        </li>
                                        <li className="flex items-center gap-3 text-gray-700">
                                            <CheckCircle size={18} className="text-teal-600 flex-shrink-0" />
                                            <span>Identifies instance families and architectures</span>
                                        </li>
                                        <li className="flex items-center gap-3 text-gray-700">
                                            <CheckCircle size={18} className="text-teal-600 flex-shrink-0" />
                                            <span>Maps resources across all connected accounts</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex gap-8 items-start">
                            <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                    3
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">Metrics Collection</h3>
                                <p className="text-gray-600 mb-4">Collects CPU and memory usage from cloud-native monitoring</p>
                                <div className="bg-white p-6 rounded-lg border border-gray-200">
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-3 text-gray-700">
                                            <Activity size={18} className="text-blue-600 flex-shrink-0" />
                                            <span>Uses recent historical data (last 7–30 days)</span>
                                        </li>
                                        <li className="flex items-center gap-3 text-gray-700">
                                            <Activity size={18} className="text-blue-600 flex-shrink-0" />
                                            <span>Clearly marks "insufficient data" when uptime is too low</span>
                                        </li>
                                        <li className="flex items-center gap-3 text-gray-700">
                                            <Activity size={18} className="text-blue-600 flex-shrink-0" />
                                            <span>No assumptions made about missing data</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex gap-8 items-start">
                            <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                    4
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">ML Analysis</h3>
                                <p className="text-gray-600 mb-4">ML model classifies instances and calculates confidence</p>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                                        <div className="font-semibold text-red-700 mb-1">OVERSIZED</div>
                                        <p className="text-xs text-red-600">Resources larger than needed</p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                        <div className="font-semibold text-green-700 mb-1">OPTIMAL</div>
                                        <p className="text-xs text-green-600">Right-sized for workload</p>
                                    </div>
                                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                        <div className="font-semibold text-yellow-700 mb-1">UNDERSIZED</div>
                                        <p className="text-xs text-yellow-600">May need more capacity</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 5 */}
                        <div className="flex gap-8 items-start">
                            <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-teal-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                    5
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-2xl font-bold text-gray-900 mb-3">Recommendations</h3>
                                <p className="text-gray-600 mb-4">Only shown if confidence threshold is met</p>
                                <div className="bg-white p-6 rounded-lg border border-gray-200">
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <CheckCircle size={20} className="text-teal-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="font-semibold text-gray-900">Recommended instance type</div>
                                                <p className="text-sm text-gray-600">With compatibility check (region, architecture, family)</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CheckCircle size={20} className="text-teal-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="font-semibold text-gray-900">Estimated cost impact</div>
                                                <p className="text-sm text-gray-600">Projected monthly savings or cost increase</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CheckCircle size={20} className="text-teal-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <div className="font-semibold text-gray-900">Explanation</div>
                                                <p className="text-sm text-gray-600">"Why this recommendation?" with supporting data</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Features Section */}
            <section id="features" className="px-16 py-20 bg-white">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-4xl font-bold text-gray-900 text-center mb-4">
                        Everything you need to optimize cloud costs — safely
                    </h2>
                    <p className="text-lg text-gray-600 text-center mb-16 max-w-3xl mx-auto">
                        Comprehensive analysis tools designed for accuracy and transparency
                    </p>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Cloud size={24} className="text-teal-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Multi-Cloud Support</h3>
                                    <p className="text-gray-600 mb-4">Connect AWS, Azure, and GCP accounts securely with unified dashboard for all compute resources.</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-teal-600 rounded-full"></div>
                                            Single pane of glass for all clouds
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-teal-600 rounded-full"></div>
                                            Consistent analysis across providers
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Activity size={24} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Usage-Based Analysis</h3>
                                    <p className="text-gray-600 mb-4">CPU and memory utilization analysis using cloud-native monitoring data.</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                            CloudWatch, Azure Monitor, GCP Monitoring
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                            Historical usage patterns (7-30 days)
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Cpu size={24} className="text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">ML-Powered Right-Sizing</h3>
                                    <p className="text-gray-600 mb-4">Detects over-sized, under-sized, and optimal instances using historical usage patterns.</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                                            Not based on assumptions
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
                                            Real data-driven recommendations
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <BarChart3 size={24} className="text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">Confidence Scoring</h3>
                                    <p className="text-gray-600 mb-4">Each recommendation includes a confidence percentage to help you make informed decisions.</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                            Low-confidence recommendations suppressed
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                            Transparent confidence thresholds
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Platform Scale Section */}
            <section className="px-16 py-16 bg-gray-50">
                <div className="max-w-5xl mx-auto text-center">
                    <h2 className="text-4xl font-bold text-gray-900 mb-6">
                        Built to scale with your cloud environment
                    </h2>
                    <p className="text-xl text-gray-600 leading-relaxed">
                        Designed to analyze thousands of cloud resources across multiple providers, from small teams to enterprise-scale infrastructures.
                    </p>
                </div>
            </section>

            {/* Blog Section */}
            <section id="blog" className="px-16 py-16 bg-white">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
                        Learn cloud cost optimization the right way
                    </h2>
                    <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
                        Expert insights on data-driven cloud optimization
                    </p>

                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="h-48 bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center">
                                <BarChart3 size={60} className="text-teal-600 opacity-40" />
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-3">
                                    How ML analyzes cloud usage patterns
                                </h3>
                                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    Understanding the machine learning algorithms behind accurate resource classification.
                                </p>
                                <button className="text-teal-600 text-sm font-semibold hover:text-teal-700 flex items-center gap-1">
                                    Read More <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
                                <Shield size={60} className="text-blue-600 opacity-40" />
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-3">
                                    Why confidence matters in cost optimization
                                </h3>
                                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    Learn why confidence-based recommendations prevent costly mistakes.
                                </p>
                                <button className="text-teal-600 text-sm font-semibold hover:text-teal-700 flex items-center gap-1">
                                    Read More <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="h-48 bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                                <AlertCircle size={60} className="text-purple-600 opacity-40" />
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-3">
                                    Common mistakes in cloud right-sizing
                                </h3>
                                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                    Avoid the pitfalls of assumption-based optimization strategies.
                                </p>
                                <button className="text-teal-600 text-sm font-semibold hover:text-teal-700 flex items-center gap-1">
                                    Read More <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="px-16 py-20 bg-gray-50">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl font-bold text-gray-900 mb-6">
                        Start optimizing your cloud costs with confidence
                    </h2>
                    <p className="text-lg text-gray-600 mb-8">
                        No risky automation. No blind changes. Just clear, data-driven insights.
                    </p>
                    <button onClick={() => navigate('/auth/signup')} className="px-10 py-3.5 bg-teal-500 rounded-md text-white text-base font-semibold hover:bg-teal-600 transition-all shadow-lg">
                        Get Started Free
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="px-16 py-12 bg-gray-900 text-gray-400">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-4 gap-8 mb-8">
                        {/* Our Services */}
                        <div>
                            <h4 className="text-white text-sm font-semibold mb-4">Our Services</h4>
                            <ul className="space-y-2">
                                <li><button onClick={() => navigate('/help')} className="text-sm hover:text-teal-400 transition-colors">Documentation</button></li>
                                <li><button className="text-sm hover:text-teal-400 transition-colors">API Reference</button></li>
                                <li><button className="text-sm hover:text-teal-400 transition-colors">IAM Guide</button></li>
                            </ul>
                        </div>

                        {/* Academy */}
                        <div>
                            <h4 className="text-white text-sm font-semibold mb-4">Academy</h4>
                            <ul className="space-y-2">
                                <li><button onClick={() => scrollToSection('features')} className="text-sm hover:text-teal-400 transition-colors">Features</button></li>
                                <li><button onClick={() => scrollToSection('how-it-works')} className="text-sm hover:text-teal-400 transition-colors">How It Works</button></li>
                                <li><button className="text-sm hover:text-teal-400 transition-colors">Best Practices</button></li>
                            </ul>
                        </div>

                        {/* How We Work */}
                        <div>
                            <h4 className="text-white text-sm font-semibold mb-4">How We Work</h4>
                            <ul className="space-y-2">
                                <li><button className="text-sm hover:text-teal-400 transition-colors">About</button></li>
                                <li><button onClick={() => scrollToSection('blog')} className="text-sm hover:text-teal-400 transition-colors">Blog</button></li>
                                <li><button className="text-sm hover:text-teal-400 transition-colors">Contact</button></li>
                            </ul>
                        </div>

                        {/* Stay in Touch */}
                        <div>
                            <h4 className="text-white text-sm font-semibold mb-4">Stay in Touch</h4>
                            <div className="flex gap-3">
                                <a href="#" className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center hover:bg-teal-600 transition-colors">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
                                </a>
                                <a href="#" className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center hover:bg-teal-600 transition-colors">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                                </a>
                                <a href="#" className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center hover:bg-teal-600 transition-colors">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-6 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="Cloud Optimizer" className="h-6" />
                            <span className="text-sm font-semibold text-white">Cloud Optimizer</span>
                        </div>
                        <p className="text-xs text-gray-500">
                            © 2026 Cloud Optimizer. Analyze. Decide. Optimize.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
