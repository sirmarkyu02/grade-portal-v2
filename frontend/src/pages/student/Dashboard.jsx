import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Calendar, User, Settings, Bell, Camera, ChevronRight, Award, Activity } from 'lucide-react';
import { AppLayout, PageHeader, GradePill, StatusBadge, EmptyState, LoadingSpinner } from '../../components/Layout';
import { useAuth } from '../../App';
import api from '../../api';
import toast from 'react-hot-toast';

// ─── Attendance View ──────────────────────────────────────────────────────────
function AttendanceView({ attendance }) {
  if (!attendance) return <div className="empty-state"><p className="empty-desc">No attendance data available.</p></div>;
  const { summary, records } = attendance;
  const termKeys = ['term1', 'term2', 'term3'];
  const termLabels = ['Term 1', 'Term 2', 'Term 3'];
  const attDot = (type) => {
    const map = { P: 'att-present', A: 'att-absent', L: 'att-late', E: 'att-excused' };
    return map[type] || 'att-present';
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="grid-3">
        {termKeys.map((k, i) => {
          const t = summary?.[k] || {};
          const total = (t.present || 0) + (t.absent || 0) + (t.late || 0) + (t.excused || 0);
          const pct = total > 0 ? Math.round(((t.present || 0) / total) * 100) : 0;
          return (
            <div key={k} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{termLabels[i]}</h4>
                <span className={`badge ${pct >= 80 ? 'badge-success' : pct >= 60 ? 'badge-warning' : 'badge-error'}`}>{pct}% rate</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                {[['Present', t.present || 0, '#065f46', '#d1fae5'], ['Absent', t.absent || 0, '#991b1b', '#fee2e2'], ['Late', t.late || 0, '#92400e', '#fef3c7'], ['Excused', t.excused || 0, '#1e40af', '#dbeafe']].map(([label, val, color, bg]) => (
                  <div key={label} style={{ background: bg, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: '0.7rem', color, opacity: 0.8 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Grades for a subject ─────────────────────────────────────────────────────
function SubjectGrades({ subject }) {
  const [activeTab, setActiveTab] = useState('Term 1');
  const termNames = Object.keys(subject.terms || {});
  if (termNames.length === 0) return <div className="empty-state"><p className="empty-desc">No grade data available for this subject yet.</p></div>;

  const term = subject.terms[activeTab];

  const renderScoreTable = (items, label) => {
    if (!items || items.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>No {label} recorded.</p>;
    const total = items.reduce((s, i) => s + (i.hps || 0), 0);
    const scored = items.reduce((s, i) => s + (i.score !== null && i.score !== undefined && i.score !== '' ? Number(i.score) : 0), 0);
    return (
      <div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Item</th><th>Date</th><th>Score</th><th>Max</th><th>%</th></tr></thead>
            <tbody>
              {items.map((item, i) => {
                const pct = item.hps > 0 && item.score !== null && item.score !== '' ? Math.round((Number(item.score) / item.hps) * 100) : null;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{item.label}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{item.date || '—'}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.score ?? '—'}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.hps}</td>
                    <td>{pct !== null ? <span className={`badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-error'}`}>{pct}%</span> : '—'}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: 'var(--grad-soft)' }}>
                <td colSpan={2}><strong>Total</strong></td>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{scored}</span></td>
                <td>{total}</td>
                <td>{total > 0 ? <span className="badge badge-brand">{Math.round((scored / total) * 100)}%</span> : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Term Tabs */}
      <div className="tabs">
        {termNames.map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {term && (
        <>
          {/* Summary */}
          <div className="grid-4">
            {[
              { label: 'Written Works', value: term.summary?.wwWS !== null ? `${term.summary.wwWS?.toFixed(2) ?? '—'}` : '—', icon: '📝' },
              { label: 'Performance Tasks', value: term.summary?.ptWS !== null ? `${term.summary.ptWS?.toFixed(2) ?? '—'}` : '—', icon: '🎯' },
              { label: 'Exams', value: term.summary?.examWS !== null ? `${term.summary.examWS?.toFixed(2) ?? '—'}` : '—', icon: '📋' },
              { label: 'Term Grade', value: term.summary?.transmutedGrade ?? '—', icon: '🏆', isGrade: true },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{s.label}</p>
                </div>
                {s.isGrade ? <GradePill grade={s.value} /> : <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.25rem' }}>{s.value}</p>}
              </div>
            ))}
          </div>

          {/* Status banner if present */}
          {term.summary?.status && (
            <div style={{ padding: '10px 16px', borderRadius: 10, background: String(term.summary.status).toLowerCase().includes('pass') ? '#d1fae5' : '#fee2e2', border: `1px solid ${String(term.summary.status).toLowerCase().includes('pass') ? '#6ee7b7' : '#fca5a5'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, color: String(term.summary.status).toLowerCase().includes('pass') ? '#065f46' : '#991b1b' }}>
                {String(term.summary.status).toLowerCase().includes('pass') ? '✓ Passed' : '✗ Not Passed'} — {term.summary.status}
              </span>
            </div>
          )}

          {/* Detail sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h4 style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet-500)', display: 'inline-block' }} />
                Written Works
              </h4>
              {renderScoreTable(term.writtenWorks, 'written works')}
            </div>
            <div>
              <h4 style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-500)', display: 'inline-block' }} />
                Performance Tasks
              </h4>
              {renderScoreTable(term.performanceTasks, 'performance tasks')}
            </div>
            {Object.keys(term.exams || {}).length > 0 && (
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                  Examinations
                </h4>
                {renderScoreTable(Object.values(term.exams), 'exams')}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Overview (Home) ──────────────────────────────────────────────────────────
function OverviewPage({ studentData, profile }) {
  if (!studentData) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;
  const { student } = studentData;
  const subjects = student.subjects || [];
  const totalSubjects = subjects.length;
  const passedSubjects = subjects.filter(s => s.gradingSummary?.remarks?.toLowerCase().includes('pass')).length;

  return (
    <div className="page-content fade-in">
      {/* Welcome banner */}
      <div style={{ 
        borderRadius: 24, 
        background: 'linear-gradient(135deg, var(--violet-600) 0%, var(--brand-500) 100%)', 
        padding: '36px 40px', 
        marginBottom: 32, 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 16, 
        overflow: 'hidden', 
        position: 'relative',
        boxShadow: 'var(--shadow-brand)'
      }}>
        <div className="orb" style={{ width: 300, height: 300, top: -120, right: -40, opacity: 0.15, background: 'white' }} />
        <div className="orb" style={{ width: 200, height: 200, bottom: -80, left: 20, opacity: 0.1, background: 'white', animationDuration: '15s' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ opacity: 0.9, fontSize: '0.9375rem', marginBottom: 6, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Good day,</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>{student.name}</h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 20, backdropFilter: 'blur(10px)' }}>
            <User size={14} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{student.studentNo}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, textShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{totalSubjects}</div>
          <div style={{ opacity: 0.9, fontSize: '1rem', fontWeight: 500, marginTop: 4 }}>Subject{totalSubjects !== 1 ? 's' : ''} Enrolled</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        <div className="stat-card" style={{ background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' }}>
          <div className="stat-icon brand" style={{ background: 'var(--violet-100)', color: 'var(--violet-600)' }}><BookOpen size={22} /></div>
          <div className="stat-value" style={{ color: 'var(--violet-700)' }}>{totalSubjects}</div>
          <div className="stat-label">Enrolled Subjects</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(to bottom, #ffffff, #f0fdf4)' }}>
          <div className="stat-icon green" style={{ background: '#d1fae5', color: '#059669' }}><Award size={22} /></div>
          <div className="stat-value" style={{ color: '#059669' }}>{passedSubjects}</div>
          <div className="stat-label">Subjects Passed</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(to bottom, #ffffff, #fef2f2)' }}>
          <div className="stat-icon amber" style={{ background: '#fee2e2', color: '#dc2626' }}><Activity size={22} /></div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{totalSubjects - passedSubjects}</div>
          <div className="stat-label">Needs Attention</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(to bottom, #ffffff, #eff6ff)' }}>
          <div className="stat-icon blue" style={{ background: '#dbeafe', color: '#2563eb' }}><Calendar size={22} /></div>
          <div className="stat-value" style={{ color: '#2563eb' }}>{subjects.reduce((s, sub) => s + (sub.attendance?.summary?.term1?.absent || 0) + (sub.attendance?.summary?.term2?.absent || 0) + (sub.attendance?.summary?.term3?.absent || 0), 0)}</div>
          <div className="stat-label">Total Absences</div>
        </div>
      </div>

      {/* Subjects overview */}
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" description="Your grades will appear here once your teacher uploads them." />
      ) : (
        <div>
          <h3 style={{ fontWeight: 800, marginBottom: 16 }}>My Subjects</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subjects.map((sub, i) => {
              const gs = sub.gradingSummary;
              return (
                <div key={i} className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', align: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--violet-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--violet-600)' }}>
                      <BookOpen size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: 2 }}>{sub.info.subject}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500 }}>{sub.info.section} • {sub.info.instructor}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    {gs ? (
                      <>
                        {['term1', 'term2', 'term3'].map(k => gs[k] ? (
                          <div key={k} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{k.replace('term', 'T')}</div>
                            <GradePill grade={gs[k]} />
                          </div>
                        ) : null)}
                        {gs.finalGrade && <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Final</div>
                          <GradePill grade={gs.finalGrade} />
                        </div>}
                      </>
                    ) : (
                      <span className="badge badge-neutral">No grades yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subject Detail Page ──────────────────────────────────────────────────────
function SubjectPage({ studentData }) {
  const [selected, setSelected] = useState(null);
  const subjects = studentData?.student?.subjects || [];
  if (subjects.length === 0) return <div className="page-content"><EmptyState icon={BookOpen} title="No subjects" description="No grade data uploaded yet." /></div>;
  const sub = selected !== null ? subjects[selected] : null;

  return (
    <div className="page-content fade-in">
      {!sub ? (
        <>
          <h2 style={{ fontWeight: 800, marginBottom: 16 }}>My Grades</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subjects.map((sub, i) => (
              <div key={i} className="card" style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => setSelected(i)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--grad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={20} color="var(--violet-600)" />
                    </div>
                    <div>
                      <p style={{ fontWeight: 700 }}>{sub.info.subject}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{sub.info.section} • {sub.info.instructor}</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        WW: {sub.info.weights?.writtenOral}% | PT: {sub.info.weights?.performanceTask}% | Exam: {sub.info.weights?.termExam}%
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {sub.gradingSummary?.finalGrade && <GradePill grade={sub.gradingSummary.finalGrade} />}
                    {sub.gradingSummary?.remarks && <StatusBadge status={sub.gradingSummary.remarks} />}
                    <span style={{ color: 'var(--violet-400)' }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} style={{ marginBottom: 16 }}>← Back to subjects</button>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontWeight: 800 }}>{sub.info.subject}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{sub.info.section} • {sub.info.instructor} • {sub.info.schoolYear}</p>
          </div>
          <SubjectGrades subject={sub} />
        </>
      )}
    </div>
  );
}

// ─── Attendance Page ──────────────────────────────────────────────────────────
function StudentAttendancePage({ studentData }) {
  const subjects = studentData?.student?.subjects || [];
  const [selected, setSelected] = useState(0);
  const sub = subjects[selected];
  return (
    <div className="page-content fade-in">
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Attendance</h2>
      {subjects.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select className="form-input" style={{ maxWidth: 300 }} value={selected} onChange={e => setSelected(Number(e.target.value))}>
            {subjects.map((s, i) => <option key={i} value={i}>{s.info.subject} — {s.info.section}</option>)}
          </select>
        </div>
      )}
      {sub ? <AttendanceView attendance={sub.attendance} /> : <EmptyState icon={Calendar} title="No attendance data" description="Attendance records will appear here once uploaded." />}
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage({ user, profile, onRefresh }) {
  const [form, setForm] = useState({ contactNo: profile?.contactNo || '', parentName: profile?.parentName || '', parentContactNo: profile?.parentContactNo || '', address: profile?.address || '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile?.photo || null);
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const fileRef = React.useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      ['contactNo', 'parentName', 'parentContactNo', 'address'].forEach(k => fd.append(k, form[k] || ''));
      if (photoFile) fd.append('photo', photoFile);
      await api.put('/student/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile updated!');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed.');
    } finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!form.currentPassword) { toast.error('Enter your current password.'); return; }
    if (!form.newPassword || form.newPassword.length < 6) { toast.error('New password must be at least 6 characters.'); return; }
    if (form.newPassword !== form.confirmPassword) { toast.error('Passwords do not match.'); return; }
    setPwLoading(true);
    try {
      await api.post('/student/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed successfully.');
      set('currentPassword', ''); set('newPassword', ''); set('confirmPassword', '');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password change failed.');
    } finally { setPwLoading(false); }
  };

  const initials = (n) => n ? (n.trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)) : '?';

  return (
    <div className="page-content fade-in">
      <h2 style={{ fontWeight: 800, marginBottom: 24 }}>My Profile</h2>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Personal Information</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="photo-upload" style={{ width: 96, height: 96 }} onClick={() => fileRef.current.click()}>
                {photoPreview ? <img src={photoPreview} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-200)' }} />
                  : <div className="photo-preview" style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--grad-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>{initials(user?.name)}</div>}
                <div className="photo-overlay"><Camera size={20} /></div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) { setPhotoFile(f); const r = new FileReader(); r.onload = e2 => setPhotoPreview(e2.target.result); r.readAsDataURL(f); } }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.name}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Student No.: {user?.id}</p>
              </div>
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['contactNo', 'Your Contact No.', 'tel'], ['parentName', "Parent/Guardian", 'text'], ['parentContactNo', "Guardian's Contact", 'tel'], ['address', 'Address', 'text']].map(([k, label, type]) => (
                <div key={k} className="form-group" style={k === 'address' ? { gridColumn: '1/-1' } : {}}>
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={label} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={loading}>
              {loading ? <><LoadingSpinner /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Change Password</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" value={form.currentPassword} onChange={e => set('currentPassword', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" value={form.newPassword} onChange={e => set('newPassword', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleChangePassword} disabled={pwLoading}>
              {pwLoading ? <><LoadingSpinner /> Changing...</> : 'Change Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Student Dashboard ───────────────────────────────────────────────────
export default function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refresh } = useAuth();
  const [studentData, setStudentData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const page = location.pathname.replace('/student', '').replace('/', '') || 'home';

  const loadData = async () => {
    try {
      const res = await api.get('/student/grades');
      setStudentData(res.data);
      setProfile(res.data.profile);
    } catch (err) {
      toast.error('Failed to load grades.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const nav = [
    { icon: LayoutDashboard, label: 'Overview', active: page === 'home' || page === '', onClick: () => navigate('/student') },
    { icon: BookOpen, label: 'My Grades', active: page === 'grades', onClick: () => navigate('/student/grades') },
    { icon: Calendar, label: 'Attendance', active: page === 'attendance', onClick: () => navigate('/student/attendance') },
    { type: 'section', label: 'Account' },
    { icon: User, label: 'Profile', active: page === 'profile', onClick: () => navigate('/student/profile') },
  ];

  return (
    <AppLayout navItems={nav} role="student">
      <Routes>
        <Route path="/" element={
          <>
            <PageHeader title="Overview" subtitle={loading ? 'Loading...' : `Welcome back, ${studentData?.student?.name?.split(' ')[0]}!`} />
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>
              : <OverviewPage studentData={studentData} profile={profile} />}
          </>
        } />
        <Route path="/grades" element={
          <>
            <PageHeader title="My Grades" subtitle="Detailed scores per subject and term" />
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>
              : <SubjectPage studentData={studentData} />}
          </>
        } />
        <Route path="/attendance" element={
          <>
            <PageHeader title="Attendance" subtitle="Your attendance records per term" />
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>
              : <StudentAttendancePage studentData={studentData} />}
          </>
        } />
        <Route path="/profile" element={
          <>
            <PageHeader title="My Profile" subtitle="Manage your account and personal information" />
            <ProfilePage user={user} profile={profile} onRefresh={() => { loadData(); refresh(); }} />
          </>
        } />
      </Routes>
    </AppLayout>
  );
}
