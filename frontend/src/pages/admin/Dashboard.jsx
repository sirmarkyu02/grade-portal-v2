import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, FileUp, Settings, Trash2, Edit3, Plus, Download, RotateCcw, Search, ChevronRight, Eye, BarChart2, RefreshCw, FileSpreadsheet, Cloud, CloudUpload, CloudDownload, ExternalLink, Globe } from 'lucide-react';
import { AppLayout, PageHeader, GradePill, StatusBadge, EmptyState, LoadingSpinner, Modal, ConfirmModal } from '../../components/Layout';
import { useAuth } from '../../App';
import { Shield, Clock, HardDrive, Key, UserCheck, AlertTriangle, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import SystemLogsAndSessions from './SystemLogsAndSessions';

// ─── Overview Page ─────────────────────────────────────────────────────────────
function OverviewPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState({ online: false, checking: true, cloudUrl: 'http://16.59.47.134', lastSync: null, localFilesCount: 0 });
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncMode, setSyncMode] = useState('push'); // 'push' | 'pull'
  const [authorizedConfirm, setAuthorizedConfirm] = useState(false);

  const loadStats = async () => {
    try {
      const [status, statsRes] = await Promise.all([api.get('/status'), api.get('/admin/statistics')]);
      setStats({ ...statsRes.data, status: status.data });
    } catch { toast.error('Failed to load statistics.'); }
    finally { setLoading(false); }
  };

  const checkCloudStatus = async () => {
    setCloudStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await api.get('/sync/status');
      setCloudStatus({ ...res.data, checking: false });
    } catch {
      setCloudStatus(prev => ({ ...prev, online: false, checking: false }));
    }
  };

  const handlePushToCloud = async () => {
    setCloudSyncing(true);
    try {
      const res = await api.post('/sync/push-to-cloud');
      toast.success(res.data?.message || 'Successfully synchronized to AWS Cloud!');
      setSyncModalOpen(false);
      setAuthorizedConfirm(false);
      checkCloudStatus();
      loadStats();
      window.dispatchEvent(new CustomEvent('grades-synced'));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cloud synchronization failed.');
    } finally {
      setCloudSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setCloudSyncing(true);
    try {
      const res = await api.post('/sync/pull-from-cloud');
      toast.success(res.data?.message || 'Successfully pulled updates from AWS Cloud!');
      setSyncModalOpen(false);
      setAuthorizedConfirm(false);
      checkCloudStatus();
      loadStats();
      window.dispatchEvent(new CustomEvent('grades-synced'));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Pull from AWS failed.');
    } finally {
      setCloudSyncing(false);
    }
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
      toast.success('Local data reloaded successfully.');
      loadStats();
    } catch { toast.error('Local reload failed.'); }
    finally { setSyncing(false); }
  };

  useEffect(() => { 
    loadStats(); 
    checkCloudStatus();
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;
  const ov = stats?.overview || {};

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 10 }}>
        <a className="btn btn-primary btn-sm" href="/api/admin/backup" download>
          <HardDrive size={14} /> Download Backup
        </a>
        <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <LoadingSpinner /> : <RefreshCw size={14} />} Reload Local
        </button>
      </div>

      {/* AWS Cloud Synchronization Center */}
      <div className="cloud-sync-card fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--violet-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--violet-700)' }}>
              <CloudUpload size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>AWS Cloud Synchronization</h3>
                {cloudStatus.checking ? (
                  <span className="badge badge-neutral" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <LoadingSpinner size="sm" /> Checking AWS...
                  </span>
                ) : cloudStatus.online ? (
                  <span className="badge badge-success" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="cloud-pulse-online" /> AWS Online ({cloudStatus.cloudUrl.replace('http://', '').replace('https://', '')})
                  </span>
                ) : (
                  <span className="badge badge-error" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="cloud-pulse-offline" /> AWS Offline / No Internet
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Offline app integration: Authorize and push updated Excel grade records to the online AWS portal.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={checkCloudStatus} 
              disabled={cloudStatus.checking || cloudSyncing}
              title="Ping AWS server to verify connection"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} className={cloudStatus.checking ? 'spin' : ''} />
              <span>Check</span>
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => { setSyncMode('pull'); setAuthorizedConfirm(false); setSyncModalOpen(true); }}
              disabled={cloudSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title="Download latest edits from AWS Cloud into offline app"
            >
              <CloudDownload size={14} style={{ color: 'var(--brand-600)' }} />
              <span>Pull from AWS</span>
            </button>
            <button 
              className="btn btn-primary btn-sm" 
              onClick={() => { setSyncMode('push'); setAuthorizedConfirm(false); setSyncModalOpen(true); }}
              disabled={cloudSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title="Push offline grade sheets and settings to AWS Cloud"
            >
              <CloudUpload size={14} />
              <span>Push to AWS</span>
            </button>
          </div>
        </div>

        {/* Sync Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div className="cloud-sync-metric">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Offline Excel Records</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {cloudStatus.localFilesCount || stats?.status?.filesLoaded || 0} Files
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ready in local Grades folder</span>
          </div>

          <div className="cloud-sync-metric">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Target Cloud Server</span>
            <a 
              href={cloudStatus.cloudUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--brand-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {cloudStatus.cloudUrl.replace('http://', '').replace('https://', '')}
              <ExternalLink size={12} />
            </a>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Live public EC2 instance</span>
          </div>

          <div className="cloud-sync-metric">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Online Students</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: cloudStatus.online ? '#059669' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {cloudStatus.online && cloudStatus.cloudInfo?.totalStudents !== undefined ? `${cloudStatus.cloudInfo.totalStudents} Active` : '—'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {cloudStatus.online ? `${cloudStatus.cloudInfo?.filesLoaded || 0} files on Cloud` : 'Connect to check'}
            </span>
          </div>

          <div className="cloud-sync-metric">
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Last Cloud Sync</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {cloudStatus.lastSync ? new Date(cloudStatus.lastSync).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never Synced Yet'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Offline & AWS sync</span>
          </div>
        </div>
      </div>

      {/* Cloud Sync Authorization Modal */}
      <Modal 
        open={syncModalOpen} 
        onClose={() => !cloudSyncing && setSyncModalOpen(false)} 
        title={syncMode === 'pull' ? 'Authorize Pull from AWS Cloud (Online ➔ Offline)' : 'Authorize Push to AWS Cloud (Offline ➔ Online)'} 
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '14px 18px', background: 'var(--grad-soft)', borderRadius: 12, border: '1px solid var(--violet-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Shield size={18} color="var(--violet-700)" />
              <strong style={{ fontSize: '0.9375rem', color: 'var(--violet-900)' }}>
                {syncMode === 'pull' ? 'Download from AWS Cloud' : 'Administrator Authorization Required'}
              </strong>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {syncMode === 'pull' ? (
                <>
                  You are about to pull and download files from the live AWS Cloud Server (<strong>{cloudStatus.cloudUrl}</strong>) to replace this computer's local files. <strong>Use this only if you or teachers made changes directly on the online website.</strong>
                </>
              ) : (
                <>
                  You are about to push <strong>{cloudStatus.localFilesCount || stats?.status?.filesLoaded || 0} Excel grade files</strong> and active settings from this offline computer up to the live AWS Cloud Server (<strong>{cloudStatus.cloudUrl}</strong>). <strong>Use this after entering grades locally so they appear online.</strong>
                </>
              )}
            </p>
          </div>

          {syncMode === 'pull' && (
            <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10, color: '#92400e', fontSize: '0.8125rem' }}>
              <AlertTriangle size={18} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 2 }}>Important Notice regarding Pull:</strong>
                <span>"Pull from AWS" will <strong>overwrite your local offline files</strong> with whatever data is currently on the online AWS server. If you made edits on this offline computer, choose <strong>"Push to AWS"</strong> instead! (A backup of your existing local files is automatically saved).</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: 12, borderRadius: 10 }}>
            {syncMode === 'pull' ? (
              <>
                <div>✓ Downloads latest online Excel grade sheets from AWS into your local Grades folder</div>
                <div>✓ Automatically reloads and recalculates student ratings and records locally</div>
                <div>✓ Existing local files are automatically backed up to Grades_History</div>
              </>
            ) : (
              <>
                <div>✓ Uploads offline Excel sheets to AWS Cloud (Offline ➔ AWS)</div>
                <div>✓ Immediately recalculates student ratings, initial grades, and attendance online</div>
                <div>✓ Enables students and teachers to view the latest grades via the internet</div>
              </>
            )}
          </div>

          {!cloudStatus.online && (
            <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, color: '#991b1b', fontSize: '0.8125rem' }}>
              <AlertTriangle size={18} color="#dc2626" />
              <span>Warning: AWS server appears offline or unreachable. Please check your internet connection before proceeding.</span>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0', fontSize: '0.875rem' }}>
            <input 
              type="checkbox" 
              checked={authorizedConfirm} 
              onChange={e => setAuthorizedConfirm(e.target.checked)} 
              disabled={cloudSyncing} 
              style={{ width: 18, height: 18 }} 
            />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {syncMode === 'pull' 
                ? 'I understand and authorize replacing local offline files with data from AWS Cloud.' 
                : 'I authorize updating the live AWS Cloud portal with offline Excel data.'}
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setSyncModalOpen(false)} disabled={cloudSyncing}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={syncMode === 'pull' ? handlePullFromCloud : handlePushToCloud} 
              disabled={!authorizedConfirm || cloudSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {cloudSyncing ? (
                <><LoadingSpinner size="sm" /> {syncMode === 'pull' ? 'Pulling from AWS...' : 'Syncing to AWS...'}</>
              ) : syncMode === 'pull' ? (
                <><CloudDownload size={16} /> Authorize & Pull Now</>
              ) : (
                <><CloudUpload size={16} /> Authorize & Push Now</>
              )}
            </button>
          </div>
        </div>
      </Modal>

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
  const { startImpersonation } = useAuth();
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
      toast.success(`Impersonating teacher ${t.name}`);
      startImpersonation(res.data.token, { id: t.username, name: t.name, department: t.department }, 'teacher', { department: t.department });
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
              <thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Department</th><th>Classes</th><th>Added</th><th className="col-actions">Actions</th></tr></thead>
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
                    <td className="col-actions">
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-action" onClick={() => openEdit(t)} title="Edit Teacher" aria-label="Edit Teacher"><Edit3 size={15} /></button>
                        <button className="btn btn-ghost btn-action" onClick={() => setConfirmDelete(t)} style={{ color: 'var(--color-error)' }} title="Delete Teacher" aria-label="Delete Teacher"><Trash2 size={15} /></button>
                        <button className="btn btn-ghost btn-action" onClick={() => handleImpersonate(t)} title="Impersonate Teacher" aria-label="Impersonate Teacher"><UserCheck size={15}/></button>
                        <button className="btn btn-ghost btn-action" onClick={() => toggleStatus(t)} title={t.status === 'suspended' ? 'Activate' : 'Suspend'} aria-label={t.status === 'suspended' ? 'Activate' : 'Suspend'}><Shield size={15}/></button>
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
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>Supported Template Formats:</p>
            <ul style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li><strong>High School (SHS):</strong> Data Input, Term 1..3 (3 Terms Only), Attendance, Grading Summary</li>
              <li><strong>Tertiary / College:</strong> Settings, Input, PRELIMS, MIDTERM, PRE-FINALS, FINALS (4 Terms), Summary</li>
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
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncingSettings, setSyncingSettings] = useState(false);

  const fetchSyncStatus = async () => {
    try {
      const res = await api.get('/sync/status');
      setSyncStatus(res.data);
    } catch {
      setSyncStatus({ online: false, settingsSync: { status: 'offline' } });
    }
  };

  useEffect(() => {
    api.get('/admin/activity-logs').then(r => setLogs(r.data.logs || []));
    api.get('/admin/sessions').then(r => setSessions(r.data.sessions || {}));
    api.get('/admin/classes').then(r => setClasses(r.data.classes || []));
    fetchSyncStatus();
  }, []);

  const handleSyncSettings = async (mode = 'auto') => {
    setSyncingSettings(true);
    try {
      const payload = {};
      if (mode === 'forcePush') payload.forcePush = true;
      if (mode === 'forcePull') payload.forcePull = true;
      const res = await api.post('/sync/sync-settings', payload);
      if (res.data?.success) {
        toast.success(res.data.message || 'Settings synchronized!');
        if (res.data.appliedSettings) {
          setForm(prev => ({ ...prev, ...res.data.appliedSettings, adminPassword: '' }));
          setSettings(res.data.appliedSettings);
        }
        await fetchSyncStatus();
      } else {
        toast.error(res.data?.error || 'Synchronization failed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to synchronize settings with AWS Cloud.');
    } finally {
      setSyncingSettings(false);
    }
  };

  const revokeSession = async (token) => {
    try {
      await api.delete(`/admin/sessions/${token}`);
      toast.success('Session revoked');
      setSessions(s => { const ns = {...s}; delete ns[token]; return ns; });
    } catch { toast.error('Failed to revoke session'); }
  };

  useEffect(() => {
    api.get('/settings').then(r => { 
      setSettings(r.data); 
      setForm({ ...r.data, adminPassword: '' }); 
    }).catch(() => toast.error('Failed to load settings.')).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.adminPassword?.trim()) delete payload.adminPassword;
      const res = await api.put('/settings', payload);
      
      const cloudSync = res.data?.cloudSync;
      if (cloudSync && cloudSync.success) {
        if (cloudSync.action === 'pushed') {
          toast.success('Settings saved and synchronized to AWS Cloud!');
        } else if (cloudSync.action === 'pulled') {
          toast.success('Settings saved! Newer AWS Cloud settings were synchronized locally.');
          if (cloudSync.appliedSettings) {
            setForm(prev => ({ ...prev, ...cloudSync.appliedSettings, adminPassword: '' }));
            setSettings(cloudSync.appliedSettings);
          }
        } else {
          toast.success('Settings saved! Offline and Online settings are in sync.');
        }
      } else if (cloudSync && cloudSync.offline) {
        toast.success('Settings saved locally. (AWS Cloud is currently offline)');
      } else {
        toast.success('Settings saved successfully!');
      }

      await fetchSyncStatus();
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Save failed.'); 
    }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;

  return (
    <div className="page-content fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>General & Identity</button>
        <button className={`tab-btn ${activeTab === 'terms' ? 'active' : ''}`} onClick={() => setActiveTab('terms')}>Terms & Access</button>
        <button className={`tab-btn ${activeTab === 'cloud' ? 'active' : ''}`} onClick={() => setActiveTab('cloud')}>Cloud Sync & AWS</button>
        <button className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>System Logs & Sessions</button>
      </div>

      {/* Settings Synchronization Banner */}
      {activeTab !== 'system' && (
        <div style={{
          maxWidth: 800,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: syncStatus?.settingsSync?.status === 'in_sync' ? 'rgba(16, 185, 129, 0.12)' :
                               syncStatus?.settingsSync?.status === 'cloud_newer' ? 'rgba(37, 99, 235, 0.12)' :
                               syncStatus?.settingsSync?.status === 'local_newer' ? 'rgba(245, 158, 11, 0.12)' :
                               'rgba(100, 116, 139, 0.12)',
              color: syncStatus?.settingsSync?.status === 'in_sync' ? '#059669' :
                     syncStatus?.settingsSync?.status === 'cloud_newer' ? '#2563eb' :
                     syncStatus?.settingsSync?.status === 'local_newer' ? '#d97706' :
                     '#64748b'
            }}>
              {syncStatus?.online ? <Cloud size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                  {syncStatus?.settingsSync?.status === 'in_sync' && 'Settings In Sync with AWS Cloud'}
                  {syncStatus?.settingsSync?.status === 'local_newer' && 'Offline Settings are Newer (Ready to Sync)'}
                  {syncStatus?.settingsSync?.status === 'cloud_newer' && 'Online Cloud has Newer Settings Available'}
                  {(!syncStatus?.online || syncStatus?.settingsSync?.status === 'offline') && 'AWS Cloud Offline (Local Authority)'}
                  {syncStatus?.settingsSync?.status === 'unknown' && 'Settings Sync Ready'}
                </span>
                <span className={`badge ${
                  syncStatus?.settingsSync?.status === 'in_sync' ? 'badge-success' :
                  syncStatus?.settingsSync?.status === 'local_newer' ? 'badge-warning' :
                  syncStatus?.settingsSync?.status === 'cloud_newer' ? 'badge-brand' :
                  'badge-neutral'
                }`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                  {syncStatus?.settingsSync?.status === 'in_sync' ? 'In Sync' :
                   syncStatus?.settingsSync?.status === 'local_newer' ? 'Offline Newer' :
                   syncStatus?.settingsSync?.status === 'cloud_newer' ? 'Cloud Newer' :
                   'Offline'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {syncStatus?.settingsSync?.localUpdatedAt ? `Local update: ${new Date(syncStatus.settingsSync.localUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Local: Saved'}
                {syncStatus?.settingsSync?.cloudUpdatedAt ? ` • AWS Cloud update: ${new Date(syncStatus.settingsSync.cloudUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
                {syncStatus?.settingsSync?.status === 'in_sync' ? ' • Last-update synchronization active' : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleSyncSettings('auto')} 
              disabled={syncingSettings || !syncStatus?.online}
              title="Synchronize offline and online settings based on last update"
              style={{ fontSize: '0.78125rem', padding: '6px 12px' }}
            >
              <RefreshCw size={13} className={syncingSettings ? 'animate-spin' : ''} />
              {syncingSettings ? 'Syncing...' : 'Sync Settings'}
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: activeTab === 'system' ? '100%' : 800, width: '100%' }}>
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
            <div className="card-footer" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', padding: '12px 20px', borderRadius: '0 0 var(--radius) var(--radius)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Grade Portal v2.0 • Academic Records Engine</span>
                <span style={{ color: 'var(--text-secondary)' }}>Developed by <strong style={{ color: 'var(--brand-600)' }}>Sir Markyu</strong></span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="card fade-in">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem' }}>Terms & Access Control</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge badge-neutral">SHS: 3 Terms</span>
                <span className="badge badge-brand">College: 4 Terms</span>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              
              {/* ─── SECTION 1: SENIOR HIGH SCHOOL (SHS) ──────────────── */}
              <div style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      Senior High School (SHS) — 3 Terms
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Controls student visibility and teacher locking for Term 1, Term 2, and Term 3.
                    </p>
                  </div>
                  <span className="badge badge-neutral">High School</span>
                </div>

                {/* SHS Visible Terms */}
                <div style={{ marginBottom: 20 }}>
                  <p className="form-label" style={{ marginBottom: 8, fontSize: '0.8125rem' }}>Visible Terms (Student View)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {['Term 1', 'Term 2', 'Term 3'].map(t => (
                      <div key={t} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t}</span>
                        <label className="toggle">
                          <input type="checkbox" checked={form.visibleTerms?.[t] !== false} onChange={e => setForm(f => ({ ...f, visibleTerms: { ...f.visibleTerms, [t]: e.target.checked } }))} />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SHS Term Locks */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Lock size={15} color="var(--brand-500)" />
                    <p className="form-label" style={{ marginBottom: 0, fontSize: '0.8125rem' }}>SHS Term Locks (Prevent Teacher Edits)</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['Term 1', 'Term 2', 'Term 3'].map(t => {
                      const shsClasses = classes.filter(c => c.templateType !== 'tertiary');
                      const termLockState = form.termLocks?.[t];
                      const isAllLocked = termLockState === true || (typeof termLockState === 'object' && shsClasses.length > 0 && shsClasses.every(c => termLockState[c.filename] === true));
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
                            shsClasses.forEach(c => newState[c.filename] = true);
                          } else if (typeof currentState === 'object') {
                            newState = { ...currentState };
                          }
                          newState[filename] = checked;
                          return { ...f, termLocks: { ...f.termLocks, [t]: newState } };
                        });
                      };

                      return (
                        <div key={t} style={{ border: `1px solid ${isAnyLocked ? 'var(--brand-200)' : 'var(--border)'}`, borderRadius: 8, overflow: 'hidden', background: isAnyLocked ? 'var(--brand-50)' : 'var(--bg-main)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }} onClick={() => setExpandedTerms(prev => ({ ...prev, [t]: !prev[t] }))}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isAllLocked ? 'var(--brand-100)' : 'var(--violet-100)', color: isAllLocked ? 'var(--brand-600)' : 'var(--violet-600)' }}>
                                {isAllLocked ? <Lock size={14} /> : <Unlock size={14} />}
                              </div>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t}</span>
                                <span style={{ fontSize: '0.75rem', color: isAllLocked ? 'var(--brand-500)' : 'var(--text-muted)', marginLeft: 8 }}>
                                  {isAllLocked ? 'Locked' : (isAnyLocked ? 'Partially locked' : 'Open')}
                                </span>
                              </div>
                              {isExpanded ? <ChevronUp size={14} color="var(--text-muted)"/> : <ChevronDown size={14} color="var(--text-muted)"/>}
                            </div>
                            <label className="toggle">
                              <input type="checkbox" checked={isAllLocked} onChange={e => toggleAll(e.target.checked)} />
                              <span className="toggle-slider" />
                            </label>
                          </div>
                          {isExpanded && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {shsClasses.length === 0 ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No SHS classes uploaded.</p> : 
                                shsClasses.map(c => {
                                  const isClassLocked = termLockState === true || (typeof termLockState === 'object' && termLockState[c.filename]);
                                  return (
                                    <div key={c.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.subject}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>{c.section}</span>
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
              </div>

              {/* ─── SECTION 2: TERTIARY / COLLEGE (4 TERMS) ──────────── */}
              <div style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid var(--violet-200)', background: 'var(--grad-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--violet-700)' }}>
                      Tertiary / College — 4 Terms (PRELIMS, MIDTERM, PRE-FINALS, FINALS)
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Controls student visibility and faculty locking for the 4 collegiate grading terms.
                    </p>
                  </div>
                  <span className="badge badge-brand">College</span>
                </div>

                {/* College Visible Terms */}
                <div style={{ marginBottom: 20 }}>
                  <p className="form-label" style={{ marginBottom: 8, fontSize: '0.8125rem' }}>Visible Terms (Collegiate View)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    {[
                      { key: 'PRELIMS', label: 'PRELIMS (Prelim)' },
                      { key: 'MIDTERM', label: 'MIDTERM (Midterm)' },
                      { key: 'PRE-FINALS', label: 'PRE-FINALS (Pre-Final)' },
                      { key: 'FINALS', label: 'FINALS (Finals)' }
                    ].map(({ key, label }) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'white', border: '1px solid var(--violet-200)', borderRadius: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-main)' }}>{label}</span>
                        <label className="toggle">
                          <input type="checkbox" checked={form.visibleTerms?.[key] !== false} onChange={e => setForm(f => ({ ...f, visibleTerms: { ...f.visibleTerms, [key]: e.target.checked } }))} />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* College Term Locks */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Lock size={15} color="var(--violet-600)" />
                    <p className="form-label" style={{ marginBottom: 0, fontSize: '0.8125rem' }}>College Term Locks (Prevent Faculty Edits)</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { key: 'PRELIMS', label: 'PRELIMS' },
                      { key: 'MIDTERM', label: 'MIDTERM' },
                      { key: 'PRE-FINALS', label: 'PRE-FINALS' },
                      { key: 'FINALS', label: 'FINALS' }
                    ].map(({ key, label }) => {
                      const collegeClasses = classes.filter(c => c.templateType === 'tertiary');
                      const termLockState = form.termLocks?.[key];
                      const isAllLocked = termLockState === true || (typeof termLockState === 'object' && collegeClasses.length > 0 && collegeClasses.every(c => termLockState[c.filename] === true));
                      const isAnyLocked = isAllLocked || (typeof termLockState === 'object' && Object.values(termLockState).some(v => v === true));
                      const isExpanded = !!expandedTerms[key];

                      const toggleAll = (checked) => {
                        setForm(f => ({ ...f, termLocks: { ...f.termLocks, [key]: checked } }));
                      };

                      const toggleSubject = (filename, checked) => {
                        setForm(f => {
                          let currentState = f.termLocks?.[key];
                          let newState = {};
                          if (currentState === true) {
                            collegeClasses.forEach(c => newState[c.filename] = true);
                          } else if (typeof currentState === 'object') {
                            newState = { ...currentState };
                          }
                          newState[filename] = checked;
                          return { ...f, termLocks: { ...f.termLocks, [key]: newState } };
                        });
                      };

                      return (
                        <div key={key} style={{ border: `1px solid ${isAnyLocked ? 'var(--brand-200)' : 'var(--violet-200)'}`, borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }} onClick={() => setExpandedTerms(prev => ({ ...prev, [key]: !prev[key] }))}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isAllLocked ? 'var(--brand-100)' : 'var(--violet-100)', color: isAllLocked ? 'var(--brand-600)' : 'var(--violet-600)' }}>
                                {isAllLocked ? <Lock size={14} /> : <Unlock size={14} />}
                              </div>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--violet-800)' }}>{label}</span>
                                <span style={{ fontSize: '0.75rem', color: isAllLocked ? 'var(--brand-500)' : 'var(--text-muted)', marginLeft: 8 }}>
                                  {isAllLocked ? 'Locked' : (isAnyLocked ? 'Partially locked' : 'Open')}
                                </span>
                              </div>
                              {isExpanded ? <ChevronUp size={14} color="var(--text-muted)"/> : <ChevronDown size={14} color="var(--text-muted)"/>}
                            </div>
                            <label className="toggle">
                              <input type="checkbox" checked={isAllLocked} onChange={e => toggleAll(e.target.checked)} />
                              <span className="toggle-slider" />
                            </label>
                          </div>
                          {isExpanded && (
                            <div style={{ borderTop: '1px solid var(--violet-200)', padding: '10px 14px', background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {collegeClasses.length === 0 ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>No College classes uploaded.</p> : 
                                collegeClasses.map(c => {
                                  const isClassLocked = termLockState === true || (typeof termLockState === 'object' && termLockState[c.filename]);
                                  return (
                                    <div key={c.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.subject}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>{c.section}</span>
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
              </div>

              <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={handleSave} disabled={saving}>
                {saving ? <><LoadingSpinner /> Saving...</> : 'Save Term Settings'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'cloud' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Settings Synchronization Card */}
            <div className="card fade-in">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Cloud size={18} color="var(--brand-600)" />
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>Bidirectional Settings Synchronization</h3>
                </div>
                <span className={`badge ${
                  syncStatus?.settingsSync?.status === 'in_sync' ? 'badge-success' :
                  syncStatus?.settingsSync?.status === 'local_newer' ? 'badge-warning' :
                  syncStatus?.settingsSync?.status === 'cloud_newer' ? 'badge-brand' :
                  'badge-neutral'
                }`}>
                  {syncStatus?.settingsSync?.status === 'in_sync' ? 'Synchronized' :
                   syncStatus?.settingsSync?.status === 'local_newer' ? 'Offline Newer' :
                   syncStatus?.settingsSync?.status === 'cloud_newer' ? 'Cloud Newer' :
                   'Cloud Offline'}
                </span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  Settings automatically synchronize between your offline desktop computer and your online AWS EC2 cloud portal based on the <strong>last update timestamp</strong>. The system compares modification times, ensuring the most recently saved settings win while preserving environment-specific secrets.
                </p>

                {/* Timestamps & Status Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <HardDrive size={14} color="var(--brand-500)" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Offline Machine</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {syncStatus?.settingsSync?.localUpdatedAt ? new Date(syncStatus.settingsSync.localUpdatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {syncStatus?.settingsSync?.localUpdatedAt ? new Date(syncStatus.settingsSync.localUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Not saved yet'}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Globe size={14} color="var(--brand-500)" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AWS Cloud Portal</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {syncStatus?.online && syncStatus?.settingsSync?.cloudUpdatedAt ? new Date(syncStatus.settingsSync.cloudUpdatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : (syncStatus?.online ? 'Connected' : 'Offline')}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {syncStatus?.online && syncStatus?.settingsSync?.cloudUpdatedAt ? new Date(syncStatus.settingsSync.cloudUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (syncStatus?.online ? 'No remote timestamp' : 'Server unreachable')}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Clock size={14} color="var(--brand-500)" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Sync Event</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'None'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never synced'}
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, paddingTop: 6 }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleSyncSettings('auto')} 
                    disabled={syncingSettings || !syncStatus?.online}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <RefreshCw size={14} className={syncingSettings ? 'animate-spin' : ''} />
                    {syncingSettings ? 'Synchronizing...' : 'Sync Settings (Last Update Wins)'}
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleSyncSettings('forcePush')} 
                    disabled={syncingSettings || !syncStatus?.online}
                    title="Force push offline settings to online cloud regardless of timestamps"
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <CloudUpload size={14} />
                    Force Push to Cloud
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    onClick={() => handleSyncSettings('forcePull')} 
                    disabled={syncingSettings || !syncStatus?.online}
                    title="Force pull cloud settings to offline local machine regardless of timestamps"
                    style={{ fontSize: '0.8125rem' }}
                  >
                    <CloudDownload size={14} />
                    Force Pull from Cloud
                  </button>
                </div>
              </div>
            </div>

            {/* AWS Connection Settings Card */}
            <div className="card fade-in">
              <div className="card-header"><h3 style={{ fontSize: '1rem' }}>AWS Cloud Integration Settings</h3></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ padding: '12px 16px', background: 'var(--grad-soft)', borderRadius: 10, border: '1px solid var(--violet-200)', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Configure the connection between this offline administrative application and your public AWS EC2 instance.
                  When you authorize a sync, all offline Excel grade files are transmitted to this address.
                </div>

                <div className="form-group">
                  <label className="form-label">Live AWS Cloud Server URL</label>
                  <input 
                    className="form-input" 
                    type="text" 
                    value={form.cloudSync?.serverUrl || 'http://16.59.47.134'} 
                    onChange={e => setForm(f => ({ ...f, cloudSync: { ...(f.cloudSync || {}), serverUrl: e.target.value } }))} 
                    placeholder="e.g. http://16.59.47.134" 
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    The public IP or domain of your AWS EC2 instance running Grade Portal v2.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Cloud Sync Authorization Secret Key</label>
                  <input 
                    className="form-input" 
                    type="password" 
                    value={form.cloudSync?.secretKey || 'gradeportal-secure-cloud-sync-key-2026'} 
                    onChange={e => setForm(f => ({ ...f, cloudSync: { ...(f.cloudSync || {}), secretKey: e.target.value } }))} 
                    placeholder="Secret synchronization token" 
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Shared secret token used to authenticate synchronization requests between this offline machine and AWS.
                  </p>
                </div>

                <button className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={handleSave} disabled={saving}>
                  {saving ? <><LoadingSpinner /> Saving...</> : 'Save Cloud Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <SystemLogsAndSessions />
        )}
      </div>
    </div>
  );
}

function StudentsOverview() {
  const { startImpersonation } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [resetting, setResetting] = useState(false);

  const fetchStudents = () => {
    api.get('/admin/students').then(r => setStudents(r.data.students || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStudents();
    window.addEventListener('grades-synced', fetchStudents);
    return () => window.removeEventListener('grades-synced', fetchStudents);
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      const handleSync = () => handleSelectStudent(selectedStudent);
      window.addEventListener('grades-synced', handleSync);
      return () => window.removeEventListener('grades-synced', handleSync);
    }
  }, [selectedStudent]);

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
      toast.success(`Impersonating student ${s.name}`);
      startImpersonation(res.data.token, { id: s.studentNo, name: s.name, onboarded: true }, 'student', { section: s.section || '' });
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
          <div className="table-wrapper" style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Student No.</th><th>Status</th><th>Subjects</th><th className="col-actions">Action</th></tr></thead>
              <tbody>
                {filtered.slice(0, 50).map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{s.studentNo}</td>
                    <td><span className={`badge ${s.status === 'suspended' ? 'badge-error' : 'badge-success'}`}>{s.status || 'active'}</span></td>
                    <td><span className="badge badge-neutral">{s.subjectCount}</span></td>
                    <td className="col-actions">
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-action" onClick={() => handleSelectStudent(s.studentNo)} title="View Student Details" aria-label="View Student Details">
                          <Eye size={15} />
                        </button>
                        <button className="btn btn-ghost btn-action" onClick={() => handleImpersonate(s)} title="Impersonate Student" aria-label="Impersonate Student">
                          <UserCheck size={15} />
                        </button>
                        <button className="btn btn-ghost btn-action" onClick={() => setConfirmReset(s)} title="Reset Password" aria-label="Reset Password">
                          <Key size={15} />
                        </button>
                        <button className="btn btn-ghost btn-action" onClick={() => toggleStatus(s)} title={s.status === 'suspended' ? 'Activate Student' : 'Suspend Student'} aria-label={s.status === 'suspended' ? 'Activate Student' : 'Suspend Student'}>
                          <Shield size={15} />
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
                {(details?.student?.name || 'ST').split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{details?.student?.name || 'Unknown Student'}</h3>
                <p style={{ color: 'var(--text-muted)' }}>ID: {details?.student?.studentNo || '—'}</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.875rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={14} /> {details?.student?.subjects?.length || 0} Subjects</span>
                </div>
              </div>
              <button 
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => handleImpersonate({ studentNo: details?.student?.studentNo, name: details?.student?.name, section: details?.student?.subjects?.[0]?.info?.section })}
                title="Impersonate and view portal as this student"
              >
                <UserCheck size={14} />
                <span>Impersonate Student</span>
              </button>
            </div>

            <div className="grid-2">
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>Contact Info</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                  <p><strong>Contact No:</strong> {details?.profile?.contactNo || '—'}</p>
                  <p><strong>Address:</strong> {details?.profile?.address || '—'}</p>
                </div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>Guardian Info</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
                  <p><strong>Name:</strong> {details?.profile?.parentName || '—'}</p>
                  <p><strong>Contact No:</strong> {details?.profile?.parentContactNo || '—'}</p>
                </div>
              </div>
            </div>

            <div>
              {(() => {
                const allSubs = details?.student?.subjects || [];
                if (allSubs.length === 0) {
                  return <p style={{ color: 'var(--text-muted)' }}>No subjects enrolled.</p>;
                }
                const shsSubs = allSubs.filter(s => s?.info?.templateType !== 'tertiary');
                const collegeSubs = allSubs.filter(s => s?.info?.templateType === 'tertiary');

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {shsSubs.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                            Senior High School (SHS) — 3 Terms
                          </h4>
                          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>3 Terms: Term 1, Term 2, Term 3</span>
                        </div>
                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Subject</th>
                                <th>Section</th>
                                <th>Term 1</th>
                                <th>Term 2</th>
                                <th>Term 3</th>
                                <th>Final Grade</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shsSubs.map((sub, i) => {
                                const gs = sub?.gradingSummary || {};
                                return (
                                  <tr key={i}>
                                    <td style={{ fontWeight: 600 }}>{sub?.info?.subject || '—'}</td>
                                    <td>{sub?.info?.section || '—'}</td>
                                    <td><GradePill grade={gs.term1 || sub?.terms?.['Term 1']?.summary?.transmutedGrade} /></td>
                                    <td><GradePill grade={gs.term2 || sub?.terms?.['Term 2']?.summary?.transmutedGrade} /></td>
                                    <td><GradePill grade={gs.term3 || sub?.terms?.['Term 3']?.summary?.transmutedGrade} /></td>
                                    <td><GradePill grade={gs.finalGrade} /></td>
                                    <td>{gs.remarks ? <StatusBadge status={gs.remarks} /> : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {collegeSubs.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--violet-700)' }}>
                            Tertiary / College — 4 Terms (1.00 – 5.00 Scale)
                          </h4>
                          <span className="badge badge-brand" style={{ fontSize: '0.75rem' }}>4 Terms: PRE, MID, PF, FIN</span>
                        </div>
                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Course / Subject</th>
                                <th>Section</th>
                                <th>Prelims</th>
                                <th>Midterm</th>
                                <th>Pre-Finals</th>
                                <th>Finals</th>
                                <th>Final Grade</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {collegeSubs.map((sub, i) => {
                                const gs = sub?.gradingSummary || {};
                                return (
                                  <tr key={i}>
                                    <td style={{ fontWeight: 600 }}>
                                      <div>{sub?.info?.subject || '—'}</div>
                                      {sub?.info?.code && <span className="tertiary-meta-chip" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{sub.info.code}</span>}
                                    </td>
                                    <td>{sub?.info?.section || '—'}</td>
                                    <td><GradePill grade={gs.term1 || sub?.terms?.['PRELIMS']?.summary?.transmutedGrade} /></td>
                                    <td><GradePill grade={gs.term2 || sub?.terms?.['MIDTERM']?.summary?.transmutedGrade} /></td>
                                    <td><GradePill grade={gs.term3 || sub?.terms?.['PRE-FINALS']?.summary?.transmutedGrade} /></td>
                                    <td><GradePill grade={gs.term4 || sub?.terms?.['FINALS']?.summary?.transmutedGrade} /></td>
                                    <td><GradePill grade={gs.finalGrade} /></td>
                                    <td>{gs.remarks ? <StatusBadge status={gs.remarks} /> : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
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
