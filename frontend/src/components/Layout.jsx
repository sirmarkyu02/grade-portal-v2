import React, { useState, useEffect } from 'react';
import { GraduationCap, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

export function AppLayout({ children, navItems, role }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [portalName, setPortalName] = useState('Grade Portal');

  useEffect(() => {
    import('../api').then(m => m.default.get('/settings/public')).then(r => setPortalName(r.data.portalName || 'Grade Portal')).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully.');
  };

  const initials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const roleLabel = { student: 'Student', teacher: 'Teacher', admin: 'Administrator' }[role] || 'User';
  const roleBadgeColor = { student: '#ddd6fe', teacher: '#fce7f3', admin: '#d1fae5' }[role];
  const roleBadgeText = { student: 'var(--violet-700)', teacher: 'var(--brand-700)', admin: '#065f46' }[role];

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99, backdropFilter: 'blur(2px)' }} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <GraduationCap size={20} color="white" />
          </div>
          <span className="sidebar-title">{portalName}</span>
          <button onClick={() => setSidebarOpen(false)} className="btn btn-ghost btn-icon" style={{ marginLeft: 'auto', display: 'none' }} id="close-sidebar">
            <X size={16} />
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="avatar">
            {user?.photo ? <img src={user.photo} alt={user.name} /> : initials(user?.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="profile-name">{user?.name || 'User'}</p>
            <span style={{ display: 'inline-block', background: roleBadgeColor, color: roleBadgeText, fontSize: '0.6875rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999, marginTop: 2 }}>{roleLabel}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.type === 'section') return <p key={i} className="nav-section-label">{item.label}</p>;
            return (
              <button key={i} onClick={() => { item.onClick?.(); setSidebarOpen(false); }} className={`nav-item ${item.active ? 'active' : ''}`}>
                <item.icon size={18} className="nav-icon" />
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--color-error)', width: '100%' }}>
            <LogOut size={18} className="nav-icon" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Mobile header */}
        <div style={{ display: 'none', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'white', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }} id="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon">
            <Menu size={20} />
          </button>
          <div className="sidebar-logo" style={{ width: 28, height: 28 }}>
            <GraduationCap size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{portalName}</span>
        </div>
        {children}
      </main>

      <style>{`
        @media (max-width: 1024px) {
          #close-sidebar { display: flex !important; }
          #mobile-header { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-right">{actions}</div>}
    </div>
  );
}

export function GradePill({ grade }) {
  if (!grade && grade !== 0) return <span className="grade-pill grade-empty">—</span>;
  const g = Number(grade);
  const cls = g >= 90 ? 'grade-a' : g >= 80 ? 'grade-b' : g >= 75 ? 'grade-c' : g >= 65 ? 'grade-d' : 'grade-f';
  return <span className={`grade-pill ${cls}`}>{grade}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  const isPassed = s.includes('pass') || s === 'passed';
  return (
    <span className={`badge ${isPassed ? 'badge-success' : 'badge-error'}`}>
      {isPassed ? '✓' : '✗'} {status}
    </span>
  );
}

export function LoadingSpinner({ size = 'sm' }) {
  return (
    <svg className={`spinner spinner-${size}`} viewBox="0 0 24 24" fill="none" stroke="var(--violet-500)" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" />
    </svg>
  );
}

export function Modal({ open, onClose, title, size = 'md', children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className={`btn btn-${variant}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><LoadingSpinner /> Loading...</> : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{message}</p>
    </Modal>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} />
      </div>
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-desc">{description}</p>}
      {action}
    </div>
  );
}
