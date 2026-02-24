import { useState } from 'react';
import { HelpCircle, Cloud, Upload, FileText, ChevronRight, CheckCircle, Info } from 'lucide-react';

export default function Help() {
    const [activeSection, setActiveSection] = useState('getting-started');
    const [selectedCloud, setSelectedCloud] = useState('aws');

    const sections = [
        { id: 'getting-started', label: 'Getting Started', icon: HelpCircle },
        { id: 'cloud-connection', label: 'Cloud Connection', icon: Cloud },
        { id: 'csv-upload', label: 'CSV Upload', icon: Upload },
        { id: 'faq', label: 'FAQ', icon: FileText },
    ];

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - var(--az-navbar-h))', background: 'var(--az-bg)' }}>
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
                    desc="Resources using <40% CPU/memory. Can be downsized to save 30-50% costs."
                    example="t3.large (15% CPU, 30% memory) → t3.medium saves $17/month"
                />
                <RecommendationType type="Undersized" color="#8A3707"
                    desc="Resources at >80% CPU/memory. Need upgrade to prevent performance issues."
                    example="t3.small (85% CPU, 90% memory) → t3.medium prevents downtime"
                />
                <RecommendationType type="Optimal" color="var(--az-success)"
                    desc="Resources at 40-80% utilization. Already well-sized, no changes needed."
                    example="t3.medium (60% CPU, 65% memory) is perfectly balanced"
                />
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
                    <>Navigate to <strong style={{ color: 'var(--az-blue)' }}>IAM → Users</strong></>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"Add users"</strong> or select existing user</>,
                    <>For new user: Enter username (e.g., <strong style={{ color: 'var(--az-blue)' }}>"cloud-optimizer-readonly"</strong>), select <strong style={{ color: 'var(--az-blue)' }}>"Programmatic access"</strong></>,
                    <>Attach policies: <strong style={{ color: 'var(--az-success)' }}>AmazonEC2ReadOnlyAccess</strong> + <strong style={{ color: 'var(--az-success)' }}>CloudWatchReadOnlyAccess</strong></>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"Create user"</strong> and <strong style={{ color: 'var(--az-error)' }}>download credentials CSV</strong></>,
                    <>For existing user: Go to <strong style={{ color: 'var(--az-blue)' }}>"Security credentials"</strong> tab → <strong style={{ color: 'var(--az-blue)' }}>"Create access key"</strong></>,
                    <>Select <strong style={{ color: 'var(--az-blue)' }}>"Third-party service"</strong> → Create key</>,
                    <><strong style={{ color: 'var(--az-error)' }}>Copy Access Key ID and Secret Access Key</strong> (shown only once!)</>,
                    <>In Cloud Optimizer: Go to <strong style={{ color: 'var(--az-blue)' }}>"Connect Cloud"</strong> → Select <strong style={{ color: 'var(--az-blue)' }}>AWS</strong> → Paste credentials → <strong style={{ color: 'var(--az-success)' }}>Connect</strong></>
                ]} />
            </Section>

            <Section title="Required Permissions">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        ✓ Read-Only Access Required:
                    </div>
                    <PermList perms={[
                        <><strong style={{ color: 'var(--az-blue)' }}>ec2:DescribeInstances</strong> - List all EC2 instances</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>ec2:DescribeRegions</strong> - Discover AWS regions</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>ec2:DescribeInstanceTypes</strong> - Get instance specs</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>cloudwatch:GetMetricStatistics</strong> - Fetch metrics</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>cloudwatch:ListMetrics</strong> - List available metrics</>
                    ]} />
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
                    <>Go to <strong style={{ color: 'var(--az-blue)' }}>"App registrations"</strong> → Click <strong style={{ color: 'var(--az-blue)' }}>"+  New registration"</strong></>,
                    <>Name: <strong style={{ color: 'var(--az-blue)' }}>"CloudOptimizer"</strong>, Account types: <strong style={{ color: 'var(--az-blue)' }}>"This directory only"</strong>, Redirect URI: Leave blank</>,
                    <>Click <strong style={{ color: 'var(--az-blue)' }}>"Register"</strong> → <strong style={{ color: 'var(--az-error)' }}>Copy Application (client) ID and Directory (tenant) ID</strong></>,
                    <>Go to <strong style={{ color: 'var(--az-blue)' }}>"Certificates & secrets"</strong> → <strong style={{ color: 'var(--az-blue)' }}>"+  New client secret"</strong></>,
                    <>Description: <strong style={{ color: 'var(--az-blue)' }}>"CloudOptimizer Access"</strong>, Expiration: <strong style={{ color: 'var(--az-blue)' }}>24 months</strong> → Create</>,
                    <><strong style={{ color: 'var(--az-error)' }}>Copy the secret VALUE immediately</strong> (shown only once!)</>,
                    <>Search for <strong style={{ color: 'var(--az-blue)' }}>"Subscriptions"</strong> → Select your subscription → <strong style={{ color: 'var(--az-error)' }}>Copy Subscription ID</strong></>,
                    <>In subscription: <strong style={{ color: 'var(--az-blue)' }}>"Access control (IAM)"</strong> → <strong style={{ color: 'var(--az-blue)' }}>"+  Add"</strong> → <strong style={{ color: 'var(--az-blue)' }}>"Add role assignment"</strong></>,
                    <>Role: <strong style={{ color: 'var(--az-success)' }}>"Reader"</strong>, Assign to: <strong style={{ color: 'var(--az-blue)' }}>"User, group, or service principal"</strong></>,
                    <>Select your <strong style={{ color: 'var(--az-blue)' }}>"CloudOptimizer"</strong> app → <strong style={{ color: 'var(--az-success)' }}>Save</strong></>,
                    <>In Cloud Optimizer: <strong style={{ color: 'var(--az-blue)' }}>Connect Cloud</strong> → <strong style={{ color: 'var(--az-blue)' }}>Azure</strong> → Enter all 4 credentials → <strong style={{ color: 'var(--az-success)' }}>Connect</strong></>
                ]} />
            </Section>

            <Section title="Required Permissions">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        ✓ Reader Role Required:
                    </div>
                    <PermList perms={[
                        <><strong style={{ color: 'var(--az-blue)' }}>Microsoft.Compute/virtualMachines/read</strong> - List VMs</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>Microsoft.Compute/virtualMachines/instanceView/read</strong> - Get VM status</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>Microsoft.Insights/metrics/read</strong> - Read Monitor metrics</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>Microsoft.Resources/subscriptions/resourceGroups/read</strong> - List resource groups</>
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
                <CredItem name="Project ID" format="Lowercase, numbers, hyphens" example="my-project-12345" />
                <CredItem name="Service Account Key" format="Complete JSON file" example='{"type": "service_account", "project_id": "...", ...}' />
            </Section>

            <Section title="Step-by-Step Setup">
                <Steps steps={[
                    'Log in to Google Cloud Console (https://console.cloud.google.com/)',
                    'Select your project from dropdown → Note the Project ID',
                    'Menu (☰) → "IAM & Admin" → "Service Accounts"',
                    'Click "+ CREATE SERVICE ACCOUNT"',
                    'Name: "cloud-optimizer", Description: "Read-only for Cloud Optimizer" → CREATE',
                    'Grant roles: "Compute Viewer" + "Monitoring Viewer" → CONTINUE → DONE',
                    'Click on the service account → "KEYS" tab',
                    'Click "ADD KEY" → "Create new key" → Select "JSON" → CREATE',
                    'JSON file downloads automatically - store it securely',
                    'Open JSON file with text editor → Copy entire content (including { and })',
                    'In Cloud Optimizer: Connect Cloud → GCP → Enter Project ID → Paste JSON → Connect'
                ]} />
            </Section>

            <Section title="Required Permissions">
                <div style={{ background: 'var(--az-surface)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--az-text)', marginBottom: 12 }}>
                        ✓ Viewer Roles Required:
                    </div>
                    <PermList perms={[
                        <><strong style={{ color: 'var(--az-blue)' }}>compute.instances.list</strong> - List VM instances</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>compute.instances.get</strong> - Get instance details</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>compute.zones.list</strong> - List available zones</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>monitoring.timeSeries.list</strong> - Read metrics data</>,
                        <><strong style={{ color: 'var(--az-blue)' }}>monitoring.metricDescriptors.list</strong> - List metrics</>
                    ]} />
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
                    <li><strong>Invalid JSON:</strong> Ensure complete copy including {and}</li>
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
                    <>Go to <strong style={{ color: 'var(--az-blue)' }}>"APIs & Services"</strong> → <strong style={{ color: 'var(--az-blue)' }}>"Library"</strong></>,
                    <>Search <strong style={{ color: 'var(--az-blue)' }}>"Compute Engine API"</strong> → Click <strong style={{ color: 'var(--az-success)' }}>ENABLE</strong></>,
                    <>Search <strong style={{ color: 'var(--az-blue)' }}>"Cloud Monitoring API"</strong> → Click <strong style={{ color: 'var(--az-success)' }}>ENABLE</strong></>,
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
            <p style={{ fontSize: 14, color: 'var(--az-text-2)', marginBottom: 30 }}>Upload resource data for offline analysis without cloud connection</p>

            <Section title="Required CSV Format">
                <p style={{ fontSize: 14, color: 'var(--az-text-2)', marginBottom: 15 }}>Your CSV must have exactly 18 columns in this order:</p>
                <div style={{ background: 'var(--az-surface)', padding: 15, borderRadius: 6, marginBottom: 20, overflowX: 'auto' }}>
                    <code style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre' }}>
                        resource_id, cloud_provider, region, instance_type, os, vcpu_count, ram_gb, cpu_avg, cpu_p95, memory_avg, memory_p95, disk_read_iops, disk_write_iops, network_in_bytes, network_out_bytes, uptime_hours, cost_per_month, resource_type
                    </code>
                </div>
            </Section>

            <Section title="Column Descriptions">
                <CSVColumns />
            </Section>

            <Section title="How to Find Metrics">
                <div style={{ background: 'var(--az-blue-light)', border: '1px solid var(--az-blue)', borderRadius: 8, padding: 16, marginBottom: 15 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--az-blue)', marginBottom: 8 }}>📊 Where to find each metric in your cloud console:</div>
                </div>

                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#FF9900', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    ☁️ AWS CloudWatch:
                </h4>
                <ul style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20, marginBottom: 15 }}>
                    <li><strong>Location:</strong> EC2 → Instances → Select instance → <strong style={{ color: 'var(--az-blue)' }}>Monitoring tab</strong></li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>CPU:</strong> CPUUtilization metric (average & 95th percentile)</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Memory:</strong> Requires CloudWatch agent installation</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Disk:</strong> EBS ReadOps/WriteOps metrics</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Network:</strong> NetworkIn/NetworkOut metrics</li>
                </ul>

                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0089D6', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🔷 Azure Monitor:
                </h4>
                <ul style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20, marginBottom: 15 }}>
                    <li><strong>Location:</strong> Virtual Machines → Select VM → <strong style={{ color: 'var(--az-blue)' }}>Metrics</strong></li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>CPU:</strong> "Percentage CPU" metric</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Memory:</strong> "Available Memory Bytes"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Disk:</strong> "Disk Read/Write Operations/Sec"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Network:</strong> "Network In/Out Total"</li>
                </ul>

                <h4 style={{ fontSize: 15, fontWeight: 600, color: '#34A853', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🌐 GCP Monitoring:
                </h4>
                <ul style={{ fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.8, paddingLeft: 20 }}>
                    <li><strong>Location:</strong> Compute Engine → VM instances → Select instance → <strong style={{ color: 'var(--az-blue)' }}>Monitoring</strong></li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>CPU:</strong> "CPU utilization" metric</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Memory:</strong> "Memory utilization"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Disk:</strong> "Disk read/write operations"</li>
                    <li><strong style={{ color: 'var(--az-blue)' }}>Network:</strong> "Network bytes received/sent"</li>
                </ul>
            </Section>

            <Section title="Example CSV">
                <div style={{ background: 'var(--az-surface)', padding: 15, borderRadius: 6, overflowX: 'auto' }}>
                    <code style={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre' }}>
                        {`resource_id,cloud_provider,region,instance_type,os,vcpu_count,ram_gb,cpu_avg,cpu_p95,memory_avg,memory_p95,disk_read_iops,disk_write_iops,network_in_bytes,network_out_bytes,uptime_hours,cost_per_month,resource_type
i-1234567890abcdef0,aws,us-east-1,t3.medium,Linux,2,4,25.5,45.2,60.3,75.8,100,50,1000000,500000,720,35.04,compute
vm-prod-web-01,azure,eastus,Standard_D2s_v3,Windows,2,8,15.2,30.5,45.6,65.2,80,40,800000,400000,720,70.08,compute`}
                    </code>
                </div>
            </Section>
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
            <FAQItem q="Can I filter recommendations by confidence?" a="Yes. Filter by High (80%+), Medium (60-79%), or Low (<60%) confidence scores." />
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
