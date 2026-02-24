import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ModeProvider } from "./context/ModeContext";

// Layouts
import CloudLayout from "./layouts/CloudLayout";
import CSVLayout from "./layouts/CSVLayout";
import AuthLayout from "./layouts/AuthLayout";

// Public Pages
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
  return (
    <AuthProvider>
      <ModeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<ModeSelection />} />
            <Route path="/mode" element={<ModeSelection />} />

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

            {/* Help/Documentation Route (accessible from both modes) */}
            <Route path="/help" element={<ProtectedRoute><CloudLayout /></ProtectedRoute>}>
              <Route index element={<Help />} />
            </Route>

            {/* Catch all - redirect to mode selection */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ModeProvider>
    </AuthProvider>
  );
}