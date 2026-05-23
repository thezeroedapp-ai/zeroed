import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Plan from './pages/Plan';
import Goals from './pages/Goals';
import Activity from './pages/Activity';
import Budget from './pages/Budget';
import Recommend from './pages/Recommend';
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup"    element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/"          element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/accounts"  element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
          <Route path="/plan"      element={<ProtectedRoute><Plan /></ProtectedRoute>} />
          <Route path="/goals"     element={<ProtectedRoute><Goals /></ProtectedRoute>} />
          <Route path="/activity"  element={<ProtectedRoute><Activity /></ProtectedRoute>} />
          <Route path="/budget"    element={<ProtectedRoute><Budget /></ProtectedRoute>} />
          <Route path="/recommend" element={<ProtectedRoute><Recommend /></ProtectedRoute>} />
          <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin"     element={<AdminRoute><Admin /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
