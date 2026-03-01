import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, Cloud, Upload, FileText, ChevronRight, CheckCircle, Info } from 'lucide-react';

export default function Help() {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('getting-started');
    const [selectedCloud, setSelectedCloud] = useState('aws');

    const sections = [
        { id: 'getting-started', label: 'Getting Started', icon: HelpCircle },
        { id: 'cloud-connection', label: 'Cloud Connection', icon: Cloud },
        { id: 'csv-upload', label: 'CSV Upload', icon: Upload },
        { id: 'faq', label: 'FAQ', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Public Navigation Header */}
            <nav className="flex justify-between items-center px-16 py-4 bg-white border-b border-gray-200">
                <div onClick={() => navigate('/')} className="cursor-pointer">
                    <img src="/logo.png" alt="Cloud Optimizer" className="h-10" />
                </div>

                <div className="flex gap-3 items-center">
                    <button onClick={() => navigate('/')} className="px-5 py-2 text-gray-700 text-sm font-medium hover:text-teal-600 transition-colors">
                        Home
                    </button>
                    <button onClick={() => navigate('/auth/login')} className="px-5 py-2 text-gray-700 text-sm font-medium hover:text-teal-600 transition-colors">
                        Sign In
                    </button>
                    <button onClick={() => navigate('/auth/signup')} className="px-5 py-2 bg-teal-500 rounded-md text-white text-sm font-semibold hover:bg-teal-600 transition-all">
                        Get Started Free
                    </button>
                </div>
            </nav>

            {/* Help Content */}
            <div style={{ display: 'flex', height: 'calc(100vh - 73px)', background: 'var(--az-bg)' }}>
                <div style={{ width: 240, background: 'var(--az-card)', borderRight: '1px solid var(--az-border)', padding: '20px 0', overflowY: 'auto' }}>
                    <div style={{ padding: '0 20px', marginBottom: 20 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--az-text)', margin: 0 }}>Help Center</h2>
                    </div>
                    {sections.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setActiveSection(id)} style={{
                            width: '100%', padding: '12px 20px', border: 'none',
                            background: activeSection === id ? 'var(--az-blue-light)' : 'transparent',
                            color: activeSection === id ? 'var(--az-blue)' : 'var(--az-text-2)',
                            textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center',
                            gap: 10, fontSize: 14, fontWeight: activeSection === id ? 600 : 400,
                            transition: 'all 0.15s', fontFamily: 'inherit',
                            borderLeft: activeSection === id ? '3px solid var(--az-blue)' : '3px solid transparent'
                        }}>
                            <Icon size={18} />{label}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 40 }}>
                    <div style={{ maxWidth: 900 }}>
                        {activeSection === 'getting-started' && <GettingStarted />}
                        {activeSection === 'cloud-connection' && <CloudConnection selectedCloud={selectedCloud} setSelectedCloud={setSelectedCloud} />}
                        {activeSection === 'csv-upload' && <CSVUpload />}
                        {activeSection === 'faq' && <FAQ />}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Getting Started Component
function GettingStarted() {
    return (
        <>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--az-text)', marginBottom: 10 }}>Getting Started</h1>
            <p style={{ fontSize: 14, color: 'var(--az-text-2)', marginBottom: 30, lineHeight: 1.8 }}>
                Welcome to Cloud Advisor & Cost Optimizer - an intelligent platform that helps you reduce cloud costs by up to 40% through ML-powered analysis and recommendations.
            </p>

            <Section title="What is Cloud Optimizer?">
                <p style={{ fontSize: 14, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                    Cloud Optimizer analyzes your cloud infrastructure across AWS, Azure, and GCP to identify cost-saving opportunities. Using Machine Learning, it examines CPU, memory, disk, and network usage patterns to recommend optimal instance sizes that maintain performance while reducing costs.
                </p>
            </Section>

            <Section title="Key Features">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 15 }}>
                    <FeatureCard icon={<CheckCircle size={18} style={{ color: 'var(--az-success)' }} />} title="Multi-Cloud Support" desc="AWS, Azure, and GCP in one dashboard" />
                    <FeatureCard icon={<CheckCircle size={18} style={{ color: 'var(--az-success)' }} />} title="ML Recommendations" desc="AI-powered right-sizing suggestions" />
                    <FeatureCard icon={<CheckCircle size={18} style={{ color: 'var(--az-success)' }} />} title="Real-Time Metrics" desc="Live CPU, memory, disk, network data" />
                    <FeatureCard icon={<CheckCircle size={18} style={{ color: 'var(--az-success)' }} />} title="Cost Calculator" desc="Instant savings in USD and INR" />
                    <FeatureCard icon={<CheckCircle size={18} style={{ color: 'var(--az-success)' }} />} title="CSV Mode" desc="Offline analysis without cloud access" />
                    <FeatureCard icon={<CheckCircle size={18} style={{ color: 'var(--az-success)' }} />} title="PDF Reports" desc="Exportable recommendations" />
                </div>
            </Section>

            <Section title="Two Usage Modes">
                <ModeCard title="🌐 Cloud Mode" subtitle="Direct Integration (Recommended)"
                    features={['Auto-fetch resources and metrics', 'Real-time monitoring', 'Live usage analysis', 'Automatic updates']}
                    steps={['Connect cloud account', 'Auto-discover resources', 'Fetch real-time metrics', 'Get ML recommendations']}
                />
                <ModeCard title="📄 CSV Mode" subtitle="Offline Analysis"
                    features={['No cloud connection needed', 'Upload historical data', 'One-time analysis', 'Security-friendly']}
                    steps={['Export resource data', 'Format as CSV (18 columns)', 'Upload file', 'Get recommendations']}
                />
            </Section>

            <Section title="Quick Start Steps">
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 8, padding: 20 }}>
                    <ol style={{ fontSize: 14, color: 'var(--az-text)', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
                        <li>Create account and log in</li>
                        <li>Choose Cloud Mode or CSV Mode</li>
                        <li>Connect cloud provider OR upload CSV</li>
                        <li>View dashboard with all resources</li>
                        <li>Review ML-powered recommendations</li>
                        <li>Analyze potential savings</li>
                        <li>Generate and export reports</li>
                        <li>Implement changes in your cloud console</li>
                    </ol>
                </div>
            </Section>

            <Section title="Understanding Recommendations">
                <RecommendationType type="Oversized" color="var(--az-error)"
                    desc="Resources using less than 40% CPU/memory. Can be downsized to save 30-50% costs."
                    example="t3.large (15% CPU, 30% memory) to t3.medium saves $17/month"
                />
                <RecommendationType type="Undersized" color="#8A3707"
                    desc="Resources at greater than 80% CPU/memory. Need upgrade to prevent performance issues."
                    example="t3.small (85% CPU, 90% memory) to t3.medium prevents downtime"
                />
                <RecommendationType type="Optimal" color="var(--az-success)"
                    desc="Resources at 40-80% utilization. Already well-sized, no changes needed."
                    example="t3.medium (60% CPU, 65% memory) is perfectly balanced"
                />
            </Section>

            <Section title="How Cloud Connect Recommendations Work">
                <div style={{ background: 'var(--az-blue-light)', border: '2px solid var(--az-blue)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 12 }}>🤖 Automated ML-Powered Analysis Pipeline</h3>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, margin: 0 }}>
                        When you connect your cloud account, the system automatically fetches resources, collects metrics, and runs ML analysis to generate intelligent right-sizing recommendations.
                    </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FF9900', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>1</div>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', margin: 0 }}>Resource Discovery</h4>
                        </div>
                        <div style={{ paddingLeft: 48, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                            <strong style={{ color: 'var(--az-blue)' }}>What happens:</strong> System connects to your cloud provider and discovers all compute instances (EC2, VMs, Compute Engine) across all regions.<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Data collected:</strong> Instance ID, type, region, vCPU count, memory, OS, current state, tags<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Time:</strong> 5-15 seconds per region
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0089D6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>2</div>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', margin: 0 }}>Metrics Collection</h4>
                        </div>
                        <div style={{ paddingLeft: 48, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                            <strong style={{ color: 'var(--az-blue)' }}>What happens:</strong> Fetches historical performance metrics from CloudWatch, Azure Monitor, or GCP Monitoring for the past 14-30 days.<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Metrics collected:</strong><br />
                            • <strong>CPU:</strong> Average, P95, peak, off-peak, spike ratio<br />
                            • <strong>Memory:</strong> Average, P95, swap usage (if available)<br />
                            • <strong>Disk:</strong> Read/write IOPS, latency<br />
                            • <strong>Network:</strong> In/out bytes, packet loss<br />
                            • <strong>Uptime:</strong> Running hours, availability<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Time:</strong> 10-30 seconds per instance
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#34A853', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>3</div>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', margin: 0 }}>Data Normalization</h4>
                        </div>
                        <div style={{ paddingLeft: 48, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                            <strong style={{ color: 'var(--az-blue)' }}>What happens:</strong> Converts cloud-specific data into standardized format for ML analysis.<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Process:</strong><br />
                            • Standardizes instance types across clouds<br />
                            • Converts metrics to consistent units (percentages, bytes)<br />
                            • Handles missing data with intelligent defaults<br />
                            • Calculates derived metrics (spike ratios, workload patterns)<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Time:</strong> 1-2 seconds per instance
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#8A3707', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>4</div>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', margin: 0 }}>Pricing Enrichment</h4>
                        </div>
                        <div style={{ paddingLeft: 48, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                            <strong style={{ color: 'var(--az-blue)' }}>What happens:</strong> Fetches current pricing data for instance types in each region.<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Data sources:</strong><br />
                            • AWS Pricing API<br />
                            • Azure Retail Prices API<br />
                            • GCP Cloud Billing API<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Calculations:</strong> Current monthly cost, recommended instance cost, potential savings<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Time:</strong> 2-5 seconds per instance
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--az-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>5</div>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', margin: 0 }}>ML Prediction & Classification</h4>
                        </div>
                        <div style={{ paddingLeft: 48, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                            <strong style={{ color: 'var(--az-blue)' }}>What happens:</strong> Machine Learning model analyzes 24+ features to predict optimal instance size.<br />
                            <strong style={{ color: 'var(--az-blue)' }}>ML Model:</strong> Random Forest trained on 10,000+ real-world instances<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Features analyzed:</strong><br />
                            • CPU/memory utilization patterns<br />
                            • Spike ratios and peak behavior<br />
                            • Workload patterns (steady, bursty, periodic)<br />
                            • Resource throttling indicators<br />
                            • Uptime and availability<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Output:</strong> Classification (OPTIMAL, OVERSIZED, UNDERSIZED, ZOMBIE), recommended instance type, confidence score (0-100%)<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Time:</strong> Less than 1 second per instance
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--az-success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>6</div>
                            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', margin: 0 }}>Results Display</h4>
                        </div>
                        <div style={{ paddingLeft: 48, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                            <strong style={{ color: 'var(--az-blue)' }}>What you see:</strong><br />
                            • Dashboard with all instances and their optimization status<br />
                            • Detailed metrics and recommendations for each instance<br />
                            • Potential monthly savings in USD<br />
                            • Confidence scores for each recommendation<br />
                            • Actionable next steps<br />
                            <strong style={{ color: 'var(--az-blue)' }}>Storage:</strong> Results stored in browser localStorage for instant access (no database needed)
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Classification Logic - How Decisions Are Made">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        🎯 Priority-Based Classification System:
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8 }}>
                        The system uses a priority-based approach to classify instances, checking conditions in this order:
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--az-card)', border: '2px solid #8A3707', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#8A3707', marginBottom: 6 }}>Priority 1: UNDERSIZED (Performance Risk)</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Condition:</strong> CPU {'>'} 80% OR Memory {'>'} 85%<br />
                            <strong>Why first:</strong> Performance issues are critical - must be addressed immediately<br />
                            <strong>Action:</strong> Upgrade to larger instance type<br />
                            <strong>Impact:</strong> Cost increases but prevents downtime
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-error)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-error)', marginBottom: 6 }}>Priority 2: ZOMBIE (Idle Resources)</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Condition:</strong> CPU {'<'} 5% AND Uptime {'>'} 500 hours<br />
                            <strong>Why second:</strong> Completely wasted resources - 100% savings opportunity<br />
                            <strong>Action:</strong> Terminate or stop instance<br />
                            <strong>Impact:</strong> Eliminate 100% of cost
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-warning)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-warning)', marginBottom: 6 }}>Priority 3: OVERSIZED (Cost Optimization)</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Condition:</strong> CPU {'<'} 20% AND Memory {'<'} 30%<br />
                            <strong>Why third:</strong> Safe cost reduction opportunity<br />
                            <strong>Action:</strong> Downsize to smaller instance type<br />
                            <strong>Impact:</strong> 30-50% cost reduction
                        </div>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-success)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 6 }}>Priority 4: OPTIMAL (No Action Needed)</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Condition:</strong> Balanced utilization (40-80% CPU/memory)<br />
                            <strong>Why last:</strong> Already well-sized<br />
                            <strong>Action:</strong> No changes needed<br />
                            <strong>Impact:</strong> $0 savings (already optimized)
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="What Affects Confidence Scores?">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 15 }}>
                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-success)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8 }}>✅ Increases Confidence</div>
                        <ul style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6, paddingLeft: 20, margin: 0 }}>
                            <li>30+ days of metrics data</li>
                            <li>Consistent usage patterns</li>
                            <li>Complete metrics (CPU, memory, disk, network)</li>
                            <li>High uptime (greater than 90%)</li>
                            <li>Low spike ratios (less than 2x)</li>
                            <li>Steady workload pattern</li>
                        </ul>
                    </div>

                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-error)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-error)', marginBottom: 8 }}>⚠️ Decreases Confidence</div>
                        <ul style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6, paddingLeft: 20, margin: 0 }}>
                            <li>Less than 14 days of data</li>
                            <li>Erratic usage patterns</li>
                            <li>Missing metrics (no memory data)</li>
                            <li>Low uptime (less than 50%)</li>
                            <li>High spike ratios (greater than 3x)</li>
                            <li>Bursty workload pattern</li>
                        </ul>
                    </div>
                </div>
            </Section>

            <Section title="Typical Processing Times">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        ⏱️ Expected sync duration by instance count:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
                        <div style={{ padding: 12, background: 'var(--az-card)', borderRadius: 6 }}>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)' }}>1-10 instances</div>
                            <div style={{ color: 'var(--az-text-2)' }}>15-30 seconds</div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--az-card)', borderRadius: 6 }}>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)' }}>11-50 instances</div>
                            <div style={{ color: 'var(--az-text-2)' }}>30-60 seconds</div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--az-card)', borderRadius: 6 }}>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)' }}>51-100 instances</div>
                            <div style={{ color: 'var(--az-text-2)' }}>1-2 minutes</div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--az-card)', borderRadius: 6 }}>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)' }}>100+ instances</div>
                            <div style={{ color: 'var(--az-text-2)' }}>2-5 minutes</div>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Confidence Scores">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <ConfidenceItem level="High (80-100%)" color="var(--az-success)" desc="Very reliable. Safe to implement immediately." />
                    <ConfidenceItem level="Medium (60-79%)" color="#8A3707" desc="Moderately reliable. Review before implementing." />
                    <ConfidenceItem level="Low (0-59%)" color="var(--az-error)" desc="Less reliable. Requires careful testing." />
                </div>
            </Section>
        </>
    );
}

// Cloud Connection Component with Provider Selector
function CloudConnection({ selectedCloud, setSelectedCloud }) {
    const clouds = [
        { id: 'aws', name: 'Amazon Web Services', logo: '☁️', color: '#FF9900' },
        { id: 'azure', name: 'Microsoft Azure', logo: '🔷', color: '#0089D6' },
        { id: 'gcp', name: 'Google Cloud Platform', logo: '🌐', color: '#4285F4' }
    ];

    return (
        <>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--az-text)', marginBottom: 10 }}>Cloud Connection Guide</h1>
            <p style={{ fontSize: 14, color: 'var(--az-text-2)', marginBottom: 30 }}>Step-by-step instructions to connect your cloud provider</p>

            <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--az-text)', marginBottom: 15 }}>Select Your Cloud Provider:</h3>
                <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap' }}>
                    {clouds.map(cloud => (
                        <button key={cloud.id} onClick={() => setSelectedCloud(cloud.id)} style={{
                            flex: '1 1 200px', padding: '16px 20px',
                            border: selectedCloud === cloud.id ? `2px solid ${cloud.color}` : '2px solid var(--az-border)',
                            borderRadius: 8, background: selectedCloud === cloud.id ? `${cloud.color}15` : 'var(--az-card)',
                            cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 12, fontSize: 15,
                            fontWeight: selectedCloud === cloud.id ? 600 : 400,
                            color: selectedCloud === cloud.id ? cloud.color : 'var(--az-text)'
                        }}>
                            <span style={{ fontSize: 24 }}>{cloud.logo}</span>{cloud.name}
                        </button>
                    ))}
                </div>
            </div>

            {selectedCloud === 'aws' && <AWSGuide />}
            {selectedCloud === 'azure' && <AzureGuide />}
            {selectedCloud === 'gcp' && <GCPGuide />}
        </>
    );
}

// AWS Connection Guide
function AWSGuide() {
    return (
        <>
            <div style={{ background: '#FFF4E5', border: '2px solid #FF9900', borderRadius: 10, padding: 25, marginBottom: 30 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: '#D47A00', marginBottom: 10 }}>☁️ Amazon Web Services (AWS)</h2>
                <p style={{ fontSize: 14, color: 'var(--az-text-2)', lineHeight: 1.8, margin: 0 }}>
                    Connect AWS to auto-discover EC2 instances and fetch CloudWatch metrics including CPU, memory, disk I/O, and network usage.
                </p>
            </div>

            <Section title="Required Credentials">
                <CredItem name="Access Key ID" format="20 characters" example="AKIAIOSFODNN7EXAMPLE" highlight />
                <CredItem name="Secret Access Key" format="40 characters" example="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" highlight />
                <CredItem name="Region" format="AWS region code" example="us-east-1, eu-west-1, ap-south-1" highlight />
            </Section>

            <Section title="Step-by-Step Setup">
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Info size={18} style={{ color: 'var(--az-blue)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-blue)' }}>Important: Follow these steps carefully</span>
                    </div>
                </div>
                <Steps steps={[
                    <>Log in to <strong style={{ color: 'var(--az-blue)' }}>AWS Console</strong> (https://console.aws.amazon.com/)</>,
                    <>Navigate to <strong style={{ color: 'var(--az-blue)' }}>IAM {'->'} Users</strong></>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"Add users"</strong> or select existing user</>,
                    <>For new user: Enter username (e.g., <strong style={{ color: 'var(--az-blue)' }}>"cloud-optimizer-readonly"</strong>), select <strong style={{ color: 'var(--az-blue)' }}>"Programmatic access"</strong></>,
                    <>Attach policies: <strong style={{ color: 'var(--az-success)' }}>AmazonEC2ReadOnlyAccess</strong> + <strong style={{ color: 'var(--az-success)' }}>CloudWatchReadOnlyAccess</strong></>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"Create user"</strong> and <strong style={{ color: 'var(--az-error)' }}>download credentials CSV</strong></>,
                    <>For existing user: Go to <strong style={{ color: 'var(--az-blue)' }}>"Security credentials"</strong> tab {'->'} <strong style={{ color: 'var(--az-blue)' }}>"Create access key"</strong></>,
                    <>Select <strong style={{ color: 'var(--az-blue)' }}>"Third-party service"</strong> {'->'} Create key</>,
                    <><strong style={{ color: 'var(--az-error)' }}>Copy Access Key ID and Secret Access Key</strong> (shown only once!)</>,
                    <>In Cloud Optimizer: Go to <strong style={{ color: 'var(--az-blue)' }}>"Connect Cloud"</strong> {'->'} Select <strong style={{ color: 'var(--az-blue)' }}>AWS</strong> {'->'} Paste credentials {'->'} <strong style={{ color: 'var(--az-success)' }}>Connect</strong></>
                ]} />
            </Section>

            <Section title="Required IAM Permissions - Detailed Breakdown">
                <div style={{ background: 'var(--az-blue-light)', border: '2px solid var(--az-blue)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 12 }}>🔐 What Permissions Does Cloud Optimizer Need?</h3>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, margin: 0 }}>
                        Cloud Optimizer requires <strong>read-only permissions</strong> to fetch your EC2 instances, CloudWatch metrics, and pricing data. We <strong>NEVER</strong> need write, modify, or delete permissions.
                    </p>
                </div>

                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        📋 Complete List of Required Permissions:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#FF9900', marginBottom: 8 }}>EC2 Permissions (Instance Discovery)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>ec2:DescribeInstances</code> - List all EC2 instances across regions</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>ec2:DescribeRegions</code> - Discover available AWS regions</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>ec2:DescribeInstanceTypes</code> - Get vCPU and memory specs</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>ec2:DescribeImages</code> - Detect OS (Linux/Windows)</>
                            ]} />
                        </div>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#FF9900', marginBottom: 8 }}>CloudWatch Permissions (Metrics Collection)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>cloudwatch:GetMetricStatistics</code> - Fetch CPU, memory, disk, network metrics</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>cloudwatch:ListMetrics</code> - List available metrics for instances</>
                            ]} />
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)', marginTop: 8, fontStyle: 'italic' }}>
                                💡 These permissions enable fetching 14-30 days of historical metrics for accurate ML predictions
                            </div>
                        </div>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#FF9900', marginBottom: 8 }}>Optional Permissions (Enhanced Features)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>s3:ListAllMyBuckets</code> - List S3 buckets (optional storage analysis)</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>sts:GetCallerIdentity</code> - Verify IAM user identity</>
                            ]} />
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--az-success-bg)', border: '1px solid var(--az-success)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8 }}>✅ Recommended: Use AWS Managed Policies</div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                        Instead of creating custom policies, attach these AWS-managed policies to your IAM user:
                    </p>
                    <ul style={{ fontSize: 13, color: 'var(--az-text-2)', margin: '8px 0', paddingLeft: 20 }}>
                        <li><strong style={{ color: 'var(--az-success)' }}>AmazonEC2ReadOnlyAccess</strong> - Covers all EC2 permissions</li>
                        <li><strong style={{ color: 'var(--az-success)' }}>CloudWatchReadOnlyAccess</strong> - Covers all CloudWatch permissions</li>
                    </ul>
                </div>

                <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        🛠️ Option 2: Create Custom IAM Policy (Advanced)
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', marginBottom: 12 }}>
                        If you prefer minimal permissions, create a custom policy with only the required permissions:
                    </p>
                    <div style={{ background: 'var(--az-surface)', padding: 15, borderRadius: 6, overflowX: 'auto', marginBottom: 12 }}>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre', display: 'block', color: 'var(--az-text-2)' }}>
                            {`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeRegions",
        "ec2:DescribeInstanceTypes",
        "ec2:DescribeImages",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    }
  ]
}`}
                        </code>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                        <strong>To create custom policy:</strong><br />
                        1. Go to IAM → Policies → Create policy<br />
                        2. Click JSON tab and paste the policy above<br />
                        3. Name it "CloudOptimizerReadOnly"<br />
                        4. Attach to your IAM user
                    </div>
                </div>
            </Section>

            <Alert type="warning" title="🔒 Security Best Practices">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Never share</strong> your Secret Access Key</li>
                    <li>Use <strong>read-only permissions</strong> only (no write/delete)</li>
                    <li>Create a <strong>dedicated IAM user</strong> for Cloud Optimizer</li>
                    <li><strong>Rotate keys</strong> every 90 days</li>
                    <li>Enable <strong>MFA</strong> on your AWS account</li>
                    <li>Monitor <strong>CloudTrail logs</strong> regularly</li>
                </ul>
            </Alert>

            <Alert type="info" title="🔧 Troubleshooting">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Invalid credentials:</strong> Check for extra spaces when copying</li>
                    <li><strong>No instances found:</strong> Verify region has EC2 instances</li>
                    <li><strong>Permission denied:</strong> Ensure policies are attached to IAM user</li>
                    <li><strong>Region issues:</strong> Try manual region selection</li>
                </ul>
            </Alert>
        </>
    );
}

// Azure Connection Guide
function AzureGuide() {
    return (
        <>
            <div style={{ background: '#E6F4FF', border: '2px solid #0089D6', borderRadius: 10, padding: 25, marginBottom: 30 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0089D6', marginBottom: 10 }}>🔷 Microsoft Azure</h2>
                <p style={{ fontSize: 14, color: 'var(--az-text-2)', lineHeight: 1.8, margin: 0 }}>
                    Connect Azure to auto-discover Virtual Machines and fetch Azure Monitor metrics for comprehensive infrastructure analysis.
                </p>
            </div>

            <Section title="Required Credentials">
                <CredItem name="Subscription ID" format="GUID (36 chars)" example="12345678-1234-1234-1234-123456789012" highlight />
                <CredItem name="Tenant ID" format="GUID (36 chars)" example="87654321-4321-4321-4321-210987654321" highlight />
                <CredItem name="Client ID" format="GUID (36 chars)" example="abcdef12-3456-7890-abcd-ef1234567890" highlight />
                <CredItem name="Client Secret" format="Alphanumeric string" example="abc123~DEF456.ghi789_JKL012" highlight />
            </Section>

            <Section title="Step-by-Step Setup">
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Info size={18} style={{ color: 'var(--az-blue)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-blue)' }}>Important: You need all 4 credentials</span>
                    </div>
                </div>
                <Steps steps={[
                    <>Log in to <strong style={{ color: 'var(--az-blue)' }}>Azure Portal</strong> (https://portal.azure.com/)</>,
                    <>Search for <strong style={{ color: 'var(--az-blue)' }}>"Azure Active Directory"</strong> and select it</>,
                    <>Go to <strong style={{ color: 'var(--az-blue)' }}>"App registrations"</strong> {'->'} Click <strong style={{ color: 'var(--az-blue)' }}>"+  New registration"</strong></>,
                    <>Name: <strong style={{ color: 'var(--az-blue)' }}>"CloudOptimizer"</strong>, Account types: <strong style={{ color: 'var(--az-blue)' }}>"This directory only"</strong>, Redirect URI: Leave blank</>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"Register"</strong> {'->'} <strong style={{ color: 'var(--az-error)' }}>Copy Application (client) ID and Directory (tenant) ID</strong></>,
                    <>Go to <strong style={{ color: 'var(--az-blue)' }}>"Certificates & secrets"</strong> {'->'} <strong style={{ color: 'var(--az-blue)' }}>"+  New client secret"</strong></>,
                    <>Description: <strong style={{ color: 'var(--az-blue)' }}>"CloudOptimizer Access"</strong>, Expiration: <strong style={{ color: 'var(--az-blue)' }}>24 months</strong> {'->'} Create</>,
                    <><strong style={{ color: 'var(--az-error)' }}>Copy the secret VALUE immediately</strong> (shown only once!)</>,
                    <>Search for <strong style={{ color: 'var(--az-blue)' }}>"Subscriptions"</strong> {'->'} Select your subscription {'->'} <strong style={{ color: 'var(--az-error)' }}>Copy Subscription ID</strong></>,
                    <>In subscription: <strong style={{ color: 'var(--az-blue)' }}>"Access control (IAM)"</strong> {'->'} <strong style={{ color: 'var(--az-blue)' }}>"+  Add"</strong> {'->'} <strong style={{ color: 'var(--az-blue)' }}>"Add role assignment"</strong></>,
                    <>Role: <strong style={{ color: 'var(--az-success)' }}>"Reader"</strong>, Assign to: <strong style={{ color: 'var(--az-blue)' }}>"User, group, or service principal"</strong></>,
                    <>Select your <strong style={{ color: 'var(--az-blue)' }}>"CloudOptimizer"</strong> app {'->'} <strong style={{ color: 'var(--az-success)' }}>Save</strong></>,
                    <>In Cloud Optimizer: <strong style={{ color: 'var(--az-blue)' }}>Connect Cloud</strong> {'->'} <strong style={{ color: 'var(--az-blue)' }}>Azure</strong> {'->'} Enter all 4 credentials {'->'} <strong style={{ color: 'var(--az-success)' }}>Connect</strong></>
                ]} />
            </Section>

            <Section title="Required IAM Permissions - Detailed Breakdown">
                <div style={{ background: 'var(--az-blue-light)', border: '2px solid var(--az-blue)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 12 }}>🔐 What Permissions Does Cloud Optimizer Need?</h3>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, margin: 0 }}>
                        Cloud Optimizer requires <strong>read-only access</strong> to your Azure subscription. We need the <strong>Reader</strong> role to fetch VMs and the <strong>Monitoring Reader</strong> role to fetch Azure Monitor metrics.
                    </p>
                </div>

                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        📋 Complete List of Required Permissions:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0089D6', marginBottom: 8 }}>Reader Role (VM Discovery)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>Microsoft.Compute/virtualMachines/read</code> - List all Virtual Machines</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>Microsoft.Compute/virtualMachines/instanceView/read</code> - Get VM power state (running/stopped)</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>Microsoft.Compute/virtualMachineSizes/read</code> - Get vCPU and memory specs</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>Microsoft.Resources/subscriptions/resourceGroups/read</code> - List resource groups</>
                            ]} />
                        </div>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0089D6', marginBottom: 8 }}>Monitoring Reader Role (Metrics Collection)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>Microsoft.Insights/metrics/read</code> - Read Azure Monitor metrics</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>Microsoft.Insights/metricDefinitions/read</code> - List available metrics</>
                            ]} />
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)', marginTop: 8, fontStyle: 'italic' }}>
                                💡 Metrics collected: CPU Percentage, Available Memory Bytes, Network In/Out, Disk Read/Write Ops
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--az-success-bg)', border: '1px solid var(--az-success)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8 }}>✅ Recommended: Assign Built-in Roles</div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: '8px 0 0 0', lineHeight: 1.6 }}>
                        Azure has built-in roles that include all necessary permissions. Assign these roles to your App Registration at the <strong>Subscription level</strong>:
                    </p>
                    <ul style={{ fontSize: 13, color: 'var(--az-text-2)', margin: '8px 0', paddingLeft: 20 }}>
                        <li><strong style={{ color: 'var(--az-success)' }}>Reader</strong> - Provides read access to all resources (includes VM discovery)</li>
                        <li><strong style={{ color: 'var(--az-success)' }}>Monitoring Reader</strong> - Provides read access to Azure Monitor metrics</li>
                    </ul>
                </div>

                <div style={{ background: 'var(--az-warning-bg)', border: '1px solid var(--az-warning)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#8A3707', marginBottom: 8 }}>⚠️ Important: Memory Metrics Require Azure Monitor Agent</div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                        Azure provides <strong>CPU metrics by default</strong>, but <strong>memory metrics require the Azure Monitor Agent</strong> to be installed on your VMs. Without the agent:
                    </p>
                    <ul style={{ fontSize: 12, color: 'var(--az-text-2)', margin: '8px 0', paddingLeft: 20 }}>
                        <li>✅ CPU metrics will be available</li>
                        <li>❌ Memory metrics will show as "N/A"</li>
                        <li>⚠️ Recommendations will be based on CPU only (lower confidence)</li>
                    </ul>
                    <p style={{ fontSize: 12, color: 'var(--az-text-2)', margin: '8px 0 0 0' }}>
                        <strong>To enable memory metrics:</strong> Install Azure Monitor Agent on your VMs from Azure Portal → Virtual Machines → Monitoring → Insights
                    </p>
                </div>

                <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        📍 How to Assign Roles to Your App Registration:
                    </div>
                    <Steps steps={[
                        <>Go to Azure Portal → <strong style={{ color: 'var(--az-blue)' }}>Subscriptions</strong></>,
                        <>Select your subscription → <strong style={{ color: 'var(--az-blue)' }}>Access control (IAM)</strong></>,
                        <>Click <strong style={{ color: 'var(--az-blue)' }}>+ Add</strong> → <strong style={{ color: 'var(--az-blue)' }}>Add role assignment</strong></>,
                        <>Select role: <strong style={{ color: 'var(--az-success)' }}>Reader</strong> → Click <strong style={{ color: 'var(--az-blue)' }}>Next</strong></>,
                        <>Assign access to: <strong style={{ color: 'var(--az-blue)' }}>User, group, or service principal</strong></>,
                        <>Click <strong style={{ color: 'var(--az-blue)' }}>+ Select members</strong> → Search for your App Registration name (e.g., "CloudOptimizer")</>,
                        <>Select it → Click <strong style={{ color: 'var(--az-success)' }}>Review + assign</strong></>,
                        <>Repeat steps 3-7 for <strong style={{ color: 'var(--az-success)' }}>Monitoring Reader</strong> role</>
                    ]} />
                </div>
            </Section>

            <Alert type="warning" title="🔒 Security Best Practices">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Never share</strong> your Client Secret</li>
                    <li>Use <strong>Reader role</strong> only (no Contributor/Owner)</li>
                    <li>Create <strong>dedicated App Registration</strong> for Cloud Optimizer</li>
                    <li><strong>Rotate secrets</strong> before expiry</li>
                    <li>Enable <strong>Conditional Access</strong> policies</li>
                    <li>Monitor <strong>Activity Log</strong> regularly</li>
                </ul>
            </Alert>

            <Alert type="info" title="🔧 Troubleshooting">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Auth failed:</strong> Verify all 4 credentials are correct</li>
                    <li><strong>No VMs:</strong> Check subscription has Virtual Machines</li>
                    <li><strong>Permission denied:</strong> Verify Reader role at subscription level</li>
                    <li><strong>Secret expired:</strong> Create new client secret</li>
                </ul>
            </Alert>
        </>
    );
}

// GCP Connection Guide
function GCPGuide() {
    return (
        <>
            <div style={{ background: '#E8F5E9', border: '2px solid #34A853', borderRadius: 10, padding: 25, marginBottom: 30 }}>
                <h2 style={{ fontSize: 22, fontWeight: 600, color: '#34A853', marginBottom: 10 }}>🌐 Google Cloud Platform</h2>
                <p style={{ fontSize: 14, color: 'var(--az-text-2)', lineHeight: 1.8, margin: 0 }}>
                    Connect GCP to auto-discover Compute Engine instances and fetch Cloud Monitoring metrics for complete infrastructure visibility.
                </p>
            </div>

            <Section title="Required Credentials">
                <CredItem name="Project ID" format="Lowercase, numbers, hyphens" example="my-project-12345" highlight />
                <CredItem name="Service Account Key" format="Complete JSON file" example='{"type": "service_account", "project_id": "...", ...}' highlight />
            </Section>

            <Section title="Step-by-Step Setup">
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Info size={18} style={{ color: 'var(--az-blue)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-blue)' }}>Important: Follow these steps carefully to get your GCP credentials</span>
                    </div>
                </div>
                <Steps steps={[
                    <>Log in to <strong style={{ color: 'var(--az-blue)' }}>Google Cloud Console</strong> (https://console.cloud.google.com/)</>,
                    <>At the top of the page, click the <strong style={{ color: 'var(--az-blue)' }}>project dropdown</strong> (next to "Google Cloud") {'->'} Select your project {'->'} <strong style={{ color: 'var(--az-error)' }}>Note down the Project ID</strong> (shown below project name)</>,
                    <>Click the <strong style={{ color: 'var(--az-blue)' }}>hamburger menu (☰)</strong> in top-left corner</>,
                    <>Navigate to <strong style={{ color: 'var(--az-blue)' }}>"IAM & Admin"</strong> {'->'} <strong style={{ color: 'var(--az-blue)' }}>"Service Accounts"</strong></>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"+  CREATE SERVICE ACCOUNT"</strong> button at the top</>,
                    <>Enter details:<br />
                        • Service account name: <strong style={{ color: 'var(--az-blue)' }}>"cloud-optimizer"</strong><br />
                        • Service account ID: <strong style={{ color: 'var(--az-blue)' }}>cloud-optimizer</strong> (auto-filled)<br />
                        • Description: <strong style={{ color: 'var(--az-blue)' }}>"Read-only access for Cloud Optimizer"</strong><br />
                        • Click <strong style={{ color: 'var(--az-success)' }}>CREATE AND CONTINUE</strong>
                    </>,
                    <>Grant roles (Step 2 of 3):<br />
                        • Click <strong style={{ color: 'var(--az-blue)' }}>"Select a role"</strong> dropdown<br />
                        • Search and select <strong style={{ color: 'var(--az-success)' }}>"Compute Viewer"</strong><br />
                        • Click <strong style={{ color: 'var(--az-blue)' }}>"+  ADD ANOTHER ROLE"</strong><br />
                        • Search and select <strong style={{ color: 'var(--az-success)' }}>"Monitoring Viewer"</strong><br />
                        • Click <strong style={{ color: 'var(--az-success)' }}>CONTINUE</strong>
                    </>,
                    <>Grant users access (Step 3 of 3):<br />
                        • Leave this section <strong style={{ color: 'var(--az-blue)' }}>blank</strong> (optional)<br />
                        • Click <strong style={{ color: 'var(--az-success)' }}>DONE</strong>
                    </>,
                    <>You'll see your new service account in the list. Click on the <strong style={{ color: 'var(--az-blue)' }}>email address</strong> (cloud-optimizer@your-project.iam.gserviceaccount.com)</>,
                    <>Go to the <strong style={{ color: 'var(--az-blue)' }}>"KEYS"</strong> tab at the top</>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"ADD KEY"</strong> {'->'} <strong style={{ color: 'var(--az-blue)' }}>"Create new key"</strong></>,
                    <>Select <strong style={{ color: 'var(--az-blue)' }}>"JSON"</strong> as the key type {'->'} Click <strong style={{ color: 'var(--az-success)' }}>CREATE</strong></>,
                    <><strong style={{ color: 'var(--az-error)' }}>JSON file downloads automatically</strong> to your computer (e.g., your-project-abc123.json) {'->'} <strong style={{ color: 'var(--az-error)' }}>Store it securely!</strong></>,
                    <>Open the downloaded JSON file with a <strong style={{ color: 'var(--az-blue)' }}>text editor</strong> (Notepad, VS Code, etc.)</>,
                    <><strong style={{ color: 'var(--az-error)' }}>Copy the ENTIRE content</strong> including the opening and closing curly braces {'{'}...{'}'}</>,
                    <>In Cloud Optimizer application:<br />
                        • Go to <strong style={{ color: 'var(--az-blue)' }}>"Connect Cloud"</strong> page<br />
                        • Select <strong style={{ color: 'var(--az-blue)' }}>"Google Cloud Platform (GCP)"</strong><br />
                        • Enter your <strong style={{ color: 'var(--az-blue)' }}>Project ID</strong> (from step 2)<br />
                        • Paste the <strong style={{ color: 'var(--az-blue)' }}>entire JSON content</strong> in the Service Account Key field<br />
                        • Click <strong style={{ color: 'var(--az-success)' }}>CONNECT</strong>
                    </>
                ]} />
            </Section>

            <Section title="How to Find Your Project ID">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        📍 Multiple ways to find your GCP Project ID:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--az-text-2)' }}>
                        <div>
                            <strong style={{ color: 'var(--az-blue)' }}>Method 1 - Dashboard:</strong><br />
                            • Go to GCP Console home page<br />
                            • Look at the <strong>Project info</strong> card on the left<br />
                            • Project ID is shown below the project name
                        </div>
                        <div>
                            <strong style={{ color: 'var(--az-blue)' }}>Method 2 - Top Bar:</strong><br />
                            • Click the project dropdown at the top<br />
                            • Project ID is shown in gray text below each project name
                        </div>
                        <div>
                            <strong style={{ color: 'var(--az-blue)' }}>Method 3 - Settings:</strong><br />
                            • Menu (☰) {'->'} "IAM & Admin" {'->'} "Settings"<br />
                            • Project ID is displayed at the top
                        </div>
                    </div>
                </div>
                <div style={{ background: 'var(--az-warning-bg)', border: '1px solid var(--az-warning)', borderRadius: 6, padding: 12, fontSize: 12, color: '#8A3707' }}>
                    ⚠️ <strong>Note:</strong> Project ID is different from Project Name. Use the ID (lowercase with hyphens), not the name.
                </div>
            </Section>

            <Section title="Understanding the JSON Key File">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        🔑 What's inside the JSON key file:
                    </div>
                    <div style={{ background: 'var(--az-card)', padding: 12, borderRadius: 6, marginBottom: 12 }}>
                        <code style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre', display: 'block', color: 'var(--az-text-2)' }}>
                            {`{
  "type": "service_account",
  "project_id": "your-project-12345",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",
  "client_email": "cloud-optimizer@your-project.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}`}
                        </code>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                        • <strong>type:</strong> Always "service_account"<br />
                        • <strong>project_id:</strong> Your GCP project identifier<br />
                        • <strong>private_key:</strong> Secret key for authentication (keep secure!)<br />
                        • <strong>client_email:</strong> Service account email address
                    </div>
                </div>
            </Section>

            <Section title="Required IAM Permissions - Detailed Breakdown">
                <div style={{ background: 'var(--az-blue-light)', border: '2px solid var(--az-blue)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 12 }}>🔐 What Permissions Does Cloud Optimizer Need?</h3>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, margin: 0 }}>
                        Cloud Optimizer requires <strong>read-only access</strong> to your GCP project. We need the <strong>Compute Viewer</strong> role to fetch VM instances and the <strong>Monitoring Viewer</strong> role to fetch Cloud Monitoring metrics.
                    </p>
                </div>

                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        📋 Complete List of Required Permissions:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#34A853', marginBottom: 8 }}>Compute Viewer Role (VM Discovery)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>compute.instances.list</code> - List all Compute Engine instances</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>compute.instances.get</code> - Get instance details and state</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>compute.zones.list</code> - List available zones</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>compute.machineTypes.get</code> - Get vCPU and memory specs</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>compute.machineTypes.list</code> - List available machine types</>
                            ]} />
                        </div>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#34A853', marginBottom: 8 }}>Monitoring Viewer Role (Metrics Collection)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>monitoring.timeSeries.list</code> - Read Cloud Monitoring metrics</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>monitoring.metricDescriptors.list</code> - List available metrics</>
                            ]} />
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)', marginTop: 8, fontStyle: 'italic' }}>
                                💡 Metrics collected: CPU utilization, Memory percent used, Network bytes sent/received
                            </div>
                        </div>
                        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#34A853', marginBottom: 8 }}>Optional: Cloud Billing Viewer (Pricing Data)</div>
                            <PermList perms={[
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>billing.accounts.get</code> - Get billing account info</>,
                                <><code style={{ background: 'var(--az-surface)', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>billing.resourceCosts.get</code> - Get resource pricing</>
                            ]} />
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)', marginTop: 8, fontStyle: 'italic' }}>
                                ℹ️ Optional - If not granted, system will use cached pricing data
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--az-success-bg)', border: '1px solid var(--az-success)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8 }}>✅ Recommended: Assign Built-in Roles</div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: '8px 0 0 0', lineHeight: 1.6 }}>
                        GCP has built-in roles that include all necessary permissions. Assign these roles to your Service Account at the <strong>Project level</strong>:
                    </p>
                    <ul style={{ fontSize: 13, color: 'var(--az-text-2)', margin: '8px 0', paddingLeft: 20 }}>
                        <li><strong style={{ color: 'var(--az-success)' }}>Compute Viewer</strong> - Provides read access to Compute Engine resources</li>
                        <li><strong style={{ color: 'var(--az-success)' }}>Monitoring Viewer</strong> - Provides read access to Cloud Monitoring metrics</li>
                        <li><strong style={{ color: 'var(--az-text-2)' }}>Cloud Billing Viewer</strong> (Optional) - Provides access to live pricing data</li>
                    </ul>
                </div>

                <div style={{ background: 'var(--az-warning-bg)', border: '1px solid var(--az-warning)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#8A3707', marginBottom: 8 }}>⚠️ Important: Memory Metrics Require Ops Agent</div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                        GCP provides <strong>CPU metrics by default</strong>, but <strong>memory metrics require the Ops Agent</strong> (formerly Cloud Monitoring agent) to be installed on your VMs. Without the agent:
                    </p>
                    <ul style={{ fontSize: 12, color: 'var(--az-text-2)', margin: '8px 0', paddingLeft: 20 }}>
                        <li>✅ CPU metrics will be available</li>
                        <li>❌ Memory metrics will show as "N/A"</li>
                        <li>⚠️ Recommendations will be based on CPU only (lower confidence)</li>
                    </ul>
                    <p style={{ fontSize: 12, color: 'var(--az-text-2)', margin: '8px 0 0 0' }}>
                        <strong>To enable memory metrics:</strong> Install Ops Agent on your VMs - <a href="https://cloud.google.com/stackdriver/docs/solutions/agents/ops-agent/installation" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--az-blue)' }}>Installation Guide</a>
                    </p>
                </div>

                <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        🔧 Enable Required APIs (Must Do First!)
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', marginBottom: 12 }}>
                        Before Cloud Optimizer can access your project, you must enable these APIs:
                    </p>
                    <Steps steps={[
                        <>Go to GCP Console → <strong style={{ color: 'var(--az-blue)' }}>APIs & Services</strong> → <strong style={{ color: 'var(--az-blue)' }}>Library</strong></>,
                        <>Search for <strong style={{ color: 'var(--az-blue)' }}>"Compute Engine API"</strong> → Click on it → Click <strong style={{ color: 'var(--az-success)' }}>ENABLE</strong></>,
                        <>Search for <strong style={{ color: 'var(--az-blue)' }}>"Cloud Monitoring API"</strong> → Click on it → Click <strong style={{ color: 'var(--az-success)' }}>ENABLE</strong></>,
                        <>Search for <strong style={{ color: 'var(--az-blue)' }}>"Cloud Billing API"</strong> (Optional) → Click on it → Click <strong style={{ color: 'var(--az-success)' }}>ENABLE</strong></>,
                        <><strong style={{ color: 'var(--az-error)' }}>Wait 2-3 minutes</strong> for APIs to fully activate before connecting</>
                    ]} />
                </div>

                <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        📍 Roles Are Assigned During Service Account Creation
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                        When you create the Service Account (Step 7 in setup above), you assign the <strong>Compute Viewer</strong> and <strong>Monitoring Viewer</strong> roles. These roles are automatically applied at the project level and include all the permissions listed above.
                    </p>
                </div>
            </Section>

            <Alert type="warning" title="🔒 Security Best Practices">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Never share</strong> JSON key file or commit to version control</li>
                    <li>Use <strong>Viewer roles</strong> only (read-only access)</li>
                    <li>Create <strong>dedicated service account</strong> for Cloud Optimizer</li>
                    <li><strong>Rotate keys</strong> every 90 days</li>
                    <li>Enable <strong>audit logging</strong> to monitor usage</li>
                    <li><strong>Delete old keys</strong> after creating new ones</li>
                    <li>Store JSON in <strong>secure password manager</strong> or secrets vault</li>
                </ul>
            </Alert>

            <Alert type="info" title="🔧 Troubleshooting">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Invalid JSON:</strong> Ensure complete copy including opening and closing curly braces</li>
                    <li><strong>Auth failed:</strong> Verify JSON key is valid and not expired</li>
                    <li><strong>No instances:</strong> Check project has Compute Engine VMs</li>
                    <li><strong>Permission denied:</strong> Verify Compute Viewer + Monitoring Viewer roles</li>
                    <li><strong>API not enabled:</strong> Enable Compute Engine + Monitoring APIs</li>
                </ul>
            </Alert>

            <Section title="Enable Required APIs">
                <div style={{ background: 'var(--az-warning-bg)', border: '1px solid var(--az-warning)', borderRadius: 8, padding: 16, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#8A3707', marginBottom: 8 }}>⚠️ If you see "API not enabled" errors:</div>
                </div>
                <Steps steps={[
                    <>Go to <strong style={{ color: 'var(--az-blue)' }}>"APIs & Services"</strong> {'->'} <strong style={{ color: 'var(--az-blue)' }}>"Library"</strong></>,
                    <>Search <strong style={{ color: 'var(--az-blue)' }}>"Compute Engine API"</strong> {'->'} Click <strong style={{ color: 'var(--az-success)' }}>ENABLE</strong></>,
                    <>Search <strong style={{ color: 'var(--az-blue)' }}>"Cloud Monitoring API"</strong> {'->'} Click <strong style={{ color: 'var(--az-success)' }}>ENABLE</strong></>,
                    <><strong style={{ color: 'var(--az-error)' }}>Wait 2-3 minutes</strong> for APIs to activate</>,
                    <>Try connecting again in Cloud Optimizer</>
                ]} />
            </Section>
        </>
    );
}

// CSV Upload Guide
function CSVUpload() {
    return (
        <>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--az-text)', marginBottom: 10 }}>CSV Upload Guide</h1>
            <p style={{ fontSize: 14, color: 'var(--az-text-2)', marginBottom: 30, lineHeight: 1.8 }}>
                Upload cloud infrastructure metrics as CSV for offline analysis without connecting your cloud account. Perfect for security-conscious environments or one-time assessments.
            </p>

            <Alert type="info" title="✨ New: Smart CSV Processing with 8 Bug Fixes">
                <p style={{ margin: '8px 0', fontSize: 13, lineHeight: 1.8 }}>
                    We've enhanced the CSV pipeline with intelligent features: <strong>missing timestamp handling</strong>, <strong>auto-column mapping</strong>, <strong>extra column tolerance</strong>, <strong>improved classification priority</strong>, and more. The system now handles real-world CSV exports seamlessly!
                </p>
            </Alert>

            <Section title="Quick Start - 3 Simple Steps">
                <div style={{ background: 'var(--az-blue-light)', border: '2px solid var(--az-blue)', borderRadius: 10, padding: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--az-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>1</div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', marginBottom: 4 }}>Export Metrics from Cloud Console</div>
                                <div style={{ fontSize: 13, color: 'var(--az-text-2)' }}>Export CPU, memory, disk, and network metrics from CloudWatch, Azure Monitor, or GCP Monitoring</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--az-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>2</div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', marginBottom: 4 }}>Format as CSV (Flexible)</div>
                                <div style={{ fontSize: 13, color: 'var(--az-text-2)' }}>Use any column names - system auto-maps common variations. Timestamp optional. Extra columns ignored.</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--az-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>3</div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', marginBottom: 4 }}>Upload & Get Recommendations</div>
                                <div style={{ fontSize: 13, color: 'var(--az-text-2)' }}>Drag & drop your CSV file. Get instant ML-powered right-sizing recommendations with savings calculations.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Required Fields (Minimum 5 Columns)">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        ✅ Minimum Required Columns:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div style={{ padding: 10, background: 'var(--az-card)', borderRadius: 6, border: '1px solid var(--az-border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>instance_id</div>
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>Unique identifier</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--az-card)', borderRadius: 6, border: '1px solid var(--az-border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>instance_type</div>
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>VM size/type</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--az-card)', borderRadius: 6, border: '1px solid var(--az-border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>region</div>
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>Cloud region</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--az-card)', borderRadius: 6, border: '1px solid var(--az-border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>cpu_avg</div>
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>Avg CPU % (0-100)</div>
                        </div>
                        <div style={{ padding: 10, background: 'var(--az-card)', borderRadius: 6, border: '1px solid var(--az-border)' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>memory_avg</div>
                            <div style={{ fontSize: 11, color: 'var(--az-text-2)' }}>Avg memory % (0-100)</div>
                        </div>
                    </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--az-text-2)', fontStyle: 'italic', marginTop: 10 }}>
                    💡 Tip: System auto-fills missing optional fields with intelligent defaults
                </div>
            </Section>

            <Section title="✨ Smart Features - Flexible CSV Handling">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 15 }}>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-success)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>✅</span> Missing Timestamp? No Problem!
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                            If your CSV doesn't have a timestamp column, the system will prompt you to select the time range (7, 14, or 30 days). Confidence automatically capped at 70% for safety.
                        </p>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-success)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>✅</span> Auto-Column Mapping
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                            Use <code style={{ background: 'var(--az-surface)', padding: '2px 4px', borderRadius: 3 }}>resource_id</code> instead of <code style={{ background: 'var(--az-surface)', padding: '2px 4px', borderRadius: 3 }}>instance_id</code>? Or <code style={{ background: 'var(--az-surface)', padding: '2px 4px', borderRadius: 3 }}>date</code> instead of <code style={{ background: 'var(--az-surface)', padding: '2px 4px', borderRadius: 3 }}>timestamp</code>? System automatically maps common column name variations.
                        </p>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-success)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>✅</span> Extra Columns Ignored
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                            Have extra columns like <code style={{ background: 'var(--az-surface)', padding: '2px 4px', borderRadius: 3 }}>tags</code>, <code style={{ background: 'var(--az-surface)', padding: '2px 4px', borderRadius: 3 }}>owner</code>, or <code style={{ background: 'var(--az-surface)', padding: '2px 4px', borderRadius: 3 }}>environment</code>? No problem! System silently ignores unknown columns.
                        </p>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-success)', borderRadius: 8, padding: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>✅</span> Smart Classification
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--az-text-2)', margin: 0, lineHeight: 1.6 }}>
                            Improved priority: UNDERSIZED (high CPU/memory) {'->'} ZOMBIE (idle {'>'} 500hrs) {'->'} OVERSIZED (low usage) {'->'} OPTIMAL. Accurate detection of performance risks.
                        </p>
                    </div>
                </div>
            </Section>

            <Section title="Supported Column Name Variations">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        🔄 System automatically maps these column name variations:
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, fontSize: 12 }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>instance_id {'->'}</div>
                            <div style={{ color: 'var(--az-text-2)', fontFamily: 'monospace', fontSize: 11 }}>resource_id, resourceid</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>cpu_avg {'->'}</div>
                            <div style={{ color: 'var(--az-text-2)', fontFamily: 'monospace', fontSize: 11 }}>cpu_util, cpu_utilization, cpuutil</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>memory_avg {'->'}</div>
                            <div style={{ color: 'var(--az-text-2)', fontFamily: 'monospace', fontSize: 11 }}>memory_util, memory_utilization, memutil</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--az-blue)', marginBottom: 4 }}>timestamp {'->'}</div>
                            <div style={{ color: 'var(--az-text-2)', fontFamily: 'monospace', fontSize: 11 }}>date, datetime, time, created_at</div>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Understanding Classification Results">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                    <div style={{ background: 'var(--az-card)', border: '2px solid #8A3707', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#8A3707', marginBottom: 6 }}>🔥 UNDERSIZED</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', marginBottom: 8 }}>CPU {'>'} 80% OR Memory {'>'} 85%</div>
                        <div style={{ fontSize: 11, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Action:</strong> UPSIZE<br />
                            <strong>Savings:</strong> "N/A"<br />
                            <strong>Risk:</strong> HIGH performance risk<br />
                            <strong>Impact:</strong> Cost will INCREASE
                        </div>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-error)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-error)', marginBottom: 6 }}>💀 ZOMBIE</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', marginBottom: 8 }}>CPU {'<'} 5% AND Uptime {'>'} 500 hours</div>
                        <div style={{ fontSize: 11, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Action:</strong> TERMINATE<br />
                            <strong>Savings:</strong> 100% of cost<br />
                            <strong>Risk:</strong> None (idle instance)<br />
                            <strong>Impact:</strong> Eliminate waste
                        </div>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-warning)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-warning)', marginBottom: 6 }}>📉 OVERSIZED</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', marginBottom: 8 }}>CPU {'<'} 20% AND Memory {'<'} 30%</div>
                        <div style={{ fontSize: 11, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Action:</strong> RESIZE (downsize)<br />
                            <strong>Savings:</strong> 30-50% typical<br />
                            <strong>Risk:</strong> Low<br />
                            <strong>Impact:</strong> Cost reduction
                        </div>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-success)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-success)', marginBottom: 6 }}>✅ OPTIMAL</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', marginBottom: 8 }}>Balanced utilization</div>
                        <div style={{ fontSize: 11, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Action:</strong> NO ACTION<br />
                            <strong>Savings:</strong> $0<br />
                            <strong>Risk:</strong> None<br />
                            <strong>Impact:</strong> Already optimized
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="Two CSV Formats Supported">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 15, marginBottom: 20 }}>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-success)', borderRadius: 8, padding: 16 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-success)', marginBottom: 8 }}>✅ Enhanced Format (Recommended)</h4>
                        <p style={{ fontSize: 13, color: 'var(--az-text-2)', marginBottom: 8 }}>30 columns - 24 ML features</p>
                        <ul style={{ fontSize: 12, color: 'var(--az-text-2)', paddingLeft: 20, margin: 0 }}>
                            <li>Higher prediction confidence (75-95%)</li>
                            <li>Better anomaly detection</li>
                            <li>Data quality scoring</li>
                            <li>Workload pattern analysis</li>
                        </ul>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '2px solid var(--az-blue)', borderRadius: 8, padding: 16 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 8 }}>📄 Legacy Format (Still Supported)</h4>
                        <p style={{ fontSize: 13, color: 'var(--az-text-2)', marginBottom: 8 }}>18 columns - Original format</p>
                        <ul style={{ fontSize: 12, color: 'var(--az-text-2)', paddingLeft: 20, margin: 0 }}>
                            <li>Backward compatible</li>
                            <li>Auto-fills missing 12 features</li>
                            <li>Good for quick analysis</li>
                            <li>Moderate confidence (60-80%)</li>
                        </ul>
                    </div>
                </div>
            </Section>

            <Section title="Complete Column Reference - All 30 Columns">
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 8 }}>
                        📋 Complete list of all columns for Enhanced CSV format (30 columns total)
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--az-text-2)', margin: '8px 0 0 0' }}>
                        For Legacy format, use only the first 18 columns (up to resource_type)
                    </p>
                </div>
                <AllCSVColumns />
            </Section>

            <Section title="How to Find Metrics">
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 8 }}>📊 Where to find each metric in your cloud console:</div>
                </div>

                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#FF9900', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    ☁️ AWS CloudWatch:
                </h4>
                <ul style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20, marginBottom: 15 }}>
                    <li><strong>Location:</strong> EC2 {'->'} Instances {'->'} Select instance {'->'} <strong style={{ color: 'var(--az-blue)' }}>Monitoring tab</strong></li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>CPU:</strong> CPUUtilization metric (average & 95th percentile)</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Memory:</strong> Requires CloudWatch agent installation</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Disk:</strong> EBS ReadOps/WriteOps metrics</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Network:</strong> NetworkIn/NetworkOut metrics</li>
                    <li><strong style={{ color: 'var(--az-success)' }}>New:</strong> Use CloudWatch Insights for spike ratios and peak/off-peak analysis</li>
                </ul>

                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0089D6', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🔷 Azure Monitor:
                </h4>
                <ul style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20, marginBottom: 15 }}>
                    <li><strong>Location:</strong> Virtual Machines {'->'} Select VM {'->'} <strong style={{ color: 'var(--az-blue)' }}>Metrics</strong></li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>CPU:</strong> "Percentage CPU" metric</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Memory:</strong> "Available Memory Bytes"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Disk:</strong> "Disk Read/Write Operations/Sec"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Network:</strong> "Network In/Out Total"</li>
                    <li><strong style={{ color: 'var(--az-success)' }}>New:</strong> Use Azure Monitor Logs for advanced metrics</li>
                </ul>

                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#34A853', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🌐 GCP Monitoring:
                </h4>
                <ul style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20 }}>
                    <li><strong>Location:</strong> Compute Engine {'->'} VM instances {'->'} Select instance {'->'} <strong style={{ color: 'var(--az-blue)' }}>Monitoring</strong></li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>CPU:</strong> "CPU utilization" metric</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Memory:</strong> "Memory utilization"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Disk:</strong> "Disk read/write operations"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Network:</strong> "Network bytes received/sent"</li>
                    <li><strong style={{ color: 'var(--az-success)' }}>New:</strong> Use Cloud Monitoring for percentile metrics</li>
                </ul>
            </Section>

            <Section title="Example CSV (Enhanced Format)">
                <div style={{ background: 'var(--az-surface)', padding: 15, borderRadius: 6, overflowX: 'auto' }}>
                    <code style={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre' }}>
                        {`resource_id,cloud_provider,region,instance_type,os,vcpu_count,ram_gb,cpu_avg,cpu_p95,memory_avg,memory_p95,disk_read_iops,disk_write_iops,network_in_bytes,network_out_bytes,uptime_hours,cost_per_month,resource_type,cpu_spike_ratio,memory_spike_ratio,cpu_throttle_percent,peak_hour_avg_cpu,off_peak_avg_cpu,weekend_avg_cpu,memory_swap_usage,disk_latency_ms,network_packet_loss,data_days,granularity_hourly,workload_pattern
i-1234567890abcdef0,aws,us-east-1,t3.medium,Linux,2,4,25.5,45.2,60.3,75.8,100,50,1000000,500000,720,35.04,compute,1.77,1.26,0,35.2,18.3,22.1,0,8.5,0,30,1,1
vm-prod-web-01,azure,eastus,Standard_D2s_v3,Windows,2,8,15.2,30.5,45.6,65.2,80,40,800000,400000,720,70.08,compute,2.01,1.43,0,28.7,10.5,12.8,0,12.3,0.1,45,1,0`}
                    </code>
                </div>
            </Section>

            <Section title="Example CSV (Legacy Format)">
                <div style={{ background: 'var(--az-surface)', padding: 15, borderRadius: 6, overflowX: 'auto' }}>
                    <code style={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre' }}>
                        {`resource_id,cloud_provider,region,instance_type,os,vcpu_count,ram_gb,cpu_avg,cpu_p95,memory_avg,memory_p95,disk_read_iops,disk_write_iops,network_in_bytes,network_out_bytes,uptime_hours,cost_per_month,resource_type
i-1234567890abcdef0,aws,us-east-1,t3.medium,Linux,2,4,25.5,45.2,60.3,75.8,100,50,1000000,500000,720,35.04,compute
vm-prod-web-01,azure,eastus,Standard_D2s_v3,Windows,2,8,15.2,30.5,45.6,65.2,80,40,800000,400000,720,70.08,compute`}
                    </code>
                </div>
            </Section>

            <Section title="Step-by-Step Upload Process">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16 }}>
                    <Steps steps={[
                        <>Navigate to <strong style={{ color: 'var(--az-blue)' }}>CSV Upload</strong> page from the main menu</>,
                        <>Click the upload area or <strong style={{ color: 'var(--az-blue)' }}>drag & drop</strong> your CSV file</>,
                        <>If timestamp is missing, select time range: <strong style={{ color: 'var(--az-blue)' }}>7, 14, or 30 days</strong></>,
                        <>System processes your file: <strong style={{ color: 'var(--az-success)' }}>normalizes {'->'} enriches {'->'} ML analysis</strong></>,
                        <>View recommendations with <strong style={{ color: 'var(--az-blue)' }}>classification, confidence, and savings</strong></>,
                        <>Filter by classification type or confidence level</>,
                        <>Export results as <strong style={{ color: 'var(--az-blue)' }}>PDF report</strong> or save for later</>
                    ]} />
                </div>
            </Section>

            <Section title="Common Issues & Solutions">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>❌ "CSV file is empty or invalid"</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Solution:</strong> Ensure file has data rows (not just headers). Remove blank rows. Check file encoding is UTF-8.
                        </div>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>❌ "Missing required columns"</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Solution:</strong> Verify you have at least: instance_id, instance_type, region, cpu_avg, memory_avg. Check for typos in column names.
                        </div>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>⚠️ Low confidence scores (less than 60%)</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Solution:</strong> Add timestamp column. Include p95 metrics (cpu_p95, memory_p95). Provide more optional fields. Ensure data covers 14-30 days.
                        </div>
                    </div>
                    <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 6 }}>⚠️ Unexpected classifications</div>
                        <div style={{ fontSize: 12, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                            <strong>Solution:</strong> Verify metrics are in correct units (CPU/memory as percentages 0-100, not decimals). Check uptime_hours for ZOMBIE detection (greater than 500 hours).
                        </div>
                    </div>
                </div>
            </Section>

            <Alert type="warning" title="🔒 Data Privacy & Security">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Privacy-first:</strong> CSV mode requires no cloud credentials</li>
                    <li><strong>Local processing:</strong> ML model runs on our servers, not sent to third parties</li>
                    <li><strong>No storage:</strong> CSV data is processed in memory and not permanently stored</li>
                    <li><strong>Secure upload:</strong> All uploads use HTTPS encryption</li>
                    <li><strong>Session-based:</strong> Results are tied to your session only</li>
                </ul>
            </Alert>

            <Alert type="info" title="💡 Pro Tips for Best Results">
                <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
                    <li><strong>Data period:</strong> Use 30 days of metrics for highest confidence (14 days minimum)</li>
                    <li><strong>Granularity:</strong> Hourly data is better than daily aggregates</li>
                    <li><strong>Include p95:</strong> 95th percentile metrics improve spike detection</li>
                    <li><strong>Complete data:</strong> More optional fields = better recommendations</li>
                    <li><strong>Test first:</strong> Start with sample CSVs to understand the format</li>
                    <li><strong>Batch processing:</strong> Upload up to 1000 instances per CSV</li>
                </ul>
            </Alert>
        </>
    );
}

// FAQ Section
function FAQ() {
    return (
        <>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--az-text)', marginBottom: 10 }}>Frequently Asked Questions</h1>
            <p style={{ fontSize: 14, color: 'var(--az-text-2)', marginBottom: 30 }}>Common questions and answers</p>

            <FAQItem q="Is my cloud credential data secure?" a="Yes. All credentials are encrypted using industry-standard encryption and stored securely. We never share your credentials with third parties." />
            <FAQItem q="How accurate are the recommendations?" a="Our ML model analyzes historical usage patterns with 80%+ confidence scores being highly reliable. We recommend testing changes in non-production first." />
            <FAQItem q="Can I connect multiple cloud accounts?" a="Yes. You can connect AWS, Azure, and GCP simultaneously. The dashboard shows aggregated data from all connected providers." />
            <FAQItem q="What permissions do I need to grant?" a="Only read-only permissions for compute resources and monitoring metrics. We never require write or delete permissions." />
            <FAQItem q="How often is data refreshed?" a="Cloud data is fetched in real-time when you access the dashboard. Metrics update every 5-15 minutes depending on the provider." />
            <FAQItem q="Can I export recommendations?" a="Yes. Generate PDF reports with all recommendations and savings calculations from the Reports page." />
            <FAQItem q="What if I don't want to connect my cloud?" a="Use CSV Mode to upload resource data manually without connecting any cloud accounts." />
            <FAQItem q="How are savings calculated?" a="By comparing current instance costs with recommended right-sized instances based on actual usage patterns over time." />
            <FAQItem q="What happens to stopped/terminated instances?" a="They show 0% metrics with clear status indicators. Recommendations focus on running instances only." />
            <FAQItem q="Can I filter recommendations by confidence?" a="Yes. Filter by High (80%+), Medium (60-79%), or Low (less than 60%) confidence scores." />
        </>
    );
}

// Helper Components
function Section({ title, children }) {
    return (
        <div style={{ marginBottom: 35 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--az-text)', marginBottom: 15 }}>{title}</h3>
            {children}
        </div>
    );
}

function FeatureCard({ icon, title, desc }) {
    return (
        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 14, display: 'flex', gap: 10 }}>
            {icon}
            <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--az-text-2)' }}>{desc}</div>
            </div>
        </div>
    );
}

function ModeCard({ title, subtitle, features, steps }) {
    return (
        <div style={{ background: 'var(--az-card)', border: '1px solid var(--az-border)', borderRadius: 8, padding: 20, marginBottom: 15 }}>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--az-text)', marginBottom: 4 }}>{title}</h4>
            <p style={{ fontSize: 13, color: 'var(--az-text-2)', marginBottom: 12 }}>{subtitle}</p>
            <div style={{ fontSize: 13, color: 'var(--az-text-2)', marginBottom: 12 }}>
                <strong>Features:</strong>
                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                    {features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
            </div>
            <div style={{ fontSize: 13, color: 'var(--az-text-2)' }}>
                <strong>Steps:</strong>
                <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
                    {steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
            </div>
        </div>
    );
}

function RecommendationType({ type, color, desc, example }) {
    return (
        <div style={{ background: 'var(--az-card)', border: `2px solid ${color}`, borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color, marginBottom: 8 }}>{type}</div>
            <p style={{ fontSize: 13, color: 'var(--az-text-2)', marginBottom: 8 }}>{desc}</p>
            <div style={{ fontSize: 12, color: 'var(--az-text-3)', fontStyle: 'italic' }}>Example: {example}</div>
        </div>
    );
}

function ConfidenceItem({ level, color, desc }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--az-surface)', borderRadius: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-text)' }}>{level}</span>
                <span style={{ fontSize: 13, color: 'var(--az-text-2)', marginLeft: 8 }}>- {desc}</span>
            </div>
        </div>
    );
}

function CredItem({ name, format, example, highlight }) {
    return (
        <div style={{
            background: highlight ? 'var(--az-blue-light)' : 'var(--az-surface)',
            padding: 12,
            borderRadius: 6,
            marginBottom: 10,
            border: highlight ? '1px solid var(--az-blue)' : 'none'
        }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? 'var(--az-blue)' : 'var(--az-text)', marginBottom: 4 }}>
                {highlight && '🔑 '}{name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--az-text-2)', marginBottom: 4 }}>
                <strong>Format:</strong> {format}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--az-text-3)' }}>
                <strong>Example:</strong> {example}
            </div>
        </div>
    );
}

function Steps({ steps }) {
    return (
        <ol style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            {steps.map((step, i) => <li key={i} style={{ marginBottom: 8 }}>{step}</li>)}
        </ol>
    );
}

function PermList({ perms }) {
    return (
        <ul style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
            {perms.map((perm, i) => <li key={i} style={{ marginBottom: 6, fontFamily: 'monospace', fontSize: 12 }}>{perm}</li>)}
        </ul>
    );
}

function Alert({ type, title, children }) {
    const colors = {
        warning: { bg: 'var(--az-warning-bg)', border: 'var(--az-warning)', text: '#8A3707' },
        info: { bg: 'var(--az-info-bg)', border: 'var(--az-info)', text: 'var(--az-info)' }
    };
    const c = colors[type] || colors.info;
    return (
        <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: 14, marginTop: 15, fontSize: 13, color: c.text, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
            {children}
        </div>
    );
}

function FAQItem({ q, a }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--az-text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChevronRight size={16} style={{ color: 'var(--az-blue)' }} />{q}
            </h4>
            <p style={{ fontSize: 14, color: 'var(--az-text-2)', marginLeft: 24, lineHeight: 1.6, margin: '0 0 0 24px' }}>{a}</p>
        </div>
    );
}

function AllCSVColumns() {
    const cols = [
        // Basic Information (Columns 1-8)
        ['1', 'resource_id', 'Unique instance identifier', 'i-1234567890abcdef0', 'Required', 'text', 'Cloud console instance list'],
        ['2', 'cloud_provider', 'Cloud provider', 'aws, azure, or gcp', 'Required', 'text', 'Your cloud provider name'],
        ['3', 'region', 'Cloud region', 'us-east-1, eastus, us-central1', 'Required', 'text', 'Instance details page'],
        ['4', 'instance_type', 'Instance/VM size', 't3.medium, Standard_D2s_v3, n1-standard-2', 'Required', 'text', 'Instance details page'],
        ['5', 'os', 'Operating system', 'Linux or Windows', 'Required', 'text', 'Instance details or tags'],
        ['6', 'vcpu_count', 'Number of virtual CPUs', '1, 2, 4, 8, 16...', 'Required', 'number', 'Instance type specifications'],
        ['7', 'ram_gb', 'RAM in gigabytes', '1, 2, 4, 8, 16, 32...', 'Required', 'number', 'Instance type specifications'],
        ['8', 'resource_type', 'Resource type', 'compute (usually)', 'Required', 'text', 'Use "compute" for VMs'],

        // Original 12 ML Features (Columns 9-20)
        ['9', 'cpu_avg', 'Average CPU utilization %', '0-100', 'Required', 'number', 'CloudWatch/Monitor/Monitoring (avg over 30 days)'],
        ['10', 'cpu_p95', '95th percentile CPU %', '0-100', 'Required', 'number', 'CloudWatch/Monitor/Monitoring (p95 over 30 days)'],
        ['11', 'memory_avg', 'Average memory utilization %', '0-100', 'Required', 'number', 'CloudWatch Agent/Monitor/Monitoring (avg)'],
        ['12', 'memory_p95', '95th percentile memory %', '0-100', 'Required', 'number', 'CloudWatch Agent/Monitor/Monitoring (p95)'],
        ['13', 'disk_read_iops', 'Disk read operations/sec', '0+', 'Required', 'number', 'EBS metrics/Disk metrics (avg)'],
        ['14', 'disk_write_iops', 'Disk write operations/sec', '0+', 'Required', 'number', 'EBS metrics/Disk metrics (avg)'],
        ['15', 'network_in_bytes', 'Network bytes received', '0+', 'Required', 'number', 'NetworkIn metric (total over period)'],
        ['16', 'network_out_bytes', 'Network bytes sent', '0+', 'Required', 'number', 'NetworkOut metric (total over period)'],
        ['17', 'uptime_hours', 'Monthly uptime hours', '0-744', 'Required', 'number', 'Calculate from instance state changes'],
        ['18', 'cost_per_month', 'Monthly cost in USD', '0+', 'Required', 'number', 'Cost Explorer/Cost Management/Billing'],

        // New 12 Enhanced Features (Columns 19-30) - Optional for Legacy Format
        ['19', 'cpu_spike_ratio', 'CPU burstiness (p95/avg)', '≥ 1.0', 'Enhanced only', 'number', 'Calculate: cpu_p95 / cpu_avg'],
        ['20', 'memory_spike_ratio', 'Memory burstiness (p95/avg)', '≥ 1.0', 'Enhanced only', 'number', 'Calculate: memory_p95 / memory_avg'],
        ['21', 'cpu_throttle_percent', 'CPU throttling percentage', '0-100', 'Enhanced only', 'number', 'CloudWatch CPUCreditBalance or custom metrics'],
        ['22', 'peak_hour_avg_cpu', 'Avg CPU during 4 busiest hours', '0-100', 'Enhanced only', 'number', 'Analyze hourly CPU data, find top 4 hours'],
        ['23', 'off_peak_avg_cpu', 'Avg CPU during 4 lowest hours', '0-100', 'Enhanced only', 'number', 'Analyze hourly CPU data, find bottom 4 hours'],
        ['24', 'weekend_avg_cpu', 'Avg CPU on Sat/Sun', '0-100', 'Enhanced only', 'number', 'Filter CPU data for Saturdays and Sundays'],
        ['25', 'memory_swap_usage', 'Swap memory usage %', '0-100', 'Enhanced only', 'number', 'CloudWatch Agent mem_used_percent (swap)'],
        ['26', 'disk_latency_ms', 'Disk response time in ms', '0+', 'Enhanced only', 'number', 'EBS VolumeReadTime/VolumeWriteTime metrics'],
        ['27', 'network_packet_loss', 'Packet loss percentage', '0-100', 'Enhanced only', 'number', 'VPC Flow Logs or custom network monitoring'],
        ['28', 'data_days', 'Days of data coverage', '1+', 'Enhanced only', 'number', 'Number of days you collected metrics for'],
        ['29', 'granularity_hourly', 'Hourly granularity flag', '0 or 1', 'Enhanced only', 'number', '1 if hourly data, 0 if daily aggregates'],
        ['30', 'workload_pattern', 'Workload pattern type', '0-3', 'Enhanced only', 'number', '0=variable, 1=steady, 2=batch, 3=scheduled']
    ];

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', border: '1px solid var(--az-border)' }}>
                <thead>
                    <tr style={{ background: 'var(--az-blue)', color: 'white' }}>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>#</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Column Name</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Description</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Valid Values</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Type</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid rgba(255,255,255,0.2)' }}>Required</th>
                        <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>Where to Get This Data</th>
                    </tr>
                </thead>
                <tbody>
                    {cols.map(([num, name, desc, range, required, format, source], i) => {
                        const isEnhanced = required === 'Enhanced only';
                        const isLegacyEnd = num === '18';
                        return (
                            <tr key={i} style={{
                                borderBottom: isLegacyEnd ? '3px solid var(--az-blue)' : '1px solid var(--az-border)',
                                background: isEnhanced ? '#f0f9ff' : (i % 2 === 0 ? 'var(--az-surface)' : 'transparent')
                            }}>
                                <td style={{ padding: '8px', fontFamily: 'monospace', color: 'var(--az-text-3)', borderRight: '1px solid var(--az-border)', fontWeight: 600, fontSize: 10 }}>{num}</td>
                                <td style={{ padding: '8px', fontFamily: 'monospace', color: isEnhanced ? 'var(--az-success)' : 'var(--az-blue)', fontWeight: 600, borderRight: '1px solid var(--az-border)', fontSize: 10 }}>{name}</td>
                                <td style={{ padding: '8px', color: 'var(--az-text)', borderRight: '1px solid var(--az-border)' }}>{desc}</td>
                                <td style={{ padding: '8px', color: 'var(--az-text-2)', fontFamily: 'monospace', fontSize: 10, borderRight: '1px solid var(--az-border)' }}>{range}</td>
                                <td style={{ padding: '8px', color: 'var(--az-text-2)', fontSize: 10, borderRight: '1px solid var(--az-border)' }}>{format}</td>
                                <td style={{ padding: '8px', color: isEnhanced ? 'var(--az-success)' : 'var(--az-blue)', fontWeight: 600, fontSize: 10, borderRight: '1px solid var(--az-border)' }}>{required}</td>
                                <td style={{ padding: '8px', color: 'var(--az-text-2)', fontSize: 10, fontStyle: 'italic' }}>{source}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div style={{ marginTop: 15, padding: 12, background: 'var(--az-blue-light)', borderRadius: 6, fontSize: 12, color: 'var(--az-text-2)' }}>
                <strong style={{ color: 'var(--az-blue)' }}>Legend:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                    <li><strong>Columns 1-18</strong>: Required for both Enhanced and Legacy formats</li>
                    <li><strong>Columns 19-30</strong>: Required only for Enhanced format (auto-filled with defaults in Legacy format)</li>
                    <li><strong>Blue line after column 18</strong>: Marks the end of Legacy format</li>
                    <li><strong>Where to Get This Data</strong>: Shows the source or calculation method for each metric</li>
                </ul>
            </div>
        </div>
    );
}

function EnhancedCSVColumns() {
    const cols = [
        ['cpu_spike_ratio', 'CPU burstiness (p95/avg)', '≥ 1.0', 'Higher = more spiky workload'],
        ['memory_spike_ratio', 'Memory burstiness (p95/avg)', '≥ 1.0', 'Higher = more memory spikes'],
        ['cpu_throttle_percent', 'CPU throttling percentage', '0-100', 'Higher = more throttling events'],
        ['peak_hour_avg_cpu', 'Avg CPU during 4 busiest hours', '0-100', 'Shows peak workload intensity'],
        ['off_peak_avg_cpu', 'Avg CPU during 4 lowest hours', '0-100', 'Shows baseline usage'],
        ['weekend_avg_cpu', 'Avg CPU on Sat/Sun', '0-100', 'Weekend vs weekday patterns'],
        ['memory_swap_usage', 'Swap memory usage %', '0-100', 'High swap = memory pressure'],
        ['disk_latency_ms', 'Disk response time in ms', '≥ 0', 'Higher = slower disk I/O'],
        ['network_packet_loss', 'Packet loss percentage', '0-100', 'Higher = network issues'],
        ['data_days', 'Days of data coverage', '≥ 1', 'More days = higher confidence'],
        ['granularity_hourly', 'Hourly granularity flag', '0 or 1', '1 = hourly data, 0 = daily'],
        ['workload_pattern', 'Workload pattern type', '0 or 1', '1 = steady, 0 = variable']
    ];
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'var(--az-success)', color: 'white', borderBottom: '2px solid var(--az-border)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Column Name</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>What It Measures</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Valid Range</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Interpretation</th>
                    </tr>
                </thead>
                <tbody>
                    {cols.map(([name, measure, range, interpretation], i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--az-border)', background: i % 2 === 0 ? 'var(--az-surface)' : 'transparent' }}>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--az-success)', fontWeight: 600 }}>{name}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--az-text)' }}>{measure}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--az-blue)', fontFamily: 'monospace', fontSize: 11 }}>{range}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--az-text-2)', fontSize: 11 }}>{interpretation}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CSVColumns() {
    const cols = [
        ['resource_id', 'Unique ID (e.g., i-1234567890abcdef0)'],
        ['cloud_provider', 'aws, azure, or gcp'],
        ['region', 'Cloud region (us-east-1, eastus, etc.)'],
        ['instance_type', 'Instance type (t3.medium, Standard_D2s_v3)'],
        ['os', 'Linux or Windows'],
        ['vcpu_count', 'Number of virtual CPUs'],
        ['ram_gb', 'RAM in gigabytes'],
        ['cpu_avg', 'Average CPU % (0-100)'],
        ['cpu_p95', '95th percentile CPU %'],
        ['memory_avg', 'Average memory % (0-100)'],
        ['memory_p95', '95th percentile memory %'],
        ['disk_read_iops', 'Disk read ops/sec'],
        ['disk_write_iops', 'Disk write ops/sec'],
        ['network_in_bytes', 'Network bytes received'],
        ['network_out_bytes', 'Network bytes sent'],
        ['uptime_hours', 'Monthly uptime hours'],
        ['cost_per_month', 'Monthly cost in USD'],
        ['resource_type', 'Usually "compute"']
    ];
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'var(--az-surface)', borderBottom: '2px solid var(--az-border)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Column</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Description</th>
                    </tr>
                </thead>
                <tbody>
                    {cols.map(([name, desc], i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--az-border)' }}>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--az-blue)' }}>{name}</td>
                            <td style={{ padding: '8px 10px', color: 'var(--az-text-2)' }}>{desc}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SupportedRegions() {
    const regions = {
        aws: ['ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ca-central-1', 'eu-central-1', 'eu-north-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'sa-east-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
        gcp: ['africa-south1', 'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-northeast2', 'asia-northeast3', 'asia-south1', 'asia-south2', 'asia-southeast1', 'asia-southeast2', 'asia-southeast3', 'australia-southeast1', 'australia-southeast2', 'europe-central2', 'europe-north1', 'europe-north2', 'europe-southwest1', 'europe-west1', 'europe-west10', 'europe-west12', 'europe-west2', 'europe-west3', 'europe-west4', 'europe-west6', 'europe-west8', 'europe-west9', 'me-central1', 'me-central2', 'me-west1', 'northamerica-northeast1', 'northamerica-northeast2', 'northamerica-south1', 'southamerica-east1', 'southamerica-west1', 'us-central1', 'us-east1', 'us-east4', 'us-east5', 'us-south1', 'us-west1', 'us-west2', 'us-west3', 'us-west4'],
        azure: ['australiacentral', 'australiaeast', 'australiasoutheast', 'austriaeast', 'belgiumcentral', 'brazilsouth', 'canadacentral', 'canadaeast', 'centralindia', 'centralus', 'chilecentral', 'eastasia', 'eastus', 'eastus2', 'eastus2euap', 'eastusstg', 'francecentral', 'germanywestcentral', 'indonesiacentral', 'israelcentral', 'italynorth', 'japaneast', 'japanwest', 'koreacentral', 'koreasouth', 'malaysiawest', 'mexicocentral', 'newzealandnorth', 'northeurope', 'norwayeast', 'polandcentral', 'qatarcentral', 'southafricanorth', 'southcentralus', 'southeastasia', 'southindia', 'spaincentral', 'swedencentral', 'switzerlandnorth', 'uaenorth', 'ukwest', 'westeurope', 'westus2']
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            <RegionCard title="AWS Regions" count={regions.aws.length} regions={regions.aws} color="#FF9900" icon="☁️" />
            <RegionCard title="GCP Regions" count={regions.gcp.length} regions={regions.gcp} color="#4285F4" icon="🌐" />
            <RegionCard title="Azure Regions" count={regions.azure.length} regions={regions.azure} color="#0089D6" icon="🔷" />
        </div>
    );
}

function RegionCard({ title, count, regions, color, icon }) {
    return (
        <div style={{ background: 'var(--az-card)', border: `2px solid ${color}`, borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <h4 style={{ fontSize: 16, fontWeight: 600, color, margin: 0 }}>{title} ({count})</h4>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, color: 'var(--az-text-2)' }}>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                    {regions.map((region, i) => (
                        <li key={i} style={{ fontFamily: 'monospace' }}>• {region}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
