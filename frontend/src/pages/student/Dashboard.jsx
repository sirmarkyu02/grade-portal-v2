import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, Calendar, User, Settings, Bell, Camera, 
  ChevronRight, Award, Activity, GraduationCap, Info, TrendingUp, 
  CheckCircle2, AlertTriangle, Clock, MapPin, CalendarDays, ExternalLink,
  HelpCircle, Sparkles, ShieldCheck
} from 'lucide-react';
import { AppLayout, PageHeader, GradePill, StatusBadge, EmptyState, LoadingSpinner, Modal } from '../../components/Layout';
import { useAuth } from '../../App';
import api from '../../api';
import toast from 'react-hot-toast';

// ─── Format Helpers ─────────────────────────────────────────────────────────
function formatStudentName(raw) {
  if (!raw) return 'Student';
  if (raw.includes(',')) {
    const parts = raw.split(',');
    const last = parts[0]?.trim() || '';
    const firstMiddle = parts[1]?.trim() || '';
    const cleanLast = last.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    const cleanFirst = firstMiddle.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    return `${cleanFirst} ${cleanLast}`.trim();
  }
  return raw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function getFirstName(raw) {
  if (!raw) return 'Student';
  if (raw.includes(',')) {
    const firstPart = raw.split(',')[1]?.trim() || '';
    const firstWord = firstPart.split(' ')[0] || '';
    return firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase() : 'Student';
  }
  return raw.split(' ')[0];
}

function formatGradeNum(val, suffix = '') {
  if (val === null || val === undefined || val === '' || val === '—' || val === '-') return '—';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return `${num.toFixed(2)}${suffix}`;
}

function getAcademicStanding(gwa) {
  if (!gwa) return null;
  const num = Number(gwa);
  if (isNaN(num)) return null;
  if (num <= 1.45) {
    return {
      label: "President's Lister Candidate",
      badgeClass: 'gwa-badge-gold',
      icon: '🏆',
      desc: 'Outstanding Collegiate Academic Excellence (1.00 – 1.45 GWA)'
    };
  }
  if (num <= 1.75) {
    return {
      label: "Dean's Lister Candidate",
      badgeClass: 'gwa-badge-blue',
      icon: '🌟',
      desc: 'High Academic Honors Distinction (1.46 – 1.75 GWA)'
    };
  }
  if (num <= 3.00) {
    return {
      label: 'Good Academic Standing',
      badgeClass: 'gwa-badge-green',
      icon: '✅',
      desc: 'Regular Passing Academic Standing (1.76 – 3.00 GWA)'
    };
  }
  return {
    label: 'Academic Warning / Conditional',
    badgeClass: 'gwa-badge-amber',
    icon: '⚠️',
    desc: 'Below passing threshold; academic consultation advised (> 3.00 GWA)'
  };
}

// ─── Grading Scale Reference Modal ──────────────────────────────────────────
function GradingScaleModal({ open, onClose }) {
  const scale = [
    { grade: '1.00', pct: '97 – 100%', remark: 'Excellent', cls: 'grade-a' },
    { grade: '1.25', pct: '94 – 96%', remark: 'Very Superior', cls: 'grade-a' },
    { grade: '1.50', pct: '91 – 93%', remark: 'Superior', cls: 'grade-a' },
    { grade: '1.75', pct: '88 – 90%', remark: 'Very Good', cls: 'grade-a' },
    { grade: '2.00', pct: '85 – 87%', remark: 'Good', cls: 'grade-b' },
    { grade: '2.25', pct: '82 – 84%', remark: 'Satisfactory', cls: 'grade-b' },
    { grade: '2.50', pct: '79 – 81%', remark: 'Fair', cls: 'grade-b' },
    { grade: '2.75', pct: '76 – 78%', remark: 'Passing', cls: 'grade-c' },
    { grade: '3.00', pct: '75%', remark: 'Passing (Threshold)', cls: 'grade-c' },
    { grade: '5.00', pct: 'Below 75%', remark: 'Failed / Did Not Meet Requirements', cls: 'grade-f' },
    { grade: 'INC', pct: '—', remark: 'Incomplete Requirements', cls: 'grade-d' },
    { grade: 'DRP', pct: '—', remark: 'Officially / Unofficially Dropped', cls: 'grade-f' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="College Grading Scale & Evaluation Guide" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Intro */}
        <div style={{ padding: '14px 18px', background: 'var(--grad-soft)', borderRadius: 12, border: '1px solid var(--violet-200)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            In tertiary education, grades follow the <strong>1.00 to 5.00 numerical rating system</strong>, where <strong>1.00</strong> represents highest excellence and <strong>3.00</strong> is the passing mark.
          </p>
        </div>

        {/* Weights Breakdown */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={18} color="var(--violet-600)" />
            Evaluation Weights Distribution
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TERM WEIGHT: QUIZZES</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--violet-700)', marginTop: 2 }}>20%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Short tests & oral recitations</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TERM WEIGHT: PT / LAB</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-600)', marginTop: 2 }}>30%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Projects, laboratory, practicals</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TERM WEIGHT: MAJOR EXAM</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: 2 }}>50%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Periodical major examinations</div>
            </div>
          </div>
        </div>

        {/* Semestral Computation */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="var(--brand-600)" />
            Semestral Term Contribution
          </h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['Prelims', '20%'], ['Midterm', '20%'], ['Pre-Finals', '20%'], ['Finals', '40%']].map(([term, wt]) => (
              <div key={term} style={{ flex: '1 1 110px', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{term}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{wt}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Transmutation Table */}
        <div>
          <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="var(--violet-600)" />
            Standard Transmutation Scale
          </h4>
          <div className="table-wrapper" style={{ maxHeight: 320 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rating</th>
                  <th>Raw Percentage</th>
                  <th>Academic Equivalent / Remark</th>
                </tr>
              </thead>
              <tbody>
                {scale.map((s, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`grade-pill ${s.cls}`}>{s.grade}</span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.pct}</td>
                    <td style={{ fontWeight: 500 }}>{s.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Honor Roll */}
        <div style={{ padding: '14px 18px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <h5 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 6, color: 'var(--violet-700)' }}>Honors Qualification Criteria</h5>
          <ul style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 18, margin: 0 }}>
            <li><strong>President's List:</strong> General Weighted Average (GWA) of <strong>1.00 to 1.45</strong>, with no individual grade below 1.75.</li>
            <li><strong>Dean's List:</strong> General Weighted Average (GWA) of <strong>1.46 to 1.75</strong>, with no individual grade below 2.00.</li>
            <li>No grade of <strong>5.00</strong>, <strong>INC</strong> (Incomplete), or <strong>DRP</strong> (Dropped) in any academic course.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

// ─── Attendance View ──────────────────────────────────────────────────────────
function AttendanceView({ attendance, isTertiary = false }) {
  const [showDetailedLog, setShowDetailedLog] = useState(false);
  if (!attendance) return <div className="empty-state"><p className="empty-desc">No attendance data available.</p></div>;
  const { summary, records } = attendance;
  const hasTerm4 = !!summary?.term4 && ((summary.term4.present || 0) + (summary.term4.absent || 0) + (summary.term4.late || 0) + (summary.term4.excused || 0) > 0 || isTertiary);
  const termKeys = hasTerm4 ? ['term1', 'term2', 'term3', 'term4'] : ['term1', 'term2', 'term3'];
  const termLabels = isTertiary 
    ? ['Prelims', 'Midterm', 'Pre-Finals', 'Finals'] 
    : (hasTerm4 ? ['Term 1', 'Term 2', 'Term 3', 'Term 4'] : ['Term 1', 'Term 2', 'Term 3']);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={hasTerm4 ? "grid-4" : "grid-3"}>
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

      {records && records.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showDetailedLog ? 16 : 0 }}>
            <div>
              <h4 style={{ fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarDays size={18} color="var(--violet-600)" />
                Detailed Daily Attendance Record
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {records.length} recorded meeting dates and remarks
              </p>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setShowDetailedLog(v => !v)}
            >
              {showDetailedLog ? 'Hide Log' : 'View Detailed Log'}
            </button>
          </div>

          {showDetailedLog && (
            <div className="table-wrapper" style={{ maxHeight: 350, marginTop: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date / Day</th>
                    <th>Term</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => {
                    const statusStr = r.status === 'P' ? 'Present' : r.status === 'A' ? 'Absent' : r.status === 'L' ? 'Late' : r.status === 'E' ? 'Excused' : 'Recorded';
                    const badgeCls = r.status === 'P' ? 'badge-success' : r.status === 'A' ? 'badge-error' : r.status === 'L' ? 'badge-warning' : 'badge-neutral';
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{r.date}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.term}</td>
                        <td>
                          <span className={`badge ${badgeCls}`}>{statusStr}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Grades for a subject ─────────────────────────────────────────────────────
function SubjectGrades({ subject }) {
  const termNames = Object.keys(subject.terms || {});
  const [activeTab, setActiveTab] = useState(termNames.length > 0 ? termNames[0] : 'Term 1');
  const isTertiary = subject.info?.templateType === 'tertiary';

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
                <th>Score</th>
                <th>Max HPS</th>
                {hasWeights && <th>Weight</th>}
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const pct = item.hps > 0 && item.score !== null && item.score !== '' ? Math.round((Number(item.score) / item.hps) * 100) : null;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{item.label}</td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{item.score ?? '—'}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.hps}</td>
                    {hasWeights && <td style={{ color: 'var(--text-muted)' }}>{typeof item.weight === 'number' ? `${Math.round(item.weight * 100)}%` : '—'}</td>}
                    <td>
                      {pct !== null ? (
                        <span className={`badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-error'}`}>
                          {pct}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: 'var(--grad-soft)' }}>
                <td><strong>Total Sum</strong></td>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{hasWeights ? '—' : scored}</span></td>
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

  const quizzesOrWw = term.quizzes || term.writtenWorks;
  const gs = subject.gradingSummary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Course Info Ribbon */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {subject.info?.code && (
          <span className="tertiary-meta-chip">
            <BookOpen size={13} /> {subject.info.code}
          </span>
        )}
        {subject.info?.section && (
          <span className="tertiary-meta-chip">
            <User size={13} /> {subject.info.section}
          </span>
        )}
        {subject.info?.room && (
          <span className="tertiary-meta-chip">
            <MapPin size={13} /> Room: {subject.info.room}
          </span>
        )}
        {subject.info?.schedule && (
          <span className="tertiary-meta-chip">
            <Clock size={13} /> {subject.info.schedule} {subject.info.time ? `(${subject.info.time})` : ''}
          </span>
        )}
        {isTertiary && (
          <span className="badge badge-brand" style={{ fontWeight: 700 }}>
            <GraduationCap size={13} /> Tertiary / College
          </span>
        )}
      </div>

      {/* Term Tabs */}
      <div className="tabs">
        {termNames.map(t => (
          <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {term && (
        <>
          {/* Highlight Summary Cards */}
          {(() => {
            const hasInitial = term.summary?.initialGrade !== undefined && term.summary?.initialGrade !== null && String(term.summary.initialGrade).trim() !== '';
            const fallbackInitial = ((term.summary?.wwWS || 0) + (term.summary?.ptWS || 0) + (term.summary?.examWS || 0));
            const hasAnyWS = (term.summary?.wwWS !== null && term.summary?.wwWS !== undefined) ||
                             (term.summary?.ptWS !== null && term.summary?.ptWS !== undefined) ||
                             (term.summary?.examWS !== null && term.summary?.examWS !== undefined);
            const displayInitial = hasInitial ? term.summary.initialGrade : (hasAnyWS ? fallbackInitial : null);

            return (
              <div className="grid-5" style={{ marginBottom: 4 }}>
                {quizzesOrWw && (
                  <div className="stat-card stat-card-sm">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.25rem' }}>📝</span>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {isTertiary ? 'Quizzes (20% Wt)' : 'Written Works'}
                      </p>
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.35rem' }}>
                      {formatGradeNum(term.summary?.wwWS, '%')}
                    </p>
                  </div>
                )}

                {term.performanceTasks && (
                  <div className="stat-card stat-card-sm">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.25rem' }}>🎯</span>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {isTertiary ? 'PT / Lab (30% Wt)' : 'Performance Tasks'}
                      </p>
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.35rem' }}>
                      {formatGradeNum(term.summary?.ptWS, '%')}
                    </p>
                  </div>
                )}

                {term.exams && (
                  <div className="stat-card stat-card-sm">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.25rem' }}>📋</span>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {isTertiary ? 'Major Exam (50% Wt)' : 'Major Exams'}
                      </p>
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.35rem' }}>
                      {formatGradeNum(term.summary?.examWS, '%')}
                    </p>
                  </div>
                )}

                {/* Card 4: Initial Grade (Raw total percentage before transmutation, like in SHS) */}
                <div className="stat-card stat-card-sm" style={{ background: 'var(--grad-soft)', border: '1px solid var(--brand-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.25rem' }}>📊</span>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-700)' }}>
                        Initial Grade
                      </p>
                    </div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
                      Raw %
                    </span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.35rem', color: 'var(--brand-700)' }}>
                    {formatGradeNum(displayInitial, '%')}
                  </p>
                </div>

                {/* Card 5: Term Rating (EQV) / Term Final */}
                <div className="stat-card stat-card-sm" style={{ background: 'var(--grad-soft)', border: '1px solid var(--violet-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--violet-700)' }}>
                      {isTertiary ? 'Term Rating (EQV)' : 'Term Final'}
                    </p>
                    {term.summary?.rank ? (
                      <span className="ranking-pill" title={`Class Rank: #${term.summary.rank}`}>
                        🏆 #{term.summary.rank}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <GradePill grade={term.summary?.transmutedGrade} size="lg" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Status banner */}
          {term.summary?.status && (
            (() => {
              const statStr = String(term.summary.status).toLowerCase();
              const hasGrade = term.summary.transmutedGrade !== null && term.summary.transmutedGrade !== undefined && term.summary.transmutedGrade !== '';
              
              if (!hasGrade || statStr.includes('hidden') || statStr.includes('progress') || statStr.includes('tba')) {
                return (
                  <div style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--brand-50)', border: '1px solid var(--brand-100)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
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
              const isIncomplete = statStr.includes('incomplete') || statStr.includes('inc');
              const isDropped = statStr.includes('dropped') || statStr.includes('drp');
              
              return (
                <div style={{ 
                  padding: '14px 20px', 
                  borderRadius: 14, 
                  background: isPassed ? '#ecfdf5' : (isIncomplete ? '#fffbeb' : '#fef2f2'), 
                  border: `1px solid ${isPassed ? '#a7f3d0' : (isIncomplete ? '#fde68a' : '#fecaca')}`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12, 
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: isPassed ? '#d1fae5' : (isIncomplete ? '#fef3c7' : '#fee2e2'), padding: 8, borderRadius: '50%', display: 'flex' }}>
                      <Award size={20} color={isPassed ? '#059669' : (isIncomplete ? '#d97706' : '#dc2626')} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: isPassed ? '#065f46' : (isIncomplete ? '#92400e' : '#991b1b'), fontSize: '0.9375rem' }}>
                        {isPassed ? `Official Term Status: Passed [${term.summary.transmutedGrade}]` : isIncomplete ? 'Status: Incomplete Requirements (INC)' : isDropped ? 'Status: Dropped Subject (DRP)' : `Official Term Status: Not Passed [${term.summary.transmutedGrade}]`}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: isPassed ? '#047857' : (isIncomplete ? '#b45309' : '#b91c1c'), opacity: 0.9 }}>
                        {isPassed ? 'Congratulations on meeting collegiate passing standards for this grading period.' : 'Please coordinate with your instructor regarding requirements.'}
                      </div>
                    </div>
                  </div>
                  {term.summary?.rank && (
                    <div className="ranking-pill" style={{ padding: '6px 14px', fontSize: '0.8125rem' }}>
                      Class Rank: #{term.summary.rank}
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {/* Detailed Item Tables */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {quizzesOrWw && (
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--violet-500)', display: 'inline-block' }} />
                  {isTertiary ? 'Quizzes & Oral Assessments (20% Weight)' : 'Written Works'}
                </h4>
                {renderScoreTable(quizzesOrWw, isTertiary ? 'quizzes' : 'written works')}
              </div>
            )}

            {term.performanceTasks && (
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-500)', display: 'inline-block' }} />
                  {isTertiary ? 'Performance Tasks / Laboratory Practicals (30% Weight)' : 'Performance Tasks'}
                </h4>
                {renderScoreTable(term.performanceTasks, 'performance tasks')}
              </div>
            )}

            {term.exams && Object.keys(term.exams).length > 0 && (
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
                  {isTertiary ? 'Periodical Major Examination (50% Weight)' : 'Examinations'}
                </h4>
                {renderScoreTable(Object.values(term.exams), 'exams')}
              </div>
            )}
          </div>

          {/* Semestral Progress Progression Card */}
          {isTertiary && gs && (
            <div className="card" style={{ padding: 24, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>
                    Cumulative Semestral Standing
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Weights: Prelims (20%) + Midterm (20%) + Pre-Finals (20%) + Finals (40%)
                  </p>
                </div>
                {gs.finalGrade && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>Final Grade:</span>
                    <GradePill grade={gs.finalGrade} size="lg" />
                  </div>
                )}
              </div>

              <div className="semestral-timeline">
                {[
                  { name: 'Prelims', wt: '20%', val: gs.term1, key: 'PRELIMS' },
                  { name: 'Midterm', wt: '20%', val: gs.term2, key: 'MIDTERM' },
                  { name: 'Pre-Finals', wt: '20%', val: gs.term3, key: 'PRE-FINALS' },
                  { name: 'Finals', wt: '40%', val: gs.term4, key: 'FINALS' },
                ].map(step => {
                  const isActive = activeTab === step.key;
                  return (
                    <div 
                      key={step.name} 
                      className={`semestral-step ${isActive ? 'active' : ''}`}
                      onClick={() => termNames.includes(step.key) && setActiveTab(step.key)}
                      style={{ cursor: termNames.includes(step.key) ? 'pointer' : 'default' }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{step.name} ({step.wt})</div>
                      <div style={{ marginTop: 6 }}>
                        <GradePill grade={step.val} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Overview (Home) ──────────────────────────────────────────────────────────
function OverviewPage({ studentData, profile }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const navigate = useNavigate();

  if (!studentData) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>;
  const { student } = studentData;
  const subjects = student.subjects || [];
  const totalSubjects = subjects.length;

  const tertiarySubjects = subjects.filter(s => s.info?.templateType === 'tertiary');
  const isCollege = tertiarySubjects.length > 0 || (student.studentNo && (student.studentNo.startsWith('02') || student.studentNo.length === 11));

  // Calculate College GWA (1.00 - 5.00)
  let totalGradePoints = 0;
  let gradedCount = 0;
  tertiarySubjects.forEach(s => {
    const gs = s.gradingSummary;
    if (!gs) return;
    const gradeVal = gs.finalGrade || gs.term4 || gs.term3 || gs.term2 || gs.term1;
    const num = Number(gradeVal);
    if (!isNaN(num) && num >= 1.0 && num <= 5.0) {
      totalGradePoints += num;
      gradedCount++;
    }
  });
  const collegeGwa = gradedCount > 0 ? (totalGradePoints / gradedCount).toFixed(2) : null;
  const academicStanding = getAcademicStanding(collegeGwa);

  // Subject Counts
  const passedSubjects = subjects.filter(s => {
    const gs = s.gradingSummary;
    if (!gs) return false;
    if (gs.remarks) return gs.remarks.toLowerCase().includes('pass');
    const grade = gs.finalGrade ?? gs.term4 ?? gs.term3 ?? gs.term2 ?? gs.term1;
    if (grade === undefined || grade === null) return false;
    const num = Number(grade);
    if (isNaN(num)) return false;
    return s.info?.templateType === 'tertiary' || num <= 5.0 ? num <= 3.0 : num >= 75;
  }).length;

  const needsAttention = subjects.filter(s => {
    const gs = s.gradingSummary;
    if (!gs) return false;
    if (gs.remarks) return gs.remarks.toLowerCase().includes('fail') || gs.remarks.toLowerCase().includes('needs attention') || gs.remarks.toLowerCase().includes('dropped');
    const grade = gs.finalGrade ?? gs.term4 ?? gs.term3 ?? gs.term2 ?? gs.term1;
    if (grade === undefined || grade === null) return false;
    const num = Number(grade);
    if (isNaN(num)) return false;
    return s.info?.templateType === 'tertiary' || num <= 5.0 ? num > 3.0 : num < 75;
  }).length;

  const totalAbsences = subjects.reduce((tot, sub) => {
    const sum = sub.attendance?.summary || {};
    return tot + Object.values(sum).reduce((acc, curr) => acc + (curr?.absent || 0), 0);
  }, 0);

  const primaryDept = tertiarySubjects[0]?.info?.department || 'College Department';
  const primarySection = tertiarySubjects[0]?.info?.section || '';
  const primaryCampus = tertiarySubjects[0]?.info?.campus || '';

  return (
    <div className="page-content fade-in">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="welcome-content">
          <p className="welcome-greeting">
            {isCollege ? 'Tertiary / College Student Portal' : 'Student Portal'}
          </p>
          <h2 className="welcome-name">
            {formatStudentName(student.name)}
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <div className="welcome-id">
              <User size={14} />
              <span>{student.studentNo}</span>
            </div>
            {isCollege && (
              <div className="welcome-id" style={{ background: 'rgba(255,255,255,0.25)' }}>
                <GraduationCap size={14} />
                <span>{primarySection ? `${primarySection} • ` : ''}{primaryDept}</span>
              </div>
            )}
          </div>
        </div>
        <div className="welcome-stats">
          <div className="welcome-count">{totalSubjects}</div>
          <div className="welcome-label">Subject{totalSubjects !== 1 ? 's' : ''} Enrolled</div>
        </div>
      </div>

      {/* Dedicated College Academic Standing & GWA Card */}
      {isCollege && (
        <div className="college-gwa-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--violet-700)', letterSpacing: '0.04em' }}>
                Collegiate Academic Standing
              </span>
              {academicStanding && (
                <span className={academicStanding.badgeClass}>
                  {academicStanding.icon} {academicStanding.label}
                </span>
              )}
            </div>
            <p style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {primarySection} • {primaryDept}
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
              {academicStanding ? academicStanding.desc : 'Grades computed across active college courses (1.00 - 5.00 Scale)'}
              {primaryCampus ? ` • ${primaryCampus} Campus` : ''}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {collegeGwa ? (
              <div style={{ textAlign: 'center', padding: '10px 18px', background: 'white', borderRadius: 14, border: '1px solid var(--violet-200)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Current GWA
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--violet-700)', fontFamily: 'var(--font-mono)', lineHeight: 1.1, marginTop: 2 }}>
                  {collegeGwa}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '8px 14px', background: 'white', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>GWA Rating</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>In Progress</div>
              </div>
            )}

            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setGuideOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              <Info size={15} color="var(--violet-600)" />
              Grading Scale Guide
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
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
          <div className="stat-value" style={{ color: '#dc2626' }}>{needsAttention}</div>
          <div className="stat-label">Needs Attention</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(to bottom, #ffffff, #eff6ff)' }}>
          <div className="stat-icon blue" style={{ background: '#dbeafe', color: '#2563eb' }}><Calendar size={22} /></div>
          <div className="stat-value" style={{ color: '#2563eb' }}>{totalAbsences}</div>
          <div className="stat-label">Total Absences</div>
        </div>
      </div>

      {/* Subjects Overview */}
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" description="Your grades will appear here once your teacher uploads them." />
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontWeight: 800 }}>My Subjects</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/student/grades')} style={{ fontWeight: 600 }}>
              View Complete Grades →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subjects.map((sub, i) => {
              const gs = sub.gradingSummary;
              const isTertiarySub = sub.info?.templateType === 'tertiary';
              const termsList = isTertiarySub
                ? [{ key: 'term1', label: 'PRE' }, { key: 'term2', label: 'MID' }, { key: 'term3', label: 'PF' }, { key: 'term4', label: 'FIN' }]
                : [{ key: 'term1', label: 'T1' }, { key: 'term2', label: 'T2' }, { key: 'term3', label: 'T3' }, { key: 'term4', label: 'T4' }];

              return (
                <div 
                  key={i} 
                  className="card student-subject-card" 
                  style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, cursor: 'pointer' }}
                  onClick={() => navigate('/student/grades')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--violet-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--violet-600)' }}>
                      <BookOpen size={24} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', margin: 0 }}>
                          {sub.info.subject}
                        </p>
                        {sub.info.code && (
                          <span className="tertiary-meta-chip">
                            {sub.info.code}
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500, marginTop: 3 }}>
                        {sub.info.section} • {sub.info.instructor} {sub.info.gradeLevel ? `• ${sub.info.gradeLevel}` : ''}
                        {sub.info.room ? ` • RM ${sub.info.room}` : ''}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                    {gs ? (
                      <>
                        {termsList.map(({ key, label }) => gs[key] ? (
                          <div key={key} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                            <GradePill grade={gs[key]} />
                          </div>
                        ) : null)}
                        {gs.finalGrade && (
                          <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', paddingLeft: 10 }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Final</div>
                            <GradePill grade={gs.finalGrade} />
                          </div>
                        )}
                        <span style={{ color: 'var(--violet-400)', marginLeft: 4 }}>›</span>
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

      {/* Reference Modal */}
      <GradingScaleModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

// ─── Subject Detail Page ──────────────────────────────────────────────────────
function SubjectPage({ studentData }) {
  const [selected, setSelected] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const subjects = studentData?.student?.subjects || [];
  if (subjects.length === 0) return <div className="page-content"><EmptyState icon={BookOpen} title="No subjects" description="No grade data uploaded yet." /></div>;
  const sub = selected !== null ? subjects[selected] : null;

  return (
    <div className="page-content fade-in">
      {!sub ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 800 }}>My Grades</h2>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setGuideOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Info size={15} color="var(--violet-600)" />
              Grading Scale Guide
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subjects.map((sub, i) => (
              <div 
                key={i} 
                className="card student-subject-card" 
                style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s' }} 
                onClick={() => setSelected(i)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--grad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={20} color="var(--violet-600)" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 700, margin: 0 }}>{sub.info.subject}</p>
                        {sub.info.code && <span className="tertiary-meta-chip">{sub.info.code}</span>}
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: 2 }}>
                        {sub.info.section} • {sub.info.instructor}
                      </p>
                      {sub.info?.templateType === 'tertiary' ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                          Quizzes: {Math.round((sub.info.weights?.writtenOral || 0.2) * 100)}% | PT/Lab: {Math.round((sub.info.weights?.performanceTask || 0.3) * 100)}% | Major Exam: {Math.round((sub.info.weights?.termExam || 0.5) * 100)}%
                        </p>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                          WW: {sub.info.weights?.writtenOral ? Math.round(sub.info.weights.writtenOral * 100) : 0}% | PT: {sub.info.weights?.performanceTask ? Math.round(sub.info.weights.performanceTask * 100) : 0}% | Exam: {sub.info.weights?.termExam ? Math.round(sub.info.weights.termExam * 100) : 0}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {sub.gradingSummary?.finalGrade && <GradePill grade={sub.gradingSummary.finalGrade} />}
                    {sub.gradingSummary?.remarks && sub.gradingSummary.remarks !== 'Hidden' && <StatusBadge status={sub.gradingSummary.remarks} />}
                    <span style={{ color: 'var(--violet-400)' }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <GradingScaleModal open={guideOpen} onClose={() => setGuideOpen(false)} />
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
              ← Back to subjects
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => setGuideOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Info size={15} color="var(--violet-600)" />
              Grading Scale Guide
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontWeight: 800 }}>{sub.info.subject}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {sub.info.section} • {sub.info.instructor} • {sub.info.schoolYear || sub.info.semester || ''}
            </p>
          </div>
          <SubjectGrades subject={sub} />

          <GradingScaleModal open={guideOpen} onClose={() => setGuideOpen(false)} />
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
      <h2 style={{ fontWeight: 800, marginBottom: 16 }}>Attendance Records</h2>
      {subjects.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select className="form-input" style={{ maxWidth: 340 }} value={selected} onChange={e => setSelected(Number(e.target.value))}>
            {subjects.map((s, i) => (
              <option key={i} value={i}>
                {s.info.subject} — {s.info.section} {s.info.code ? `(${s.info.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {sub ? (
        <AttendanceView attendance={sub.attendance} isTertiary={sub.info?.templateType === 'tertiary'} />
      ) : (
        <EmptyState icon={Calendar} title="No attendance data" description="Attendance records will appear here once uploaded." />
      )}
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage({ user, profile, onRefresh, studentData }) {
  const [form, setForm] = useState({ contactNo: profile?.contactNo || '', parentName: profile?.parentName || '', parentContactNo: profile?.parentContactNo || '', address: profile?.address || '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile?.photo || null);
  const [loading, setLoading] = useState(false);
  const fileRef = React.useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      ['contactNo', 'parentName', 'parentContactNo', 'address'].forEach(k => fd.append(k, form[k] || ''));
      if (photoFile) fd.append('photo', photoFile);
      await api.put('/student/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Profile updated successfully!');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed.');
    } finally { setLoading(false); }
  };

  const initials = (n) => n ? (n.trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2)) : '?';
  const subjects = studentData?.student?.subjects || [];
  const tertiarySub = subjects.find(s => s.info?.templateType === 'tertiary');

  return (
    <div className="page-content fade-in">
      <h2 style={{ fontWeight: 800, marginBottom: 24 }}>My Student Profile</h2>
      <div className="card">
        <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Personal & Academic Information</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="photo-upload" style={{ width: 96, height: 96 }} onClick={() => fileRef.current.click()}>
              {photoPreview ? <img src={photoPreview} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-200)' }} />
                : <div className="photo-preview" style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--grad-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>{initials(user?.name)}</div>}
              <div className="photo-overlay"><Camera size={20} /></div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) { setPhotoFile(f); const r = new FileReader(); r.onload = e2 => setPhotoPreview(e2.target.result); r.readAsDataURL(f); } }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 800, fontSize: '1.15rem' }}>{formatStudentName(user?.name)}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Student ID: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{user?.id}</span></p>
              {tertiarySub && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  <span className="badge badge-brand">
                    <GraduationCap size={13} /> {tertiarySub.info.section} • {tertiarySub.info.department}
                  </span>
                  {tertiarySub.info.campus && (
                    <span className="badge badge-neutral">
                      {tertiarySub.info.campus} Campus
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="divider" />
          <div className="grid-2" style={{ gap: 12 }}>
            {[['contactNo', 'Student Contact Number', 'tel'], ['parentName', "Parent / Guardian Full Name", 'text'], ['parentContactNo', "Guardian Contact Number", 'tel'], ['address', 'Permanent Home Address', 'text']].map(([k, label, type]) => (
              <div key={k} className="form-group" style={k === 'address' ? { gridColumn: '1/-1' } : {}}>
                <label className="form-label">{label}</label>
                <input className="form-input" type={type} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={label} />
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={handleSaveProfile} disabled={loading} style={{ alignSelf: 'flex-start' }}>
            {loading ? <><LoadingSpinner /> Saving...</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({ user, onRefresh }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [themeLoading, setThemeLoading] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(user?.theme || 'default');
  const [activeTab, setActiveTab] = useState('personalize');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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

  const handleThemeChange = async (themeKey) => {
    setCurrentTheme(themeKey);
    setThemeLoading(true);
    try {
      await api.put('/student/theme', { theme: themeKey });
      toast.success('Theme updated successfully.');
      onRefresh?.();
    } catch (err) {
      toast.error('Failed to update theme.');
    } finally { setThemeLoading(false); }
  };

  const themes = [
    { id: 'default', label: 'Default (Violet)', color: '#8b5cf6' },
    { id: 'blue', label: 'Light Blue', color: '#3b82f6' },
    { id: 'orange', label: 'Light Orange', color: '#f97316' },
    { id: 'pink', label: 'Light Pink/Red', color: '#f43f5e' },
    { id: 'green', label: 'Light Green', color: '#10b981' },
  ];

  return (
    <div className="page-content fade-in">
      <h2 style={{ fontWeight: 800, marginBottom: 24 }}>Account Settings</h2>
      
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12, overflowX: 'auto', whiteSpace: 'nowrap', padding: '0 4px 12px 4px' }}>
        <button 
          onClick={() => setActiveTab('personalize')}
          style={{ 
            background: activeTab === 'personalize' ? 'var(--brand-100)' : 'transparent',
            color: activeTab === 'personalize' ? 'var(--brand-700)' : 'var(--text-muted)',
            border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          Personalize Theme
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          style={{ 
            background: activeTab === 'security' ? 'var(--brand-100)' : 'transparent',
            color: activeTab === 'security' ? 'var(--brand-700)' : 'var(--text-muted)',
            border: 'none', padding: '8px 16px', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
          Security & Password
        </button>
      </div>

      {activeTab === 'personalize' && (
        <div className="card fade-in" style={{ maxWidth: 600 }}>
          <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Personalize</h3></div>
          <div className="card-body">
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>Choose a color theme for your dashboard.</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {themes.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => handleThemeChange(t.id)}
                  disabled={themeLoading}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', background: t.color,
                    border: currentTheme === t.id ? '4px solid white' : 'none',
                    boxShadow: currentTheme === t.id ? `0 0 0 2px ${t.color}` : 'var(--shadow-sm)',
                    cursor: themeLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: themeLoading && currentTheme !== t.id ? 0.5 : 1
                  }}
                  title={t.label}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card fade-in" style={{ maxWidth: 600 }}>
          <div className="card-header"><h3 style={{ fontSize: '1rem' }}>Change Account Password</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group"><label className="form-label">Current Password</label><input className="form-input" type="password" value={form.currentPassword} onChange={e => set('currentPassword', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">New Password</label><input className="form-input" type="password" value={form.newPassword} onChange={e => set('newPassword', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Confirm New Password</label><input className="form-input" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} /></div>
            <button className="btn btn-primary" onClick={handleChangePassword} disabled={pwLoading} style={{ alignSelf: 'flex-start' }}>
              {pwLoading ? <><LoadingSpinner /> Changing...</> : 'Change Password'}
            </button>
          </div>
        </div>
      )}

      <div className="card fade-in" style={{ maxWidth: 600, marginTop: 20 }}>
        <div className="card-header"><h3 style={{ fontSize: '1rem' }}>System Information</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>System Version</span>
            <span style={{ fontWeight: 600 }}>Grade Portal v2.0 (Tertiary & SHS)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Developer</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-600)' }}>Developed by Sir Markyu</span>
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
    { icon: Settings, label: 'Settings', active: page === 'settings', onClick: () => navigate('/student/settings') },
  ];

  return (
    <AppLayout navItems={nav} role="student">
      <Routes>
        <Route path="/" element={
          <>
            <PageHeader 
              title="Academic Overview" 
              subtitle={loading ? 'Loading...' : `Welcome back, ${getFirstName(studentData?.student?.name)}!`} 
            />
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>
              : <OverviewPage studentData={studentData} profile={profile} />}
          </>
        } />
        <Route path="/grades" element={
          <>
            <PageHeader title="My Grades & Scores" subtitle="Detailed performance tasks, quizzes, and major exam scores" />
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>
              : <SubjectPage studentData={studentData} />}
          </>
        } />
        <Route path="/attendance" element={
          <>
            <PageHeader title="Attendance Summary" subtitle="Your term attendance logs and records" />
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><LoadingSpinner size="lg" /></div>
              : <StudentAttendancePage studentData={studentData} />}
          </>
        } />
        <Route path="/profile" element={
          <>
            <PageHeader title="Student Profile" subtitle="Manage your account information and contact records" />
            <ProfilePage user={user} profile={profile} onRefresh={() => { loadData(); refresh(); }} studentData={studentData} />
          </>
        } />
        <Route path="/settings" element={
          <>
            <PageHeader title="Account Settings" subtitle="Personalize preferences and manage your credentials" />
            <SettingsPage user={user} onRefresh={() => { loadData(); refresh(); }} />
          </>
        } />
      </Routes>
    </AppLayout>
  );
}
