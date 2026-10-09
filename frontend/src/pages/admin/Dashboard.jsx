import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, FileUp, Settings, Trash2, Edit3, Plus, Download, RotateCcw, Search, ChevronRight, Eye, BarChart2, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { AppLayout, PageHeader, GradePill, EmptyState, LoadingSpinner, Modal, ConfirmModal } from '../../components/Layout';
import { useAuth } from '../../App';
import { Shield, Clock, HardDrive, Key, UserCheck, AlertTriangle, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

// ─── Overview Page ─────────────────────────────────────────────────────────────
function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadStats = async () => {
    try {
      const [status, statsRes] = await Promise.all([api.get('/status'), api.get('/admin/statistics')]);
      setStats({ ...statsRes.data, status: status.data });
    } catch { toast.error('Failed to load statistics.'); }
    finally { setLoading(false); }
  };

  const handleDownloadBackup = async () => {
    try {
      const toastId = toast.loading('Generating backup...');
      const response = await api.get('/admin/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `GradePortal_Backup_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Backup downloaded!', { id: toastId });
    } catch (err) {
      toast.error('Failed to download backup.');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/admin/sync');
      toast.success('Data synced successfully.');
      loadStats();
    } catch { toast.error('Sync failed.'); }
    finally { setSyncing(false); }
  };

  useEffect(() => { loadStats(); }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;
  const ov = stats?.overview || {};

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 10 }}>
        <a className="btn btn-primary btn-sm" href="/api/admin/backup" download>
          <HardDrive size={14} /> Download Backup
        </a>
        <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <LoadingSpinner /> : <RefreshCw size={14} />} Sync Data
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 32 }}>
        {[
          { label: 'Total Students', value: ov.totalStudents || 0, icon: Users, colorClass: 'brand' },
          { label: 'Total Subjects', value: ov.totalSubjects || 0, icon: BookOpen, colorClass: 'green' },
          { label: 'Files Loaded', value: stats?.status?.filesLoaded || 0, icon: FileUp, colorClass: 'blue' },
          { label: 'Last Sync', value: stats?.status?.lastSync ? new Date(stats.status.lastSync).toLocaleTimeString() : '—', icon: RefreshCw, colorClass: 'amber' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ 
            transition: 'transform 0.2s, box-shadow 0.2s', 
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
            <div className={`stat-icon ${s.colorClass}`}><s.icon size={24} /></div>
            <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8, marginBottom: 4 }}>{s.value}</div>
            <div className="stat-label" style={{ fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: '0.75rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Subject Stats Table */}
      <div className="card">
        <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Subject Statistics</h3></div>
        <div className="table-wrapper" style={{ borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr><th>Subject</th><th>Section</th><th>Grade Level</th><th>Instructor</th><th>Students</th><th>Graded</th><th>Average</th><th>Pass Rate</th><th>Passed</th><th>Failed</th></tr>
            </thead>
            <tbody>
              {(stats?.subjectStats || []).map((s, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{s.subject}</td>
                  <td>{s.section || '—'}</td>
                  <td>{s.gradeLevel || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{s.instructor || '—'}</td>
                  <td>{s.totalStudents}</td>
                  <td>{s.gradedStudents}</td>
                  <td><GradePill grade={s.average} /></td>
                  <td>
                    {s.passRate !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress" style={{ width: 60 }}><div className="progress-bar success" style={{ width: `${s.passRate}%` }} /></div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{s.passRate}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td><span className="badge badge-success">{s.passed}</span></td>
                  <td><span className="badge badge-error">{s.failed}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Teachers Management ───────────────────────────────────────────────────────
function TeachersPage() {
  const { login } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'classes'
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ username: '', name: '', email: '', department: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState([]);

  const load = async () => {
    try { const r = await api.get('/admin/teachers'); setTeachers(r.data.teachers || []); }
    catch { toast.error('Failed to load teachers.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ username: '', name: '', email: '', department: '', password: '' }); setModal('add'); };
  const openEdit = (t) => { setSelected(t); setForm({ username: t.username, name: t.name, email: t.email || '', department: t.department || '', password: '' }); setModal('edit'); };
  const openClasses = async (t) => {
    setSelected(t); setModal('classes'); setTeacherClasses([]);
    try { const r = await api.get(`/admin/teacher/${t.username}/classes`); setTeacherClasses(r.data.classes || []); }
    catch { toast.error('Failed to load teacher classes.'); }
  };

  const toggleStatus = async (t) => {
    try {
      const newStatus = t.status === 'suspended' ? 'active' : 'suspended';
      await api.put(`/admin/users/${t.username}/status`, { status: newStatus });
      toast.success('Status updated');
      load();
    } catch { toast.error('Update failed'); }
  };

  const handleImpersonate = async (t) => {
    try {
      const res = await api.post(`/admin/impersonate/teacher/${t.username}`);
      toast.success('Impersonating teacher');
      localStorage.setItem('admin_return_token', localStorage.getItem('gp_token'));
      login(res.data.token, { id: t.username, name: t.name, department: t.department }, 'teacher');
    } catch { toast.error('Impersonation failed'); }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.username.trim()) { toast.error('Name and username are required.'); return; }
    setSaving(true);
    try {
      if (modal === 'add') {
        if (!form.password.trim()) { toast.error('Password is required for new teacher.'); setSaving(false); return; }
        await api.post('/admin/teachers', form);
        toast.success('Teacher added!');
      } else {
        await api.put(`/admin/teachers/${selected.username}`, { ...form, newUsername: form.username });
        toast.success('Teacher updated!');
      }
      setModal(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await api.delete(`/admin/teachers/${confirmDelete.username}`); toast.success('Teacher deleted.'); setConfirmDelete(null); load(); }
    catch { toast.error('Delete failed.'); }
    finally { setDeleting(false); }
  };

  const filtered = teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input type="text" className="search-input" placeholder="Search teachers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={14} /> Add Teacher
        </button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          <div className="table-wrapper" style={{ borderRadius: 0 }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Department</th><th>Classes</th><th>Added</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{t.username}</td>
                    <td><span className={`badge ${t.status === 'suspended' ? 'badge-error' : 'badge-success'}`}>{t.status || 'active'}</span></td>
                    <td>{t.department || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openClasses(t)}>
                        <Eye size={13} /> {(t.files || []).length} classes
                      </button>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}><Edit3 size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(t)} style={{ color: 'var(--color-error)' }}><Trash2 size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleImpersonate(t)} title="Impersonate"><UserCheck size={13}/></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(t)} title={t.status === 'suspended' ? 'Activate' : 'Suspend'}><Shield size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Teacher' : 'Edit Teacher'} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <LoadingSpinner /> : 'Save'}</button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['name', 'Full Name', 'text', true], ['username', 'Username / Login ID', 'text', true], ['email', 'Email', 'email', false], ['department', 'Department', 'text', false], ['password', modal === 'add' ? 'Password *' : 'New Password (leave blank to keep)', 'password', modal === 'add']].map(([k, label, type, req]) => (
            <div key={k} className="form-group">
              <label className="form-label">{label} {req && <span>*</span>}</label>
              <input className="form-input" type={type} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={label} />
            </div>
          ))}
        </div>
      </Modal>

      {/* Classes View Modal */}
      <Modal open={modal === 'classes'} onClose={() => setModal(null)} title={`${selected?.name}'s Classes`} size="md">
        {teacherClasses.length === 0 ? <EmptyState icon={BookOpen} title="No classes" description="This teacher has no uploaded grade sheets." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {teacherClasses.map((cls, i) => (
              <div key={i} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{cls.subject || cls.fileName}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{cls.section} • {cls.studentCount} students</p>
                </div>
                <GradePill grade={null} />
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} loading={deleting} title="Delete Teacher" message={`Are you sure you want to delete "${confirmDelete?.name}"? This cannot be undone.`} confirmLabel="Delete" variant="danger" />
    </div>
  );
}

// ─── Templates Management ──────────────────────────────────────────────────────
function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reverting, setReverting] = useState(null);

  const load = async () => {
    try { const r = await api.get('/admin/templates'); setTemplates(r.data.templates || []); }
    catch { toast.error('Failed to load templates.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    onDrop: async (files) => {
      if (!files.length) return;
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('template', files[0]);
        await api.post('/admin/templates/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Template uploaded!');
        load();
      } catch (err) { toast.error(err.response?.data?.error || 'Upload failed.'); }
      finally { setUploading(false); }
    }
  });

  const handleDelete = async () => {
    setDeleting(true);
    try { await api.delete(`/admin/templates/${encodeURIComponent(confirmDelete)}`); toast.success('Template deleted.'); setConfirmDelete(null); load(); }
    catch { toast.error('Delete failed.'); }
    finally { setDeleting(false); }
  };

  const handleRevert = async (name) => {
    setReverting(name);
    try { await api.post(`/admin/templates/revert/${encodeURIComponent(name)}`); toast.success('Template reverted to previous version.'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Revert failed.'); }
    finally { setReverting(null); }
  };

  return (
    <div className="page-content fade-in">
      <div className="grid-2" style={{ alignItems: 'start', gap: 24 }}>
        <div>
          <h3 style={{ fontWeight: 800, marginBottom: 16 }}>Grade Templates</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
            Upload Excel grade sheet templates here. Teachers can download and use these as their starting point.
          </p>
          {loading ? <LoadingSpinner /> : templates.length === 0 ? (
            <EmptyState icon={FileUp} title="No templates yet" description="Upload a template below to get started." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {templates.map((t, i) => (
                <div key={i} className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ color: 'var(--violet-500)', display: 'flex', alignItems: 'center' }}>
                          <FileSpreadsheet size={18} />
                        </div>
                        <p style={{ 
                          fontWeight: 600, 
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: '0.95rem'
                        }} title={t.name}>
                          {t.name}
                        </p>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', paddingLeft: 28 }}>
                        {(t.size / 1024).toFixed(1)} KB &bull; {t.lastModified ? new Date(t.lastModified).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <a className="btn btn-secondary btn-sm" href={`/api/admin/templates/download/${encodeURIComponent(t.name)}`} download title="Download Template"><Download size={14} /></a>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRevert(t.name)} disabled={reverting === t.name} title="Revert to previous version">
                        {reverting === t.name ? <LoadingSpinner /> : <RotateCcw size={14} />}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(t.name)} title="Delete Template"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ fontWeight: 800, marginBottom: 16 }}>Upload New Template</h3>
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'drag-active' : ''}`}>
            <input {...getInputProps()} />
            <div className="dropzone-icon"><FileUp size={32} /></div>
            <p className="dropzone-text">{isDragActive ? 'Drop here...' : 'Upload Template'}</p>
            <p className="dropzone-hint">Drag & drop or click to select an .xlsx template</p>
            {uploading && <LoadingSpinner />}
          </div>
          <div style={{ marginTop: 16, padding: 16, background: 'var(--grad-soft)', borderRadius: 10, border: '1px solid var(--violet-200)' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>Required Sheets:</p>
            <ul style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', paddingLeft: 16 }}>
              <li>Data Input</li><li>Term 1</li><li>Term 2</li><li>Term 3</li>
            </ul>
          </div>
        </div>
      </div>
      <ConfirmModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete} loading={deleting} title="Delete Template" message={`Delete "${confirmDelete}"? This cannot be undone.`} confirmLabel="Delete" variant="danger" />
    </div>
  );
}

// ─── Settings Page ─────────────────────────────────────────────────────────────
function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState({});
  const [activeTab, setActiveTab] = useState('general');
  const [classes, setClasses] = useState([]);
  const [expandedTerms, setExpandedTerms] = useState({});

  useEffect(() => {
    api.get('/admin/activity-logs').then(r => setLogs(r.data.logs || []));
    api.get('/admin/sessions').then(r => setSessions(r.data.sessions || {}));
    api.get('/admin/classes').then(r => setClasses(r.data.classes || []));
  }, []);

  const revokeSession = async (token) => {
    try {
      await api.delete(`/admin/sessions/${token}`);
      toast.success('Session revoked');
      setSessions(s => { const ns = {...s}; delete ns[token]; return ns; });
    } catch { toast.error('Failed to revoke session'); }
  };

  useEffect(() => {
    api.get('/settings').then(r => { setSettings(r.data); setForm({ ...r.data, adminPassword: '' }); }).catch(() => toast.error('Failed to load settings.')).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.adminPassword?.trim()) delete payload.adminPassword;
      await api.put('/settings', payload);
      toast.success('Settings saved!');
    } catch { toast.error('Save failed.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;

  return (
    <div className="page-content fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>General & Identity</button>
        <button className={`tab-btn ${activeTab === 'terms' ? 'active' : ''}`} onClick={() => setActiveTab('terms')}>Terms & Access</button>
        <button className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>System Logs & Sessions</button>
      </div>

      <div style={{ maxWidth: activeTab === 'system' ? 1000 : 800 }}>
        {activeTab === 'general' && (
          <div className="card fade-in">
            <div className="card-header"><h3 style={{ fontSize: '1rem' }}>General Settings</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Portal Name</label>
                <input className="form-input" type="text" value={form.portalName || ''} onChange={e => setForm(f => ({ ...f, portalName: e.target.value }))} placeholder="e.g. Student Grade Portal" />
              </div>
              <div className="form-group">
                <label className="form-label">School Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input className="form-input" type="text" value={form.schoolName || ''} onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))} placeholder="e.g. STI College" />
              </div>
              <div className="form-group">
                <label className="form-label">Change Admin Password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(leave blank to keep)</span></label>
                <input className="form-input" type="password" value={form.adminPassword || ''} onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="New admin password" />
              </div>
              <div className="divider" />
              <div className="form-group">
                <label className="form-label">School Address</label>
                <input className="form-input" type="text" value={form.schoolInfo?.address || ''} onChange={e => setForm(f => ({ ...f, schoolInfo: { ...f.schoolInfo, address: e.target.value } }))} placeholder="Address" />
              </div>
              <div className="form-group">
                <label className="form-label">Global Notification Banner</label>
                <div style={{display: 'flex', gap: 10}}>
                  <input className="form-input" style={{flex: 1}} type="text" value={form.notification?.message || ''} onChange={e => setForm(f => ({ ...f, notification: { ...f.notification, message: e.target.value } }))} placeholder="Announcement text" />
                  <label className="toggle" style={{marginTop: 8}}>
                    <input type="checkbox" checked={form.notification?.enabled || false} onChange={e => setForm(f => ({ ...f, notification: { ...f.notification, enabled: e.target.checked } }))} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
              <div className="divider" />
              <div>
                <p className="form-label" style={{ marginBottom: 12 }}>Features</p>
                {[['grades', 'Grade Viewing'], ['attendance', 'Attendance Viewing']].map(([k, label]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 500 }}>{label}</span>
                    <label className="toggle">
                      <input type="checkbox" checked={form.features?.[k] !== false} onChange={e => setForm(f => ({ ...f, features: { ...f.features, [k]: e.target.checked } }))} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleSave} disabled={saving}>
                {saving ? <><LoadingSpinner /> Saving...</> : 'Save General Settings'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="card fade-in">
            <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Terms & Access Control</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <p className="form-label" style={{ marginBottom: 12 }}>Visible Terms (Full Data)</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>Control which terms are visible to students when they view their grades.</p>
                {['Term 1', 'Term 2', 'Term 3', 'Term 4'].map(t => (
                  <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 500 }}>{t}</span>
                    <label className="toggle">
                      <input type="checkbox" checked={form.visibleTerms?.[t] !== false} onChange={e => setForm(f => ({ ...f, visibleTerms: { ...f.visibleTerms, [t]: e.target.checked } }))} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                ))}
              </div>

              <div className="divider" />
              
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Lock size={18} color="var(--brand-500)" />
                    <p className="form-label" style={{ marginBottom: 0 }}>Term Lock (Teacher Access)</p>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Prevent teachers from editing, modifying, or adding components to a specific term to ensure the integrity of the grades after the term ends.
                  </p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['Term 1', 'Term 2', 'Term 3', 'Term 4'].map(t => {
                    const termLockState = form.termLocks?.[t];
                    // If it's a boolean true, all are locked. If it's an object, we check if any are locked to show the master toggle as 'indeterminate' or checked.
                    const isAllLocked = termLockState === true || (typeof termLockState === 'object' && Object.values(termLockState).every(v => v === true) && Object.keys(termLockState).length === classes.length && classes.length > 0);
                    const isAnyLocked = isAllLocked || (typeof termLockState === 'object' && Object.values(termLockState).some(v => v === true));
                    const isExpanded = !!expandedTerms[t];

                    const toggleAll = (checked) => {
                      setForm(f => ({ ...f, termLocks: { ...f.termLocks, [t]: checked } }));
                    };

                    const toggleSubject = (filename, checked) => {
                      setForm(f => {
                        let currentState = f.termLocks?.[t];
                        let newState = {};
                        if (currentState === true) {
                          // Convert to object mapping
                          classes.forEach(c => newState[c.filename] = true);
                        } else if (typeof currentState === 'object') {
                          newState = { ...currentState };
                        }
                        newState[filename] = checked;
                        return { ...f, termLocks: { ...f.termLocks, [t]: newState } };
                      });
                    };

                    return (
                      <div key={t} style={{ 
                        display: 'flex', flexDirection: 'column', 
                        backgroundColor: isAnyLocked ? 'var(--brand-50)' : 'var(--bg-input)',
                        border: `1px solid ${isAnyLocked ? 'var(--brand-200)' : 'var(--border)'}`,
                        borderRadius: 8,
                        transition: 'all 0.2s',
                        overflow: 'hidden'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }} onClick={() => setExpandedTerms(prev => ({ ...prev, [t]: !prev[t] }))}>
                            <div style={{ 
                              width: 32, height: 32, borderRadius: '50%', 
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: isAllLocked ? 'var(--brand-100)' : 'var(--violet-100)',
                              color: isAllLocked ? 'var(--brand-600)' : 'var(--violet-600)'
                            }}>
                              {isAllLocked ? <Lock size={16} /> : <Unlock size={16} />}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 600, color: isAllLocked ? 'var(--brand-700)' : 'var(--text-primary)' }}>{t}</span>
                                {isExpanded ? <ChevronUp size={16} color="var(--text-muted)"/> : <ChevronDown size={16} color="var(--text-muted)"/>}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: isAllLocked ? 'var(--brand-500)' : 'var(--text-muted)' }}>
                                {isAllLocked ? 'Locked for editing' : (isAnyLocked ? 'Partially locked' : 'Open for editing')}
                              </div>
                            </div>
                          </div>
                          <label className="toggle">
                            <input type="checkbox" checked={isAllLocked} onChange={e => toggleAll(e.target.checked)} />
                            <span className="toggle-slider" />
                          </label>
                        </div>
                        {isExpanded && (
                          <div style={{ borderTop: `1px solid ${isAnyLocked ? 'var(--brand-200)' : 'var(--border)'}`, padding: '12px 16px', backgroundColor: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {classes.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No classes available.</p> : 
                             classes.map(c => {
                               const isClassLocked = termLockState === true || (typeof termLockState === 'object' && termLockState[c.filename]);
                               return (
                                 <div key={c.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <div style={{ display: 'flex', flexDirection: 'column' }}>
                                     <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{c.subject}</span>
                                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.gradeLevel} - {c.section}</span>
                                   </div>
                                   <label className="toggle">
                                     <input type="checkbox" checked={!!isClassLocked} onChange={e => toggleSubject(c.filename, e.target.checked)} />
                                     <span className="toggle-slider" />
                                   </label>
                                 </div>
                               );
                             })
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleSave} disabled={saving}>
                {saving ? <><LoadingSpinner /> Saving...</> : 'Save Term Settings'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card fade-in">
              <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Active Sessions</h3></div>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead><tr><th>User</th><th>Role</th><th>Active Since</th><th>Action</th></tr></thead>
                  <tbody>
                    {Object.entries(sessions).map(([tok, s]) => (
                      <tr key={tok}>
                        <td>{s.meta?.name || s.userId}</td>
                        <td>{s.role}</td>
                        <td style={{fontSize:'0.8rem'}}>{new Date(s.createdAt).toLocaleString()}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => revokeSession(tok)}>Revoke</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card fade-in">
              <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Activity Logs</h3></div>
              <div className="table-wrapper" style={{maxHeight: 400, overflow: 'auto'}}>
                <table className="data-table">
                  <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                  <tbody>
                    {logs.slice(0, 50).map(l => (
                      <tr key={l.id}>
                        <td style={{fontSize:'0.8rem'}}>{new Date(l.timestamp).toLocaleString()}</td>
                        <td>{l.userId} ({l.role})</td>
                        <td>{l.action}</td>
                        <td style={{fontSize:'0.8rem', color: 'var(--text-muted)'}}>{l.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentsOverview() {
  const { login } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.get('/admin/students').then(r => setStudents(r.data.students || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (s) => {
    try {
      const newStatus = s.status === 'suspended' ? 'active' : 'suspended';
      await api.put(`/admin/users/${s.studentNo}/status`, { status: newStatus });
      toast.success('Status updated');
      setStudents(prev => prev.map(st => st.studentNo === s.studentNo ? { ...st, status: newStatus } : st));
    } catch { toast.error('Update failed'); }
  };

  const handleImpersonate = async (s) => {
    try {
      const res = await api.post(`/admin/impersonate/student/${s.studentNo}`);
      toast.success('Impersonating student');
      localStorage.setItem('admin_return_token', localStorage.getItem('gp_token'));
      login(res.data.token, { id: s.studentNo, name: s.name }, 'student');
    } catch { toast.error('Impersonation failed'); }
  };

  const handleResetPassword = async () => {
    const s = confirmReset;
    if (!s) return;
    setResetting(true);
    try {
      const res = await api.post(`/admin/students/${s.studentNo}/reset-password`);
      toast.success(`Password reset to: ${res.data.newPassword}`, { duration: 8000 });
      setConfirmReset(null);
    } catch {
      toast.error('Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const handleSelectStudent = async (studentNo) => {
    setSelectedStudent(studentNo);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/admin/students/${studentNo}`);
      setDetails(res.data);
    } catch {
      toast.error('Failed to load student details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.studentNo.includes(search));

  return (
    <>
      <div className="card-body" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input type="text" className="search-input" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        {loading ? <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div> : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Student No.</th><th>Status</th><th>Subjects</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.slice(0, 50).map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{s.studentNo}</td>
                    <td><span className={`badge ${s.status === 'suspended' ? 'badge-error' : 'badge-success'}`}>{s.status || 'active'}</span></td>
                    <td><span className="badge badge-neutral">{s.subjectCount}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleSelectStudent(s.studentNo)} title="View">
                        <Eye size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleImpersonate(s)} title="Impersonate">
                        <UserCheck size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmReset(s)} title="Reset Password">
                        <Key size={13} />
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(s)} title={s.status === 'suspended' ? 'Activate' : 'Suspend'}>
                        <Shield size={13} />
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!selectedStudent} onClose={() => { setSelectedStudent(null); setDetails(null); }} title="Student Details" size="lg">
        {detailsLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><LoadingSpinner size="lg" /></div> : details ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--grad-main)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
                {details.student.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{details.student.name}</h3>
                <p style={{ color: 'var(--text-muted)' }}>ID: {details.student.studentNo}</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.875rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={14} /> {details.student.subjects.length} Subjects</span>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>Contact Info</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                  <p><strong>Contact No:</strong> {details.profile.contactNo || '—'}</p>
                  <p><strong>Address:</strong> {details.profile.address || '—'}</p>
                </div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>Guardian Info</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                  <p><strong>Name:</strong> {details.profile.parentName || '—'}</p>
                  <p><strong>Contact No:</strong> {details.profile.parentContactNo || '—'}</p>
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Academic Performance</h4>
              {details.student.subjects.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No subjects enrolled.</p> : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr><th>Subject</th><th>Section</th><th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Final</th><th>Remarks</th></tr>
                    </thead>
                    <tbody>
                      {details.student.subjects.map((sub, i) => {
                        const gs = sub.gradingSummary || {};
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{sub.info.subject}</td>
                            <td>{sub.info.section}</td>
                            <td><GradePill grade={gs.term1 || sub.terms?.['Term 1']?.summary?.transmutedGrade} /></td>
                            <td><GradePill grade={gs.term2 || sub.terms?.['Term 2']?.summary?.transmutedGrade} /></td>
                            <td><GradePill grade={gs.term3 || sub.terms?.['Term 3']?.summary?.transmutedGrade} /></td>
                            <td><GradePill grade={gs.finalGrade} /></td>
                            <td>{gs.remarks ? (
                              <span className={`badge ${gs.remarks.toLowerCase() === 'passed' ? 'badge-success' : gs.remarks.toLowerCase() === 'failed' ? 'badge-danger' : 'badge-neutral'}`}>
                                {gs.remarks}
                              </span>
                            ) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : <EmptyState icon={Users} title="Error" description="Could not load student details." />}
      </Modal>

      <ConfirmModal 
        open={!!confirmReset} 
        onClose={() => setConfirmReset(null)} 
        onConfirm={handleResetPassword} 
        loading={resetting} 
        title="Reset Password" 
        message={`Are you sure you want to reset the password for ${confirmReset?.name}? Their new password will be the last 6 digits of their Student No.`} 
        confirmLabel="Reset Password" 
        variant="primary" 
      />
    </>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = location.pathname.replace('/admin', '').replace('/', '') || 'overview';

  const nav = [
    { type: 'section', label: 'Dashboard' },
    { icon: LayoutDashboard, label: 'Overview', active: page === 'overview' || page === '', onClick: () => navigate('/admin') },
    { icon: Users, label: 'Teachers', active: page === 'teachers', onClick: () => navigate('/admin/teachers') },
    { icon: Users, label: 'Students', active: page === 'students', onClick: () => navigate('/admin/students') },
    { icon: FileUp, label: 'Templates', active: page === 'templates', onClick: () => navigate('/admin/templates') },
    { type: 'section', label: 'System' },
    { icon: Settings, label: 'Settings', active: page === 'settings', onClick: () => navigate('/admin/settings') },
  ];

  return (
    <AppLayout navItems={nav} role="admin">
      <Routes>
        <Route path="/" element={<><PageHeader title="Dashboard Overview" subtitle="System statistics and data overview" /><OverviewPage /></>} />
        <Route path="/teachers" element={<><PageHeader title="Teacher Management" subtitle="Add, edit, and manage teacher accounts" /><TeachersPage /></>} />
        <Route path="/students" element={<><PageHeader title="Students Overview" subtitle="View and manage students" /><div className="page-content fade-in"><div className="card"><div className="card-header"><h3 style={{ fontSize: '1rem' }}>Students Overview</h3></div><StudentsOverview /></div></div></>} />
        <Route path="/templates" element={<><PageHeader title="Grade Templates" subtitle="Manage Excel grade sheet templates for teachers" /><TemplatesPage /></>} />
        <Route path="/settings" element={<><PageHeader title="Settings" subtitle="Configure portal settings and visibility" /><SettingsPage /></>} />
      </Routes>
    </AppLayout>
  );
}
