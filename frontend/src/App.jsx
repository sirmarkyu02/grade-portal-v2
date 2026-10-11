import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { Shield, RotateCcw } from 'lucide-react';
import './index.css';

import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import StudentDashboard from './pages/student/Dashboard';
import TeacherDashboard from './pages/teacher/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import api from './api';

const THEMES = {
  blue: {
    '--brand-50': '#eff6ff', '--brand-100': '#dbeafe', '--brand-200': '#bfdbfe', '--brand-300': '#93c5fd', '--brand-400': '#60a5fa', '--brand-500': '#3b82f6', '--brand-600': '#2563eb', '--brand-700': '#1d4ed8',
    '--violet-50': '#f0f9ff', '--violet-100': '#e0f2fe', '--violet-200': '#bae6fd', '--violet-300': '#7dd3fc', '--violet-400': '#38bdf8', '--violet-500': '#0ea5e9', '--violet-600': '#0284c7', '--violet-700': '#0369a1',
    '--grad-main': 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)',
    '--grad-soft': 'linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%)',
    '--grad-card': 'linear-gradient(160deg, #fff 0%, #eff6ff 100%)',
    '--grad-hero': 'linear-gradient(135deg, #3b82f6 0%, #0ea5e9 50%, #0284c7 100%)',
    '--border-focus': '#38bdf8', '--bg-hover': '#eff6ff', '--shadow-brand': '0 8px 24px rgba(59, 130, 246, 0.25)'
  },
  orange: {
    '--brand-50': '#fff7ed', '--brand-100': '#ffedd5', '--brand-200': '#fed7aa', '--brand-300': '#fdba74', '--brand-400': '#fb923c', '--brand-500': '#f97316', '--brand-600': '#ea580c', '--brand-700': '#c2410c',
    '--violet-50': '#fffbeb', '--violet-100': '#fef3c7', '--violet-200': '#fde68a', '--violet-300': '#fcd34d', '--violet-400': '#fbbf24', '--violet-500': '#f59e0b', '--violet-600': '#d97706', '--violet-700': '#b45309',
    '--grad-main': 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
    '--grad-soft': 'linear-gradient(135deg, #ffedd5 0%, #fef3c7 100%)',
    '--grad-card': 'linear-gradient(160deg, #fff 0%, #fff7ed 100%)',
    '--grad-hero': 'linear-gradient(135deg, #f97316 0%, #f59e0b 50%, #d97706 100%)',
    '--border-focus': '#fbbf24', '--bg-hover': '#fff7ed', '--shadow-brand': '0 8px 24px rgba(249, 115, 22, 0.25)'
  },
  pink: {
    '--brand-50': '#fff1f2', '--brand-100': '#ffe4e6', '--brand-200': '#fecdd3', '--brand-300': '#fda4af', '--brand-400': '#fb7185', '--brand-500': '#f43f5e', '--brand-600': '#e11d48', '--brand-700': '#be123c',
    '--violet-50': '#fdf2f8', '--violet-100': '#fce7f3', '--violet-200': '#fbcfe8', '--violet-300': '#f9a8d4', '--violet-400': '#f472b6', '--violet-500': '#ec4899', '--violet-600': '#db2777', '--violet-700': '#be185d',
    '--grad-main': 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
    '--grad-soft': 'linear-gradient(135deg, #ffe4e6 0%, #fce7f3 100%)',
    '--grad-card': 'linear-gradient(160deg, #fff 0%, #fff1f2 100%)',
    '--grad-hero': 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #db2777 100%)',
    '--border-focus': '#f472b6', '--bg-hover': '#fff1f2', '--shadow-brand': '0 8px 24px rgba(244, 63, 94, 0.25)'
  },
  green: {
    '--brand-50': '#ecfdf5', '--brand-100': '#d1fae5', '--brand-200': '#a7f3d0', '--brand-300': '#6ee7b7', '--brand-400': '#34d399', '--brand-500': '#10b981', '--brand-600': '#059669', '--brand-700': '#047857',
    '--violet-50': '#f0fdf4', '--violet-100': '#dcfce7', '--violet-200': '#bbf7d0', '--violet-300': '#86efac', '--violet-400': '#4ade80', '--violet-500': '#22c55e', '--violet-600': '#16a34a', '--violet-700': '#15803d',
    '--grad-main': 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
    '--grad-soft': 'linear-gradient(135deg, #d1fae5 0%, #dcfce7 100%)',
    '--grad-card': 'linear-gradient(160deg, #fff 0%, #ecfdf5 100%)',
    '--grad-hero': 'linear-gradient(135deg, #10b981 0%, #22c55e 50%, #16a34a 100%)',
    '--border-focus': '#4ade80', '--bg-hover': '#ecfdf5', '--shadow-brand': '0 8px 24px rgba(16, 185, 129, 0.25)'
  }
};

// ─── Auth Context ────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonateInfo, setImpersonateInfo] = useState(() => {
    try {
      const stored = localStorage.getItem('admin_impersonate_data');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [isImpersonating, setIsImpersonating] = useState(() => !!localStorage.getItem('admin_return_token'));

  const loadFromStorage = useCallback(async () => {
    const token = localStorage.getItem('gp_token');
    const returnToken = localStorage.getItem('admin_return_token');
    if (!token) {
      if (returnToken) {
        localStorage.removeItem('admin_return_token');
        localStorage.removeItem('admin_impersonate_data');
        setIsImpersonating(false);
        setImpersonateInfo(null);
      }
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setRole(res.data.role);
      const isImp = !!localStorage.getItem('admin_return_token');
      setIsImpersonating(isImp);
      if (isImp) {
        const stored = localStorage.getItem('admin_impersonate_data');
        if (stored) {
          try { setImpersonateInfo(JSON.parse(stored)); } catch {}
        }
      }
    } catch {
      if (returnToken) {
        localStorage.setItem('gp_token', returnToken);
        localStorage.removeItem('admin_return_token');
        localStorage.removeItem('admin_impersonate_data');
        setIsImpersonating(false);
        setImpersonateInfo(null);
        try {
          const adminRes = await api.get('/auth/me');
          setUser(adminRes.data.user);
          setRole(adminRes.data.role);
          setLoading(false);
          return;
        } catch {
          localStorage.removeItem('gp_token');
        }
      } else {
        localStorage.removeItem('gp_token');
      }
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

  const startImpersonation = useCallback((impersonateToken, userObj, targetRole, metadata = {}) => {
    const currentAdminToken = localStorage.getItem('gp_token');
    if (currentAdminToken) {
      localStorage.setItem('admin_return_token', currentAdminToken);
    }
    const info = {
      role: targetRole,
      id: userObj.id,
      name: userObj.name || metadata.name || userObj.id,
      details: metadata.department || metadata.section || '',
      returnPath: window.location.pathname.startsWith('/admin') ? window.location.pathname : '/admin',
      startedAt: new Date().toISOString()
    };
    localStorage.setItem('admin_impersonate_data', JSON.stringify(info));
    localStorage.setItem('gp_token', impersonateToken);
    setUser(userObj);
    setRole(targetRole);
    setIsImpersonating(true);
    setImpersonateInfo(info);
  }, []);

  const exitImpersonation = useCallback(async () => {
    const returnToken = localStorage.getItem('admin_return_token');
    const storedInfo = localStorage.getItem('admin_impersonate_data');
    let returnPath = '/admin';
    if (storedInfo) {
      try {
        const parsed = JSON.parse(storedInfo);
        if (parsed.returnPath && parsed.returnPath.startsWith('/admin')) {
          returnPath = parsed.returnPath;
        }
      } catch {}
    }

    try {
      await api.post('/admin/impersonate/revert', { adminToken: returnToken });
    } catch {}

    if (returnToken) {
      localStorage.setItem('gp_token', returnToken);
    }
    localStorage.removeItem('admin_return_token');
    localStorage.removeItem('admin_impersonate_data');
    setIsImpersonating(false);
    setImpersonateInfo(null);

    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setRole(res.data.role);
      toast.success('Exited impersonation mode. Returned to Admin.');
      window.location.href = returnPath;
    } catch {
      window.location.href = '/login';
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('gp_token');
    localStorage.removeItem('admin_return_token');
    localStorage.removeItem('admin_impersonate_data');
    setUser(null);
    setRole(null);
    setIsImpersonating(false);
    setImpersonateInfo(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      role,
      loading,
      login,
      logout,
      isImpersonating,
      impersonateInfo,
      startImpersonation,
      exitImpersonation,
      refresh: loadFromStorage
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children, allowedRoles }) {
  const { role, loading, user, isImpersonating } = useAuth();
  if (loading) return <PageLoader />;
  if (!role) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;

  // Enforce onboarding for normal students (impersonating admin can bypass or view dashboard)
  if (role === 'student' && user && !user.onboarded && !isImpersonating && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  // Prevent onboarded students from accessing the onboarding page
  if (role === 'student' && user && user.onboarded && window.location.pathname === '/onboarding') {
    return <Navigate to="/student" replace />;
  }
  
  return children;
}

function RootRedirect() {
  const { role, loading, user, isImpersonating } = useAuth();
  
  if (loading) return <PageLoader />;
  if (!role) return <Navigate to="/login" replace />;
  if (role === 'student') return <Navigate to={(user?.onboarded || isImpersonating) ? "/student" : "/onboarding"} replace />;
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

function ImpersonationBanner() {
  const { isImpersonating, impersonateInfo, exitImpersonation } = useAuth();
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!isImpersonating) return;
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (document.querySelector('.modal-overlay')) return;
      if (e.key === 'Escape') {
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImpersonating, exitImpersonation]);

  if (!isImpersonating) return null;

  const handleExit = async () => {
    if (exiting) return;
    setExiting(true);
    await exitImpersonation();
    setExiting(false);
  };

  const roleLabel = impersonateInfo?.role === 'teacher' ? 'Teacher' : 'Student';
  const roleBadgeStyle = impersonateInfo?.role === 'teacher' 
    ? { background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }
    : { background: 'rgba(56, 189, 248, 0.25)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' };

  return (
    <div className="admin-impersonation-banner" role="alert" aria-live="polite">
      <div className="impersonation-banner-inner">
        <div className="impersonation-banner-left">
          <div className="impersonation-pulse-indicator" title="Active live impersonation session">
            <span className="pulse-dot" />
            <span className="pulse-ring" />
          </div>
          <span className="impersonation-role-badge" style={roleBadgeStyle}>
            {roleLabel}
          </span>
          <div className="impersonation-info-text">
            <span className="impersonation-heading">Viewing as:</span>
            <span className="impersonation-user-name">{impersonateInfo?.name || 'User'}</span>
            {impersonateInfo?.id && (
              <span className="impersonation-user-id">{impersonateInfo.id}</span>
            )}
            {impersonateInfo?.details && (
              <span className="impersonation-user-details">• {impersonateInfo.details}</span>
            )}
          </div>
        </div>

        <div className="impersonation-banner-center">
          <span className="impersonation-badge-security">
            <Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Admin Impersonation Mode Active
          </span>
        </div>

        <div className="impersonation-banner-right">
          <button
            className="btn-return-admin"
            onClick={handleExit}
            disabled={exiting}
            title="Exit impersonation and return to Admin panel (Shortcut: Esc)"
          >
            {exiting ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 14, height: 14 }}>
                  <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
                </svg>
                <span>Returning...</span>
              </>
            ) : (
              <>
                <RotateCcw size={13} className="return-icon" />
                <span>Return to Admin</span>
                <kbd className="esc-key-badge">Esc</kbd>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeApplier() {
  const { user } = useAuth();
  
  useEffect(() => {
    const theme = user?.theme;
    if (theme && THEMES[theme]) {
      Object.entries(THEMES[theme]).forEach(([key, val]) => {
        document.documentElement.style.setProperty(key, val);
      });
    } else {
      // Revert to default
      const allKeys = Object.keys(THEMES.blue);
      allKeys.forEach(key => document.documentElement.style.removeProperty(key));
    }
  }, [user?.theme]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeApplier />
        <ImpersonationBanner />
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
