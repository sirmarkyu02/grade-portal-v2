import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, BookOpen, Users, Award, Lock, User } from 'lucide-react';
import { useAuth } from '../App';
import api from '../api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, role } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [portalName, setPortalName] = useState('Grade Portal');
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    if (role) {
      if (role === 'student') {
         // Let App.jsx ProtectedRoute handle the onboarding redirect if they go to /student
         navigate('/student');
      } else {
         navigate(role === 'teacher' ? '/teacher' : '/admin');
      }
    }
    api.get('/settings/public').then(r => {
      setPortalName(r.data.portalName || 'Grade Portal');
      setSchoolName(r.data.schoolName || '');
    }).catch(() => {});
  }, [role, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!userId.trim() || !password.trim()) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { userId: userId.trim(), password: password.trim() });
      login(res.data.token, res.data.user, res.data.role);
      if (res.data.role === 'student' && !res.data.isOnboarded) {
        navigate('/onboarding');
      } else {
        navigate(res.data.role === 'student' ? '/student' : res.data.role === 'teacher' ? '/teacher' : '/admin');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: BookOpen, text: 'View grades per subject and term' },
    { icon: Award, text: 'Track your academic progress' },
    { icon: Users, text: 'Monitor your attendance records' },
  ];

  return (
    <div className="login-page">
      {/* Left Panel */}
      <div className="login-left">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32, maxWidth: 460, color: 'white' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.2)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <GraduationCap size={40} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 800, color: 'white', marginBottom: 8 }}>{portalName}</h1>
              {schoolName && <p style={{ fontSize: '1rem', opacity: 0.85, fontWeight: 500 }}>{schoolName}</p>}
              <p style={{ fontSize: '0.9375rem', opacity: 0.75, marginTop: 8, lineHeight: 1.7 }}>Your one-stop hub for academic records,<br />grades, and attendance tracking.</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <f.icon size={18} color="white" />
                </div>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{f.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, opacity: 0.6, fontSize: '0.8125rem' }}>
            <span>Student Portal</span>
            <span>•</span>
            <span>Teacher Dashboard</span>
            <span>•</span>
            <span>Admin Panel</span>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="login-right">
        <div className="login-form">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ width: 52, height: 52, background: 'var(--grad-soft)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <GraduationCap size={28} color="var(--violet-600)" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Welcome back!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Sign in with your Student No. or Teacher ID</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} autoComplete="off">
            <div className="form-group">
              <label className="form-label">User ID <span>*</span></label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input
                  className="form-input has-icon"
                  type="text"
                  placeholder="e.g. 2024000001"
                  value={userId}
                  onChange={e => { setUserId(e.target.value); setError(''); }}
                  autoFocus
                  id="userId"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password <span>*</span></label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  className={`form-input has-icon ${error ? 'error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  style={{ paddingRight: 44 }}
                  id="password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p className="form-error">{error}</p>}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? (
                <><svg className="spinner spinner-sm" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" /></svg> Signing in...</>
              ) : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: 16, background: 'var(--grad-soft)', borderRadius: 10, border: '1px solid var(--violet-200)' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.7, fontWeight: 500 }}>
              <strong>Default password:</strong> your Student Number (e.g. 2024000001).<br />
              You'll be asked to change it on your first login.
            </p>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 24 }}>
            Grade Portal v2 &nbsp;•&nbsp; Powered by Excel Integration
          </p>
        </div>
      </div>
    </div>
  );
}
