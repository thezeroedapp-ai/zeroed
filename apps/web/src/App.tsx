import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Plan from './pages/Plan';
import Spending from './pages/Spending';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="loading-state"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile === undefined) return <div className="loading-state"><div className="spinner" /></div>;
  if (!profile?.is_admin) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup"   element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
          <Route path="/plan"     element={<ProtectedRoute><Plan /></ProtectedRoute>} />
          <Route path="/spending" element={<ProtectedRoute><Spending /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin"    element={<AdminRoute><Admin /></AdminRoute>} />
          {/* Legacy redirects for deep links that used to be standalone pages */}
          <Route path="/goals"    element={<Navigate to="/plan?tab=goals" replace />} />
          <Route path="/budget"   element={<Navigate to="/accounts?tab=budget" replace />} />
          <Route path="/rewards"  element={<Navigate to="/accounts?tab=rewards" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
