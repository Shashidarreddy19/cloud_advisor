import { Outlet, useLocation } from 'react-router-dom';
import TopNavbar from './TopNavbar';

const LayoutWrapper = ({ sidebar: Sidebar }) => {
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--az-bg)' }}>
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TopNavbar />
                <main style={{
                    flex: 1, overflowX: 'hidden', overflowY: 'auto',
                    background: 'var(--az-bg)', padding: '20px 24px',
                }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default LayoutWrapper;