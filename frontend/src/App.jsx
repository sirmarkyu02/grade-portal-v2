import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';

import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import StudentDashboard from './pages/student/Dashboard';
import TeacherDashboard from './pages/teacher/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import api from './api';

// ─── Auth Context ────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFromStorage = useCallback(async () => {
    const token = localStorage.getItem('gp_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setRole(res.data.role);
    } catch {
      localStorage.removeItem('gp_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  const login = useCallback((token, userObj, roleStr) => {
    localStorage.setItem('gp_token', token);
    setUser(userObj);
    setRole(roleStr);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('gp_token');
    setUser(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, refresh: loadFromStorage }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { role, loading, user } = useAuth();
  if (loading) return <PageLoader />;
  if (!role) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  
  // Enforce onboarding for students
  if (role === 'student' && user && !user.onboarded && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  // Prevent onboarded students from accessing the onboarding page
  if (role === 'student' && user && user.onboarded && window.location.pathname === '/onboarding') {
    return <Navigate to="/student" replace />;
  }
  
  return children;
}

function RootRedirect() {
  const { role, loading, user } = useAuth();
  if (loading) return <PageLoader />;
  if (!role) return <Navigate to="/login" replace />;
  if (role === 'student') return <Navigate to={user?.onboarded ? "/student" : "/onboarding"} replace />;
  if (role === 'teacher') return <Navigate to="/teacher" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--grad-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-brand)' }}>
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L4 16l20 12 20-12L24 4z" fill="white" />
            <path d="M4 32l20 12 20-12" stroke="white" strokeWidth="2.5" fill="none" strokeOpacity="0.7" />
            <path d="M4 24l20 12 20-12" stroke="white" strokeWidth="2.5" fill="none" strokeOpacity="0.5" />
          </svg>
        </div>
        <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="var(--violet-500)" strokeWidth="2.5" style={{ width: 24, height: 24 }}>
          <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
        </svg>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontFamily: 'var(--font-sans)', fontSize: '0.875rem', fontWeight: 500, borderRadius: 10, boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' },
            success: { iconTheme: { primary: 'var(--color-success)', secondary: 'white' } },
            error: { iconTheme: { primary: 'var(--color-error)', secondary: 'white' } },
          }}
        />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<ProtectedRoute allowedRoles={['student']}><OnboardingPage /></ProtectedRoute>} />
          <Route path="/student/*" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/teacher/*" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
