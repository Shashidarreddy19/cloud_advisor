import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { ModeProvider } from "./context/ModeContext";

// Layouts
import CloudLayout from "./layouts/CloudLayout";
import CSVLayout from "./layouts/CSVLayout";
import AuthLayout from "./layouts/AuthLayout";

// Public Pages
import Landing from "./pages/Landing";
import ModeSelection from "./pages/mode/ModeSelection";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";

// Cloud Pages
import CloudDashboard from "./pages/cloud/Dashboard";
import CloudConnect from "./pages/cloud/Connect";
import Instances from "./pages/cloud/Instances";
import Buckets from "./pages/cloud/Buckets";
import ResourceDetail from "./pages/cloud/ResourceDetail";
// import Databases from "./pages/cloud/Databases"; // Placeholder
// import Snapshots from "./pages/cloud/Snapshots"; // Placeholder

// CSV Pages
import CSVDashboard from "./pages/csv/Dashboard";
import UploadCSV from "./pages/csv/UploadCSV";
import Recommendations from "./pages/csv/Recommendations";
import Reports from "./pages/csv/Reports";

// Common Pages
import Settings from "./pages/Settings";
import Help from "./pages/Help";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/auth/login" replace />;
  }

  return children;
}

export default function App() {
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // Detect event type: refresh vs close
      const isRefresh = performance.navigation?.type === 1 ||
        performance.getEntriesByType?.('navigation')[0]?.type === 'reload';

      if (isRefresh) {
        // Don't cleanup on refresh
        return;
      }

      // Check if user visited recommendations page
      const visitedRecs = sessionStorage.getItem('visitedRecommendations');
      const hasCSVData = localStorage.getItem('offlineAnalysis');

      if (visitedRecs && hasCSVData) {
        // Show browser's native save prompt
        event.preventDefault();
        event.returnValue = 'You have unsaved recommendations. Save before closing?';

        // Execute cleanup with save option
        // Note: Modern browsers show generic message, not custom text
        // The actual save/cleanup logic will be handled by sessionManager
        const userId = localStorage.getItem('userId');
        if (userId) {
          // Send cleanup beacon
          const cleanupData = JSON.stringify({ userId, mode: 'csv' });
          navigator.sendBeacon('/api/csv/cleanup', cleanupData);

          // Clear auth tokens
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('user');
          localStorage.removeItem('offlineAnalysis');
        }
      } else if (hasCSVData) {
        // Silent cleanup (no visit recorded)
        const userId = localStorage.getItem('userId');
        if (userId) {
          const cleanupData = JSON.stringify({ userId, mode: 'csv' });
          navigator.sendBeacon('/api/csv/cleanup', cleanupData);

          // Clear auth tokens
          localStorage.removeItem('token');
          localStorage.removeItem('userId');
          localStorage.removeItem('user');
          localStorage.removeItem('offlineAnalysis');
        }
      } else {
        // Just logout (no CSV data)
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('user');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <AuthProvider>
      <ModeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/mode" element={<ModeSelection />} />
            <Route path="/help" element={<Help />} />

            <Route path="/auth" element={<AuthLayout />}>
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />
            </Route>

            {/* Cloud Mode Routes */}
            <Route path="/cloud" element={<ProtectedRoute><CloudLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<CloudDashboard />} />
              <Route path="connect" element={<CloudConnect />} />
              <Route path="instances" element={<Instances />} />
              <Route path="buckets" element={<Buckets />} />
              <Route path="resource/:id" element={<ResourceDetail />} />
            </Route>

            {/* CSV Mode Routes */}
            <Route path="/csv" element={<ProtectedRoute><CSVLayout /></ProtectedRoute>}>
              <Route path="dashboard" element={<CSVDashboard />} />
              <Route path="upload" element={<UploadCSV />} />
              <Route path="recommendations" element={<Recommendations />} />
              <Route path="reports" element={<Reports />} />
            </Route>

            {/* Common Settings Route (accessible from both modes) */}
            <Route path="/settings" element={<ProtectedRoute><CloudLayout /></ProtectedRoute>}>
              <Route index element={<Settings />} />
            </Route>

            {/* Catch all - redirect to mode selection */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ModeProvider>
    </AuthProvider>
  );
}