import { X, AlertCircle, Key, Shield, Info } from 'lucide-react';

/**
 * ErrorModal - Displays detailed error information for cloud connection failures
 * Shows specific guidance based on the error type
 */
export default function ErrorModal({ error, provider, onClose, onRetry }) {
    if (!error) return null;

    // Parse error details
    const errorDetails = parseCloudError(error, provider);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16
        }}>
            <div style={{
                background: '#fff',
                borderRadius: 8,
                width: '100%',
                maxWidth: 520,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                border: '1px solid var(--az-border)',
                maxHeight: '90vh',
                overflow: 'auto'
            }} className="animate-fade-in-up">
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--az-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--az-error-bg)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertCircle size={22} style={{ color: 'var(--az-error)' }} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--az-error)' }}>
                                Connection Failed
                            </h2>
                            <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>
                                {provider} credentials are invalid
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--az-text-3)',
                            padding: 4,
                            borderRadius: 4,
                            display: 'flex'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px' }}>
                    {/* Error Type */}
                    <div style={{
                        background: 'var(--az-error-bg)',
                        border: '1px solid var(--az-error)',
                        borderRadius: 6,
                        padding: '14px 16px',
                        marginBottom: 20
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <Key size={18} style={{ color: 'var(--az-error)', marginTop: 2, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 6px 0', fontSize: 14, fontWeight: 600, color: 'var(--az-error)' }}>
                                    {errorDetails.title}
                                </h3>
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--az-text)', lineHeight: 1.5 }}>
                                    {errorDetails.message}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* What's Wrong */}
                    <div style={{ marginBottom: 20 }}>
                        <h4 style={{
                            margin: '0 0 10px 0',
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--az-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            <Shield size={14} />
                            What's Wrong
                        </h4>
                        <div style={{
                            background: 'var(--az-bg)',
                            border: '1px solid var(--az-border)',
                            borderRadius: 6,
                            padding: '12px 14px'
                        }}>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--az-text-2)', lineHeight: 1.6 }}>
                                {errorDetails.issues.map((issue, i) => (
                                    <li key={i}>{issue}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* How to Fix */}
                    <div style={{ marginBottom: 20 }}>
                        <h4 style={{
                            margin: '0 0 10px 0',
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--az-text)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}>
                            <Info size={14} />
                            How to Fix
                        </h4>
                        <div style={{
                            background: 'var(--az-blue-light)',
                            border: '1px solid var(--az-blue-mid)',
                            borderRadius: 6,
                            padding: '12px 14px'
                        }}>
                            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--az-text)', lineHeight: 1.6 }}>
                                {errorDetails.solutions.map((solution, i) => (
                                    <li key={i}>{solution}</li>
                                ))}
                            </ol>
                        </div>
                    </div>

                    {/* Provider-specific help */}
                    {errorDetails.helpLink && (
                        <div style={{
                            background: '#fff',
                            border: '1px solid var(--az-border)',
                            borderRadius: 6,
                            padding: '12px 14px',
                            fontSize: 12,
                            color: 'var(--az-text-2)'
                        }}>
                            <strong>Need help?</strong> Visit{' '}
                            <a
                                href={errorDetails.helpLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--az-blue)', textDecoration: 'none', fontWeight: 600 }}
                            >
                                {provider} Documentation
                            </a>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--az-border)',
                    background: 'var(--az-bg)',
                    display: 'flex',
                    gap: 10,
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onClose}
                        className="az-btn az-btn-secondary"
                        style={{ fontSize: 13 }}
                    >
                        Cancel
                    </button>
                    {onRetry && (
                        <button
                            onClick={() => { onClose(); onRetry(); }}
                            className="az-btn az-btn-primary"
                            style={{ fontSize: 13 }}
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Parse cloud error and return detailed information
 */
function parseCloudError(error, provider) {
    const errorStr = error.toLowerCase();

    // AWS Errors
    if (provider === 'AWS') {
        if (errorStr.includes('invalidclienttokenid') || errorStr.includes('security token')) {
            return {
                title: 'Invalid Access Key ID',
                message: 'The AWS Access Key ID you entered is incorrect or has been deleted.',
                issues: [
                    'Access Key ID is incorrect',
                    'Access Key ID has been deleted from AWS IAM',
                    'Access Key ID contains typos or extra spaces',
                    'You copied the Secret Access Key instead of Access Key ID'
                ],
                solutions: [
                    'Go to AWS Console → IAM → Users',
                    'Select your IAM user',
                    'Go to "Security credentials" tab',
                    'Create a new access key',
                    'Copy the Access Key ID (starts with "AKIA")',
                    'Paste it carefully without extra spaces'
                ],
                helpLink: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'
            };
        }

        if (errorStr.includes('signaturedoesnotmatch')) {
            return {
                title: 'Invalid Secret Access Key',
                message: 'The AWS Secret Access Key you entered is incorrect.',
                issues: [
                    'Secret Access Key is incorrect',
                    'Secret Access Key contains typos',
                    'You copied only part of the Secret Access Key',
                    'Secret Access Key has extra spaces'
                ],
                solutions: [
                    'Secret Access Keys cannot be retrieved after creation',
                    'You must create a NEW access key',
                    'Go to AWS Console → IAM → Users → Your User',
                    'Go to "Security credentials" tab',
                    'Click "Create access key"',
                    'Copy BOTH Access Key ID and Secret Access Key',
                    'Enter them in the form'
                ],
                helpLink: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'
            };
        }

        if (errorStr.includes('accessdenied') || errorStr.includes('not authorized')) {
            return {
                title: 'Access Denied - Insufficient Permissions',
                message: 'Your AWS IAM user does not have the required permissions.',
                issues: [
                    'IAM user lacks required permissions',
                    'IAM policy is too restrictive',
                    'User is not allowed to access EC2, CloudWatch, or S3',
                    'Permissions were recently revoked'
                ],
                solutions: [
                    'Go to AWS Console → IAM → Users → Your User',
                    'Click "Add permissions"',
                    'Attach the "ReadOnlyAccess" managed policy',
                    'OR create a custom policy with EC2, CloudWatch, S3 read permissions',
                    'Save and try connecting again'
                ],
                helpLink: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html'
            };
        }

        if (errorStr.includes('region')) {
            return {
                title: 'Invalid Region',
                message: 'The AWS region you selected may be incorrect or unavailable.',
                issues: [
                    'Region does not exist',
                    'Region is not enabled for your account',
                    'Your resources are in a different region'
                ],
                solutions: [
                    'Check which region your EC2 instances are in',
                    'Go to AWS Console and note the region in the top-right',
                    'Select the correct region from the dropdown',
                    'Common regions: us-east-1, us-west-2, ap-southeast-1'
                ],
                helpLink: 'https://docs.aws.amazon.com/general/latest/gr/rande.html'
            };
        }
    }

    // Azure Errors
    if (provider === 'Azure') {
        if (errorStr.includes('invalid_client') || errorStr.includes('unauthorized_client')) {
            return {
                title: 'Invalid Client ID or Client Secret',
                message: 'The Azure Client ID or Client Secret you entered is incorrect.',
                issues: [
                    'Client ID is incorrect',
                    'Client Secret is incorrect or expired',
                    'Service Principal was deleted',
                    'Credentials contain typos or extra spaces'
                ],
                solutions: [
                    'Go to Azure Portal → Azure Active Directory',
                    'Click "App registrations"',
                    'Select your app or create a new one',
                    'Copy the "Application (client) ID"',
                    'Go to "Certificates & secrets"',
                    'Create a new client secret',
                    'Copy the secret VALUE (not the ID)',
                    'Enter both in the form'
                ],
                helpLink: 'https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal'
            };
        }

        if (errorStr.includes('invalid_tenant') || errorStr.includes('tenant')) {
            return {
                title: 'Invalid Tenant ID',
                message: 'The Azure Tenant ID you entered is incorrect.',
                issues: [
                    'Tenant ID is incorrect',
                    'Tenant ID contains typos',
                    'You entered the wrong directory ID'
                ],
                solutions: [
                    'Go to Azure Portal → Azure Active Directory',
                    'Click "Overview" in the left menu',
                    'Find "Tenant ID" (it\'s a GUID)',
                    'Copy the Tenant ID',
                    'Paste it in the form'
                ],
                helpLink: 'https://learn.microsoft.com/en-us/azure/active-directory/fundamentals/active-directory-how-to-find-tenant'
            };
        }

        if (errorStr.includes('subscription')) {
            return {
                title: 'Invalid Subscription ID',
                message: 'The Azure Subscription ID you entered is incorrect or inaccessible.',
                issues: [
                    'Subscription ID is incorrect',
                    'Service Principal does not have access to this subscription',
                    'Subscription is disabled or expired'
                ],
                solutions: [
                    'Go to Azure Portal → Subscriptions',
                    'Copy your Subscription ID',
                    'Go to your subscription → Access control (IAM)',
                    'Add your Service Principal with "Reader" role',
                    'Wait a few minutes for permissions to propagate',
                    'Try connecting again'
                ],
                helpLink: 'https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal'
            };
        }

        if (errorStr.includes('forbidden') || errorStr.includes('authorization')) {
            return {
                title: 'Access Denied - Insufficient Permissions',
                message: 'Your Azure Service Principal does not have the required permissions.',
                issues: [
                    'Service Principal lacks "Reader" role',
                    'Permissions not assigned at subscription level',
                    'Role assignment is still propagating'
                ],
                solutions: [
                    'Go to Azure Portal → Subscriptions → Your Subscription',
                    'Click "Access control (IAM)"',
                    'Click "Add" → "Add role assignment"',
                    'Select "Reader" role',
                    'Search for your Service Principal',
                    'Click "Save"',
                    'Wait 5-10 minutes for permissions to propagate'
                ],
                helpLink: 'https://learn.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal'
            };
        }
    }

    // GCP Errors
    if (provider === 'GCP') {
        if (errorStr.includes('invalid_grant') || errorStr.includes('invalid json')) {
            return {
                title: 'Invalid Service Account JSON',
                message: 'The GCP Service Account JSON file you uploaded is invalid or corrupted.',
                issues: [
                    'JSON file is corrupted or incomplete',
                    'You uploaded the wrong file',
                    'JSON file is not a valid service account key',
                    'File was edited and is no longer valid JSON'
                ],
                solutions: [
                    'Go to GCP Console → IAM & Admin → Service Accounts',
                    'Select your service account or create a new one',
                    'Click "Keys" tab',
                    'Click "Add Key" → "Create new key"',
                    'Select "JSON" format',
                    'Download the JSON file',
                    'Upload the ORIGINAL file without editing it'
                ],
                helpLink: 'https://cloud.google.com/iam/docs/creating-managing-service-account-keys'
            };
        }

        if (errorStr.includes('permission') || errorStr.includes('forbidden')) {
            return {
                title: 'Access Denied - Insufficient Permissions',
                message: 'Your GCP Service Account does not have the required permissions.',
                issues: [
                    'Service Account lacks required roles',
                    'Missing Compute Viewer role',
                    'Missing Monitoring Viewer role',
                    'Missing Storage Object Viewer role'
                ],
                solutions: [
                    'Go to GCP Console → IAM & Admin → IAM',
                    'Find your service account',
                    'Click "Edit" (pencil icon)',
                    'Add these roles:',
                    '  - Compute Viewer',
                    '  - Monitoring Viewer',
                    '  - Storage Object Viewer',
                    'Click "Save"',
                    'Try connecting again'
                ],
                helpLink: 'https://cloud.google.com/iam/docs/granting-changing-revoking-access'
            };
        }

        if (errorStr.includes('project')) {
            return {
                title: 'Invalid Project ID',
                message: 'The GCP Project ID in your service account is incorrect or inaccessible.',
                issues: [
                    'Project ID does not exist',
                    'Service Account does not have access to this project',
                    'Project is disabled or deleted'
                ],
                solutions: [
                    'Go to GCP Console',
                    'Check the Project ID in the top bar',
                    'Ensure your Service Account belongs to this project',
                    'Download a new Service Account key from the correct project',
                    'Upload the new JSON file'
                ],
                helpLink: 'https://cloud.google.com/resource-manager/docs/creating-managing-projects'
            };
        }
    }

    // Generic error
    return {
        title: 'Connection Error',
        message: 'Unable to connect to ' + provider + '. Please check your credentials.',
        issues: [
            'One or more credentials are incorrect',
            'Credentials have been revoked or expired',
            'Network connectivity issues',
            'Service is temporarily unavailable'
        ],
        solutions: [
            'Double-check all credentials for typos',
            'Ensure credentials are copied without extra spaces',
            'Verify credentials are still valid in ' + provider + ' console',
            'Try creating new credentials',
            'Check your internet connection',
            'Try again in a few minutes'
        ],
        helpLink: null
    };
}
