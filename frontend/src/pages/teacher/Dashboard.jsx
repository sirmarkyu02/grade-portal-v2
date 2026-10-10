import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Upload, Download, Edit3, Save, X, Search, RotateCcw, Eye, EyeOff, Users, Settings, Activity, Award } from 'lucide-react';
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

      <div className="grid-2 teacher-dashboard-grid" style={{ alignItems: 'start' }}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 16, minWidth: 0, flex: 1 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--brand-600)' }}>
                        <BookOpen size={24} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: 2, wordWrap: 'break-word', lineHeight: 1.3 }}>{cls.subject || cls.fileName?.replace('.xlsx', '')}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cls.section} • {cls.gradeLevel}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Last updated: {cls.lastModified ? new Date(cls.lastModified).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                      <span className="badge" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', padding: '6px 12px' }}>{cls.studentCount} students</span>
                      <span style={{ color: 'var(--brand-400)', marginLeft: 4 }}>›</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="upload-section" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

function ManageColumnsModal({ classInfo, isTermLocked, onClose, onSaved, initialMode = "table" }) {
  const [headers, setHeaders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTermTab, setActiveTermTab] = useState('Term 1');
  const [activeComponentTab, setActiveComponentTab] = useState(initialMode === 'attendance' ? 'attendance' : 'ww');

  useEffect(() => {
    api.get(`/teacher/class/${encodeURIComponent(classInfo.fileName)}/headers`)
      .then(r => {
        setHeaders(r.data);
        const terms = Object.keys(r.data.columns || {});
        if (terms.length > 0 && !terms.includes(activeTermTab)) {
          setActiveTermTab(terms[0]);
        }
      })
      .catch(() => toast.error('Failed to load headers.'))
      .finally(() => setLoading(false));
  }, [classInfo.fileName]);

  const handleAddItem = (type) => {
    setHeaders(prev => {
      const next = { ...prev };
      if (type === 'attendance') {
        const idx = next.attendance.findIndex(a => !a.dateStr);
        if (idx !== -1) {
          next.attendance = [...next.attendance];
          next.attendance[idx] = { ...next.attendance[idx], dateStr: new Date().toLocaleDateString('en-US'), term: activeTermTab.replace('Term ', 'T') };
        } else {
          toast.error('No more attendance columns available.');
        }
      } else {
        const termData = { ...next.columns[activeTermTab] };
        termData[type] = [...termData[type]];
        const idx = termData[type].findIndex(i => i.hps === null || i.hps === undefined || i.hps === '');
        if (idx !== -1) {
           const activeCount = termData[type].filter(i => i.hps !== null && i.hps !== undefined && i.hps !== '').length;
           termData[type][idx] = { ...termData[type][idx], hps: 10, label: `${type === 'ww' ? 'WW' : 'PT'}${activeCount + 1}` };
        } else {
          toast.error(`No more columns available for ${type.toUpperCase()}.`);
        }
        next.columns = { ...next.columns, [activeTermTab]: termData };
      }
      return next;
    });
  };

  const handleUpdate = (type, col, key, val) => {
    setHeaders(prev => {
      const next = { ...prev };
      if (type === 'attendance') {
        const idx = next.attendance.findIndex(a => a.col === col);
        if (idx !== -1) {
          next.attendance = [...next.attendance];
          next.attendance[idx] = { ...next.attendance[idx], [key]: val };
        }
      } else {
        const termData = { ...next.columns[activeTermTab] };
        termData[type] = [...termData[type]];
        const idx = termData[type].findIndex(i => i.col === col);
        if (idx !== -1) {
          termData[type][idx] = { ...termData[type][idx], [key]: val };
        }
        next.columns = { ...next.columns, [activeTermTab]: termData };
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [];
      const attendanceUpdates = [];
      for (const [termName, termData] of Object.entries(headers.columns)) {
        if (isTermLocked(termName)) continue;
        for (const w of termData.ww) updates.push({ termName, col: w.col, hps: w.hps, label: w.label, dateStr: w.date });
        for (const p of termData.pt) updates.push({ termName, col: p.col, hps: p.hps, label: p.label, dateStr: p.date });
        if (termData.exam) {
          for (const e of termData.exam) updates.push({ termName, col: e.col, hps: e.hps, label: e.label, dateStr: e.date });
        }
      }
      for (const a of headers.attendance) {
        const fullTermName = a.term ? a.term.replace('T', 'Term ') : null;
        if (fullTermName && isTermLocked(fullTermName)) continue;
        attendanceUpdates.push({ col: a.col, dateStr: a.dateStr, term: a.term });
      }
      await api.put(`/teacher/class/${encodeURIComponent(classInfo.fileName)}/headers`, { updates, attendanceUpdates });
      toast.success('Activities/Attendance saved successfully!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>;
  if (!headers) return <div style={{ padding: 48, textAlign: 'center' }}>Failed to load headers.</div>;

  const renderTable = (items, type) => {
    if (!items) return null;
    const activeItems = type === 'exam' ? items : items.filter(item => type === 'attendance' ? item.dateStr : (item.hps !== null && item.hps !== undefined && item.hps !== ''));
    const isLocked = isTermLocked(activeTermTab);
    
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ fontWeight: 600 }}>{type === 'ww' ? 'Written Works' : type === 'pt' ? 'Performance Tasks' : type === 'exam' ? 'Term Exams' : 'Attendance Dates'}</h4>
          {type !== 'exam' && (
            <button className="btn btn-primary btn-sm" onClick={() => handleAddItem(type)} disabled={isLocked}>
              + Add {type === 'attendance' ? "Today's Date" : 'Item'}
            </button>
          )}
        </div>
        {activeItems.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8 }}>
            No items yet. Click "Add Item" to add one.
          </div>
        ) : (
          <div className="table-wrapper" style={{ maxHeight: 400 }}>
            <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'white' }}>
                <tr>
                  <th style={{width: 50}}>#</th>
                  {type !== 'attendance' && <th>HPS</th>}
                  <th>Label / Term</th>
                  <th>Date</th>
                  {type !== 'exam' && <th className="no-print">Action</th>}
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item, i) => (
              <tr key={item.col}>
                <td>{i + 1}</td>
                {type !== 'attendance' && (
                  <td>
                    <input type="number" min="0" value={item.hps ?? ''} onChange={e => handleUpdate(type, item.col, 'hps', e.target.value ? Number(e.target.value) : null)} style={{ width: 80, padding: 4 }} disabled={isLocked} />
                  </td>
                )}
                <td>
                  {type === 'exam' ? (
                    <span style={{
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.label}
                    </span>
                  ) : (
                    <input type="text" value={type === 'attendance' ? (item.term || '') : (item.label || '')} onChange={e => handleUpdate(type, item.col, type === 'attendance' ? 'term' : 'label', e.target.value)} style={{ width: 100, padding: 4 }} disabled={isLocked} />
                  )}
                </td>
                <td>
                  <input type="text" placeholder="e.g. 10/06/2026" value={type === 'attendance' ? (item.dateStr || '') : (item.date || '')} onChange={e => handleUpdate(type, item.col, type === 'attendance' ? 'dateStr' : 'date', e.target.value)} style={{ width: 120, padding: 4 }} disabled={isLocked} />
                </td>
                {type !== 'exam' && (
                  <td>
                    <button className="btn btn-ghost btn-sm" disabled={isLocked} onClick={() => {
                      if (type === 'attendance') {
                        handleUpdate(type, item.col, 'dateStr', '');
                        handleUpdate(type, item.col, 'term', '');
                      } else {
                        handleUpdate(type, item.col, 'hps', null);
                        handleUpdate(type, item.col, 'label', '');
                        handleUpdate(type, item.col, 'date', '');
                      }
                    }} style={{ color: 'var(--danger)' }} title="Remove item"><X size={14}/></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      </div>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {initialMode !== 'attendance' && (
          <>
            <button className={`tab-btn ${activeComponentTab === 'ww' ? 'active' : ''}`} onClick={() => setActiveComponentTab('ww')}>Written Works</button>
            <button className={`tab-btn ${activeComponentTab === 'pt' ? 'active' : ''}`} onClick={() => setActiveComponentTab('pt')}>Performance Tasks</button>
            <button className={`tab-btn ${activeComponentTab === 'exam' ? 'active' : ''}`} onClick={() => setActiveComponentTab('exam')}>Exams</button>
          </>
        )}
        <button className={`tab-btn ${activeComponentTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveComponentTab('attendance')}>Attendance</button>
      </div>
      <div className="tabs" style={{ marginBottom: 16 }}>
          {['Term 1', 'Term 2', 'Term 3', 'Term 4'].map(t => (
            headers.columns?.[t] && <button key={t} className={`tab-btn ${activeTermTab === t ? 'active' : ''}`} onClick={() => setActiveTermTab(t)}>{t}</button>
          ))}
        </div>
      {activeComponentTab === 'ww' && renderTable(headers.columns?.[activeTermTab]?.ww, 'ww')}
      {activeComponentTab === 'pt' && renderTable(headers.columns?.[activeTermTab]?.pt, 'pt')}
      {activeComponentTab === 'exam' && renderTable(headers.columns?.[activeTermTab]?.exam, 'exam')}
      {activeComponentTab === 'attendance' && renderTable(headers.attendance?.filter(a => !a.term || String(a.term).includes(activeTermTab.replace('Term ', ''))), 'attendance')}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <LoadingSpinner /> : <Save size={14} />} Save Columns
        </button>
      </div>
    </div>
  );
}


function ClassSettingsModal({ classInfo, settings, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    return {
      hideTerm1: false,
      hideTerm2: true,
      hideTerm3: true,
      hideTerm4: true,
      ...settings
    };
  });
  const [saving, setSaving] = useState(false);

  const updateSetting = async (key, val, subKey) => {
    let newForm = { ...form };
    if (subKey) {
      newForm[key] = { ...(newForm[key] || {}), [subKey]: val };
    } else {
      newForm[key] = val;
    }
    setForm(newForm);
    
    // Auto-save
    try {
      await api.put(`/teacher/class/${encodeURIComponent(classInfo.fileName)}/settings`, newForm);
      onSaved();
    } catch {
      toast.error('Failed to auto-save settings');
    }
  };

  const terms = [
    { id: 1, name: 'Term 1', hideKey: 'hideTerm1' },
    { id: 2, name: 'Term 2', hideKey: 'hideTerm2' },
    { id: 3, name: 'Term 3', hideKey: 'hideTerm3' },
    { id: 4, name: 'Term 4', hideKey: 'hideTerm4' }
  ];

  return (
    <div style={{ padding: '24px 32px' }}>
      <h3 style={{ marginBottom: 8, fontSize: '1.25rem', fontWeight: 600 }}>Term & Grade Visibility Options</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem', lineHeight: 1.5 }}>
        Manage what students can see in their grade portal. You can hide an entire term (all scores and grades) or just hide the final calculated grade for that term.
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
        {terms.map(t => {
          const isTermHidden = form[t.hideKey] === true;
          const isFinalReleased = form.releaseFinals?.[t.name] !== false;

          return (
            <div key={t.id} style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              opacity: isTermHidden ? 0.75 : 1,
              transition: 'all 0.2s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: isTermHidden ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {isTermHidden ? 'Term is currently hidden from students.' : 'Students can see their quiz/activity scores.'}
                  </div>
                </div>
                <label className="toggle" title={`Toggle ${t.name} Visibility`}>
                  <input 
                    type="checkbox" 
                    checked={!isTermHidden} 
                    onChange={e => updateSetting(t.hideKey, !e.target.checked)} 
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              {!isTermHidden && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Show Final Grade to Students
                      </div>
                    </div>
                    <label className="toggle toggle-sm">
                      <input 
                        type="checkbox" 
                        checked={isFinalReleased} 
                        onChange={e => updateSetting('releaseFinals', e.target.checked, t.name)} 
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Hide Grade Breakdown
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Only final grade shown (WW, PT, Exams hidden)
                      </div>
                    </div>
                    <label className="toggle toggle-sm">
                      <input 
                        type="checkbox" 
                        checked={form.hideBreakdown?.[t.name] === true} 
                        onChange={e => updateSetting('hideBreakdown', e.target.checked, t.name)} 
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>



      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ─── Grade Edit Mode ──────────────────────────────────────────────────────────

function GradeEditModal({ classInfo, onClose, initialMode = 'table' }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState(initialMode); // 'table' | 'individual' | 'attendance'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTermTab, setActiveTermTab] = useState('Term 1');
  const [activeComponentTab, setActiveComponentTab] = useState('summary'); // 'summary' | 'ww' | 'pt' | 'exam' | 'attendance'
  const [manageColsOpen, setManageColsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [classSettings, setClassSettings] = useState({});
  const [termLocks, setTermLocks] = useState({});
  const isTermLocked = (term) => typeof termLocks[term] === 'object' ? termLocks[term]?.[classInfo.fileName] : termLocks[term];
  const [changes, setChanges] = useState({}); // { studentNo: { termName: { key: updObj } } }

  const handleKeyDown = (e, rowIdx, colIdx, maxRow, maxCol) => {
    if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Enter'].includes(e.key)) {
      e.preventDefault();
      let nextRow = rowIdx;
      let nextCol = colIdx;
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        nextRow = Math.min(rowIdx + 1, maxRow);
      } else if (e.key === 'ArrowUp') {
        nextRow = Math.max(rowIdx - 1, 0);
      } else if (e.key === 'ArrowRight') {
        nextCol = Math.min(colIdx + 1, maxCol);
      } else if (e.key === 'ArrowLeft') {
        nextCol = Math.max(colIdx - 1, 0);
      }
      
      if (nextRow !== rowIdx || nextCol !== colIdx) {
        const nextInput = document.querySelector(`input[data-row="${nextRow}"][data-col="${nextCol}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
    }
  };
  const [search, setSearch] = useState('');

  const loadClassData = useCallback(() => {
    return Promise.all([
      api.get(`/teacher/class/${encodeURIComponent(classInfo.fileName)}/full`),
      api.get('/settings/public')
    ]).then(([rClass, rSet]) => {
      const newStudents = rClass.data.students || [];
      setStudents(newStudents);
      setClassSettings(rClass.data.settings || {});
      setTermLocks(rSet.data.termLocks || {});
      setSelectedStudent(prev => {
        if (!prev) return prev;
        return newStudents.find(s => s.studentNo === prev.studentNo) || prev;
      });
    }).catch(() => toast.error('Failed to load class data.'));
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
    
    const updatesByStudent = {};
    for (const studentNo of studentNos) {
      const studentChanges = changes[studentNo];
      const updates = [];
      for (const termChanges of Object.values(studentChanges)) {
        for (const upd of Object.values(termChanges)) {
          updates.push(upd);
        }
      }
      if (updates.length > 0) {
        updatesByStudent[studentNo] = updates;
      }
    }

    try {
      await api.put(`/teacher/class/${encodeURIComponent(classInfo.fileName)}/batch-update`, { updatesByStudent });
      setChanges({});
      await loadClassData();
      toast.success('Saved all changes successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed.');
    }
    
    setSaving(false);
  };

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.studentNo.includes(search));


  const termNames = students.length > 0 ? Object.keys(students[0].terms || {}) : ['Term 1', 'Term 2', 'Term 3'];
  const visibleTerms = termNames;


  useEffect(() => {
    if (visibleTerms.length > 0) {
      if (!activeTermTab) setActiveTermTab(visibleTerms[0]);
    }
  }, [activeTermTab, visibleTerms]);


  const renderStudentTermEditor = (student, termName) => {
    const term = student.terms?.[termName];
    if (!term) return <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No data for {termName}.</p>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[
          ['Written Works', term.writtenWorks],
          ['Performance Tasks', term.performanceTasks],
          ['Examinations', Object.values(term.exams || {})]
        ].map(([title, items]) => (
          items && items.length > 0 ? (
            <div key={title}>
              <h5 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10, color: 'var(--text-secondary)' }}>{title}</h5>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr><th>Item</th>{title !== 'Attendance' && <th>Max Score (HPS)</th>}<th>Score / Status</th></tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const val = getScore(student.studentNo, title === 'Attendance' ? 'Attendance' : termName, item.col, title === 'Attendance' ? item.status : item.score);
                      const changed = val !== (title === 'Attendance' ? item.status : item.score);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 500 }}>{title === 'Attendance' ? item.date : item.label}</td>
                          {title !== 'Attendance' && <td style={{ color: 'var(--text-muted)' }}>{item.hps}</td>}
                          <td>
                            {title === 'Attendance' ? (
                              <input
                                type="text"
                                className={`score-input ${changed ? 'changed' : ''} ${val && !['P', 'A', 'L', 'E'].includes(val.toUpperCase()) ? 'error-cell' : ''}`}
                                style={{ width: '80px', textAlign: 'center', textTransform: 'uppercase' }}
                                maxLength="1"
                                disabled={isTermLocked(termName)}
                                value={val || ''}
                                title="P: Present, A: Absent, L: Late, E: Excused"
                                onChange={e => {
                                  let inputVal = e.target.value.toUpperCase();
                                  updateScore(student.studentNo, 'Attendance', item.col, item.row, null, null, inputVal);
                                }}
                              />
                            ) : (
                              <input
                                type="number" min="0" max={item.hps} step="0.25"
                                className={`score-input ${changed ? 'changed' : ''} ${val > item.hps ? 'error-cell' : ''}`}
                                disabled={isTermLocked(termName)}
                                value={val ?? ''}
                                onChange={e => updateScore(student.studentNo, termName, item.col, item.row, item.hps, item.label, e.target.value === '' ? null : parseFloat(e.target.value))}
                              />
                            )}
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
        <div className="search-wrapper no-print">
          <Search size={16} className="search-icon" />
          <input type="text" className="search-input" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {initialMode !== 'attendance' ? (
          <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <button onClick={() => setMode('table')} className={`btn btn-sm ${mode === 'table' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: 0 }}>Table View</button>
            <button onClick={() => setMode('individual')} className={`btn btn-sm ${mode === 'individual' ? 'btn-primary' : 'btn-ghost'}`} style={{ borderRadius: 0 }}>Individual</button>
          </div>
        ) : null}
        <button className="btn btn-secondary btn-sm no-print" onClick={() => setManageColsOpen(true)}>
          <Settings size={14} /> {initialMode === 'attendance' ? 'Manage Attendance' : 'Manage Activities & Attendance'}
        </button>
        <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>
          🖨️ Print (Browser)
        </button>
        {initialMode !== 'attendance' && (
          <button className="btn btn-secondary btn-sm" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} /> Class Settings
          </button>
        )}
        {Object.keys(changes).length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={saveAllChanges} disabled={saving}>
            {saving ? <LoadingSpinner /> : <Save size={14} />} Save All ({Object.keys(changes).length})
          </button>
        )}
      </div>

      <Modal open={manageColsOpen} onClose={() => setManageColsOpen(false)} title={initialMode === 'attendance' ? 'Manage Attendance' : 'Manage Activities & Attendance'} size="lg">
        <ManageColumnsModal classInfo={classInfo} isTermLocked={isTermLocked} onClose={() => setManageColsOpen(false)} onSaved={() => { setManageColsOpen(false); setLoading(true); loadClassData().finally(() => setLoading(false)); }} initialMode={initialMode} />
      </Modal>
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Class Settings" size="md">
        <ClassSettingsModal classInfo={classInfo} settings={classSettings} onClose={() => setSettingsOpen(false)} onSaved={() => { loadClassData(); }} />
      </Modal>

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
                  {visibleTerms.map(t => <button key={t} className={`tab-btn ${activeTermTab === t ? 'active' : ''}`} onClick={() => setActiveTermTab(t)}>{t}</button>)}
                </div>
                {renderStudentTermEditor(selectedStudent, activeTermTab)}
              </div>
            )
          ) : mode === 'attendance' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="tabs">
                  {visibleTerms.map(t => <button key={t} className={`tab-btn ${activeTermTab === t ? 'active' : ''}`} onClick={() => setActiveTermTab(t)}>{t}</button>)}
                </div>
              </div>
              <div className="table-wrapper" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'white' }}>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, zIndex: 11, background: 'var(--brand-50)', minWidth: 40, width: 40, padding: '8px 2px', textAlign: 'center' }}>#</th>
                        <th style={{ position: 'sticky', left: 40, zIndex: 11, background: 'var(--brand-50)', minWidth: 220, width: 220, maxWidth: 220, padding: '8px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>Student Name</th>
                      {(() => {
                        const attRecs = (students.find(s => s.attendance?.records?.length > 0))?.attendance?.records || [];
                          const itemsArr = attRecs.filter(a => !a.term || String(a.term).includes(activeTermTab.replace('Term ', '')));
                        return itemsArr.map((item, i) => (
                          <th key={i} style={{ textAlign: 'center', minWidth: 60 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{!isNaN(new Date(item.date)) ? `${(new Date(item.date).getMonth() + 1).toString().padStart(2, '0')}/${new Date(item.date).getDate().toString().padStart(2, '0')}` : item.date}</div>
                            <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4 }}>
                              {!isNaN(new Date(item.date)) ? ['Su','M','T','W','Th','F','Sa'][new Date(item.date).getDay()] : '-'}
                            </div>
                          </th>
                        ));
                      })()}
                      <th style={{ position: 'sticky', right: 150, zIndex: 11, textAlign: 'center', minWidth: 50, width: 50, background: 'var(--brand-50)', borderLeft: '2px solid var(--border)', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }} title="Total Present">P</th>
                      <th style={{ position: 'sticky', right: 100, zIndex: 11, textAlign: 'center', minWidth: 50, width: 50, background: 'var(--brand-50)' }} title="Total Absent">A</th>
                      <th style={{ position: 'sticky', right: 50, zIndex: 11, textAlign: 'center', minWidth: 50, width: 50, background: 'var(--brand-50)' }} title="Total Late">L</th>
                      <th style={{ position: 'sticky', right: 0, zIndex: 11, textAlign: 'center', minWidth: 50, width: 50, background: 'var(--brand-50)' }} title="Total Excused">E</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => {
                      const attRecs = s.attendance?.records || [];
                      const items = attRecs.filter(a => !a.term || String(a.term).includes(activeTermTab.replace('Term ', '')));
                      
                      return (
                        <tr key={i}>
                          <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'white', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 2px', minWidth: 40, width: 40 }}>{i + 1}</td>
                            <td style={{ position: 'sticky', left: 40, zIndex: 5, background: 'white', fontWeight: 600, padding: '8px 8px', whiteSpace: 'nowrap', minWidth: 220, width: 220, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</td>
                          {items.map((item, colIdx) => {
                            const val = getScore(s.studentNo, 'Attendance', item.col, item.status);
                            const changed = val !== item.status;
                            return (
                              <td key={colIdx} style={{ textAlign: 'center', padding: '4px', borderLeft: '1px solid var(--border)' }}>
                                <input
                                  type="text"
                                  data-row={i}
                                  data-col={colIdx}
                                  className={`score-input ${changed ? 'changed' : ''} ${val && !['P', 'A', 'L', 'E'].includes(val.toUpperCase()) ? 'error-cell' : ''}`}
                                  style={{
                                    width: '36px', height: '36px', margin: '0 auto', textAlign: 'center', textTransform: 'uppercase',
                                    fontWeight: val ? 700 : 400,
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: val === 'P' ? '#d1fae5' : val === 'A' ? '#fee2e2' : val === 'L' ? '#fef3c7' : val === 'E' ? '#dbeafe' : 'var(--bg-input)',
                                    color: val === 'P' ? '#065f46' : val === 'A' ? '#991b1b' : val === 'L' ? '#92400e' : val === 'E' ? '#1e40af' : 'inherit'
                                  }}
                                  maxLength="1"
                                  disabled={isTermLocked(activeTermTab)}
                                  value={val || ''}
                                  title="P: Present, A: Absent, L: Late, E: Excused"
                                  onKeyDown={(e) => handleKeyDown(e, i, colIdx, filtered.length - 1, items.length - 1)}
                                  onChange={e => {
                                    let inputVal = e.target.value.toUpperCase();
                                    updateScore(s.studentNo, 'Attendance', item.col, item.row, null, null, inputVal);
                                  }}
                                />
                              </td>
                            );
                          })}
                          {(() => {
                            let p = 0, a = 0, l = 0, e = 0;
                            items.forEach(item => {
                              const val = getScore(s.studentNo, 'Attendance', item.col, item.status)?.toUpperCase();
                              if (val === 'P') p++;
                              if (val === 'A') a++;
                              if (val === 'L') l++;
                              if (val === 'E') e++;
                            });
                            return (
                              <>
                                <td style={{ position: 'sticky', right: 150, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, borderLeft: '2px solid var(--border)', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>{p > 0 ? p : '-'}</td>
                                <td style={{ position: 'sticky', right: 100, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, color: 'var(--danger)' }}>{a > 0 ? a : '-'}</td>
                                <td style={{ position: 'sticky', right: 50, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, color: 'var(--warning)' }}>{l > 0 ? l : '-'}</td>
                                <td style={{ position: 'sticky', right: 0, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, color: 'var(--info)' }}>{e > 0 ? e : '-'}</td>
                              </>
                            );
                          })()}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            // Table mode: bulk editing and summary
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="tabs">
                  {visibleTerms.map(t => <button key={t} className={`tab-btn ${activeTermTab === t ? 'active' : ''}`} onClick={() => setActiveTermTab(t)}>{t}</button>)}
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
                          <th>Student No.</th><th>WW Score</th><th>PT Score</th><th>Exam Score</th><th>Initial</th><th>Final Grade</th><th>Status</th><th className="no-print">Action</th>
                        </>
                      ) : (
                        // Component-specific headers
                        (() => {
                          let itemsArr = [];
                          const itemsObj = students[0]?.terms?.[activeTermTab]?.[activeComponentTab === 'ww' ? 'writtenWorks' : activeComponentTab === 'pt' ? 'performanceTasks' : 'exams'];
                          itemsArr = Array.isArray(itemsObj) ? itemsObj : Object.values(itemsObj || {});
                          
                          return itemsArr.map((item, i) => (
                            <th key={i} style={{ textAlign: 'center', minWidth: 60 }}>
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
                              <td className="no-print">
                                <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedStudent(s); setMode('individual'); }}>
                                  <Edit3 size={13} /> Edit
                                </button>
                              </td>
                            </>
                          ) : (
                            // Component-specific editable cells
                            (() => {
                              let items = [];
                              const rawItems = s.terms?.[activeTermTab]?.[activeComponentTab === 'ww' ? 'writtenWorks' : activeComponentTab === 'pt' ? 'performanceTasks' : 'exams'];
                              items = Array.isArray(rawItems) ? rawItems : Object.values(rawItems || {});
                              
                              return items.map((item, colIdx) => {
                                const val = getScore(s.studentNo, activeTermTab, item.col, item.score);
                                const changed = val !== item.score;
                                return (
                                  <td key={colIdx} style={{ textAlign: 'center' }}>
                                    <input
                                      type="number" min="0" max={item.hps} step="0.25"
                                      data-row={i}
                                      data-col={colIdx}
                                      className={`score-input ${changed ? 'changed' : ''} ${val > item.hps ? 'error-cell' : ''}`}
                                      style={{ width: '80px', margin: '0 auto', textAlign: 'center' }}
                                      disabled={isTermLocked(activeTermTab)}
                                      value={val ?? ''}
                                      onKeyDown={(e) => handleKeyDown(e, i, colIdx, filtered.length - 1, items.length - 1)}
                                      onChange={e => updateScore(s.studentNo, activeTermTab, item.col, item.row, item.hps, item.label, e.target.value === '' ? null : parseFloat(e.target.value))}
                                    />
                                  </td>
                                );
                              });
                            })()
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
  const [activeView, setActiveView] = useState('Grades');
  const [search, setSearch] = useState('');
  const [activeAttTerm, setActiveAttTerm] = useState('Term 1');
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
  const termNames = students.length > 0 ? Object.keys(students[0].terms || {}) : ['Term 1', 'Term 2', 'Term 3'];
  const visibleTerms = termNames;

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
        <button className="btn btn-primary btn-sm no-print" onClick={() => setEditMode(true)}>
          <Edit3 size={14} /> {activeView === "Attendance" ? "Edit Attendance" : "Edit Grades"}
        </button>
        <button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>
          🖨️ Print (Browser)
        </button>
        <button className="btn btn-secondary btn-sm no-print" onClick={handleDownload}>
          <Download size={14} /> Export Template (Excel)
        </button>
        <label className="btn btn-secondary btn-sm no-print" style={{ cursor: 'pointer', position: 'relative' }}>
          <Upload size={14} /> Re-upload
          <input type="file" accept=".xlsx" style={{ display: 'none', position: 'absolute' }} onChange={e => { const f = e.target.files[0]; if (f) handleReupload(f); }} />
        </label>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>Student {activeView} — {students.length} students</h3>
          
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="tabs" style={{ background: 'var(--brand-50)', padding: 4, borderRadius: 8 }}>
              <button 
                className={`tab-btn ${activeView === 'Grades' ? 'active' : ''}`}
                onClick={() => setActiveView('Grades')}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: activeView === 'Grades' ? 'white' : 'transparent', boxShadow: activeView === 'Grades' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: activeView === 'Grades' ? 600 : 500, color: activeView === 'Grades' ? 'var(--brand-600)' : 'var(--text-muted)' }}
              >
                Grades
              </button>
              <button 
                className={`tab-btn ${activeView === 'Attendance' ? 'active' : ''}`}
                onClick={() => setActiveView('Attendance')}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: activeView === 'Attendance' ? 'white' : 'transparent', boxShadow: activeView === 'Attendance' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: activeView === 'Attendance' ? 600 : 500, color: activeView === 'Attendance' ? 'var(--brand-600)' : 'var(--text-muted)' }}
              >
                Attendance
              </button>
            </div>

            <div className="search-wrapper" style={{ margin: 0 }}>
              <Search size={14} className="search-icon" />
              <input type="text" className="search-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {activeView === 'Grades' && (
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
        )}

        {activeView === 'Attendance' && (
          <>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 10, alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Select Term:</span>
              <div className="tabs" style={{ gap: 4 }}>
                {visibleTerms.map(t => (
                  <button 
                    key={t} 
                    className={`tab-btn ${activeAttTerm === t ? 'active' : ''}`} 
                    style={{ fontSize: '0.8125rem', padding: '4px 12px' }} 
                    onClick={() => setActiveAttTerm(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrapper" style={{ borderRadius: 0, maxHeight: '500px', overflowX: 'auto', maxWidth: '100%', width: '100%', minWidth: 0 }}>
              <table className="data-table">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'white' }}>
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 11, background: 'var(--brand-50)', minWidth: 40, width: 40, padding: '8px 2px', textAlign: 'center' }}>#</th>
                        <th style={{ position: 'sticky', left: 40, zIndex: 11, background: 'var(--brand-50)', minWidth: 220, width: 220, maxWidth: 220, padding: '8px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>Student Name</th>
                  {(() => {
                    const attRecs = (filtered.find(s => s.attendance?.records?.length > 0))?.attendance?.records || [];
                      const itemsArr = attRecs.filter(a => !a.term || String(a.term).includes(activeAttTerm.replace('Term ', '')));
                    return itemsArr.map((item, i) => (
                      <th key={i} style={{ textAlign: 'center', minWidth: 50, padding: '8px 4px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.75rem' }}>{!isNaN(new Date(item.date)) ? `${(new Date(item.date).getMonth() + 1).toString().padStart(2, '0')}/${new Date(item.date).getDate().toString().padStart(2, '0')}` : item.date}</div>
                        <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: 4 }}>
                          {!isNaN(new Date(item.date)) ? ['Su','M','T','W','Th','F','Sa'][new Date(item.date).getDay()] : '-'}
                        </div>
                      </th>
                    ));
                  })()}
                  <th style={{ position: 'sticky', right: 120, zIndex: 11, textAlign: 'center', minWidth: 40, width: 40, background: 'var(--brand-50)', borderLeft: '2px solid var(--border)', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }} title="Total Present">P</th>
                  <th style={{ position: 'sticky', right: 80, zIndex: 11, textAlign: 'center', minWidth: 40, width: 40, background: 'var(--brand-50)' }} title="Total Absent">A</th>
                  <th style={{ position: 'sticky', right: 40, zIndex: 11, textAlign: 'center', minWidth: 40, width: 40, background: 'var(--brand-50)' }} title="Total Late">L</th>
                  <th style={{ position: 'sticky', right: 0, zIndex: 11, textAlign: 'center', minWidth: 40, width: 40, background: 'var(--brand-50)' }} title="Total Excused">E</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const attRecs = s.attendance?.records || [];
                  const items = attRecs.filter(a => !a.term || String(a.term).includes(activeAttTerm.replace('Term ', '')));
                  
                  return (
                    <tr key={i}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 5, background: 'white', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 2px', minWidth: 40, width: 40 }}>{i + 1}</td>
                            <td style={{ position: 'sticky', left: 40, zIndex: 5, background: 'white', fontWeight: 600, padding: '8px 8px', whiteSpace: 'nowrap', minWidth: 220, width: 220, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</td>
                      {items.map((item, colIdx) => {
                        let bg = 'transparent';
                        let color = 'var(--text-muted)';
                        if (item.status === 'P') { bg = '#d1fae5'; color = '#065f46'; }
                        else if (item.status === 'A') { bg = '#fee2e2'; color = '#991b1b'; }
                        else if (item.status === 'L') { bg = '#fef3c7'; color = '#92400e'; }
                        else if (item.status === 'E') { bg = '#dbeafe'; color = '#1e40af'; }
                        
                        return (
                          <td key={colIdx} style={{ textAlign: 'center', padding: '4px 8px', borderLeft: '1px dashed var(--border)' }}>
                            <div style={{
                                width: 24, height: 24, margin: '0 auto',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: 6, background: bg, color: color,
                                fontWeight: item.status ? 700 : 400, fontSize: '0.75rem'
                            }}>
                              {item.status || '—'}
                            </div>
                          </td>
                        );
                      })}
                      {(() => {
                        let p = 0, a = 0, l = 0, e = 0;
                        items.forEach(item => {
                          const val = item.status?.toUpperCase();
                          if (val === 'P') p++;
                          if (val === 'A') a++;
                          if (val === 'L') l++;
                          if (val === 'E') e++;
                        });
                        return (
                          <>
                            <td style={{ position: 'sticky', right: 120, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, borderLeft: '2px solid var(--border)', boxShadow: '-2px 0 5px rgba(0,0,0,0.05)' }}>{p > 0 ? p : '-'}</td>
                            <td style={{ position: 'sticky', right: 80, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, color: 'var(--danger)' }}>{a > 0 ? a : '-'}</td>
                            <td style={{ position: 'sticky', right: 40, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, color: 'var(--warning)' }}>{l > 0 ? l : '-'}</td>
                            <td style={{ position: 'sticky', right: 0, zIndex: 5, background: 'white', textAlign: 'center', fontWeight: 600, color: 'var(--info)' }}>{e > 0 ? e : '-'}</td>
                          </>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={editMode} onClose={handleCloseEditMode} title={`Edit ${activeView === "Attendance" ? "Attendance" : "Grades"} — ${classInfo.subject || classInfo.fileName}`} size="xl">
        <GradeEditModal classInfo={classInfo} onClose={handleCloseEditMode} initialMode={activeView === "Attendance" ? "attendance" : "table"} />
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

// ─── Grades for a subject ─────────────────────────────────────────────────────
function SubjectGrades({ subject }) {
  const termNames = Object.keys(subject.terms || {});
  const [activeTab, setActiveTab] = useState(termNames.length > 0 ? termNames[0] : 'Term 1');

  useEffect(() => {
    if (termNames.length > 0 && !termNames.includes(activeTab)) {
      setActiveTab(termNames[0]);
    }
  }, [termNames, activeTab]);

  if (termNames.length === 0) return <div className="empty-state"><p className="empty-desc">No grade data available for this subject yet.</p></div>;

  const term = subject.terms[activeTab];
  if (!term) return null;

  const formatShortDate = (dateStr) => {
    if (!dateStr || dateStr === '—') return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${dd}/${yy}`;
  };

  const renderScoreTable = (items, label) => {
    if (!items || items.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>No {label} recorded.</p>;
    
    const hasWeights = items.some(i => typeof i.weight === 'number');
    const total = items.reduce((s, i) => s + (i.hps || 0), 0);
    const scored = items.reduce((s, i) => s + (i.score !== null && i.score !== undefined && i.score !== '' ? Number(i.score) : 0), 0);

    let finalPct = 0;
    if (hasWeights) {
      items.forEach(i => {
        if (i.score !== null && i.score !== undefined && i.score !== '') {
          const ps = i.hps > 0 ? (Number(i.score) / i.hps) * 100 : 0;
          finalPct += ps * (i.weight || 0);
        }
      });
    } else {
      finalPct = total > 0 ? (scored / total) * 100 : 0;
    }

    return (
      <div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Date</th>
                <th>Score</th>
                <th>Max</th>
                {hasWeights && <th>Weight</th>}
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const pct = item.hps > 0 && item.score !== null && item.score !== '' ? Math.round((Number(item.score) / item.hps) * 100) : null;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{item.label}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      <span className="date-desktop">{item.date || '—'}</span>
                      <span className="date-mobile">{formatShortDate(item.date)}</span>
                    </td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.score ?? '—'}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.hps}</td>
                    {hasWeights && <td style={{ color: 'var(--text-muted)' }}>{typeof item.weight === 'number' ? `${Math.round(item.weight * 100)}%` : '—'}</td>}
                    <td>{pct !== null ? <span className={`badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-error'}`}>{pct}%</span> : '—'}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: 'var(--grad-soft)' }}>
                <td colSpan={2}><strong>Total</strong></td>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{hasWeights ? '—' : scored}</span></td>
                <td>{hasWeights ? '—' : total}</td>
                {hasWeights && <td><strong>100%</strong></td>}
                <td>{finalPct > 0 ? <span className="badge badge-brand">{Math.round(finalPct)}%</span> : '—'}</td>
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
              <div key={i} className="stat-card stat-card-sm">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{s.icon}</span>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.2, minWidth: 0, wordWrap: 'break-word' }}>{s.label}</p>
                </div>
                {s.isGrade ? <><div className="no-print"><GradePill grade={s.value} size="lg" /></div><p className="print-only stat-print-val">{s.value}</p></> : <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.25rem' }}>{s.value}</p>}
              </div>
            ))}
          </div>

          {/* Status banner if present */}
          {term.summary?.status && (
            (() => {
              const statStr = String(term.summary.status).toLowerCase();
              const hasGrade = term.summary.transmutedGrade !== null && term.summary.transmutedGrade !== undefined && term.summary.transmutedGrade !== '';
              
              if (!hasGrade || statStr.includes('hidden') || statStr.includes('progress') || statStr.includes('tba')) {
                return (
                  <div className="status-banner" style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--brand-50)', border: '1px solid var(--brand-100)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: 'var(--brand-100)', padding: 6, borderRadius: '50%', display: 'flex' }}>
                      <Activity size={18} color="var(--brand-600)" />
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--brand-700)', fontSize: '0.875rem' }}>
                      Grades for this term are currently in progress or hidden by the instructor.
                    </span>
                  </div>
                );
              }

              const isPassed = statStr.includes('pass');
              
              return (
                <div className="status-banner" style={{ padding: '12px 18px', borderRadius: 12, background: isPassed ? '#ecfdf5' : '#fef2f2', border: `1px solid ${isPassed ? '#a7f3d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ background: isPassed ? '#d1fae5' : '#fee2e2', padding: 6, borderRadius: '50%', display: 'flex' }}>
                    <Award size={18} color={isPassed ? '#059669' : '#dc2626'} />
                  </div>
                  <span style={{ fontWeight: 600, color: isPassed ? '#065f46' : '#991b1b', fontSize: '0.875rem' }}>
                    {isPassed ? 'Congratulations! You passed this term.' : 'You did not pass this term.'}
                  </span>
                </div>
              );
            })()
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

function StudentsOverview() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);

  useEffect(() => {
    api.get('/teacher/students')
      .then(r => setStudents(r.data.students || []))
      .catch((err) => {
        toast.error('Failed to load students. Did you restart the backend server?');
        console.error('API Error:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectStudent = async (studentNo) => {
    setSelectedStudent(studentNo);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/teacher/students/${studentNo}`);
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
          <div className="search-wrapper no-print">
            <Search size={14} className="search-icon" />
            <input type="text" className="search-input" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        {loading ? <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div> : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Student No.</th><th>Status</th><th>Subjects Handled</th><th className="no-print">Action</th></tr></thead>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!selectedStudent} onClose={() => { setSelectedStudent(null); setDetails(null); setSelectedSubject(null); }} title={selectedSubject ? "Subject Details" : "Student Details"} size="lg">
        {detailsLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><LoadingSpinner size="lg" /></div> : details ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {selectedSubject ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}><button className="btn btn-ghost btn-sm no-print" onClick={() => setSelectedSubject(null)} style={{ alignSelf: 'flex-start', marginBottom: -8 }}>← Back to overview</button><button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>🖨️ Print (Browser)</button></div>
                <div style={{ marginBottom: 12 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedSubject.info.subject}</h3>
                  <p style={{ color: 'var(--text-muted)' }}>{selectedSubject.info.section} • {details.student.name}</p>
                </div>
                <SubjectGrades subject={selectedSubject} />
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: -10 }}><button className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>🖨️ Print (Browser)</button></div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--grad-main)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
                    {details.student.name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{details.student.name}</h3>
                    <p style={{ color: 'var(--text-muted)' }}>ID: {details.student.studentNo}</p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.875rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={14} /> {details.student.subjects.length} Handled Subjects</span>
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
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Academic Performance (Handled by You)</h4>
                  {details.student.subjects.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No handled subjects.</p> : (
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr><th>Subject</th><th>Section</th><th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Final</th><th>Remarks</th></tr>
                        </thead>
                        <tbody>
                          {details.student.subjects.map((sub, i) => {
                            const gs = sub.gradingSummary || {};
                            return (
                              <tr key={i} onClick={() => setSelectedSubject(sub)} style={{ cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ fontWeight: 600, color: 'var(--brand-600)' }}>{sub.info.subject}</td>
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
              </>
            )}
          </div>
        ) : <EmptyState icon={Users} title="Error" description="Could not load student details." />}
      </Modal>
    </>
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
    { icon: Users, label: 'Students', active: !selectedClass && page === 'students', onClick: () => { setSelectedClass(null); navigate('/teacher/students'); } },
    { icon: BookOpen, label: 'Templates', active: !selectedClass && page === 'templates', onClick: () => { setSelectedClass(null); navigate('/teacher/templates'); } },
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
        <Route path="/students" element={
          <>
            <PageHeader title="Students" subtitle="View performance of students you handle" />
            <div className="page-content fade-in"><div className="card"><div className="card-header"><h3 style={{ fontSize: '1rem' }}>Students Overview</h3></div><StudentsOverview /></div></div>
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