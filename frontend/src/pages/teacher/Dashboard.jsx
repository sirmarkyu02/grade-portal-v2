import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Upload, Download, Edit3, Save, X, Search, RotateCcw, Eye, EyeOff, Users, Settings } from 'lucide-react';
import { AppLayout, PageHeader, GradePill, StatusBadge, EmptyState, LoadingSpinner, Modal, ConfirmModal } from '../../components/Layout';
import { useAuth } from '../../App';
import api from '../../api';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';

// ─── File Drop Upload ─────────────────────────────────────────────────────────
function DropUploader({ onUpload, loading }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    onDrop: acceptedFiles => { if (acceptedFiles.length > 0) onUpload(acceptedFiles[0]); }
  });
  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? 'drag-active' : ''}`}>
      <input {...getInputProps()} />
      <div className="dropzone-icon"><Upload size={32} /></div>
      <p className="dropzone-text">{isDragActive ? 'Drop your Excel file here...' : 'Upload Grade Sheet'}</p>
      <p className="dropzone-hint">Drag & drop or click to select an .xlsx file</p>
      {loading && <LoadingSpinner />}
    </div>
  );
}

// ─── Class List ───────────────────────────────────────────────────────────────
function ClassListPage({ onSelectClass }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);

  const loadClasses = async () => {
    try {
      const res = await api.get('/teacher/classes');
      setClasses(res.data.classes || []);
    } catch { toast.error('Failed to load classes.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadClasses(); }, []);

  const handleUpload = async (file) => {
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append('gradesFile', file);
      await api.post('/teacher/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Grade sheet uploaded successfully!');
      loadClasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed.');
    } finally { setUploadLoading(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;

  return (
    <div className="page-content fade-in">
      {/* Teacher Welcome Banner */}
      <div style={{ 
        borderRadius: 24, 
        background: 'linear-gradient(135deg, var(--brand-600) 0%, var(--brand-400) 100%)', 
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
          <p style={{ opacity: 0.9, fontSize: '0.9375rem', marginBottom: 6, fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Teacher Portal</p>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>Welcome back!</h2>
          <p style={{ opacity: 0.9, fontSize: '1rem', fontWeight: 400 }}>Manage your classes, grades, and templates in one place.</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, textShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{classes.length}</div>
          <div style={{ opacity: 0.9, fontSize: '1rem', fontWeight: 500, marginTop: 4 }}>Active Class{classes.length !== 1 ? 'es' : ''}</div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>My Classes</h3>
          {classes.length === 0 ? (
            <EmptyState icon={BookOpen} title="No classes yet" description="Upload a grade sheet to get started." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes.map((cls, i) => (
                <div key={i} className="card" style={{ padding: 20, cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }} onClick={() => onSelectClass(cls)}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-lg)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--brand-600)' }}>
                        <BookOpen size={24} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: 2 }}>{cls.subject || cls.fileName?.replace('.xlsx', '')}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 2 }}>{cls.section} • {cls.gradeLevel}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Last updated: {cls.lastModified ? new Date(cls.lastModified).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span className="badge" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', padding: '6px 12px' }}>{cls.studentCount} students</span>
                      <span style={{ color: 'var(--brand-400)', marginLeft: 4 }}>›</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ fontWeight: 800, fontSize: '1.25rem' }}>Upload / Re-upload</h3>
          <div className="card" style={{ padding: 24, background: 'var(--brand-50)', border: '1px dashed var(--brand-300)', boxShadow: 'none' }}>
            <DropUploader onUpload={handleUpload} loading={uploadLoading} />
            <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand-100)', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', fontWeight: 700 }}>i</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Upload a new grade sheet or re-upload an existing one with the <strong>same filename</strong> to update its records automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grade Edit Mode ──────────────────────────────────────────────────────────
function GradeEditModal({ classInfo, onClose }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('table'); // 'table' | 'individual'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTermTab, setActiveTermTab] = useState('Term 1');
  const [activeComponentTab, setActiveComponentTab] = useState('summary'); // 'summary' | 'ww' | 'pt' | 'exam'
  const [changes, setChanges] = useState({}); // { studentNo: { termName: { key: updObj } } }
  const [search, setSearch] = useState('');

  const loadClassData = useCallback(() => {
    return api.get(`/teacher/class/${encodeURIComponent(classInfo.fileName)}/full`)
      .then(r => { setStudents(r.data.students || []); })
      .catch(() => toast.error('Failed to load class data.'));
  }, [classInfo.fileName]);

  useEffect(() => {
    loadClassData().finally(() => setLoading(false));
  }, [loadClassData]);

  const updateScore = (studentNo, termName, col, row, hps, label, value) => {
    setChanges(prev => {
      const key = `${studentNo}-${termName}-${col}`;
      const newChanges = { ...prev };
      if (!newChanges[studentNo]) newChanges[studentNo] = {};
      if (!newChanges[studentNo][termName]) newChanges[studentNo][termName] = {};
      newChanges[studentNo][termName][key] = { studentNo, termName, col, row, hps, label, value };
      return newChanges;
    });
  };

  const getScore = (studentNo, termName, col, originalScore) => {
    const key = `${studentNo}-${termName}-${col}`;
    const change = changes[studentNo]?.[termName]?.[key];
    return change !== undefined ? change.value : originalScore;
  };

  const hasChanges = (studentNo) => !!changes[studentNo] && Object.values(changes[studentNo]).some(t => Object.keys(t).length > 0);

  const saveStudentChanges = async (studentNo) => {
    const studentChanges = changes[studentNo];
    if (!studentChanges) return;
    const updates = [];
    for (const termChanges of Object.values(studentChanges)) {
      for (const upd of Object.values(termChanges)) {
        updates.push(upd);
      }
    }
    if (updates.length === 0) return;
    setSaving(true);
    try {
      await api.put(`/teacher/class/${encodeURIComponent(classInfo.fileName)}/student/${studentNo}`, { updates });
      const newChanges = { ...changes };
      delete newChanges[studentNo];
      setChanges(newChanges);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed.');
      return false;
    }
  };

  const handleSaveSingleStudent = async (studentNo) => {
    setSaving(true);
    const success = await saveStudentChanges(studentNo);
    if (success) {
      await loadClassData();
      toast.success(`Scores saved for student.`);
    }
    setSaving(false);
  };

  const saveAllChanges = async () => {
    const studentNos = Object.keys(changes);
    if (studentNos.length === 0) { toast('No changes to save.'); return; }
    setSaving(true);
    let successCount = 0;
    for (const sNo of studentNos) {
      const success = await saveStudentChanges(sNo);
      if (success) successCount++;
    }
    if (successCount > 0) {
      await loadClassData();
      toast.success('All changes saved!');
    }
    setSaving(false);
  };

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.studentNo.includes(search));
  const termNames = students.length > 0 ? Object.keys(students[0].terms || {}) : ['Term 1', 'Term 2', 'Term 3'];

  const renderStudentTermEditor = (student, termName) => {
    const term = student.terms?.[termName];
    if (!term) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No data for {termName}.</p>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[['Written Works', term.writtenWorks], ['Performance Tasks', term.performanceTasks], ['Examinations', Object.values(term.exams || {})]].map(([title, items]) => (
          items && items.length > 0 ? (
            <div key={title}>
              <h5 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10, color: 'var(--text-secondary)' }}>{title}</h5>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>Item</th><th>Max Score (HPS)</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const val = getScore(student.studentNo, termName, item.col, item.score);
                      const changed = val !== item.score;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{item.label}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{item.hps}</td>
                          <td>
                            <input
                              type="number" min="0" max={item.hps} step="0.25"
                              className={`score-input ${changed ? 'changed' : ''} ${val > item.hps ? 'error-cell' : ''}`}
                              value={val ?? ''}
                              onChange={e => updateScore(student.studentNo, termName, item.col, item.row, item.hps, item.label, e.target.value === '' ? null : parseFloat(e.target.value))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null
        ))}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 0', flexWrap: 'wrap' }}>
        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input type="text" className="search-input" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <button onClick={() => setMode('table')} className={`btn btn-sm ${mode === 'table' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: 0 }}>Table View</button>
          <button onClick={() => setMode('individual')} className={`btn btn-sm ${mode === 'individual' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: 0 }}>Individual</button>
        </div>
        {Object.keys(changes).length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={saveAllChanges} disabled={saving}>
            {saving ? <LoadingSpinner /> : <Save size={14} />} Save All ({Object.keys(changes).length})
          </button>
        )}
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><LoadingSpinner size="lg" /></div> : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {mode === 'individual' ? (
            !selectedStudent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map((s, i) => (
                  <div key={i} className="card" style={{ padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => setSelectedStudent(s)}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--grad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--violet-700)' }}>
                        {s.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p style={{ fontWeight: 600 }}>{s.name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.studentNo}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {hasChanges(s.studentNo) && <span className="badge badge-warning">Unsaved</span>}
                      <span style={{ color: 'var(--violet-400)' }}>›</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedStudent(null)}>← Back</button>
                  <h4 style={{ fontWeight: 700 }}>{selectedStudent.name}</h4>
                  {hasChanges(selectedStudent.studentNo) && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleSaveSingleStudent(selectedStudent.studentNo)} disabled={saving}>
                      <Save size={14} /> Save Changes
                    </button>
                  )}
                </div>
                <div className="tabs" style={{ marginBottom: 16 }}>
                  {termNames.map(t => <button key={t} className={`tab-btn ${activeTermTab === t ? 'active' : ''}`} onClick={() => setActiveTermTab(t)}>{t}</button>)}
                </div>
                {renderStudentTermEditor(selectedStudent, activeTermTab)}
              </div>
            )
          ) : (
            // Table mode: bulk editing and summary
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="tabs">
                  {termNames.map(t => <button key={t} className={`tab-btn ${activeTermTab === t ? 'active' : ''}`} onClick={() => setActiveTermTab(t)}>{t}</button>)}
                </div>
                <div className="tabs" style={{ gap: 4 }}>
                  <button className={`tab-btn ${activeComponentTab === 'summary' ? 'active' : ''}`} style={{ fontSize: '0.8125rem', padding: '4px 12px' }} onClick={() => setActiveComponentTab('summary')}>Summary</button>
                  <button className={`tab-btn ${activeComponentTab === 'ww' ? 'active' : ''}`} style={{ fontSize: '0.8125rem', padding: '4px 12px' }} onClick={() => setActiveComponentTab('ww')}>Written Works</button>
                  <button className={`tab-btn ${activeComponentTab === 'pt' ? 'active' : ''}`} style={{ fontSize: '0.8125rem', padding: '4px 12px' }} onClick={() => setActiveComponentTab('pt')}>Performance Tasks</button>
                  <button className={`tab-btn ${activeComponentTab === 'exam' ? 'active' : ''}`} style={{ fontSize: '0.8125rem', padding: '4px 12px' }} onClick={() => setActiveComponentTab('exam')}>Exams</button>
                </div>
              </div>

              <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'white' }}>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, zIndex: 11, background: 'var(--brand-50)' }}>#</th>
                      <th style={{ position: 'sticky', left: 40, zIndex: 11, background: 'var(--brand-50)', minWidth: 150 }}>Student Name</th>
                      {activeComponentTab === 'summary' ? (
                        <>
                          <th>Student No.</th><th>WW Score</th><th>PT Score</th><th>Exam Score</th><th>Initial</th><th>Final Grade</th><th>Status</th><th>Action</th>
                        </>
                      ) : (
                        // Component-specific headers
                        (() => {
                          const itemsObj = students[0]?.terms?.[activeTermTab]?.[activeComponentTab === 'ww' ? 'writtenWorks' : activeComponentTab === 'pt' ? 'performanceTasks' : 'exams'];
                          const itemsArr = Array.isArray(itemsObj) ? itemsObj : Object.values(itemsObj || {});
                          return itemsArr.map((item, i) => (
                            <th key={i} style={{ textAlign: 'center', minWidth: 100 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.label}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>HPS: {item.hps}</div>
                            </th>
                          ));
                        })()
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const term = s.terms?.[activeTermTab];
                      const summ = term?.summary;
                      const rawItems = term?.[activeComponentTab === 'ww' ? 'writtenWorks' : activeComponentTab === 'pt' ? 'performanceTasks' : 'exams'];
                      const items = Array.isArray(rawItems) ? rawItems : Object.values(rawItems || {});
                      
                      return (
                        <tr key={i}>
                          <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'white', color: 'var(--text-muted)' }}>{i + 1}</td>
                          <td style={{ position: 'sticky', left: 40, zIndex: 5, background: 'white', fontWeight: 600 }}>{s.name}</td>
                          
                          {activeComponentTab === 'summary' ? (
                            <>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{s.studentNo}</td>
                              <td>{summ?.wwWS !== null ? summ?.wwWS?.toFixed(2) : '—'}</td>
                              <td>{summ?.ptWS !== null ? summ?.ptWS?.toFixed(2) : '—'}</td>
                              <td>{summ?.examWS !== null ? summ?.examWS?.toFixed(2) : '—'}</td>
                              <td>{summ?.initialGrade ?? '—'}</td>
                              <td><GradePill grade={summ?.transmutedGrade} /></td>
                              <td><StatusBadge status={summ?.status} /></td>
                              <td>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedStudent(s); setMode('individual'); }}>
                                  <Edit3 size={13} /> Edit
                                </button>
                              </td>
                            </>
                          ) : (
                            // Component-specific editable cells
                            items.map((item, colIdx) => {
                              const val = getScore(s.studentNo, activeTermTab, item.col, item.score);
                              const changed = val !== item.score;
                              return (
                                <td key={colIdx} style={{ textAlign: 'center' }}>
                                  <input
                                    type="number" min="0" max={item.hps} step="0.25"
                                    className={`score-input ${changed ? 'changed' : ''} ${val > item.hps ? 'error-cell' : ''}`}
                                    style={{ width: '80px', margin: '0 auto', textAlign: 'center' }}
                                    value={val ?? ''}
                                    onChange={e => updateScore(s.studentNo, activeTermTab, item.col, item.row, item.hps, item.label, e.target.value === '' ? null : parseFloat(e.target.value))}
                                  />
                                </td>
                              );
                            })
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Class Detail Page ────────────────────────────────────────────────────────
function ClassDetailPage({ classInfo, onBack }) {
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    api.get(`/teacher/class/${encodeURIComponent(classInfo.fileName)}`)
      .then(r => setClassData(r.data))
      .catch(() => toast.error('Failed to load class.'))
      .finally(() => setLoading(false));
  }, [classInfo.fileName]);

  const handleReupload = async (file) => {
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append('gradesFile', file);
      await api.post('/teacher/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('File re-uploaded successfully!');
      const res = await api.get(`/teacher/class/${encodeURIComponent(classInfo.fileName)}`);
      setClassData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Re-upload failed.');
    } finally { setUploadLoading(false); }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/teacher/download/${encodeURIComponent(classInfo.fileName)}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', classInfo.fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      toast.error('Download failed.');
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;
  const students = classData?.students || [];
  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.studentNo.includes(search));

  const handleCloseEditMode = () => {
    setEditMode(false);
    api.get(`/teacher/class/${encodeURIComponent(classInfo.fileName)}`)
      .then(r => setClassData(r.data))
      .catch(() => {});
  };

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <h2 style={{ fontWeight: 800 }}>{classInfo.subject || classInfo.fileName?.replace('.xlsx', '')}</h2>
        <span className="badge badge-brand">{classInfo.section}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setEditMode(true)}>
          <Edit3 size={14} /> Edit Grades
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleDownload}>
          <Download size={14} /> Download
        </button>
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', position: 'relative' }}>
          <Upload size={14} /> Re-upload
          <input type="file" accept=".xlsx" style={{ display: 'none', position: 'absolute' }} onChange={e => { const f = e.target.files[0]; if (f) handleReupload(f); }} />
        </label>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1rem' }}>Student Grades — {students.length} students</h3>
          <div className="search-wrapper">
            <Search size={14} className="search-icon" />
            <input type="text" className="search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrapper" style={{ borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Student Name</th><th>Student No.</th>
                <th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Final</th><th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const gs = s.gradingSummary;
                return (
                  <tr key={i}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{s.studentNo}</td>
                    <td><GradePill grade={gs?.term1 || s.terms?.['Term 1']?.transmutedGrade} /></td>
                    <td><GradePill grade={gs?.term2 || s.terms?.['Term 2']?.transmutedGrade} /></td>
                    <td><GradePill grade={gs?.term3 || s.terms?.['Term 3']?.transmutedGrade} /></td>
                    <td><GradePill grade={gs?.finalGrade} /></td>
                    <td>{gs?.remarks ? <StatusBadge status={gs.remarks} /> : <span className="badge badge-neutral">Pending</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editMode} onClose={handleCloseEditMode} title={`Edit Grades — ${classInfo.subject || classInfo.fileName}`} size="xl">
        <GradeEditModal classInfo={classInfo} onClose={handleCloseEditMode} />
      </Modal>
    </div>
  );
}

// ─── Templates Page ───────────────────────────────────────────────────────────
function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/templates').then(r => setTemplates(r.data.templates || [])).catch(() => toast.error('Failed to load templates.')).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;

  return (
    <div className="page-content fade-in">
      <h2 style={{ fontWeight: 800, marginBottom: 20 }}>Grade Templates</h2>
      {templates.length === 0 ? (
        <EmptyState icon={BookOpen} title="No templates available" description="The administrator has not uploaded any templates yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map((t, i) => (
            <div key={i} className="card" style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700 }}>{t.name}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  {(t.size / 1024).toFixed(1)} KB • Last updated: {t.lastModified ? new Date(t.lastModified).toLocaleDateString() : '—'}
                </p>
              </div>
              <a className="btn btn-secondary btn-sm" href={`/api/teacher/download-template/${encodeURIComponent(t.name)}`} download>
                <Download size={14} /> Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Teacher Dashboard ───────────────────────────────────────────────────
export default function TeacherDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState(null);
  const page = location.pathname.replace('/teacher', '').replace('/', '') || 'classes';

  const nav = [
    { icon: LayoutDashboard, label: 'My Classes', active: !selectedClass && (page === 'classes' || page === ''), onClick: () => { setSelectedClass(null); navigate('/teacher'); } },
    { icon: BookOpen, label: 'Templates', active: page === 'templates', onClick: () => { setSelectedClass(null); navigate('/teacher/templates'); } },
  ];

  return (
    <AppLayout navItems={nav} role="teacher">
      <Routes>
        <Route path="/" element={
          <>
            <PageHeader
              title={selectedClass ? (selectedClass.subject || selectedClass.fileName?.replace('.xlsx', '')) : 'My Classes'}
              subtitle={selectedClass ? `${selectedClass.section} — ${selectedClass.studentCount} students` : 'Manage your grade sheets'}
            />
            {selectedClass ? (
              <ClassDetailPage classInfo={selectedClass} onBack={() => setSelectedClass(null)} />
            ) : (
              <ClassListPage onSelectClass={setSelectedClass} />
            )}
          </>
        } />
        <Route path="/templates" element={
          <>
            <PageHeader title="Templates" subtitle="Download grade sheet templates from the admin" />
            <TemplatesPage />
          </>
        } />
      </Routes>
    </AppLayout>
  );
}
