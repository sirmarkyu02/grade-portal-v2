import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, LogOut, Menu, X, RotateCcw, UserCheck } from 'lucide-react';
import { useAuth } from '../App';
import toast from 'react-hot-toast';

export function AppLayout({ children, navItems, role }) {
  const { user, logout, isImpersonating, exitImpersonation } = useAuth();
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <span style={{ display: 'inline-block', background: roleBadgeColor, color: roleBadgeText, fontSize: '0.6875rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999 }}>{roleLabel}</span>
              {isImpersonating && (
                <span className="impersonation-profile-tag" title="Account accessed via Admin Impersonation">
                  <UserCheck size={10} /> Impersonated
                </span>
              )}
            </div>
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

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isImpersonating ? (
            <button
              onClick={exitImpersonation}
              className="nav-item"
              style={{ color: 'var(--brand-600)', background: 'var(--brand-50)', width: '100%', fontWeight: 600, borderRadius: 8, padding: '8px 12px' }}
              title="Return to Administrator Dashboard"
            >
              <RotateCcw size={16} className="nav-icon" />
              <span>Return to Admin</span>
            </button>
          ) : (
            <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--color-error)', width: '100%' }}>
              <LogOut size={18} className="nav-icon" />
              <span>Sign Out</span>
            </button>
          )}
          <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            Developed by <span style={{ fontWeight: 700, color: 'var(--brand-600)' }}>Sir Markyu</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Mobile header */}
        <div className="mobile-header" id="mobile-header">
          <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon mobile-menu-btn" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="mobile-header-brand">
            <div className="sidebar-logo" style={{ width: 28, height: 28 }}>
              <GraduationCap size={16} color="white" />
            </div>
            <span className="mobile-header-title">{portalName}</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="mobile-avatar-btn" aria-label="Open profile drawer">
            <div className="avatar avatar-sm">
              {user?.photo ? <img src={user.photo} alt={user.name} /> : initials(user?.name)}
            </div>
          </button>
        </div>
        {children}

        {/* Mobile Bottom Navigation Bar (Hidden on desktop via CSS) */}
        <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
          {navItems
            .filter(item => item.type !== 'section' && item.icon)
            .slice(0, 5)
            .map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setSidebarOpen(false);
                  item.onClick?.();
                }}
                className={`mobile-bottom-nav-item ${item.active ? 'active' : ''}`}
              >
                <item.icon size={19} className="mobile-bottom-nav-icon" />
                <span className="mobile-bottom-nav-label">{item.label}</span>
                {item.badge && <span className="mobile-bottom-nav-badge">{item.badge}</span>}
              </button>
            ))}
        </nav>
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

export function GradePill({ grade, size = 'sm' }) {
  const sizeClass = size === 'lg' ? 'grade-pill-lg' : '';
  if (grade === null || grade === undefined || grade === '' || grade === '—' || grade === '-') {
    return <span className={`grade-pill grade-empty ${sizeClass}`}>—</span>;
  }
  const str = String(grade).trim().toUpperCase();
  if (str === 'INC') {
    return <span className={`grade-pill grade-d ${sizeClass}`}>INC</span>;
  }
  if (str === 'DRP') {
    return <span className={`grade-pill grade-f ${sizeClass}`}>DRP</span>;
  }
  const g = Number(grade);
  if (isNaN(g)) {
    return <span className={`grade-pill grade-empty ${sizeClass}`}>{grade}</span>;
  }

  let cls = 'grade-f';
  let displayVal = grade;
  if (g <= 5.0) {
    // Tertiary / College numerical rating (1.00 - 5.00, 1.00 is highest, 3.00 is passing)
    displayVal = g.toFixed(2);
    if (g <= 1.75) cls = 'grade-a';
    else if (g <= 2.50) cls = 'grade-b';
    else if (g <= 3.00) cls = 'grade-c';
    else if (g < 5.00) cls = 'grade-d';
    else cls = 'grade-f';
  } else {
    // High School percentage rating (60 - 100, 75 is passing)
    cls = g >= 90 ? 'grade-a' : g >= 80 ? 'grade-b' : g >= 75 ? 'grade-c' : g >= 65 ? 'grade-d' : 'grade-f';
  }

  return <span className={`grade-pill ${cls} ${sizeClass}`}>{displayVal}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  const isPassed = s.includes('pass') || s === 'passed';
  const isHidden = s.includes('hidden') || s.includes('tba') || s.includes('progress');
  const isIncomplete = s.includes('incomplete') || s === 'inc';
  const isDropped = s.includes('dropped') || s === 'drp';
  const badgeClass = isPassed ? 'badge-success' : isHidden ? 'badge-neutral' : isIncomplete ? 'badge-warning' : 'badge-error';
  const icon = isPassed ? '✓' : isHidden ? '🕒' : isIncomplete ? '⚠️' : '✕';
  return (
    <span className={`badge ${badgeClass}`}>
      {icon} {status}
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
        <div className="modal-drag-handle" />
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon btn-sm" aria-label="Close modal">
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

// ─── Dropdown Menu System ───────────────────────────────────────────────────
export function DropdownMenu({ trigger, children, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`dropdown-container ${className}`} ref={containerRef}>
      <div onClick={() => setOpen(prev => !prev)} className="dropdown-trigger">
        {typeof trigger === 'function' ? trigger({ open }) : trigger}
      </div>
      {open && (
        <div
          className={`dropdown-menu dropdown-menu-${align}`}
          onClick={(e) => {
            // Close dropdown unless clicking directly inside a file input
            if (e.target.tagName !== 'INPUT') {
              setOpen(false);
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ icon, title, subtitle, onClick, danger, disabled }) {
  return (
    <button
      type="button"
      className={`dropdown-item ${danger ? 'dropdown-item-danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <div className="dropdown-item-icon">{icon}</div>}
      <div className="dropdown-item-content">
        <div className="dropdown-item-title">{title}</div>
        {subtitle && <div className="dropdown-item-sub">{subtitle}</div>}
      </div>
    </button>
  );
}

export function DropdownDivider() {
  return <div className="dropdown-divider" />;
}

export function DropdownHeader({ children }) {
  return <div className="dropdown-section-header">{children}</div>;
}

