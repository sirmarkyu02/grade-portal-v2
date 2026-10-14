import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Shield, ShieldCheck, Activity, Clock, Search, RefreshCw, 
  Trash2, Download, AlertTriangle, Monitor, Smartphone, Tablet, 
  Eye, Copy, Check, LogIn, LogOut, Cloud, UserCheck, Key, 
  Sliders, HardDrive, Database, Globe, ChevronLeft, ChevronRight,
  Filter, CheckCircle, ExternalLink, X
} from 'lucide-react';
import { LoadingSpinner, Modal, ConfirmModal } from '../../components/Layout';
import { useAuth } from '../../App';
import api from '../../api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import './SystemLogsAndSessions.css';

export default function SystemLogsAndSessions() {
  const { startImpersonation } = useAuth();
  const [subTab, setSubTab] = useState('sessions'); // 'sessions' | 'logs' | 'security'
  
  // Data states
  const [sessions, setSessions] = useState({});
  const [sessionStats, setSessionStats] = useState({ total: 0, activeNow: 0, adminCount: 0, teacherCount: 0, studentCount: 0, sessionTimeout: 7200000 });
  const [logs, setLogs] = useState([]);
  const [logStats, setLogStats] = useState({ total: 0, today: 0, byCategory: {} });
  
  // Loading & sync
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Sessions filters
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionRoleFilter, setSessionRoleFilter] = useState('all');
  const [sessionDeviceFilter, setSessionDeviceFilter] = useState('all');
  const [sessionSort, setSessionSort] = useState('recent'); // 'recent' | 'longest' | 'name'

  // Activity logs filters & pagination
  const [logSearch, setLogSearch] = useState('');
  const [logRoleFilter, setLogRoleFilter] = useState('all');
  const [logCategoryFilter, setLogCategoryFilter] = useState('all');
  const [logDateFilter, setLogDateFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals & interaction
  const [inspectLog, setInspectLog] = useState(null);
  const [confirmRevokeToken, setConfirmRevokeToken] = useState(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [confirmClearLogs, setConfirmClearLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // Security policy
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState('2');
  const [savingTimeout, setSavingTimeout] = useState(false);

  // Fetch data
  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [sessionsRes, logsRes, settingsRes] = await Promise.all([
        api.get('/admin/sessions'),
        api.get('/admin/activity-logs'),
        api.get('/settings').catch(() => ({ data: {} }))
      ]);

      if (sessionsRes.data) {
        setSessions(sessionsRes.data.sessions || {});
        if (sessionsRes.data.stats) {
          setSessionStats(sessionsRes.data.stats);
        }
      }

      if (logsRes.data) {
        setLogs(logsRes.data.logs || []);
        if (logsRes.data.stats) {
          setLogStats(logsRes.data.stats);
        }
      }

      if (settingsRes.data?.sessionTimeout) {
        const hours = Math.round(settingsRes.data.sessionTimeout / (1000 * 60 * 60));
        setSessionTimeoutHours(String(hours || 2));
      }

      setLastUpdated(new Date());
    } catch {
      if (isManual) toast.error('Failed to refresh data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh interval (15s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Copy helper
  const handleCopy = (text, keyName, label = 'Copied to clipboard') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    toast.success(label);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Safe relative time helper
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '—';
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return '—';
    }
  };

  // Safe full date time
  const formatFullDateTime = (timestamp) => {
    if (!timestamp) return '—';
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return '—';
    }
  };

  // Revoke single session
  const handleRevokeSingle = async () => {
    if (!confirmRevokeToken) return;
    setActionLoading(true);
    try {
      const res = await api.delete(`/admin/sessions/${confirmRevokeToken}`);
      toast.success('Session successfully revoked');
      if (res.data?.selfRevoked) {
        window.location.reload();
        return;
      }
      setSessions(prev => {
        const next = { ...prev };
        delete next[confirmRevokeToken];
        return next;
      });
      fetchData(false);
      setConfirmRevokeToken(null);
    } catch {
      toast.error('Failed to revoke session.');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke all other sessions
  const handleRevokeAllOthers = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/admin/sessions/revoke-all', { exceptCurrent: true });
      toast.success(`Revoked ${res.data?.revokedCount || 0} active sessions.`);
      setConfirmRevokeAll(false);
      fetchData(false);
    } catch {
      toast.error('Failed to revoke sessions.');
    } finally {
      setActionLoading(false);
    }
  };

  // Clean expired sessions
  const handleCleanExpired = async () => {
    try {
      const res = await api.post('/admin/sessions/clean-expired');
      const count = res.data?.cleanedCount || 0;
      if (count > 0) {
        toast.success(`Purged ${count} expired session(s).`);
      } else {
        toast.success('No expired sessions found. All active sessions are valid.');
      }
      fetchData(false);
    } catch {
      toast.error('Failed to clean sessions.');
    }
  };

  // Clear activity logs
  const handleClearLogs = async () => {
    setActionLoading(true);
    try {
      await api.delete('/admin/activity-logs');
      toast.success('Activity logs cleared successfully.');
      setLogs([]);
      setConfirmClearLogs(false);
      fetchData(false);
    } catch {
      toast.error('Failed to clear logs.');
    } finally {
      setActionLoading(false);
    }
  };

  // Quick impersonate from session
  const handleImpersonateUser = async (session) => {
    if (!session || !session.userId) return;
    if (session.role === 'admin') {
      toast('Cannot impersonate administrator account', { icon: 'ℹ️' });
      return;
    }
    try {
      const res = await api.post(`/admin/impersonate/${session.role}/${session.userId}`);
      toast.success(`Impersonating ${session.role} ${session.meta?.name || session.userId}`);
      startImpersonation(res.data.token, res.data.user, session.role, {
        section: session.meta?.section || ''
      });
    } catch {
      toast.error('Impersonation failed.');
    }
  };

  // Save session timeout
  const handleSaveTimeout = async () => {
    setSavingTimeout(true);
    try {
      const ms = Number(sessionTimeoutHours) * 60 * 60 * 1000;
      await api.put('/settings', { sessionTimeout: ms });
      toast.success(`Session timeout updated to ${sessionTimeoutHours} hour(s)`);
      fetchData(false);
    } catch {
      toast.error('Failed to update session timeout.');
    } finally {
      setSavingTimeout(false);
    }
  };

  // Export logs to CSV
  const exportToCSV = () => {
    if (!logs.length) {
      toast.error('No activity logs to export.');
      return;
    }
    const headers = ['Timestamp', 'Date & Time', 'User ID', 'Role', 'Action', 'Category', 'Details', 'IP Address', 'Device', 'OS', 'Browser'];
    const rows = filteredLogs.map(l => [
      `"${l.timestamp || ''}"`,
      `"${formatFullDateTime(l.timestamp)}"`,
      `"${l.userId || ''}"`,
      `"${l.role || ''}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${l.category || 'system'}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${l.ip || '127.0.0.1'}"`,
      `"${l.device || 'Desktop'}"`,
      `"${l.os || 'Unknown'}"`,
      `"${l.browser || 'Unknown'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GradePortal_AuditLogs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredLogs.length} audit logs to CSV`);
  };

  // Export logs to JSON
  const exportToJSON = () => {
    if (!logs.length) {
      toast.error('No activity logs to export.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `GradePortal_AuditLogs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredLogs.length} audit logs to JSON`);
  };

  // Device icon renderer
  const renderDeviceIcon = (deviceType) => {
    const d = (deviceType || '').toLowerCase();
    if (d === 'mobile') return <Smartphone size={14} className="text-muted" />;
    if (d === 'tablet') return <Tablet size={14} className="text-muted" />;
    return <Monitor size={14} className="text-muted" />;
  };

  // Category badge & icon
  const getCategoryMeta = (catName, actionName = '') => {
    const cat = (catName || '').toLowerCase();
    const act = (actionName || '').toLowerCase();

    if (cat === 'auth' || act.includes('login') || act.includes('logout')) {
      return {
        label: 'Auth',
        className: 'sys-cat-auth',
        icon: act.includes('logout') ? <LogOut size={12} /> : <LogIn size={12} />
      };
    }
    if (cat === 'cloud' || act.includes('sync')) {
      return {
        label: 'Cloud Sync',
        className: 'sys-cat-cloud',
        icon: <Cloud size={12} />
      };
    }
    if (cat === 'impersonation' || act.includes('impersonate')) {
      return {
        label: 'Impersonate',
        className: 'sys-cat-impersonation',
        icon: <UserCheck size={12} />
      };
    }
    if (cat === 'security' || act.includes('password') || act.includes('suspend') || act.includes('revoke')) {
      return {
        label: 'Security',
        className: 'sys-cat-security',
        icon: <Key size={12} />
      };
    }
    if (cat === 'settings' || act.includes('setting') || act.includes('backup') || act.includes('template')) {
      return {
        label: 'Config',
        className: 'sys-cat-settings',
        icon: <Sliders size={12} />
      };
    }
    if (cat === 'academic' || act.includes('grade') || act.includes('score')) {
      return {
        label: 'Academic',
        className: 'sys-cat-academic',
        icon: <Database size={12} />
      };
    }
    return {
      label: 'System',
      className: 'sys-cat-system',
      icon: <Activity size={12} />
    };
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let list = Object.entries(sessions).map(([token, s]) => ({ token, ...s }));

    if (sessionSearch.trim()) {
      const q = sessionSearch.toLowerCase().trim();
      list = list.filter(s => {
        const name = (s.meta?.name || '').toLowerCase();
        const uid = (s.userId || '').toLowerCase();
        const role = (s.role || '').toLowerCase();
        const ip = (s.ip || '').toLowerCase();
        const browser = (s.browser || '').toLowerCase();
        const os = (s.os || '').toLowerCase();
        return name.includes(q) || uid.includes(q) || role.includes(q) || ip.includes(q) || browser.includes(q) || os.includes(q);
      });
    }

    if (sessionRoleFilter !== 'all') {
      list = list.filter(s => s.role === sessionRoleFilter);
    }

    if (sessionDeviceFilter !== 'all') {
      list = list.filter(s => (s.device || 'Desktop').toLowerCase() === sessionDeviceFilter.toLowerCase());
    }

    // Sort
    list.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      if (sessionSort === 'longest') {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      if (sessionSort === 'name') {
        const nameA = a.meta?.name || a.userId || '';
        const nameB = b.meta?.name || b.userId || '';
        return nameA.localeCompare(nameB);
      }
      // default: recent activity
      return (b.lastActive || b.createdAt || 0) - (a.lastActive || a.createdAt || 0);
    });

    return list;
  }, [sessions, sessionSearch, sessionRoleFilter, sessionDeviceFilter, sessionSort]);

  // Filtered activity logs
  const filteredLogs = useMemo(() => {
    let list = [...logs];

    if (logSearch.trim()) {
      const q = logSearch.toLowerCase().trim();
      list = list.filter(l => {
        const uid = (l.userId || '').toLowerCase();
        const role = (l.role || '').toLowerCase();
        const act = (l.action || '').toLowerCase();
        const det = (l.details || '').toLowerCase();
        const ip = (l.ip || '').toLowerCase();
        return uid.includes(q) || role.includes(q) || act.includes(q) || det.includes(q) || ip.includes(q);
      });
    }

    if (logRoleFilter !== 'all') {
      list = list.filter(l => l.role === logRoleFilter);
    }

    if (logCategoryFilter !== 'all') {
      list = list.filter(l => {
        const meta = getCategoryMeta(l.category, l.action);
        return meta.label.toLowerCase().includes(logCategoryFilter.toLowerCase());
      });
    }

    if (logDateFilter !== 'all') {
      const now = Date.now();
      list = list.filter(l => {
        const ts = new Date(l.timestamp).getTime();
        if (isNaN(ts)) return true;
        if (logDateFilter === 'today') {
          return new Date(ts).toDateString() === new Date().toDateString();
        }
        if (logDateFilter === '7d') {
          return now - ts <= 7 * 24 * 60 * 60 * 1000;
        }
        if (logDateFilter === '30d') {
          return now - ts <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      });
    }

    return list;
  }, [logs, logSearch, logRoleFilter, logCategoryFilter, logDateFilter]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
        <LoadingSpinner size="lg" />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading system logs and active sessions...</span>
      </div>
    );
  }

  return (
    <div className="sys-container fade-in">
      {/* ─── METRIC OVERVIEW CARDS ────────────────────────────────────────────── */}
      <div className="sys-stats-grid">
        {/* Card 1: Active Sessions */}
        <div 
          className={`sys-stat-card ${subTab === 'sessions' ? 'active-tab' : ''}`}
          onClick={() => setSubTab('sessions')}
          title="Click to view and manage Active Sessions"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Sessions
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {sessionStats.total || Object.keys(sessions).length}
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                <span className="sys-pulse-dot sys-pulse-green" style={{ width: 6, height: 6 }} /> Live
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {sessionStats.adminCount || 0} Admin • {sessionStats.teacherCount || 0} Faculty • {sessionStats.studentCount || 0} Student
            </span>
          </div>
          <div className="sys-stat-icon-wrapper sys-stat-icon-emerald">
            <Users size={22} />
          </div>
        </div>

        {/* Card 2: Active Now (Live Activity) */}
        <div 
          className="sys-stat-card"
          onClick={() => setSubTab('sessions')}
          title="Users active in the past 15 minutes"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Now (&lt;15m)
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--violet-700)', lineHeight: 1 }}>
                {sessionStats.activeNow || 0}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>online now</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Auto-sync every 15s
            </span>
          </div>
          <div className="sys-stat-icon-wrapper sys-stat-icon-violet">
            <Activity size={22} />
          </div>
        </div>

        {/* Card 3: Total Audit Trail */}
        <div 
          className={`sys-stat-card ${subTab === 'logs' ? 'active-tab' : ''}`}
          onClick={() => setSubTab('logs')}
          title="Click to view and audit Activity Logs"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Activity Logs
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {logStats.total || logs.length}
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                +{logStats.today || 0} today
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Full audit trail preserved
            </span>
          </div>
          <div className="sys-stat-icon-wrapper sys-stat-icon-blue">
            <ShieldCheck size={22} />
          </div>
        </div>

        {/* Card 4: Session Security Policy */}
        <div 
          className={`sys-stat-card ${subTab === 'security' ? 'active-tab' : ''}`}
          onClick={() => setSubTab('security')}
          title="Click to configure session timeout and security policies"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Session Policy
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {sessionTimeoutHours}h
              </span>
              <span className="badge badge-brand" style={{ fontSize: '0.7rem' }}>
                Timeout
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              Auto-invalidate on idle
            </span>
          </div>
          <div className="sys-stat-icon-wrapper sys-stat-icon-amber">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* ─── SUB-NAVIGATION & TOOLBAR ───────────────────────────────────────── */}
      <div className="sys-subnav-bar">
        <div className="sys-subnav-pills">
          <button 
            className={`sys-subnav-btn ${subTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setSubTab('sessions')}
          >
            <Users size={16} />
            <span>Active Sessions</span>
            <span className="pill-badge">{Object.keys(sessions).length}</span>
          </button>

          <button 
            className={`sys-subnav-btn ${subTab === 'logs' ? 'active' : ''}`}
            onClick={() => setSubTab('logs')}
          >
            <Activity size={16} />
            <span>Activity Audit Logs</span>
            <span className="pill-badge">{logs.length}</span>
          </button>

          <button 
            className={`sys-subnav-btn ${subTab === 'security' ? 'active' : ''}`}
            onClick={() => setSubTab('security')}
          >
            <Shield size={16} />
            <span>Security & Policies</span>
          </button>
        </div>

        {/* Global Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            className={`sys-auto-refresh-indicator ${autoRefresh ? 'enabled' : ''}`}
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Auto-refresh is active (every 15s). Click to pause.' : 'Auto-refresh is paused. Click to enable.'}
          >
            <span className={`sys-pulse-dot ${autoRefresh ? 'sys-pulse-green' : 'sys-pulse-amber'}`} />
            <span>{autoRefresh ? 'Live (15s)' : 'Paused'}</span>
          </button>

          <button 
            className="btn btn-ghost btn-sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            title="Refresh now"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'spinner' : ''} />
            <span style={{ fontSize: '0.8125rem' }}>Refresh</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SUB-TAB 1: ACTIVE SESSIONS
          ══════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'sessions' && (
        <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header & Controls */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Active System Sessions
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Real-time tracking of authenticated portal sessions across administrative, faculty, and student portals.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={handleCleanExpired}
                title="Purge all sessions older than the timeout threshold"
                style={{ fontSize: '0.8125rem' }}
              >
                <Clock size={14} /> Clean Expired
              </button>

              <button 
                className="btn btn-danger btn-sm"
                onClick={() => setConfirmRevokeAll(true)}
                disabled={Object.keys(sessions).length <= 1}
                title="Revoke all sessions except your current session"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}
              >
                <AlertTriangle size={14} /> Revoke All Others
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="sys-filter-toolbar">
            <div className="search-wrapper" style={{ minWidth: 260, flex: '1 1 260px' }}>
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search by user, ID, IP address, device..." 
                value={sessionSearch} 
                onChange={e => setSessionSearch(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>

            <div className="sys-filter-group">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Role:</span>
              {['all', 'admin', 'teacher', 'student'].map(r => (
                <button 
                  key={r}
                  className={`sys-filter-chip ${sessionRoleFilter === r ? 'active' : ''}`}
                  onClick={() => setSessionRoleFilter(r)}
                >
                  {r === 'all' ? 'All Roles' : (r === 'admin' ? 'Admins' : (r === 'teacher' ? 'Faculty' : 'Students'))}
                </button>
              ))}
            </div>

            <div className="sys-filter-group">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Device:</span>
              {['all', 'Desktop', 'Mobile'].map(d => (
                <button 
                  key={d}
                  className={`sys-filter-chip ${sessionDeviceFilter === d ? 'active' : ''}`}
                  onClick={() => setSessionDeviceFilter(d)}
                >
                  {d === 'all' ? 'All Devices' : d}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            {filteredSessions.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--violet-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--violet-400)' }}>
                  <Users size={28} />
                </div>
                <h4 style={{ margin: 0, fontWeight: 700 }}>No matching sessions found</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Try resetting your search query or filters.
                </p>
                {(sessionSearch || sessionRoleFilter !== 'all' || sessionDeviceFilter !== 'all') && (
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setSessionSearch(''); setSessionRoleFilter('all'); setSessionDeviceFilter('all'); }}
                    style={{ marginTop: 8 }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User & Identity</th>
                    <th>Role</th>
                    <th>Device & Client</th>
                    <th>IP Address</th>
                    <th>Session Timeline</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(s => {
                    const isSelf = !!s.isCurrent;
                    const userName = s.meta?.name || s.userId || 'Unknown';
                    const initials = userName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
                    const roleColor = {
                      admin: 'badge-brand',
                      teacher: 'badge-warning',
                      student: 'badge-info'
                    }[s.role] || 'badge-neutral';

                    return (
                      <tr key={s.token} className={isSelf ? 'sys-current-session-row' : ''}>
                        {/* User Identity */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div className="avatar" style={{ width: 34, height: 34, fontSize: '0.75rem' }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                  {userName}
                                </span>
                                {isSelf && (
                                  <span className="badge badge-brand" style={{ fontSize: '0.6875rem', padding: '1px 7px' }}>
                                    This Device
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                ID: {s.userId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td>
                          <span className={`badge ${roleColor}`} style={{ textTransform: 'capitalize' }}>
                            {s.role}
                          </span>
                        </td>

                        {/* Device & Client */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div className="sys-device-tag">
                              {renderDeviceIcon(s.device)}
                              <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                                {s.device || 'Desktop'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {s.browser || 'Browser'} on {s.os || 'OS'}
                            </span>
                          </div>
                        </td>

                        {/* IP Address */}
                        <td>
                          <button 
                            className="sys-ip-badge"
                            onClick={() => handleCopy(s.ip || '127.0.0.1', s.token + '_ip', 'IP address copied')}
                            title="Click to copy IP address"
                          >
                            <Globe size={11} color="var(--text-muted)" />
                            <span>{s.ip || '127.0.0.1'}</span>
                            {copiedKey === s.token + '_ip' ? <Check size={11} color="var(--color-success)" /> : <Copy size={11} color="var(--text-muted)" />}
                          </button>
                        </td>

                        {/* Timeline */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {formatRelativeTime(s.lastActive || s.createdAt)}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Since {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          {s.activeNow ? (
                            <span className="badge badge-success" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span className="sys-pulse-dot sys-pulse-green" /> Active
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span className="sys-pulse-dot sys-pulse-amber" /> Idle
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {s.role !== 'admin' && (
                              <button 
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleImpersonateUser(s)}
                                title={`Impersonate ${s.meta?.name || s.userId}`}
                                style={{ padding: '5px 8px' }}
                              >
                                <UserCheck size={14} color="var(--violet-600)" />
                              </button>
                            )}

                            <button 
                              className={`btn btn-sm ${isSelf ? 'btn-ghost' : 'btn-danger'}`}
                              onClick={() => setConfirmRevokeToken(s.token)}
                              title={isSelf ? 'Sign out this session' : 'Revoke session'}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: '0.78rem' }}
                            >
                              <Trash2 size={13} />
                              <span>{isSelf ? 'End Session' : 'Revoke'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer status */}
          <div style={{ padding: '12px 20px', background: 'var(--bg-panel)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <span>
              Showing {filteredSessions.length} of {Object.keys(sessions).length} active sessions
            </span>
            <span>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          SUB-TAB 2: ACTIVITY AUDIT LOGS
          ══════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'logs' && (
        <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header & Controls */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                System Activity Audit Trail
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Complete chronological log of authentication events, grade synchronization, impersonations, and settings updates.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={exportToCSV}
                title="Download filtered audit logs as CSV"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}
              >
                <Download size={14} /> Export CSV
              </button>

              <button 
                className="btn btn-secondary btn-sm"
                onClick={exportToJSON}
                title="Download filtered audit logs as JSON"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}
              >
                <Database size={14} /> Export JSON
              </button>

              <button 
                className="btn btn-danger btn-sm"
                onClick={() => setConfirmClearLogs(true)}
                disabled={logs.length === 0}
                title="Clear all system activity logs"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem' }}
              >
                <Trash2 size={14} /> Clear Logs
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="sys-filter-toolbar">
            <div className="search-wrapper" style={{ minWidth: 260, flex: '1 1 260px' }}>
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search audit events by user, action, narrative, IP..." 
                value={logSearch} 
                onChange={e => { setLogSearch(e.target.value); setCurrentPage(1); }} 
                style={{ width: '100%' }}
              />
            </div>

            {/* Role Filter */}
            <div className="sys-filter-group">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Role:</span>
              {['all', 'admin', 'teacher', 'student', 'system'].map(r => (
                <button 
                  key={r}
                  className={`sys-filter-chip ${logRoleFilter === r ? 'active' : ''}`}
                  onClick={() => { setLogRoleFilter(r); setCurrentPage(1); }}
                >
                  {r === 'all' ? 'All' : (r === 'admin' ? 'Admin' : (r === 'teacher' ? 'Faculty' : (r === 'student' ? 'Student' : 'System')))}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <div className="sys-filter-group">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Type:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'auth', label: 'Auth' },
                { id: 'cloud', label: 'Sync' },
                { id: 'impersonate', label: 'Impersonate' },
                { id: 'security', label: 'Security' },
                { id: 'config', label: 'Config' }
              ].map(c => (
                <button 
                  key={c.id}
                  className={`sys-filter-chip ${logCategoryFilter === c.id ? 'active' : ''}`}
                  onClick={() => { setLogCategoryFilter(c.id); setCurrentPage(1); }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Date Preset */}
            <div className="sys-filter-group">
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Time:</span>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' }
              ].map(d => (
                <button 
                  key={d.id}
                  className={`sys-filter-chip ${logDateFilter === d.id ? 'active' : ''}`}
                  onClick={() => { setLogDateFilter(d.id); setCurrentPage(1); }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0, minHeight: 300 }}>
            {filteredLogs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--violet-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--violet-400)' }}>
                  <ShieldCheck size={28} />
                </div>
                <h4 style={{ margin: 0, fontWeight: 700 }}>No activity records match your criteria</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Adjust the search term, role, or category filters.
                </p>
                {(logSearch || logRoleFilter !== 'all' || logCategoryFilter !== 'all' || logDateFilter !== 'all') && (
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setLogSearch(''); setLogRoleFilter('all'); setLogCategoryFilter('all'); setLogDateFilter('all'); }}
                    style={{ marginTop: 8 }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User / Actor</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Origin</th>
                    <th style={{ textAlign: 'right' }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map(l => {
                    const meta = getCategoryMeta(l.category, l.action);
                    return (
                      <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setInspectLog(l)}>
                        {/* Timestamp */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {formatFullDateTime(l.timestamp)}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {formatRelativeTime(l.timestamp)}
                            </span>
                          </div>
                        </td>

                        {/* Actor */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.7rem' }}>
                              {(l.userId || 'U')[0].toUpperCase()}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                                {l.userId}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                {l.role}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td>
                          <span className={`sys-category-badge ${meta.className}`}>
                            {meta.icon}
                            <span>{l.action}</span>
                          </span>
                        </td>

                        {/* Details */}
                        <td style={{ maxWidth: 360 }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {l.details || '—'}
                          </span>
                        </td>

                        {/* Origin */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {renderDeviceIcon(l.device)}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {l.ip || '127.0.0.1'}
                            </span>
                          </div>
                        </td>

                        {/* Inspect */}
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => { e.stopPropagation(); setInspectLog(l); }}
                            title="Inspect log event details"
                            style={{ padding: '4px 8px' }}
                          >
                            <Eye size={14} color="var(--violet-600)" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Bar */}
          <div className="sys-pagination">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>
                Showing {filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} events
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.78rem' }}>Per page:</span>
                <select 
                  className="form-input" 
                  style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto' }}
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '4px 8px' }}
              >
                <ChevronLeft size={16} /> Previous
              </button>

              <span style={{ fontSize: '0.8125rem', padding: '0 8px', fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>

              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                style={{ padding: '4px 8px' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          SUB-TAB 3: SECURITY & POLICIES
          ══════════════════════════════════════════════════════════════════════════ */}
      {subTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card 1: Session Expiration Policy */}
          <div className="card fade-in">
            <div className="card-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                Portal Session Timeout Policy
              </h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Configure the maximum duration of inactivity before an authenticated session is automatically invalidated. 
                Shorter session timeouts increase security against unauthorized access on shared school workstations.
              </p>

              <div>
                <label className="form-label" style={{ marginBottom: 10 }}>Session Inactivity Expiration Threshold</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                  {[
                    { value: '1', label: '1 Hour' },
                    { value: '2', label: '2 Hours (Default)' },
                    { value: '4', label: '4 Hours' },
                    { value: '8', label: '8 Hours' },
                    { value: '24', label: '24 Hours' },
                    { value: '168', label: '7 Days' }
                  ].map(opt => (
                    <div 
                      key={opt.value}
                      onClick={() => setSessionTimeoutHours(opt.value)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${sessionTimeoutHours === opt.value ? 'var(--violet-500)' : 'var(--border)'}`,
                        background: sessionTimeoutHours === opt.value ? 'var(--violet-50)' : 'var(--bg-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: sessionTimeoutHours === opt.value ? 'var(--violet-700)' : 'var(--text-primary)' }}>
                        {opt.label}
                      </span>
                      {sessionTimeoutHours === opt.value && <CheckCircle size={15} color="var(--violet-600)" />}
                    </div>
                  ))}
                </div>
              </div>

              <button 
                className="btn btn-primary"
                onClick={handleSaveTimeout}
                disabled={savingTimeout}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                {savingTimeout ? <><LoadingSpinner /> Saving Policy...</> : 'Save Session Policy'}
              </button>
            </div>
          </div>

          {/* Card 2: Security Hygiene & Audit Storage */}
          <div className="card fade-in">
            <div className="card-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                System Hygiene & Audit Retention
              </h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--violet-100)', color: 'var(--violet-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={16} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Purge Stale Sessions</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    Removes all tokens that have exceeded the inactivity window to keep the session database compact.
                  </p>
                  <button className="btn btn-secondary btn-sm" onClick={handleCleanExpired}>
                    Purge Stale Now
                  </button>
                </div>

                <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <HardDrive size={16} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Full System Backup</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    Download a complete compressed archive containing Excel grades, settings, profiles, and audit records.
                  </p>
                  <a href="/api/admin/backup" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Download size={14} /> Download Backup
                  </a>
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'var(--violet-50)', borderRadius: 10, border: '1px solid var(--violet-200)', fontSize: '0.8125rem', color: 'var(--violet-800)', lineHeight: 1.6 }}>
                <strong>Note on Audit Retention:</strong> The server automatically retains up to <strong>2,000</strong> historical audit trail entries in <code>activity_logs.json</code> with automatic FIFO rotation. For long-term administrative archival, use the <strong>Export CSV</strong> button regularly.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: INSPECT ACTIVITY LOG ──────────────────────────────────────── */}
      <Modal 
        open={!!inspectLog} 
        onClose={() => setInspectLog(null)} 
        title="Audit Event Inspector" 
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Event ID: {inspectLog?.id || '—'}
            </span>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleCopy(JSON.stringify(inspectLog, null, 2), 'raw_json', 'JSON copied to clipboard')}
            >
              <Copy size={14} /> Copy JSON
            </button>
          </div>
        }
      >
        {inspectLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`sys-category-badge ${getCategoryMeta(inspectLog.category, inspectLog.action).className}`} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                  {getCategoryMeta(inspectLog.category, inspectLog.action).icon}
                  <span>{inspectLog.action}</span>
                </span>
                <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                  Role: {inspectLog.role}
                </span>
              </div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {formatFullDateTime(inspectLog.timestamp)}
              </span>
            </div>

            {/* Grid attributes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ padding: 10, background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Actor ID</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.9rem' }}>{inspectLog.userId}</p>
              </div>

              <div style={{ padding: 10, background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Client IP</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{inspectLog.ip || '127.0.0.1'}</p>
              </div>

              <div style={{ padding: 10, background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Device & Platform</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.9rem' }}>
                  {inspectLog.device || 'Desktop'} ({inspectLog.browser || 'Browser'} / {inspectLog.os || 'OS'})
                </p>
              </div>

              <div style={{ padding: 10, background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Elapsed Time</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.9rem' }}>{formatRelativeTime(inspectLog.timestamp)}</p>
              </div>
            </div>

            {/* Narrative */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Event Narrative / Details
              </span>
              <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                {inspectLog.details || 'No additional narrative recorded.'}
              </div>
            </div>

            {/* Raw JSON */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Raw Audit Payload
              </span>
              <pre className="sys-code-block">
                {JSON.stringify(inspectLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── CONFIRM MODAL: REVOKE SINGLE SESSION ─────────────────────────────── */}
      <ConfirmModal 
        open={!!confirmRevokeToken}
        onClose={() => setConfirmRevokeToken(null)}
        onConfirm={handleRevokeSingle}
        loading={actionLoading}
        title="Revoke Session Authorization"
        message="Are you sure you want to revoke this session? The target user will be immediately signed out and must log in again."
        confirmLabel="Revoke Session"
        variant="danger"
      />

      {/* ─── CONFIRM MODAL: REVOKE ALL OTHER SESSIONS ─────────────────────────── */}
      <ConfirmModal 
        open={confirmRevokeAll}
        onClose={() => setConfirmRevokeAll(false)}
        onConfirm={handleRevokeAllOthers}
        loading={actionLoading}
        title="Revoke All Other Sessions"
        message={`Are you sure you want to terminate all other active sessions? All teachers and students currently logged in will be disconnected immediately. Your current administrator session will remain active.`}
        confirmLabel="Revoke All Others"
        variant="danger"
      />

      {/* ─── CONFIRM MODAL: CLEAR ACTIVITY LOGS ───────────────────────────────── */}
      <ConfirmModal 
        open={confirmClearLogs}
        onClose={() => setConfirmClearLogs(false)}
        onConfirm={handleClearLogs}
        loading={actionLoading}
        title="Clear Activity Audit Trail"
        message="This action will delete all historical activity logs currently stored in the system. Consider downloading a CSV or JSON export first for recordkeeping. Proceed with clearing logs?"
        confirmLabel="Clear All Logs"
        variant="danger"
      />
    </div>
  );
}
