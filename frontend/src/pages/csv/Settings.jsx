export default function Settings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--az-text)' }}>Settings</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--az-text-2)' }}>Manage your account and preferences</p>
      </div>
      <div style={{ background: '#fff', border: '1px solid var(--az-border)', borderRadius: 6, padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--az-text-3)' }}>Settings features coming soon.</p>
      </div>
    </div>
  );
}
