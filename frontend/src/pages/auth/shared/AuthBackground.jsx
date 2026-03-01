export default function AuthBackground({ children }) {
    return (
        <>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .auth-container {
                    animation: fadeIn 0.6s ease-out;
                }
                @media (max-width: 768px) {
                    .decorative-circle {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Full-screen container with gradient background */}
            <div style={{
                minHeight: '100vh',
                width: '100vw',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative circles - matching HTML design */}
                <div className="decorative-circle" style={{
                    position: 'absolute',
                    right: '-60px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '680px',
                    height: '680px',
                    borderRadius: '50%',
                    background: '#b2ede3',
                    opacity: 0.4
                }} />
                <div className="decorative-circle" style={{
                    position: 'absolute',
                    right: '0px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '600px',
                    height: '600px',
                    borderRadius: '50%',
                    background: '#6dd5c4',
                    opacity: 0.5
                }} />
                <div className="decorative-circle" style={{
                    position: 'absolute',
                    right: '50px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '500px',
                    height: '500px',
                    borderRadius: '50%',
                    background: '#3dbfad',
                    opacity: 0.7
                }} />

                {/* Content */}
                {children}
            </div>
        </>
    );
}
