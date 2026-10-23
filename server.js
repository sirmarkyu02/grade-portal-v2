const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const multer = require('multer');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

// ─── XlsxPopulate Setup & Formula Preservation Patch ──────────────────────────
const XlsxPopulate = require('xlsx-populate');
const Cell = require('xlsx-populate/lib/Cell');
const dateConverter = require('xlsx-populate/lib/dateConverter');
const RichText = require('xlsx-populate/lib/RichText');
const _ = require('lodash');

// CRITICAL FIX: Patch Cell.prototype.toXml so xlsx-populate emits the cached <v>
// value even when a formula is present. Without this, saving ANY workbook strips
// all <v> tags from formula cells, causing SheetJS to read them as null/undefined.
const origCellToXml = Cell.prototype.toXml;
Cell.prototype.toXml = function() {
  const node = origCellToXml.call(this);
  if (!_.isNil(this._formulaType) && !_.isNil(this._value)) {
    const hasV = node.children && node.children.some(c => c && c.name === 'v');
    if (!hasV) {
      let type, text;
      if (typeof this._value === 'string') {
        type = 's';
        text = this.workbook().sharedStrings().getIndexForString(this._value);
      } else if (typeof this._value === 'boolean') {
        type = 'b';
        text = this._value ? 1 : 0;
      } else if (typeof this._value === 'number') {
        text = this._value;
      } else if (this._value instanceof Date) {
        text = dateConverter.dateToNumber(this._value);
      } else if (this._value instanceof RichText || (typeof this._value === 'object' && this._value.constructor && this._value.constructor.name === 'RichText')) {
        type = 's';
        text = this.workbook().sharedStrings().getIndexForString(this._value.toXml());
      }
      if (type) node.attributes.t = type;
      node.children.push({ name: 'v', children: [text] });
    }
  }
  return node;
};

const app = express();
const PORT = 3001;


// ─── Directory Paths ────────────────────────────────────────────────────────
const ROOT = __dirname;
const GRADES_DIR = path.join(ROOT, 'Grades');
const GRADES_HISTORY_DIR = path.join(ROOT, 'Grades_History');
const TEMPLATES_DIR = path.join(ROOT, 'Templates');
const TEMPLATES_HISTORY_DIR = path.join(ROOT, 'Templates_History');
const PHOTOS_DIR = path.join(ROOT, 'uploads', 'photos');

const SETTINGS_FILE = path.join(ROOT, 'settings.json');
const TEACHERS_FILE = path.join(ROOT, 'teachers.json');
const PASSWORDS_FILE = path.join(ROOT, 'passwords.json');
const STUDENT_PROFILES_FILE = path.join(ROOT, 'student_profiles.json');
const CLASS_SETTINGS_FILE = path.join(ROOT, 'class_settings.json');
const SESSIONS_FILE = path.join(ROOT, 'sessions.json');
const ACCOUNT_STATUS_FILE = path.join(ROOT, 'account_status.json');
const ACTIVITY_LOGS_FILE = path.join(ROOT, 'activity_logs.json');
const DELETION_REQUESTS_FILE = path.join(ROOT, 'deletion_requests.json');

// Ensure directories exist
[GRADES_DIR, GRADES_HISTORY_DIR, TEMPLATES_DIR, TEMPLATES_HISTORY_DIR, PHOTOS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/photos', express.static(PHOTOS_DIR));

// ─── In-Memory Stores ───────────────────────────────────────────────────────
let studentsMap = {};
let settingsConfig = {};
let teachersConfig = {};
let passwordsConfig = {};
let studentProfilesConfig = {};
let classSettingsConfig = {};
let sessions = {};
let accountStatusConfig = {};
let activityLogs = [];
let deletionRequests = [];
let lastSync = null;

// ─── File Loaders ────────────────────────────────────────────────────────────
function loadJSON(filePath, defaultVal = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (typeof defaultVal === 'object' && !Array.isArray(defaultVal)) {
        return { ...defaultVal, ...data };
      }
      return data;
    }
  } catch (e) { console.error(`Failed to load ${path.basename(filePath)}:`, e.message); }
  return defaultVal;
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function reloadAll() {
  settingsConfig = loadJSON(SETTINGS_FILE, {
    adminPassword: 'admin123', portalName: 'Student Grade Portal', schoolName: '',
    visibleTerms: { 'Term 1': true, 'Term 2': true, 'Term 3': true },
    termLocks: { 'Term 1': false, 'Term 2': false, 'Term 3': false },
    gradeRelease: { 'Term 1': true, 'Term 2': true, 'Term 3': true, 'Term 4': true },
    schoolInfo: { name: '', address: '', contact: '' },
    notification: { enabled: false, message: '' },
    features: { grades: true, attendance: true }, sessionTimeout: 7200000,
    updatedAt: new Date().toISOString()
  });
  if (!settingsConfig.updatedAt) {
    settingsConfig.updatedAt = new Date().toISOString();
    saveJSON(SETTINGS_FILE, settingsConfig);
  }
  teachersConfig = loadJSON(TEACHERS_FILE);
  passwordsConfig = loadJSON(PASSWORDS_FILE);
  studentProfilesConfig = loadJSON(STUDENT_PROFILES_FILE);
  classSettingsConfig = loadJSON(CLASS_SETTINGS_FILE);
  sessions = loadJSON(SESSIONS_FILE);
  accountStatusConfig = loadJSON(ACCOUNT_STATUS_FILE);
  activityLogs = loadJSON(ACTIVITY_LOGS_FILE, []);
  deletionRequests = loadJSON(DELETION_REQUESTS_FILE, []);
}

reloadAll();

// Watch config files
[SETTINGS_FILE, TEACHERS_FILE, PASSWORDS_FILE, STUDENT_PROFILES_FILE, CLASS_SETTINGS_FILE, ACCOUNT_STATUS_FILE, DELETION_REQUESTS_FILE].forEach(f => {
  chokidar.watch(f, { persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 500 } })
    .on('change', () => reloadAll());
});

// ─── Session Management & Device Parsing ──────────────────────────────────────
function getClientDetails(req) {
  if (!req) return { ip: '127.0.0.1', device: 'Desktop', browser: 'System', os: 'System', ua: '' };
  
  let rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
  let ip = '127.0.0.1';
  if (typeof rawIp === 'string') {
    ip = rawIp.split(',')[0].trim().replace(/^::ffff:/, '');
    if (ip === '::1') ip = '127.0.0.1';
  }

  const ua = req.headers['user-agent'] || '';
  let device = 'Desktop';
  let os = 'Unknown OS';
  let browser = 'Browser';

  if (/mobile|android.*mobile|iphone|ipod/i.test(ua)) {
    device = 'Mobile';
  } else if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) {
    device = 'Tablet';
  }

  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';

  return { ip, device, browser, os, ua };
}

function createSession(userId, role, meta = {}, req = null) {
  const token = uuidv4();
  const client = getClientDetails(req);
  sessions[token] = {
    userId,
    role,
    meta,
    ip: client.ip,
    device: client.device,
    browser: client.browser,
    os: client.os,
    userAgent: client.ua,
    createdAt: Date.now(),
    lastActive: Date.now()
  };
  saveJSON(SESSIONS_FILE, sessions);
  return token;
}

function getSession(token) {
  if (!token || !sessions[token]) return null;
  const s = sessions[token];
  const timeout = settingsConfig.sessionTimeout || 7200000;
  if (Date.now() - s.lastActive > timeout) {
    delete sessions[token];
    saveJSON(SESSIONS_FILE, sessions);
    return null;
  }
  s.lastActive = Date.now();
  return s;
}

function destroySession(token) {
  if (sessions[token]) {
    delete sessions[token];
    saveJSON(SESSIONS_FILE, sessions);
  }
}

function logActivity(userId, role, action, details, meta = {}, req = null) {
  const client = getClientDetails(req);
  
  let category = 'system';
  const a = (action || '').toLowerCase();
  if (a.includes('login') || a.includes('logout')) category = 'auth';
  else if (a.includes('sync')) category = 'cloud';
  else if (a.includes('impersonate')) category = 'impersonation';
  else if (a.includes('password') || a.includes('suspend') || a.includes('revoke') || a.includes('status')) category = 'security';
  else if (a.includes('setting') || a.includes('backup') || a.includes('template') || a.includes('config')) category = 'settings';
  else if (a.includes('grade') || a.includes('score') || a.includes('attendance')) category = 'academic';

  activityLogs.unshift({
    id: uuidv4(),
    userId,
    role,
    action,
    details,
    category,
    ip: client.ip,
    device: client.device,
    browser: client.browser,
    os: client.os,
    meta,
    timestamp: new Date().toISOString()
  });
  if (activityLogs.length > 2000) activityLogs = activityLogs.slice(0, 2000);
  saveJSON(ACTIVITY_LOGS_FILE, activityLogs);
}

function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const session = getSession(token);
    if (!session) return res.status(401).json({ error: 'Unauthorized. Please log in again.' });
    if (roles.length && !roles.includes(session.role)) return res.status(403).json({ error: 'Forbidden.' });
    if (session.role !== 'admin' && accountStatusConfig[session.userId] === 'suspended') return res.status(403).json({ error: 'Account suspended.' });
    req.session = session;
    next();
  };
}

// ─── Excel Parsing Helpers ──────────────────────────────────────────────────
function excelDateToString(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1000) return serial;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function round2(v) {
  if (v === null || v === undefined) return null;
  return Math.round(v * 100) / 100;
}

function cellVal(ws, addr) {
  return ws[addr] ? ws[addr].v : null;
}

function parseTermSheet(ws, studentsList) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const cell = (r, c) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    return ws[addr] ? ws[addr].v : null;
  };

  // WW cols: E-X = col 4..23
  const wwItems = [];
  for (let c = 4; c <= 23; c++) {
    const hps = cell(5, c);
    if (hps && typeof hps === 'number' && hps > 0) {
      wwItems.push({ col: c, hps, label: String(cell(7, c) || `WW${c - 3}`), date: excelDateToString(cell(6, c)) });
    }
  }

  // PT cols: AB-AP = col 27..41
  const ptItems = [];
  for (let c = 27; c <= 41; c++) {
    const hps = cell(5, c);
    if (hps && typeof hps === 'number' && hps > 0) {
      ptItems.push({ col: c, hps, label: String(cell(7, c) || `PT${c - 26}`), date: excelDateToString(cell(6, c)) });
    }
  }

  // Exam cols: AT=45, AU=46, AV=47 (1-indexed: AT=col45 0-indexed)
  const examCols = {
    ST1: { col: 45, hps: cell(5, 45), label: 'Summative Test 1', date: excelDateToString(cell(7, 45)) },
    ST2: { col: 46, hps: cell(5, 46), label: 'Summative Test 2', date: excelDateToString(cell(7, 46)) },
    TE: { col: 47, hps: cell(5, 47), label: 'Term Exam', date: excelDateToString(cell(7, 47)) },
  };

  const wwWeight = cell(5, 26) || 0.2;
  const ptWeight = cell(5, 44) || 0.5;
  const examWeight = cell(6, 52) || 0.3;

  const getTransmuted = (initial) => {
    if (initial >= 99.5) return 100; if (initial >= 98.32) return 99; if (initial >= 97.14) return 98;
    if (initial >= 95.96) return 97; if (initial >= 94.78) return 96; if (initial >= 93.6) return 95;
    if (initial >= 92.42) return 94; if (initial >= 91.24) return 93; if (initial >= 90.06) return 92;
    if (initial >= 88.88) return 91; if (initial >= 87.7) return 90; if (initial >= 86.52) return 89;
    if (initial >= 85.34) return 88; if (initial >= 84.16) return 87; if (initial >= 82.98) return 86;
    if (initial >= 81.8) return 85; if (initial >= 80.62) return 84; if (initial >= 79.44) return 83;
    if (initial >= 78.26) return 82; if (initial >= 77.08) return 81; if (initial >= 75.9) return 80;
    if (initial >= 74.72) return 79; if (initial >= 73.54) return 78; if (initial >= 72.36) return 77;
    if (initial >= 71.18) return 76; if (initial >= 70) return 75; if (initial >= 65.34) return 74;
    if (initial >= 60.67) return 73; if (initial >= 56.01) return 72; if (initial >= 51.34) return 71;
    if (initial >= 46.67) return 70; if (initial >= 42.01) return 69; if (initial >= 37.34) return 68;
    if (initial >= 32.68) return 67; if (initial >= 28.01) return 66; if (initial >= 23.35) return 65;
    if (initial >= 18.68) return 64; if (initial >= 14.01) return 63; if (initial >= 9.35) return 62;
    if (initial >= 4.68) return 61; return 60;
  };

  const students = [];
  for (const stu of studentsList) {
    const r = stu.termRow;
    const studentNo = stu.studentNo;
    const studentName = stu.studentName;

    const writtenWorks = wwItems.map(item => ({ label: item.label, date: item.date, hps: item.hps, score: cell(r, item.col), col: item.col, row: r }));
    const performanceTasks = ptItems.map(item => ({ label: item.label, date: item.date, hps: item.hps, score: cell(r, item.col), col: item.col, row: r }));
    const exams = {};
    for (const [key, info] of Object.entries(examCols)) {
      const subWeight = cell(6, info.col + 3);
      if (info.hps) exams[key] = { label: info.label, date: info.date, hps: info.hps, score: cell(r, info.col), col: info.col, row: r, weight: subWeight };
    }

    let hasScore = false;
    let wwTotal = 0, wwMax = 0;
    writtenWorks.forEach(w => { wwMax += w.hps; if (w.score !== null && w.score !== undefined) { wwTotal += w.score; hasScore = true; } });
    const wwPS = wwMax > 0 ? (wwTotal / wwMax) * 100 : 0;
    const wwWS = wwPS * wwWeight;

    let ptTotal = 0, ptMax = 0;
    performanceTasks.forEach(p => { ptMax += p.hps; if (p.score !== null && p.score !== undefined) { ptTotal += p.score; hasScore = true; } });
    const ptPS = ptMax > 0 ? (ptTotal / ptMax) * 100 : 0;
    const ptWS = ptPS * ptWeight;

    let examTotal = 0, examMax = 0;
    let hasSubWeights = false;
    let weightedExamPS = 0;
    Object.values(exams).forEach(e => {
      const subWeight = cell(6, e.col + 3);
      if (typeof subWeight === 'number') {
        hasSubWeights = true;
        if (e.score !== null && e.score !== undefined) {
          const ps = e.hps > 0 ? (e.score / e.hps) * 100 : 0;
          weightedExamPS += ps * subWeight;
          hasScore = true;
        }
      } else {
        examMax += e.hps; 
        if (e.score !== null && e.score !== undefined) { 
          examTotal += e.score; 
          hasScore = true; 
        }
      }
    });
    const examPS = hasSubWeights ? weightedExamPS : (examMax > 0 ? (examTotal / examMax) * 100 : 0);
    const examWS = examPS * examWeight;

    const initialGrade = hasScore ? Math.round((wwWS + ptWS + examWS) * 100) / 100 : null;
    const transmutedGrade = hasScore ? getTransmuted(initialGrade) : null;
    
    let status = null;
    if (hasScore) {
      status = "Failed [E]";
      if (transmutedGrade >= 90) status = "Passed [A]";
      else if (transmutedGrade >= 80) status = "Passed [B]";
      else if (transmutedGrade >= 75) status = "Passed [C]";
      else if (transmutedGrade >= 65) status = "Failed [D]";
    }

    const removalScore = cell(r, 53);

    students.push({
      studentNo: String(studentNo), studentName,
      writtenWorks, performanceTasks, exams,
      summary: {
        wwTotal, wwPS: round2(wwPS), wwWS: round2(wwWS),
        ptTotal, ptPS: round2(ptPS), ptWS: round2(ptWS),
        examWS: round2(examWS), initialGrade, transmutedGrade, status,
      },
      removalExam: removalScore ? { score: removalScore, ps: cell(r, 54) } : null,
    });
  }
  return students;
}

function parseAttendance(ws, studentsList) {
  const cell = (r, c) => { const a = XLSX.utils.encode_cell({ r, c }); return ws[a] ? ws[a].v : null; };
  const sessions = [];
  for (let c = 4; c <= 103; c++) {
    const dateVal = cell(2, c);
    const termLabel = cell(4, c);
    if (dateVal) sessions.push({ col: c, date: excelDateToString(dateVal), term: termLabel || '' });
  }
  const students = {};
  for (const stu of studentsList) {
    const r = stu.attendanceRow;
    const studentNo = stu.studentNo;
    const studentName = stu.studentName;
    const records = [];
    for (const s of sessions) {
      const val = cell(r, s.col);
      records.push({ date: s.date, term: s.term, status: (val && val !== '--') ? val : null, col: s.col, row: r });
    }
      const summary = {
        term1: { present: 0, absent: 0, late: 0, excused: 0 },
        term2: { present: 0, absent: 0, late: 0, excused: 0 },
        term3: { present: 0, absent: 0, late: 0, excused: 0 },
      };
      
      for (const rec of records) {
        if (!rec.status) continue;
        const stat = rec.status.toUpperCase();
        let termKey = null;
        if (rec.term.includes('1')) termKey = 'term1';
        else if (rec.term.includes('2')) termKey = 'term2';
        else if (rec.term.includes('3')) termKey = 'term3';
        
        if (termKey) {
          if (stat === 'P') summary[termKey].present++;
          else if (stat === 'A') summary[termKey].absent++;
          else if (stat === 'L') summary[termKey].late++;
          else if (stat === 'E') summary[termKey].excused++;
        }
      }

      students[String(studentNo)] = {
        studentName, records,
        summary,
        status: cell(r, 116) || 'Active',
      };
  }
  return students;
}

function parseGradingSummary(ws, studentsList) {
  const cell = (r, c) => { const a = XLSX.utils.encode_cell({ r, c }); return ws[a] ? ws[a].v : null; };
  const students = {};
  for (const stu of studentsList) {
    const r = stu.summaryRow;
    const studentNo = stu.studentNo;
    const studentName = stu.studentName;
    students[String(studentNo)] = { studentName, term1: cell(r, 4), term2: cell(r, 5), term3: cell(r, 6), finalGrade: cell(r, 7), remarks: cell(r, 8) };
  }
  return students;
}

// ─── Tertiary / College Template Helpers ────────────────────────────────────
function detectWorkbookType(wb) {
  if (wb.Sheets['Data Input'] && (wb.Sheets['Term 1'] || wb.Sheets['Term 2'])) return 'high_school';
  if (wb.Sheets['Settings'] && wb.Sheets['Input']) return 'tertiary';
  return null;
}

function getTertiaryTransmuted(initial) {
  if (initial === null || initial === undefined || isNaN(initial)) return null;
  const num = Number(initial);
  if (num >= 97.5) return 1.0;
  if (num >= 94.5) return 1.25;
  if (num >= 91.5) return 1.5;
  if (num >= 86.5) return 1.75;
  if (num >= 81.5) return 2.0;
  if (num >= 76.0) return 2.25;
  if (num >= 70.5) return 2.5;
  if (num >= 65.0) return 2.75;
  if (num >= 59.5) return 3.0;
  return 5.0;
}

function parseTertiaryFile(wb, fname) {
  const wsSettings = wb.Sheets['Settings'];
  const wsInput = wb.Sheets['Input'];
  const wsSummary = wb.Sheets['Summary'];
  const cell = (ws, r, c) => {
    if (!ws) return null;
    const a = XLSX.utils.encode_cell({ r, c });
    return ws[a] ? ws[a].v : null;
  };

  const subjectInfo = {
    campus: cell(wsSettings, 2, 4) || '',
    department: cell(wsSettings, 3, 4) || '',
    schoolYear: cell(wsSettings, 4, 4) || '',
    semester: cell(wsSettings, 5, 4) || '',
    instructor: cell(wsSettings, 6, 4) || '',
    subject: cell(wsSettings, 7, 4) || fname.replace('.xlsx', ''),
    gradeLevel: 'Tertiary',
    classNo: cell(wsSettings, 2, 15) || '',
    code: cell(wsSettings, 3, 15) || '',
    section: cell(wsSettings, 4, 15) || '',
    room: cell(wsSettings, 5, 15) || '',
    schedule: cell(wsSettings, 6, 15) || '',
    time: cell(wsSettings, 7, 15) || '',
    templateType: 'tertiary',
    weights: {
      writtenOral: cell(wsSettings, 33, 6) || 0.2, // Quizzes
      performanceTask: cell(wsSettings, 28, 6) || 0.3, // PT
      termExam: cell(wsSettings, 38, 6) || 0.5, // Exam
    },
    termWeights: {
      'PRELIMS': cell(wsSummary, 5, 7) || 0.2,
      'MIDTERM': cell(wsSummary, 5, 9) || 0.2,
      'PRE-FINALS': cell(wsSummary, 5, 11) || 0.2,
      'FINALS': cell(wsSummary, 5, 13) || 0.4,
    },
    fileName: fname,
  };

  const studentsList = [];
  for (let r = 7; r <= 56; r++) { // rows 8 to 57 (0-indexed 7..56)
    const sNo = cell(wsInput, r, 3);
    const sName = cell(wsInput, r, 5);
    if (sNo && sName) {
      let strNo = String(sNo).trim();
      if (strNo.length === 10 && strNo.startsWith('2')) strNo = '0' + strNo;
      studentsList.push({
        studentNo: strNo,
        studentName: String(sName).trim(),
        inputRow: r,
        termRow: r - 1,
        summaryRow: r - 1
      });
    }
  }


  const termDefinitions = [
    { name: 'PRELIMS', ptCols: [6, 7, 8, 9], quizCols: [11, 12, 13, 14], examCol: 16, settingsCol: 8 },
    { name: 'MIDTERM', ptCols: [19, 20, 21, 22], quizCols: [24, 25, 26, 27], examCol: 29, settingsCol: 12 },
    { name: 'PRE-FINALS', ptCols: [32, 33, 34, 35], quizCols: [37, 38, 39, 40], examCol: 42, settingsCol: 16 },
    { name: 'FINALS', ptCols: [45, 46, 47, 48], quizCols: [50, 51, 52, 53], examCol: 55, settingsCol: 20 }
  ];

  const resolveHps = (c, sRow, sCol) => {
    let hps = cell(wsInput, 5, c);
    if (hps && typeof hps === 'number' && hps > 0) return hps;
    const addr = XLSX.utils.encode_cell({ r: 5, c });
    const f = wsInput && wsInput[addr]?.f;
    if (f && wsSettings) {
      const m = f.match(/Settings!([A-Z0-9]+)/);
      if (m && wsSettings[m[1]] && !isNaN(Number(wsSettings[m[1]].v)) && Number(wsSettings[m[1]].v) > 0) {
        return Number(wsSettings[m[1]].v);
      }
    }
    if (wsSettings && sRow !== undefined && sCol !== undefined) {
      const sVal = cell(wsSettings, sRow, sCol);
      if (sVal && !isNaN(Number(sVal)) && Number(sVal) > 0) return Number(sVal);
    }
    return null;
  };

  const terms = {};
  termDefinitions.forEach(td => {
    const wsTerm = wb.Sheets[td.name];
    const ptItems = [];
    td.ptCols.forEach((c, idx) => {
      const hps = resolveHps(c, 28 + idx, td.settingsCol);
      if (hps && hps > 0) {
        ptItems.push({ col: c, hps, label: String(cell(wsInput, 4, c) || `PRC${idx + 1}`) });
      }
    });

    const quizItems = [];
    td.quizCols.forEach((c, idx) => {
      const hps = resolveHps(c, 33 + idx, td.settingsCol);
      if (hps && hps > 0) {
        quizItems.push({ col: c, hps, label: String(cell(wsInput, 4, c) || `Q${idx + 1}`) });
      }
    });

    const examHps = resolveHps(td.examCol, 38, td.settingsCol);
    const examItem = (examHps && examHps > 0) ? {
      col: td.examCol,
      hps: examHps,
      label: String(cell(wsInput, 4, td.examCol) || 'Major Exam')
    } : null;

    // Dynamically detect summary and weight columns in wsTerm
    let gradeCol = 38, eqvCol = 39, rankCol = 40, ptWSCol = 24, wwWSCol = 34, examWSCol = 37;
    if (wsTerm) {
      for (let c = 20; c <= 60; c++) {
        const v2 = String(cell(wsTerm, 2, c) || '').trim().toUpperCase();
        const v3 = cell(wsTerm, 3, c);
        const v4 = cell(wsTerm, 4, c);
        if (v2 === 'GRADE') gradeCol = c;
        if (v2 === 'EQUIVALENT') eqvCol = c;
        if (v2 === 'RANK') rankCol = c;
        if ((v3 === 0.3 || v4 === 0.3) && ptWSCol === 24) ptWSCol = c;
        if ((v3 === 0.2 || v4 === 0.2) && wwWSCol === 34) wwWSCol = c;
        if ((v3 === 0.5 || v4 === 0.5) && examWSCol === 37) examWSCol = c;
      }
    }

    const termStudents = [];
    for (const stu of studentsList) {
      const r = stu.inputRow;
      const tr = stu.termRow;

      const performanceTasks = ptItems.map(item => ({
        label: item.label,
        hps: item.hps,
        score: cell(wsInput, r, item.col),
        col: item.col,
        row: r,
        sheet: 'Input'
      }));

      const quizzes = quizItems.map(item => ({
        label: item.label,
        hps: item.hps,
        score: cell(wsInput, r, item.col),
        col: item.col,
        row: r,
        sheet: 'Input'
      }));

      const exams = {};
      if (examItem) {
        exams['EX'] = {
          label: examItem.label,
          hps: examItem.hps,
          score: cell(wsInput, r, examItem.col),
          col: examItem.col,
          row: r,
          weight: subjectInfo.weights.termExam,
          sheet: 'Input'
        };
      }

      const rawPtWS = wsTerm ? cell(wsTerm, tr, ptWSCol) : null;
      const rawWwWS = wsTerm ? cell(wsTerm, tr, wwWSCol) : null;
      const rawExamWS = wsTerm ? cell(wsTerm, tr, examWSCol) : null;
      const rawInitial = wsTerm ? cell(wsTerm, tr, gradeCol) : null;
      const rawTransmuted = wsTerm ? cell(wsTerm, tr, eqvCol) : null;
      const rawRank = wsTerm ? cell(wsTerm, tr, rankCol) : null;

      const ptWeight = subjectInfo.weights.performanceTask || 0.3;
      const wwWeight = subjectInfo.weights.writtenOral || 0.2;
      const examWeight = subjectInfo.weights.termExam || 0.5;

      // Check if student has PT scores
      let hasPtScore = false;
      let ptPctsSum = 0;
      if (performanceTasks.length > 0) {
        performanceTasks.forEach(p => {
          if (p.score !== null && p.score !== undefined && p.score !== '' && !isNaN(Number(p.score))) {
            hasPtScore = true;
            ptPctsSum += (Number(p.score) / p.hps) * 100;
          }
        });
      }
      let ptWS = null;
      if (hasPtScore && performanceTasks.length > 0) {
        ptWS = round2((ptPctsSum / performanceTasks.length) * ptWeight);
      } else if (rawPtWS !== null && rawPtWS !== '' && !isNaN(Number(rawPtWS))) {
        ptWS = round2(Number(rawPtWS));
      }

      // Check if student has Quiz scores
      let hasWwScore = false;
      let wwPctsSum = 0;
      if (quizzes.length > 0) {
        quizzes.forEach(q => {
          if (q.score !== null && q.score !== undefined && q.score !== '' && !isNaN(Number(q.score))) {
            hasWwScore = true;
            wwPctsSum += (Number(q.score) / q.hps) * 100;
          }
        });
      }
      let wwWS = null;
      if (hasWwScore && quizzes.length > 0) {
        wwWS = round2((wwPctsSum / quizzes.length) * wwWeight);
      } else if (rawWwWS !== null && rawWwWS !== '' && !isNaN(Number(rawWwWS))) {
        wwWS = round2(Number(rawWwWS));
      }

      // Check Exam score
      let examWS = null;
      if (exams['EX']) {
        const exSc = exams['EX'].score;
        if (exSc !== null && exSc !== undefined && exSc !== '' && !isNaN(Number(exSc))) {
          examWS = round2((Number(exSc) / exams['EX'].hps) * 100 * examWeight);
        } else if (rawExamWS !== null && rawExamWS !== '' && !isNaN(Number(rawExamWS))) {
          examWS = round2(Number(rawExamWS));
        }
      }

      let initialGrade = null;
      if (hasPtScore || hasWwScore || examWS !== null) {
        initialGrade = round2((ptWS || 0) + (wwWS || 0) + (examWS || 0));
      } else if (rawInitial !== null && rawInitial !== '' && !isNaN(Number(rawInitial))) {
        initialGrade = round2(Number(rawInitial));
      }

      let transmutedGrade = null;
      if (initialGrade !== null) {
        transmutedGrade = getTertiaryTransmuted(initialGrade);
      } else if (rawTransmuted !== null && String(rawTransmuted).trim() !== '' && String(rawTransmuted).trim() !== '-') {
        transmutedGrade = rawTransmuted;
      }

      const rank = rawRank !== null && rawRank !== undefined && String(rawRank).trim() !== '' ? rawRank : null;

      let status = null;
      if (transmutedGrade !== null && transmutedGrade !== undefined && transmutedGrade !== '') {
        const str = String(transmutedGrade).toUpperCase();
        if (str === 'INC') status = 'Incomplete';
        else if (str === 'DRP') status = 'Dropped';
        else if (str === '-') status = 'In Progress';
        else {
          const num = Number(transmutedGrade);
          if (!isNaN(num)) {
            status = num <= 3.0 ? `Passed [${num.toFixed(2)}]` : `Failed [${num.toFixed(2)}]`;
          }
        }
      }

      termStudents.push({
        studentNo: stu.studentNo,
        studentName: stu.studentName,
        performanceTasks,
        quizzes,
        writtenWorks: quizzes,
        exams,
        summary: {
          ptWS,
          wwWS,
          examWS,
          initialGrade,
          transmutedGrade,
          rank,
          status
        }
      });
    }
    terms[td.name] = termStudents;
  });

  // Attendance
  const attendance = {};
  for (const stu of studentsList) {
    const tr = stu.termRow;
    const records = [];
    const summary = {
      term1: { present: 0, absent: 0, late: 0, excused: 0 },
      term2: { present: 0, absent: 0, late: 0, excused: 0 },
      term3: { present: 0, absent: 0, late: 0, excused: 0 },
      term4: { present: 0, absent: 0, late: 0, excused: 0 }
    };

    termDefinitions.forEach((td, tIdx) => {
      const wsTerm = wb.Sheets[td.name];
      if (!wsTerm) return;
      const termKey = 'term' + (tIdx + 1);
      let curMonth = '';
      for (let c = 6; c <= 20; c++) {
        const m = cell(wsTerm, 2, c);
        if (m) curMonth = String(m).trim();
        const d = cell(wsTerm, 3, c);
        const day = cell(wsTerm, 4, c);
        if (d && !isNaN(d)) {
          const dateStr = curMonth ? `${curMonth} ${d}` : `Day ${d}`;
          const rawVal = cell(wsTerm, tr, c);
          let stat = null;
          if (rawVal !== null && rawVal !== undefined && rawVal !== '' && rawVal !== '-') {
            if (rawVal === 'P' || (typeof rawVal === 'number' && rawVal > 0)) {
              stat = 'P';
              summary[termKey].present++;
            } else if (rawVal === 'A' || rawVal === 0) {
              stat = 'A';
              summary[termKey].absent++;
            } else if (rawVal === 'L') {
              stat = 'L';
              summary[termKey].late++;
            } else if (rawVal === 'E') {
              stat = 'E';
              summary[termKey].excused++;
            }
          }
          records.push({
            date: dateStr,
            term: td.name,
            status: stat,
            col: c,
            row: tr,
            sheet: td.name
          });
        }
      }
    });

    attendance[stu.studentNo] = {
      studentName: stu.studentName,
      records,
      summary,
      status: 'Active'
    };
  }

  // Summary
  const gradingSummary = {};
  for (const stu of studentsList) {
    const sr = stu.summaryRow;
    const pStu = terms['PRELIMS']?.find(s => s.studentNo === stu.studentNo);
    const mStu = terms['MIDTERM']?.find(s => s.studentNo === stu.studentNo);
    const pfStu = terms['PRE-FINALS']?.find(s => s.studentNo === stu.studentNo);
    const fStu = terms['FINALS']?.find(s => s.studentNo === stu.studentNo);

    const rawPrelim = wsSummary ? cell(wsSummary, sr, 8) : null;
    const rawMidterm = wsSummary ? cell(wsSummary, sr, 10) : null;
    const rawPreFinal = wsSummary ? cell(wsSummary, sr, 12) : null;
    const rawFinal = wsSummary ? cell(wsSummary, sr, 14) : null;
    const rawFinalGrade = wsSummary ? cell(wsSummary, sr, 18) : null;
    const rawRemarks = wsSummary ? cell(wsSummary, sr, 19) : '';

    const prelimVal = pStu?.summary?.transmutedGrade ?? rawPrelim ?? null;
    const midtermVal = mStu?.summary?.transmutedGrade ?? rawMidterm ?? null;
    const preFinalVal = pfStu?.summary?.transmutedGrade ?? rawPreFinal ?? null;
    const finalVal = fStu?.summary?.transmutedGrade ?? rawFinal ?? null;

    let finalGrade = (rawFinalGrade !== null && rawFinalGrade !== '' && !isNaN(Number(rawFinalGrade))) ? Number(rawFinalGrade) : null;
    if (finalGrade === null) {
      const valid = [prelimVal, midtermVal, preFinalVal, finalVal].filter(v => v !== null && typeof v === 'number');
      if (valid.length === 4) {
        finalGrade = round2(prelimVal * 0.2 + midtermVal * 0.2 + preFinalVal * 0.2 + finalVal * 0.4);
      } else if (valid.length > 0) {
        finalGrade = round2(valid.reduce((a, b) => a + b, 0) / valid.length);
      }
    }

    let remarks = rawRemarks || '';
    if (!remarks && finalGrade !== null) {
      remarks = finalGrade <= 3.0 ? 'Passed' : 'Failed';
    }

    gradingSummary[stu.studentNo] = {
      studentName: stu.studentName,
      term1: prelimVal,
      term2: midtermVal,
      term3: preFinalVal,
      term4: finalVal,
      finalGrade,
      remarks,
      prelims: { pct: pStu?.summary?.initialGrade ?? (wsSummary ? cell(wsSummary, sr, 7) : null), eqv: prelimVal },
      midterm: { pct: mStu?.summary?.initialGrade ?? (wsSummary ? cell(wsSummary, sr, 9) : null), eqv: midtermVal },
      preFinals: { pct: pfStu?.summary?.initialGrade ?? (wsSummary ? cell(wsSummary, sr, 11) : null), eqv: preFinalVal },
      finals: { pct: fStu?.summary?.initialGrade ?? (wsSummary ? cell(wsSummary, sr, 13) : null), eqv: finalVal }
    };
  }

  return { subjectInfo, studentsList, terms, attendance, gradingSummary };
}

// ─── Load All Grade Data ─────────────────────────────────────────────────────
function loadAllData() {
  console.log(`[${new Date().toLocaleTimeString()}] 📂 Loading grade data...`);
  const newMap = {};
  const files = fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx'));

  for (const fname of files) {
    try {
      const fpath = path.join(GRADES_DIR, fname);
      const wb = XLSX.readFile(fpath);
      const type = detectWorkbookType(wb);
      if (!type) continue;

      if (type === 'tertiary') {
        const parsed = parseTertiaryFile(wb, fname);
        for (const stu of parsed.studentsList) {
          const studentNo = stu.studentNo;
          const sName = stu.studentName;
          if (!newMap[studentNo]) newMap[studentNo] = { studentNo, name: sName, subjects: [] };

          const studentTerms = {};
          for (const [termName, termStudents] of Object.entries(parsed.terms)) {
            const match = termStudents.find(s => s.studentNo === studentNo);
            if (match) studentTerms[termName] = match;
          }

          const newSubjectEntry = {
            info: parsed.subjectInfo,
            terms: studentTerms,
            attendance: parsed.attendance[studentNo] || null,
            gradingSummary: parsed.gradingSummary[studentNo] || null,
          };

          const existingIdx = newMap[studentNo].subjects.findIndex(
            sub => sub.info.subject === parsed.subjectInfo.subject && sub.info.section === parsed.subjectInfo.section
          );
          if (existingIdx !== -1) newMap[studentNo].subjects[existingIdx] = newSubjectEntry;
          else newMap[studentNo].subjects.push(newSubjectEntry);
        }
        continue;
      }

      // High School Template
      const di = wb.Sheets['Data Input'];
      if (!di) continue;

      const subjectInfo = {
        campus: cellVal(di, 'G6') || '',
        department: cellVal(di, 'G7') || '',
        schoolYear: cellVal(di, 'G8') || '',
        instructor: cellVal(di, 'G10') || '',
        gradeLevel: cellVal(di, 'G11') || '',
        subject: cellVal(di, 'G12') || fname.replace('.xlsx', ''),
        code: cellVal(di, 'G14') || '',
        section: cellVal(di, 'G16') || '',
        room: cellVal(di, 'G17') || '',
        schedule: cellVal(di, 'G18') || '',
        time: cellVal(di, 'G19') || '',
        templateType: 'high_school',
        weights: {
          writtenOral: cellVal(di, 'H25') || 0,
          performanceTask: cellVal(di, 'H26') || 0,
          termExam: cellVal(di, 'H27') || 0,
        },
        fileName: fname,
      };

      const classStudentsList = [];
      for (let row = 7; row <= 70; row++) {
        const sNo = cellVal(di, `M${row}`);
        const sName = cellVal(di, `N${row}`);
        if (sNo && sName) {
          let strNo = String(sNo).trim();
          if (strNo.length === 10 && strNo.startsWith('2')) {
            strNo = '0' + strNo;
          }
          classStudentsList.push({
            studentNo: strNo,
            studentName: String(sName).trim(),
            diRow: row,
            termRow: row + 1,
            attendanceRow: row - 2,
            summaryRow: row + 1
          });
        }
      }

      const terms = {};
      wb.SheetNames.filter(n => n.startsWith('Term ')).forEach(termName => {
        if (wb.Sheets[termName]) terms[termName] = parseTermSheet(wb.Sheets[termName], classStudentsList);
      });

      let attendance = {};
      if (wb.Sheets['Attendance']) attendance = parseAttendance(wb.Sheets['Attendance'], classStudentsList);

      let gradingSummary = {};
      if (wb.Sheets['Grading Summary']) gradingSummary = parseGradingSummary(wb.Sheets['Grading Summary'], classStudentsList);

      for (const stu of classStudentsList) {
        const row = stu.diRow;
        const studentNo = stu.studentNo;
        const sName = stu.studentName;
        if (!newMap[studentNo]) newMap[studentNo] = { studentNo, name: sName, subjects: [] };

        const studentTerms = {};
        for (const [termName, termStudents] of Object.entries(terms)) {
          const match = termStudents.find(s => s.studentNo === studentNo);
          if (match) studentTerms[termName] = match;
        }

        const t1 = studentTerms['Term 1']?.summary?.transmutedGrade ?? null;
        const t2 = studentTerms['Term 2']?.summary?.transmutedGrade ?? null;
        const t3 = studentTerms['Term 3']?.summary?.transmutedGrade ?? null;
        const t4 = studentTerms['Term 4']?.summary?.transmutedGrade ?? null;
        
        const validTerms = [t1, t2, t3, t4].filter(t => t !== null);
        const finalGrade = validTerms.length > 0 ? Math.round(validTerms.reduce((a,b)=>a+b, 0) / validTerms.length) : null;
        
        let remarks = "";
        if (finalGrade !== null) {
          // DepEd standard SHS descriptors
          if (finalGrade >= 90) remarks = "Passed [Outstanding]";
          else if (finalGrade >= 85) remarks = "Passed [Very Satisfactory]";
          else if (finalGrade >= 80) remarks = "Passed [Satisfactory]";
          else if (finalGrade >= 75) remarks = "Passed [Fairly Satisfactory]";
          else remarks = "Failed [Did Not Meet Expectations]";
        }

        const gs = { term1: t1, term2: t2, term3: t3, term4: t4, finalGrade, remarks };

        const newSubjectEntry = {
          info: subjectInfo,
          terms: studentTerms,
          attendance: attendance[studentNo] || null,
          gradingSummary: gs,
        };

        const existingIdx = newMap[studentNo].subjects.findIndex(
          sub => sub.info.subject === subjectInfo.subject && sub.info.section === subjectInfo.section
        );
        if (existingIdx !== -1) newMap[studentNo].subjects[existingIdx] = newSubjectEntry;
        else newMap[studentNo].subjects.push(newSubjectEntry);
      }
    } catch (err) {
      console.error(`  ❌ Error reading ${fname}:`, err.message);
    }
  }

  studentsMap = newMap;
  lastSync = new Date().toISOString();
  console.log(`  ✅ Loaded ${Object.keys(studentsMap).length} students from ${files.length} files`);
}

loadAllData();

const watcher = chokidar.watch(GRADES_DIR, { ignored: /~\$/, persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 } });
watcher.on('change', loadAllData).on('add', loadAllData).on('unlink', loadAllData);

// ─── Multer Config ───────────────────────────────────────────────────────────
const gradeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, GRADES_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMPLATES_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const studentNo = req.session?.userId || 'unknown';
    cb(null, `${studentNo}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const uploadGrade = multer({ storage: gradeStorage, fileFilter: (req, file, cb) => cb(null, file.originalname.endsWith('.xlsx')) });
const uploadTemplate = multer({ storage: templateStorage, fileFilter: (req, file, cb) => cb(null, file.originalname.endsWith('.xlsx')) });
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')) });

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'User ID and password are required.' });

  let id = String(userId).trim();
  const pw = String(password).trim();

  // Normalize student ID if length 10 and starts with '2'
  if (id.length === 10 && id.startsWith('2')) {
    id = '0' + id;
  }

  // Admin
  if (id.toLowerCase() === 'admin') {
    if (pw === settingsConfig.adminPassword) {
      logActivity('admin', 'admin', 'Login', 'Administrator logged in', {}, req);
      const token = createSession('admin', 'admin', { name: 'Administrator' }, req);
      return res.json({ success: true, role: 'admin', token, user: { id: 'admin', name: 'Administrator' } });
    }
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }

  // Teacher
  const teacherId = Object.keys(teachersConfig).find(tid => tid.toLowerCase() === id.toLowerCase());
  if (teacherId) {
    if (accountStatusConfig[teacherId] === 'suspended') return res.status(403).json({ error: 'Account suspended.' });
    const t = teachersConfig[teacherId];
    if (pw === t.password) {
      logActivity(teacherId, 'teacher', 'Login', `Teacher ${t.name} logged in`, {}, req);
      const token = createSession(teacherId, 'teacher', { name: t.name, email: t.email, department: t.department }, req);
      return res.json({ success: true, role: 'teacher', token, user: { id: teacherId, name: t.name, email: t.email, department: t.department } });
    }
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Student
  const unpaddedId = id.replace(/^0+/, '');
  const student = studentsMap[id] || studentsMap[unpaddedId];
  if (!student) return res.status(404).json({ error: 'User not found. Please check your ID.' });
  const canonicalId = student.studentNo;

  if (accountStatusConfig[canonicalId] === 'suspended' || accountStatusConfig[unpaddedId] === 'suspended') {
    return res.status(403).json({ error: 'Account suspended.' });
  }

  const customPw = passwordsConfig[canonicalId] || passwordsConfig[unpaddedId];
  const isPwValid = customPw
    ? (pw === String(customPw))
    : (pw === canonicalId || pw === unpaddedId || pw === id);

  if (!isPwValid) return res.status(401).json({ error: 'Incorrect password.' });

  const profile = studentProfilesConfig[canonicalId] || studentProfilesConfig[unpaddedId] || {};
  const isOnboarded = !!profile.onboarded;
  const token = createSession(canonicalId, 'student', { name: student.name }, req);
  logActivity(canonicalId, 'student', 'Login', `Student ${student.name} logged in`, {}, req);

  res.json({ success: true, role: 'student', token, isOnboarded, user: { id: canonicalId, name: student.name, ...profile } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token && sessions[token]) {
    const s = sessions[token];
    logActivity(s.userId, s.role, 'Logout', `${s.meta?.name || s.userId} logged out`, {}, req);
  }
  destroySession(token);
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth(), (req, res) => {
  const { role, userId } = req.session;
  if (role === 'admin') return res.json({ role, user: { id: 'admin', name: 'Administrator' } });
  if (role === 'teacher') {
    const t = teachersConfig[userId] || {};
    return res.json({ role, user: { id: userId, name: t.name, email: t.email, department: t.department, photo: t.photo } });
  }
  if (role === 'student') {
    const s = studentsMap[userId];
    if (!s) return res.status(404).json({ error: 'Student not found.' });
    const profile = studentProfilesConfig[userId] || {};
    return res.json({ role, user: { id: userId, name: s.name, ...profile } });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  SETTINGS ROUTES & SYNCHRONIZATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function extractSyncableSettings(cfg) {
  if (!cfg) return null;
  return {
    portalName: cfg.portalName,
    schoolName: cfg.schoolName,
    schoolInfo: cfg.schoolInfo || {},
    notification: cfg.notification || { enabled: false, message: '' },
    features: cfg.features || { grades: true, attendance: true },
    visibleTerms: cfg.visibleTerms || {},
    termLocks: cfg.termLocks || {},
    gradeRelease: cfg.gradeRelease || {},
    sessionTimeout: cfg.sessionTimeout || 7200000,
    portalLogo: cfg.portalLogo || '',
    updatedAt: cfg.updatedAt || new Date(0).toISOString()
  };
}

function applySyncableSettings(incoming) {
  if (!incoming || typeof incoming !== 'object') return false;
  if (incoming.portalName !== undefined) settingsConfig.portalName = incoming.portalName;
  if (incoming.schoolName !== undefined) settingsConfig.schoolName = incoming.schoolName;
  if (incoming.schoolInfo !== undefined) settingsConfig.schoolInfo = incoming.schoolInfo;
  if (incoming.notification !== undefined) settingsConfig.notification = incoming.notification;
  if (incoming.features !== undefined) settingsConfig.features = incoming.features;
  if (incoming.visibleTerms !== undefined) settingsConfig.visibleTerms = incoming.visibleTerms;
  if (incoming.termLocks !== undefined) settingsConfig.termLocks = incoming.termLocks;
  if (incoming.gradeRelease !== undefined) settingsConfig.gradeRelease = incoming.gradeRelease;
  if (incoming.sessionTimeout !== undefined) settingsConfig.sessionTimeout = incoming.sessionTimeout;
  if (incoming.portalLogo !== undefined) settingsConfig.portalLogo = incoming.portalLogo;
  if (incoming.updatedAt) settingsConfig.updatedAt = incoming.updatedAt;
  saveJSON(SETTINGS_FILE, settingsConfig);
  return true;
}

async function syncSettingsWithCloud(options = {}) {
  const cloudUrl = settingsConfig.cloudSync?.serverUrl || DEFAULT_CLOUD_URL;
  const secretKey = settingsConfig.cloudSync?.secretKey || DEFAULT_SYNC_SECRET;
  const { preferLocal = false, forcePush = false, forcePull = false, req = null } = options;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`${cloudUrl}/api/sync/exchange-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-token': secretKey
      },
      body: JSON.stringify({
        localSettings: extractSyncableSettings(settingsConfig),
        preferLocal,
        forcePush,
        forcePull
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      if (resp.status === 404) {
        // Fallback for legacy AWS server before /api/sync/exchange-settings is deployed
        try {
          const files = fs.existsSync(GRADES_DIR) ? fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')) : [];
          const probeFile = files.length > 0 ? files[0] : null;

          const fallbackPullResp = await fetch(`${cloudUrl}/api/sync/provide-pull`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-sync-token': secretKey
            },
            body: JSON.stringify(probeFile ? { filename: probeFile } : {})
          });

          if (fallbackPullResp.ok) {
            const pullData = await fallbackPullResp.json();
            const remoteSettings = pullData.settings || {};
            const remoteTime = new Date(remoteSettings.updatedAt || 0).getTime();
            const localTime = new Date(settingsConfig.updatedAt || 0).getTime();

            if (!forcePull && !forcePush && remoteSettings.updatedAt && remoteTime === localTime) {
              return {
                success: true,
                action: 'already_in_sync',
                message: 'Offline and Online settings are already in sync.',
                cloudUpdatedAt: remoteSettings.updatedAt,
                localUpdatedAt: settingsConfig.updatedAt
              };
            }

            if (forcePull || (remoteTime > localTime && remoteSettings.updatedAt)) {
              applySyncableSettings(remoteSettings);
              return {
                success: true,
                action: 'pulled',
                message: `Synchronized! Online settings were newer and updated locally.`,
                cloudUpdatedAt: remoteSettings.updatedAt || null,
                localUpdatedAt: settingsConfig.updatedAt,
                appliedSettings: remoteSettings
              };
            } else {
              // Local is newer: push to remote receive-push!
              const files = fs.existsSync(GRADES_DIR) ? fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')) : [];
              if (files.length > 0) {
                const probeFile = files[0];
                const contentBase64 = fs.readFileSync(path.join(GRADES_DIR, probeFile)).toString('base64');
                const pushResp = await fetch(`${cloudUrl}/api/sync/receive-push`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-sync-token': secretKey
                  },
                  body: JSON.stringify({
                    files: [{ filename: probeFile, contentBase64 }],
                    settings: extractSyncableSettings(settingsConfig),
                    sender: `${req?.session?.userId || 'Admin'} (Settings Sync)`
                  })
                });
                if (pushResp.ok) {
                  return {
                    success: true,
                    action: 'pushed',
                    message: `Synchronized! Offline settings were newer and pushed to AWS Cloud.`,
                    cloudUpdatedAt: settingsConfig.updatedAt,
                    localUpdatedAt: settingsConfig.updatedAt
                  };
                }
              }
            }
          }
        } catch (fallbackErr) {
          console.warn('Legacy sync bridge error:', fallbackErr.message);
        }
      }

      const errText = await resp.text();
      return { success: false, error: `Cloud returned HTTP ${resp.status}: ${errText}` };
    }

    const data = await resp.json();
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to exchange settings.' };
    }

    const cloudTime = new Date(data.serverUpdatedAt || data.serverSettings?.updatedAt || 0).getTime();
    const localTime = new Date(settingsConfig.updatedAt || 0).getTime();

    if (data.action === 'incoming_should_update' && data.serverSettings) {
      // Remote cloud is NEWER (or forcePull)! Apply remote settings locally!
      applySyncableSettings(data.serverSettings);
      logActivity(
        req?.session?.userId || 'system',
        req?.session?.role || 'system',
        'Settings Synced from Cloud',
        `Synchronized settings from AWS Cloud (Cloud was updated at ${new Date(cloudTime).toLocaleString()})`,
        {},
        req
      );
      return {
        success: true,
        action: 'pulled',
        message: `Synchronized! Online settings were newer (${new Date(cloudTime).toLocaleString()}) and updated locally.`,
        cloudUpdatedAt: data.serverUpdatedAt,
        localUpdatedAt: settingsConfig.updatedAt,
        appliedSettings: data.serverSettings
      };
    } else if (data.action === 'server_updated_from_incoming') {
      // Local settings were NEWER (or forcePush)! Server updated to match local!
      logActivity(
        req?.session?.userId || 'system',
        req?.session?.role || 'system',
        'Settings Pushed to Cloud',
        `Pushed newer offline settings to AWS Cloud (Updated at ${new Date(localTime).toLocaleString()})`,
        {},
        req
      );
      return {
        success: true,
        action: 'pushed',
        message: `Synchronized! Offline settings were newer (${new Date(localTime).toLocaleString()}) and pushed to AWS Cloud.`,
        cloudUpdatedAt: settingsConfig.updatedAt,
        localUpdatedAt: settingsConfig.updatedAt
      };
    } else {
      return {
        success: true,
        action: 'already_in_sync',
        message: 'Offline and Online settings are already in sync.',
        cloudUpdatedAt: data.serverUpdatedAt || settingsConfig.updatedAt,
        localUpdatedAt: settingsConfig.updatedAt
      };
    }
  } catch (err) {
    return {
      success: false,
      offline: true,
      error: 'Cannot reach AWS Cloud server: ' + err.message
    };
  }
}

app.get('/api/settings/public', (req, res) => {
  const { adminPassword, ...safe } = settingsConfig;
  res.json({ ...safe, developer: 'Sir Markyu' });
});

app.get('/api/settings', requireAuth(['admin']), (req, res) => {
  res.json(settingsConfig);
});

app.put('/api/settings', requireAuth(['admin']), async (req, res) => {
  const { adminPassword, portalName, schoolName, visibleTerms, termLocks, features, sessionTimeout, gradeRelease, schoolInfo, notification, portalLogo } = req.body;
  if (portalName !== undefined) settingsConfig.portalName = portalName;
  if (schoolName !== undefined) settingsConfig.schoolName = schoolName;
  if (visibleTerms !== undefined) settingsConfig.visibleTerms = visibleTerms;
  if (termLocks !== undefined) settingsConfig.termLocks = termLocks;
  if (features !== undefined) settingsConfig.features = features;
  if (sessionTimeout !== undefined) settingsConfig.sessionTimeout = sessionTimeout;
  if (gradeRelease !== undefined) settingsConfig.gradeRelease = gradeRelease;
  if (schoolInfo !== undefined) settingsConfig.schoolInfo = schoolInfo;
  if (notification !== undefined) settingsConfig.notification = notification;
  if (portalLogo !== undefined) settingsConfig.portalLogo = portalLogo;
  if (adminPassword && adminPassword.trim()) settingsConfig.adminPassword = adminPassword.trim();
  
  // Set updated timestamp
  settingsConfig.updatedAt = new Date().toISOString();
  saveJSON(SETTINGS_FILE, settingsConfig);
  logActivity('admin', 'admin', 'Update Settings', 'Updated system settings', {}, req);

  // Attempt automatic cloud sync if serverUrl is configured
  let cloudSyncResult = null;
  if (settingsConfig.cloudSync?.serverUrl) {
    try {
      cloudSyncResult = await syncSettingsWithCloud({ preferLocal: true, req });
    } catch (e) {}
  }

  res.json({ 
    success: true, 
    settings: settingsConfig, 
    updatedAt: settingsConfig.updatedAt,
    cloudSync: cloudSyncResult 
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  STUDENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/student/onboard', requireAuth(['student']), uploadPhoto.single('photo'), (req, res) => {
  const studentNo = req.session.userId;
  const unpaddedId = studentNo.replace(/^0+/, '');
  const student = studentsMap[studentNo] || studentsMap[unpaddedId];
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  const canonicalId = student.studentNo;

  const { newPassword, contactNo, parentName, parentContactNo, address } = req.body;

  if (newPassword && newPassword.trim()) {
    passwordsConfig[canonicalId] = newPassword.trim();
    saveJSON(PASSWORDS_FILE, passwordsConfig);
  }

  const photo = req.file ? `/photos/${req.file.filename}` : (studentProfilesConfig[canonicalId]?.photo || null);
  studentProfilesConfig[canonicalId] = {
    ...studentProfilesConfig[canonicalId],
    contactNo, parentName, parentContactNo, address, photo, onboarded: true, onboardedAt: new Date().toISOString()
  };
  saveJSON(STUDENT_PROFILES_FILE, studentProfilesConfig);
  res.json({ success: true });
});

app.post('/api/student/change-password', requireAuth(['student']), (req, res) => {
  const studentNo = req.session.userId;
  const unpaddedId = studentNo.replace(/^0+/, '');
  const canonicalId = studentsMap[studentNo] ? studentNo : (studentsMap[unpaddedId] ? studentsMap[unpaddedId].studentNo : studentNo);
  const { currentPassword, newPassword } = req.body;
  const customPw = passwordsConfig[canonicalId] || passwordsConfig[unpaddedId];
  const isCurrentPwValid = customPw
    ? (String(currentPassword) === String(customPw))
    : (String(currentPassword) === canonicalId || String(currentPassword) === unpaddedId);
  if (!isCurrentPwValid) return res.status(401).json({ error: 'Incorrect current password.' });
  passwordsConfig[canonicalId] = newPassword.trim();
  saveJSON(PASSWORDS_FILE, passwordsConfig);
  res.json({ success: true });
});

app.put('/api/student/profile', requireAuth(['student']), uploadPhoto.single('photo'), (req, res) => {
  const studentNo = req.session.userId;
  const { contactNo, parentName, parentContactNo, address } = req.body;
  const photo = req.file ? `/photos/${req.file.filename}` : (studentProfilesConfig[studentNo]?.photo || null);
  studentProfilesConfig[studentNo] = { ...studentProfilesConfig[studentNo], contactNo, parentName, parentContactNo, address, photo };
  saveJSON(STUDENT_PROFILES_FILE, studentProfilesConfig);
  res.json({ success: true });
});

app.put('/api/student/theme', requireAuth(['student']), (req, res) => {
  const studentNo = req.session.userId;
  studentProfilesConfig[studentNo] = { ...studentProfilesConfig[studentNo], theme: req.body.theme };
  saveJSON(STUDENT_PROFILES_FILE, studentProfilesConfig);
  res.json({ success: true });
});

app.get('/api/student/grades', requireAuth(['student']), (req, res) => {
  const studentNo = req.session.userId;
  const student = studentsMap[studentNo];
  if (!student) return res.status(404).json({ error: 'Student not found.' });

  const clone = JSON.parse(JSON.stringify(student));
  const profile = studentProfilesConfig[studentNo] || {};

  clone.subjects.forEach(sub => {
    const fname = sub.info.fileName;
    const isTertiary = sub.info.templateType === 'tertiary';
    const cs = { 
      hideTerm1: false, hideTerm2: true, hideTerm3: true, hideTerm4: true, 
      ...(classSettingsConfig[fname] || {}) 
    };
    if (cs.blockedStudents?.includes(studentNo)) {
      sub.isBlocked = true; sub.terms = {}; sub.gradingSummary = null; sub.attendance = null;
    } else {
      if (cs.hideTerm1) {
        if (sub.terms['Term 1']) delete sub.terms['Term 1'];
        if (sub.terms['PRELIMS']) delete sub.terms['PRELIMS'];
        if (sub.gradingSummary) {
          sub.gradingSummary.term1 = null;
          if (sub.gradingSummary.prelims) sub.gradingSummary.prelims = null;
        }
      }
      if (cs.hideTerm2) {
        if (sub.terms['Term 2']) delete sub.terms['Term 2'];
        if (sub.terms['MIDTERM']) delete sub.terms['MIDTERM'];
        if (sub.gradingSummary) {
          sub.gradingSummary.term2 = null;
          if (sub.gradingSummary.midterm) sub.gradingSummary.midterm = null;
        }
      }
      if (cs.hideTerm3) {
        if (sub.terms['Term 3']) delete sub.terms['Term 3'];
        if (sub.terms['PRE-FINALS']) delete sub.terms['PRE-FINALS'];
        if (sub.gradingSummary) {
          sub.gradingSummary.term3 = null;
          if (sub.gradingSummary.preFinals) sub.gradingSummary.preFinals = null;
        }
      }
      if (cs.hideTerm4) {
        if (sub.terms['Term 4']) delete sub.terms['Term 4'];
        if (sub.terms['FINALS']) delete sub.terms['FINALS'];
        if (sub.gradingSummary) {
          sub.gradingSummary.term4 = null;
          if (sub.gradingSummary.finals) sub.gradingSummary.finals = null;
        }
      }
      if (cs.hideAttendance) sub.attendance = null;
      if (cs.hideBreakdown) {
        Object.keys(sub.terms).forEach(t => {
          const isTermHidden = typeof cs.hideBreakdown === 'boolean' 
            ? cs.hideBreakdown 
            : (cs.hideBreakdown[t] || 
               (t === 'PRELIMS' && cs.hideBreakdown['Term 1']) ||
               (t === 'MIDTERM' && cs.hideBreakdown['Term 2']) ||
               (t === 'PRE-FINALS' && cs.hideBreakdown['Term 3']) ||
               (t === 'FINALS' && cs.hideBreakdown['Term 4']));
          if (isTermHidden && sub.terms[t]) {
            delete sub.terms[t].writtenWorks;
            delete sub.terms[t].quizzes;
            delete sub.terms[t].performanceTasks;
            delete sub.terms[t].exams;
            if (sub.terms[t].summary) {
              delete sub.terms[t].summary.wwWS;
              delete sub.terms[t].summary.ptWS;
              delete sub.terms[t].summary.examWS;
            }
          }
        });
      }
    }
    // Apply global visible terms filter
    const vt = settingsConfig.visibleTerms || {};
    const releaseFinals = cs.releaseFinals || {};
    const termAliases = {
      'PRELIMS': 'Term 1',
      'MIDTERM': 'Term 2',
      'PRE-FINALS': 'Term 3',
      'FINALS': 'Term 4',
      'Term 1': 'PRELIMS',
      'Term 2': 'MIDTERM',
      'Term 3': 'PRE-FINALS',
      'Term 4': 'FINALS'
    };

    Object.keys(sub.terms).forEach(t => { 
      const alias = termAliases[t];
      const isVisible = vt[t] !== false && (alias ? vt[alias] !== false : true);
      const isReleased = releaseFinals[t] !== false && (alias ? releaseFinals[alias] !== false : true);

      if (!isVisible) {
        delete sub.terms[t]; 
      } else if (!isReleased) {
        if (sub.terms[t].summary) {
          sub.terms[t].summary.transmutedGrade = null;
          sub.terms[t].summary.initialGrade = null;
          sub.terms[t].summary.status = 'Hidden';
        }
      }
    });

    if (sub.gradingSummary && Object.keys(releaseFinals).length > 0) {
      if (releaseFinals['Term 1'] === false || releaseFinals['PRELIMS'] === false) {
        sub.gradingSummary.term1 = null;
        if (sub.gradingSummary.prelims) sub.gradingSummary.prelims = null;
      }
      if (releaseFinals['Term 2'] === false || releaseFinals['MIDTERM'] === false) {
        sub.gradingSummary.term2 = null;
        if (sub.gradingSummary.midterm) sub.gradingSummary.midterm = null;
      }
      if (releaseFinals['Term 3'] === false || releaseFinals['PRE-FINALS'] === false) {
        sub.gradingSummary.term3 = null;
        if (sub.gradingSummary.preFinals) sub.gradingSummary.preFinals = null;
      }
      if (releaseFinals['Term 4'] === false || releaseFinals['FINALS'] === false) {
        sub.gradingSummary.term4 = null;
        if (sub.gradingSummary.finals) sub.gradingSummary.finals = null;
      }
      
      if (Object.values(releaseFinals).some(val => val === false)) {
         sub.gradingSummary.finalGrade = null;
         sub.gradingSummary.remarks = 'Hidden';
      }
    }
  });

  res.json({ student: clone, profile, lastSync });
});

// ══════════════════════════════════════════════════════════════════════════════
//  TEACHER ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/teacher/templates', requireAuth(['teacher']), (req, res) => {
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.xlsx'));
  const templates = files.map(f => {
    const s = fs.statSync(path.join(TEMPLATES_DIR, f));
    return { name: f, size: s.size, lastModified: s.mtime };
  });
  res.json({ success: true, templates });
});

app.get('/api/teacher/download-template/:filename', requireAuth(['teacher']), (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) return res.status(400).send('Invalid filename');
  const fp = path.join(TEMPLATES_DIR, filename);
  if (fs.existsSync(fp)) res.download(fp);
  else res.status(404).send('Template not found');
});

app.get('/api/teacher/classes', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const teacher = teachersConfig[teacherId];
  const files = (teacher?.files || []).filter(f => fs.existsSync(path.join(GRADES_DIR, f)));
  const classes = files.map(f => {
    const s = fs.statSync(path.join(GRADES_DIR, f));
    // Get class info from studentsMap
    let info = { fileName: f, subject: f.replace('.xlsx', ''), section: '', students: 0 };
    for (const [sNo, data] of Object.entries(studentsMap)) {
      const sub = data.subjects.find(s => s.info.fileName === f);
      if (sub) { info = { ...sub.info }; break; }
    }
    const studentCount = Object.values(studentsMap).filter(d => d.subjects.some(s => s.info.fileName === f)).length;
    const pendingReq = deletionRequests.find(r => r.fileName === f && r.status === 'pending');
    return { ...info, studentCount, lastModified: s.mtime, deletionRequest: pendingReq || null };
  });
  res.json({ success: true, classes });
});

app.post('/api/teacher/classes/:filename/request-delete', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const { filename } = req.params;
  const { reason } = req.body;

  if (filename.includes('..') || filename.includes('/')) return res.status(400).json({ error: 'Invalid filename.' });
  if (!teachersConfig[teacherId]?.files?.includes(filename)) {
    return res.status(403).json({ error: 'Access denied: This class does not belong to your account.' });
  }

  const filePath = path.join(GRADES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Class file not found on disk.' });
  }

  const existingPending = deletionRequests.find(r => r.fileName === filename && r.status === 'pending');
  if (existingPending) {
    return res.status(400).json({ error: 'A deletion request for this class is already pending administrator approval.' });
  }

  let info = { subject: filename.replace('.xlsx', ''), section: '', gradeLevel: '' };
  for (const [sNo, data] of Object.entries(studentsMap)) {
    const sub = data.subjects.find(s => s.info.fileName === filename);
    if (sub) { info = { ...sub.info }; break; }
  }
  const studentCount = Object.values(studentsMap).filter(d => d.subjects.some(s => s.info.fileName === filename)).length;

  const newRequest = {
    id: `del_${Date.now()}_${uuidv4().slice(0, 8)}`,
    fileName: filename,
    subject: info.subject || filename.replace('.xlsx', ''),
    section: info.section || '',
    gradeLevel: info.gradeLevel || '',
    teacherId,
    teacherName: teachersConfig[teacherId]?.name || teacherId,
    studentCount,
    reason: (reason && reason.trim()) ? reason.trim() : 'Requested by teacher',
    status: 'pending',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    adminNote: null
  };

  deletionRequests.unshift(newRequest);
  saveJSON(DELETION_REQUESTS_FILE, deletionRequests);

  logActivity(
    teacherId,
    'teacher',
    'Class Deletion Requested',
    `Teacher ${newRequest.teacherName} requested deletion of "${newRequest.subject}" (${filename}) for Admin approval. Reason: ${newRequest.reason}`,
    { requestId: newRequest.id, fileName: filename },
    req
  );

  res.json({
    success: true,
    message: 'Deletion request submitted successfully. It will be removed once approved by the administrator.',
    request: newRequest
  });
});

app.post('/api/teacher/classes/:filename/cancel-delete-request', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const { filename } = req.params;

  const reqIndex = deletionRequests.findIndex(r => r.fileName === filename && r.teacherId === teacherId && r.status === 'pending');
  if (reqIndex === -1) {
    return res.status(404).json({ error: 'No active pending deletion request found for this class.' });
  }

  const cancelledReq = deletionRequests[reqIndex];
  cancelledReq.status = 'cancelled';
  cancelledReq.reviewedAt = new Date().toISOString();
  saveJSON(DELETION_REQUESTS_FILE, deletionRequests);

  logActivity(
    teacherId,
    'teacher',
    'Class Deletion Cancelled',
    `Cancelled deletion request for "${cancelledReq.subject}" (${filename})`,
    { requestId: cancelledReq.id, fileName: filename },
    req
  );

  res.json({ success: true, message: 'Class deletion request cancelled.' });
});

app.post('/api/teacher/upload', requireAuth(['teacher']), uploadGrade.single('gradesFile'), (req, res) => {
  const teacherId = req.session.userId;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const wb = XLSX.readFile(req.file.path);
    const type = detectWorkbookType(wb);
    if (!type) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid file format. Uploaded file must be either High School template (Data Input, Term 1, etc.) or Tertiary template (Settings, Input, PRELIMS, etc.).' });
    }
    const fname = req.file.filename;
    const historyPath = path.join(GRADES_HISTORY_DIR, `${Date.now()}_${fname}`);
    fs.copyFileSync(req.file.path, historyPath);
    if (!teachersConfig[teacherId]) teachersConfig[teacherId] = { files: [] };
    if (!teachersConfig[teacherId].files) teachersConfig[teacherId].files = [];
    if (!teachersConfig[teacherId].files.includes(fname)) teachersConfig[teacherId].files.push(fname);
    saveJSON(TEACHERS_FILE, teachersConfig);
    loadAllData();
    res.json({ success: true, message: 'Grades uploaded successfully.' });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});


app.put('/api/teacher/class/:filename/batch-update', requireAuth(['teacher']), async (req, res) => {
  const teacherId = req.session.userId;
  const { filename } = req.params;
  const { updatesByStudent } = req.body;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });

  const lockedTerms = settingsConfig.termLocks || {};
  const isLocked = (term) => typeof lockedTerms[term] === 'object' ? lockedTerms[term]?.[filename] : lockedTerms[term];

  for (const studentNo of Object.keys(updatesByStudent)) {
    const updates = updatesByStudent[studentNo];
    if (updates && updates.some(u => u.termName !== 'Attendance' && isLocked(u.termName))) {
      return res.status(403).json({ error: 'One or more of the specified terms are locked by the administrator.' });
    }
  }

  try {
    const XlsxPopulate = require('xlsx-populate');
    const XLSX = require('xlsx');
    const fpath = path.join(GRADES_DIR, filename);
    const workbook = await XlsxPopulate.fromFileAsync(fpath);
    const isTertiary = !!workbook.sheet('Input') && !!workbook.sheet('Settings');

    for (const studentNo of Object.keys(updatesByStudent)) {
      const updates = updatesByStudent[studentNo];
      for (const update of updates) {
        const targetSheetName = (isTertiary && update.termName !== 'Attendance') ? 'Input' : update.termName;
        const sheet = workbook.sheet(targetSheetName);
        if (sheet) {
          const c = sheet.cell(update.row + 1, update.col + 1);
          if (update.termName === 'Attendance') {
            c.value((update.value === '' || update.value === null) ? null : update.value);
          } else {
            c.value((update.value === '' || update.value === null) ? null : Number(update.value));
          }
        }
      }
    }

    const calcPr = workbook._node.children.find(c => c.name === 'calcPr');
    if (calcPr) {
      calcPr.attributes.fullCalcOnLoad = 1;
      calcPr.attributes.forceFullCalc = 1;
    }
    await workbook.toFileAsync(fpath);
    loadAllData();
    res.json({ success: true, message: 'Scores updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/teacher/class/:filename', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const filename = req.params.filename;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });

  const classStudents = [];
  for (const [studentNo, data] of Object.entries(studentsMap)) {
    const sub = data.subjects.find(s => s.info.fileName === filename);
    if (!sub) continue;
    const termsSummary = {};
    Object.keys(sub.terms || {}).forEach(t => {
      termsSummary[t] = {
        transmutedGrade: sub.terms[t].summary?.transmutedGrade,
        status: sub.terms[t].summary?.status
      };
    });
    classStudents.push({
      studentNo, name: data.name, gradingSummary: sub.gradingSummary, attendance: sub.attendance,
      terms: termsSummary
    });
  }
  classStudents.sort((a, b) => a.name.localeCompare(b.name));
  const classSettings = { hideTerm1: false, hideTerm2: true, hideTerm3: true, hideTerm4: true, hideAttendance: false, hideBreakdown: {}, blockedStudents: [], ...(classSettingsConfig[filename] || {}) };
  res.json({ success: true, students: classStudents, settings: classSettings });
});

app.get('/api/teacher/class/:filename/full', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const filename = req.params.filename;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });

  const classStudents = [];
  for (const [studentNo, data] of Object.entries(studentsMap)) {
    const sub = data.subjects.find(s => s.info.fileName === filename);
    if (sub) classStudents.push({ studentNo, name: data.name, terms: sub.terms, info: sub.info, attendance: sub.attendance, gradingSummary: sub.gradingSummary });
  }
  classStudents.sort((a, b) => a.name.localeCompare(b.name));
  const classSettings = { hideTerm1: false, hideTerm2: true, hideTerm3: true, hideTerm4: true, hideAttendance: false, hideBreakdown: {}, blockedStudents: [], releaseFinals: {}, ...(classSettingsConfig[filename] || {}) };
  res.json({ success: true, students: classStudents, settings: classSettings });
});

app.get('/api/test-route', (req, res) => res.send('WORKS!'));

app.get('/api/teacher/class/:filename/headers', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const filename = req.params.filename;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });

  try {
    const XLSX = require('xlsx');
    const fpath = path.join(GRADES_DIR, filename);
    const wb = XLSX.readFile(fpath);
    const type = detectWorkbookType(wb);

    if (type === 'tertiary') {
      const wsInput = wb.Sheets['Input'];
      const wsSettings = wb.Sheets['Settings'];
      const termDefs = [
        { name: 'PRELIMS', ptCols: [6, 7, 8, 9], quizCols: [11, 12, 13, 14], examCol: 16, settingsCol: 8 },
        { name: 'MIDTERM', ptCols: [19, 20, 21, 22], quizCols: [24, 25, 26, 27], examCol: 29, settingsCol: 12 },
        { name: 'PRE-FINALS', ptCols: [32, 33, 34, 35], quizCols: [37, 38, 39, 40], examCol: 42, settingsCol: 16 },
        { name: 'FINALS', ptCols: [45, 46, 47, 48], quizCols: [50, 51, 52, 53], examCol: 55, settingsCol: 20 }
      ];
      const resolveHps = (c, sRow, sCol) => {
        const aHps = XLSX.utils.encode_cell({ r: 5, c });
        let h = wsInput && wsInput[aHps]?.v;
        if (h && typeof h === 'number' && h > 0) return h;
        const f = wsInput && wsInput[aHps]?.f;
        if (f && wsSettings) {
          const m = f.match(/Settings!([A-Z0-9]+)/);
          if (m && wsSettings[m[1]] && !isNaN(Number(wsSettings[m[1]].v)) && Number(wsSettings[m[1]].v) > 0) {
            return Number(wsSettings[m[1]].v);
          }
        }
        if (wsSettings && sRow !== undefined && sCol !== undefined) {
          const sVal = wsSettings[XLSX.utils.encode_cell({ r: sRow, c: sCol })]?.v;
          if (sVal && !isNaN(Number(sVal)) && Number(sVal) > 0) return Number(sVal);
        }
        return null;
      };

      const columns = {};
      const attendance = [];

      termDefs.forEach(td => {
        const pt = td.ptCols.map((c, i) => {
          const aLbl = XLSX.utils.encode_cell({ r: 4, c });
          return { col: c, hps: resolveHps(c, 28 + i, td.settingsCol), label: String(wsInput && wsInput[aLbl]?.v || `PRC${i + 1}`) };
        });
        const ww = td.quizCols.map((c, i) => {
          const aLbl = XLSX.utils.encode_cell({ r: 4, c });
          return { col: c, hps: resolveHps(c, 33 + i, td.settingsCol), label: String(wsInput && wsInput[aLbl]?.v || `Q${i + 1}`) };
        });
        const exam = [{
          col: td.examCol,
          key: 'EX',
          hps: resolveHps(td.examCol, 38, td.settingsCol),
          label: String(wsInput && wsInput[XLSX.utils.encode_cell({ r: 4, c: td.examCol })]?.v || 'Major Exam')
        }];
        columns[td.name] = { ww, pt, exam };

        const wsTerm = wb.Sheets[td.name];
        if (wsTerm) {
          let curMonth = '';
          for (let c = 6; c <= 20; c++) {
            const m = wsTerm[XLSX.utils.encode_cell({ r: 2, c })]?.v;
            if (m) curMonth = String(m).trim();
            const d = wsTerm[XLSX.utils.encode_cell({ r: 3, c })]?.v;
            if (d && !isNaN(d)) {
              attendance.push({
                col: c,
                dateStr: curMonth ? `${curMonth} ${d}` : `Day ${d}`,
                term: td.name
              });
            }
          }
        }
      });

      return res.json({ success: true, columns, attendance, templateType: 'tertiary' });
    }

    const terms = ['Term 1', 'Term 2', 'Term 3', 'Term 4'];
    const columns = {};
    
    terms.forEach(term => {
      const ws = wb.Sheets[term];
      if (!ws) return;
      const cell = (r, c) => {
        const addr = XLSX.utils.encode_cell({ r, c });
        return ws[addr] ? ws[addr].v : null;
      };
      
      const ww = [], pt = [], exam = [];
      for (let c = 4; c <= 23; c++) {
        ww.push({ col: c, hps: cell(5, c) || null, date: excelDateToString(cell(6, c)), label: String(cell(7, c) || `WW${c - 3}`) });
      }
      for (let c = 27; c <= 41; c++) {
        pt.push({ col: c, hps: cell(5, c) || null, date: excelDateToString(cell(6, c)), label: String(cell(7, c) || `PT${c - 26}`) });
      }
      const examColsList = [
        { key: 'ST1', col: 45, label: 'Summative Test 1' },
        { key: 'ST2', col: 46, label: 'Summative Test 2' },
        { key: 'TE', col: 47, label: 'Term Exam' },
      ];
      for (const e of examColsList) {
         exam.push({ col: e.col, key: e.key, hps: cell(5, e.col) || null, date: excelDateToString(cell(6, e.col)), label: e.label });
      }
      columns[term] = { ww, pt, exam };
    });

    const attWs = wb.Sheets['Attendance'];
    const attendance = [];
    if (attWs) {
      const cell = (r, c) => { const a = XLSX.utils.encode_cell({ r, c }); return attWs[a] ? attWs[a].v : null; };
      for (let c = 4; c <= 103; c++) {
        attendance.push({ col: c, dateVal: cell(2, c), dateStr: excelDateToString(cell(2, c)), term: cell(4, c) });
      }
    }
    
    res.json({ success: true, columns, attendance, templateType: 'high_school' });
  } catch (err) {
    console.error('HEADERS ENDPOINT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teacher/class/:filename/headers', requireAuth(['teacher']), async (req, res) => {
  const teacherId = req.session.userId;
  const { filename } = req.params;
  const { updates, attendanceUpdates } = req.body;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });

  // Check term locks
  const lockedTerms = settingsConfig.termLocks || {};
  const isLocked = (term) => typeof lockedTerms[term] === 'object' ? lockedTerms[term]?.[filename] : lockedTerms[term];
  if (updates && updates.some(u => isLocked(u.termName))) {
    return res.status(403).json({ error: 'One or more of the specified terms are locked by the administrator.' });
  }

  try {
    const XlsxPopulate = require('xlsx-populate');
    const fpath = path.join(GRADES_DIR, filename);
    const workbook = await XlsxPopulate.fromFileAsync(fpath);

    const isTertiary = !!workbook.sheet('Input') && !!workbook.sheet('Settings');

    if (isTertiary) {
      const inputSheet = workbook.sheet('Input');
      if (updates && updates.length > 0 && inputSheet) {
        for (const update of updates) {
          if (update.hps === null || update.hps === '') {
            inputSheet.cell(6, update.col + 1).value(null);
          } else {
            inputSheet.cell(6, update.col + 1).value(Number(update.hps));
            if (update.label) inputSheet.cell(5, update.col + 1).value(update.label);
          }
        }
      }
      if (attendanceUpdates && attendanceUpdates.length > 0) {
        for (const update of attendanceUpdates) {
          const sheet = workbook.sheet(update.term || 'PRELIMS');
          if (sheet) {
            if (update.dateStr === null || update.dateStr === '') {
              sheet.cell(4, update.col + 1).value(null);
            } else {
              sheet.cell(4, update.col + 1).value(update.dateStr);
            }
          }
        }
      }
    } else {
      if (updates && updates.length > 0) {
        for (const update of updates) {
          const sheet = workbook.sheet(update.termName);
          if (sheet) {
            if (update.hps === null || update.hps === '') {
              sheet.cell(6, update.col + 1).value(null);
              if (update.col !== 45 && update.col !== 46 && update.col !== 47) {
                sheet.cell(7, update.col + 1).value(null);
                sheet.cell(8, update.col + 1).value(null);
                for (let r = 8; r <= 71; r++) {
                  sheet.cell(r, update.col + 1).value(null);
                }
              }
            } else {
              sheet.cell(6, update.col + 1).value(Number(update.hps));
              if (update.dateStr) {
                 const d = new Date(update.dateStr);
                 if (!isNaN(d.getTime())) sheet.cell(7, update.col + 1).value(XlsxPopulate.dateToNumber(d));
              } else if (update.dateStr === '') {
                 sheet.cell(7, update.col + 1).value(null);
              }
              if (update.label) sheet.cell(8, update.col + 1).value(update.label);
            }
          }
        }
      }

      if (attendanceUpdates && attendanceUpdates.length > 0) {
        const attSheet = workbook.sheet('Attendance');
        if (attSheet) {
          for (const update of attendanceUpdates) {
            if (update.dateStr === null || update.dateStr === '') {
               attSheet.cell(3, update.col + 1).value(null);
               attSheet.cell(4, update.col + 1).value(null);
               attSheet.cell(5, update.col + 1).value(null);
               for (let r = 6; r <= 70; r++) {
                 attSheet.cell(r, update.col + 1).value(null);
               }
            } else {
               const d = new Date(update.dateStr);
               if (!isNaN(d.getTime())) {
                 attSheet.cell(3, update.col + 1).value(XlsxPopulate.dateToNumber(d));
                 attSheet.cell(4, update.col + 1).value(XlsxPopulate.dateToNumber(d));
               }
               if (update.term === '') {
                  attSheet.cell(5, update.col + 1).value(null);
               } else if (update.term) {
                  attSheet.cell(5, update.col + 1).value(update.term);
               }
            }
          }
        }
      }
    }

    await workbook.toFileAsync(fpath);
    loadAllData();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teacher/class/:filename/student/:studentNo', requireAuth(['teacher']), async (req, res) => {
  const teacherId = req.session.userId;
  const { filename, studentNo } = req.params;
  const { updates } = req.body;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });

  // Check term locks
  const lockedTerms = settingsConfig.termLocks || {};
  const isLocked = (term) => typeof lockedTerms[term] === 'object' ? lockedTerms[term]?.[filename] : lockedTerms[term];
  if (updates && updates.some(u => u.termName !== 'Attendance' && isLocked(u.termName))) {
    return res.status(403).json({ error: 'One or more of the specified terms are locked by the administrator.' });
  }

  try {
    const XlsxPopulate = require('xlsx-populate');
    const XLSX = require('xlsx');
    const fpath = path.join(GRADES_DIR, filename);
    const workbook = await XlsxPopulate.fromFileAsync(fpath);
    for (const update of updates) {
      const isTertiary = !!workbook.sheet('Input') && !!workbook.sheet('Settings');
      let targetSheetName;
      if (update.sheet) {
        targetSheetName = update.sheet;
      } else if (isTertiary) {
        targetSheetName = (update.termName === 'Attendance' ? (update.term || 'PRELIMS') : 'Input');
      } else {
        targetSheetName = update.termName;
      }

      const sheet = workbook.sheet(targetSheetName);
      if (sheet) {
        const c = sheet.cell(update.row + 1, update.col + 1);
        if (update.termName === 'Attendance') {
          c.value((update.value === '' || update.value === null) ? null : update.value);
        } else {
          c.value((update.value === '' || update.value === null) ? null : Number(update.value));
        }
      }
    }
    const calcPr = workbook._node.children.find(c => c.name === 'calcPr');
    if (calcPr) {
      calcPr.attributes.fullCalcOnLoad = 1;
      calcPr.attributes.forceFullCalc = 1;
    }
    await workbook.toFileAsync(fpath);
    loadAllData();
    res.json({ success: true, message: 'Scores updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teacher/class/:filename/settings', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const filename = req.params.filename;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });
  classSettingsConfig[filename] = { ...(classSettingsConfig[filename] || {}), ...req.body };
  saveJSON(CLASS_SETTINGS_FILE, classSettingsConfig);
  res.json({ success: true });
});

app.get('/api/teacher/download/:filename', requireAuth(['teacher']), (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) return res.status(400).send('Invalid');
  const fp = path.join(GRADES_DIR, filename);
  if (fs.existsSync(fp)) res.download(fp);
  else res.status(404).send('Not found');
});

app.get('/api/teacher/students', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const teacherFiles = teachersConfig[teacherId]?.files || [];
  
  const teacherStudentsMap = {};
  for (const [studentNo, data] of Object.entries(studentsMap)) {
    const managedSubjects = data.subjects.filter(s => teacherFiles.includes(s.info.fileName));
    if (managedSubjects.length > 0) {
      if (!teacherStudentsMap[studentNo]) {
        teacherStudentsMap[studentNo] = {
          studentNo: data.studentNo,
          name: data.name,
          subjectCount: managedSubjects.length,
          status: accountStatusConfig[data.studentNo] || 'active',
          subjects: managedSubjects.map(sub => ({ subject: sub.info.subject, section: sub.info.section, fileName: sub.info.fileName }))
        };
      }
    }
  }
  
  const students = Object.values(teacherStudentsMap).sort((a, b) => a.name.localeCompare(b.name));
  res.json({ success: true, students });
});

app.get('/api/teacher/students/:studentNo', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const teacherFiles = teachersConfig[teacherId]?.files || [];
  const { studentNo } = req.params;
  
  const student = studentsMap[studentNo];
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  
  const managedSubjects = student.subjects.filter(s => teacherFiles.includes(s.info.fileName));
  if (managedSubjects.length === 0) return res.status(403).json({ error: 'Forbidden.' });
  
  const clonedStudent = { ...student, subjects: managedSubjects };
  const profile = studentProfilesConfig[studentNo] || {};
  res.json({ success: true, student: clonedStudent, profile });
});

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/admin/classes', requireAuth(['admin']), (req, res) => {
  const classMap = {};
  Object.values(studentsMap).forEach(s => {
    s.subjects.forEach(sub => {
      const fname = sub.info.fileName;
      if (!classMap[fname]) {
        classMap[fname] = { filename: fname, ...sub.info };
      }
    });
  });
  res.json({ success: true, classes: Object.values(classMap) });
});

// --- Class Deletion Requests Management ---
app.get('/api/admin/deletion-requests', requireAuth(['admin']), (req, res) => {
  const pendingCount = deletionRequests.filter(r => r.status === 'pending').length;
  res.json({ success: true, requests: deletionRequests, pendingCount });
});

app.post('/api/admin/deletion-requests/:id/approve', requireAuth(['admin']), (req, res) => {
  const { id } = req.params;
  const { adminNote } = req.body;

  const reqObj = deletionRequests.find(r => r.id === id);
  if (!reqObj) {
    return res.status(404).json({ error: 'Deletion request not found.' });
  }
  if (reqObj.status !== 'pending') {
    return res.status(400).json({ error: `Request cannot be approved because it is already ${reqObj.status}.` });
  }

  const filename = reqObj.fileName;
  const currentPath = path.join(GRADES_DIR, filename);

  // Safety Backup: copy the file to GRADES_HISTORY_DIR before unlinking
  if (fs.existsSync(currentPath)) {
    try {
      const backupPath = path.join(GRADES_HISTORY_DIR, `DELETED_${Date.now()}_${filename}`);
      fs.copyFileSync(currentPath, backupPath);
      fs.unlinkSync(currentPath);
    } catch (err) {
      console.error('Failed to safely remove class file:', err);
      return res.status(500).json({ error: 'Failed to delete class file from disk: ' + err.message });
    }
  }

  // Remove filename from all teachers
  let teachersModified = false;
  Object.keys(teachersConfig).forEach(tId => {
    if (teachersConfig[tId]?.files && teachersConfig[tId].files.includes(filename)) {
      teachersConfig[tId].files = teachersConfig[tId].files.filter(f => f !== filename);
      teachersModified = true;
    }
  });
  if (teachersModified) saveJSON(TEACHERS_FILE, teachersConfig);

  // Remove settings for this class
  if (classSettingsConfig[filename]) {
    delete classSettingsConfig[filename];
    saveJSON(CLASS_SETTINGS_FILE, classSettingsConfig);
  }

  // Remove locks for this class
  if (settingsConfig.termLocks) {
    let locksModified = false;
    for (const t of Object.keys(settingsConfig.termLocks)) {
      if (typeof settingsConfig.termLocks[t] === 'object' && settingsConfig.termLocks[t][filename] !== undefined) {
        delete settingsConfig.termLocks[t][filename];
        locksModified = true;
      }
    }
    if (locksModified) saveJSON(SETTINGS_FILE, settingsConfig);
  }

  // Mark request as approved
  reqObj.status = 'approved';
  reqObj.reviewedAt = new Date().toISOString();
  reqObj.reviewedBy = req.session.userId;
  reqObj.adminNote = (adminNote && adminNote.trim()) ? adminNote.trim() : 'Approved by administrator';
  saveJSON(DELETION_REQUESTS_FILE, deletionRequests);

  // Re-read grades and update student maps
  loadAllData();

  logActivity(
    'admin',
    'admin',
    'Class Deletion Approved',
    `Administrator approved deletion of class "${reqObj.subject}" (${filename}) requested by ${reqObj.teacherName}.`,
    { requestId: reqObj.id, fileName: filename, adminNote: reqObj.adminNote },
    req
  );

  res.json({
    success: true,
    message: `Class "${reqObj.subject}" has been successfully deleted.`,
    request: reqObj
  });
});

app.post('/api/admin/deletion-requests/:id/reject', requireAuth(['admin']), (req, res) => {
  const { id } = req.params;
  const { adminNote } = req.body;

  const reqObj = deletionRequests.find(r => r.id === id);
  if (!reqObj) {
    return res.status(404).json({ error: 'Deletion request not found.' });
  }
  if (reqObj.status !== 'pending') {
    return res.status(400).json({ error: `Request cannot be rejected because it is already ${reqObj.status}.` });
  }

  reqObj.status = 'rejected';
  reqObj.reviewedAt = new Date().toISOString();
  reqObj.reviewedBy = req.session.userId;
  reqObj.adminNote = (adminNote && adminNote.trim()) ? adminNote.trim() : 'Rejected by administrator';
  saveJSON(DELETION_REQUESTS_FILE, deletionRequests);

  logActivity(
    'admin',
    'admin',
    'Class Deletion Rejected',
    `Administrator rejected deletion of class "${reqObj.subject}" (${reqObj.fileName}) requested by ${reqObj.teacherName}. Reason: ${reqObj.adminNote}`,
    { requestId: reqObj.id, fileName: reqObj.fileName, adminNote: reqObj.adminNote },
    req
  );

  res.json({
    success: true,
    message: 'Deletion request rejected.',
    request: reqObj
  });
});

// --- Template Management ---
app.get('/api/admin/templates', requireAuth(['admin']), (req, res) => {
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.xlsx'));
  const templates = files.map(f => {
    const s = fs.statSync(path.join(TEMPLATES_DIR, f));
    return { name: f, size: s.size, lastModified: s.mtime };
  });
  res.json({ success: true, templates });
});

app.post('/api/admin/templates/upload', requireAuth(['admin']), uploadTemplate.single('template'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const wb = XLSX.readFile(req.file.path);
    const type = detectWorkbookType(wb);
    if (!type) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid template format. Must be either High School template (Data Input, Term 1, etc.) or Tertiary template (Settings, Input, PRELIMS, etc.).' });
    }
    const finalPath = path.join(TEMPLATES_DIR, req.file.filename);
    if (fs.existsSync(finalPath) && finalPath !== req.file.path) {
      const histPath = path.join(TEMPLATES_HISTORY_DIR, `${Date.now()}_${req.file.filename}`);
      fs.renameSync(finalPath, histPath);
      fs.renameSync(req.file.path, finalPath);
    }
    res.json({ success: true, message: 'Template uploaded successfully.' });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/templates/revert/:filename', requireAuth(['admin']), (req, res) => {
  const filename = req.params.filename;
  const histFiles = fs.readdirSync(TEMPLATES_HISTORY_DIR)
    .filter(f => f.endsWith(`_${filename}`)).sort((a, b) => b.localeCompare(a));
  if (histFiles.length === 0) return res.status(404).json({ error: 'No history found.' });
  const currentPath = path.join(TEMPLATES_DIR, filename);
  if (fs.existsSync(currentPath)) fs.renameSync(currentPath, path.join(TEMPLATES_HISTORY_DIR, `${Date.now()}_${filename}`));
  fs.copyFileSync(path.join(TEMPLATES_HISTORY_DIR, histFiles[0]), currentPath);
  res.json({ success: true, message: 'Template reverted.' });
});

app.delete('/api/admin/templates/:filename', requireAuth(['admin']), (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) return res.status(400).json({ error: 'Invalid filename.' });
  const fp = path.join(TEMPLATES_DIR, filename);
  if (fs.existsSync(fp)) { fs.unlinkSync(fp); res.json({ success: true }); }
  else res.status(404).json({ error: 'Not found.' });
});

app.get('/api/admin/templates/download/:filename', requireAuth(['admin']), (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) return res.status(400).send('Invalid');
  const fp = path.join(TEMPLATES_DIR, filename);
  if (fs.existsSync(fp)) res.download(fp);
  else res.status(404).send('Not found');
});

// --- Teacher Management ---
app.get('/api/admin/teachers', requireAuth(['admin']), (req, res) => {
  const teachers = Object.entries(teachersConfig).map(([id, t]) => ({
    id, username: t.username || id, name: t.name, email: t.email,
    department: t.department, photo: t.photo,
    files: (t.files || []).filter(f => fs.existsSync(path.join(GRADES_DIR, f))),
    createdAt: t.createdAt,
    status: accountStatusConfig[id] || 'active'
  }));
  res.json({ success: true, teachers });
});

app.post('/api/admin/teachers', requireAuth(['admin']), (req, res) => {
  const { username, name, email, department, password } = req.body;
  if (!username || !name || !password) return res.status(400).json({ error: 'Username, name, and password are required.' });
  if (teachersConfig[username]) return res.status(409).json({ error: 'Username already taken.' });
  teachersConfig[username] = { username, name, email: email || '', department: department || '', password, files: [], createdAt: new Date().toISOString() };
  saveJSON(TEACHERS_FILE, teachersConfig);
  res.json({ success: true, message: 'Teacher added.' });
});

app.put('/api/admin/teachers/:username', requireAuth(['admin']), (req, res) => {
  const { username } = req.params;
  if (!teachersConfig[username]) return res.status(404).json({ error: 'Teacher not found.' });
  const { name, email, department, password, newUsername } = req.body;
  if (name) teachersConfig[username].name = name;
  if (email !== undefined) teachersConfig[username].email = email;
  if (department !== undefined) teachersConfig[username].department = department;
  if (password && password.trim()) teachersConfig[username].password = password.trim();
  if (newUsername && newUsername !== username) {
    if (teachersConfig[newUsername]) return res.status(409).json({ error: 'New username already taken.' });
    teachersConfig[newUsername] = { ...teachersConfig[username], username: newUsername };
    delete teachersConfig[username];
  }
  saveJSON(TEACHERS_FILE, teachersConfig);
  res.json({ success: true });
});

app.delete('/api/admin/teachers/:username', requireAuth(['admin']), (req, res) => {
  const { username } = req.params;
  if (!teachersConfig[username]) return res.status(404).json({ error: 'Teacher not found.' });
  delete teachersConfig[username];
  saveJSON(TEACHERS_FILE, teachersConfig);
  res.json({ success: true });
});

app.get('/api/admin/teacher/:username/classes', requireAuth(['admin']), (req, res) => {
  const { username } = req.params;
  const teacher = teachersConfig[username];
  if (!teacher) return res.status(404).json({ error: 'Teacher not found.' });
  const files = (teacher.files || []).filter(f => fs.existsSync(path.join(GRADES_DIR, f)));
  const classes = files.map(f => {
    const studentCount = Object.values(studentsMap).filter(d => d.subjects.some(s => s.info.fileName === f)).length;
    let info = { fileName: f };
    for (const d of Object.values(studentsMap)) {
      const sub = d.subjects.find(s => s.info.fileName === f);
      if (sub) { info = sub.info; break; }
    }
    return { ...info, studentCount, lastModified: fs.statSync(path.join(GRADES_DIR, f)).mtime };
  });
  res.json({ success: true, classes });
});

app.get('/api/admin/class/:filename', requireAuth(['admin']), (req, res) => {
  const { filename } = req.params;
  const students = [];
  for (const [studentNo, data] of Object.entries(studentsMap)) {
    const sub = data.subjects.find(s => s.info.fileName === filename);
    if (sub) students.push({ studentNo, name: data.name, gradingSummary: sub.gradingSummary, info: sub.info });
  }
  students.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ success: true, students });
});

// --- Admin: Students Overview ---
app.get('/api/admin/students', requireAuth(['admin']), (req, res) => {
  const students = Object.values(studentsMap).map(s => ({
    studentNo: s.studentNo, name: s.name, subjectCount: s.subjects.length, status: accountStatusConfig[s.studentNo] || 'active',
    subjects: s.subjects.map(sub => ({ subject: sub.info.subject, section: sub.info.section, fileName: sub.info.fileName })),
  }));
  res.json({ success: true, students });
});

app.get('/api/admin/students/:studentNo', requireAuth(['admin']), (req, res) => {
  const { studentNo } = req.params;
  const student = studentsMap[studentNo];
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  const profile = studentProfilesConfig[studentNo] || {};
  res.json({ success: true, student, profile });
});

app.post('/api/admin/students/:studentNo/reset-password', requireAuth(['admin']), (req, res) => {
  const { studentNo } = req.params;
  const student = studentsMap[studentNo];
  if (!student) return res.status(404).json({ error: 'Student not found.' });

  const newTempPassword = String(studentNo).slice(-6);
  passwordsConfig[studentNo] = newTempPassword;
  saveJSON(PASSWORDS_FILE, passwordsConfig);
  
  logActivity('admin', 'admin', 'Reset Password', `Reset password for student ${studentNo}`);
  res.json({ success: true, newPassword: newTempPassword });
});

app.get('/api/admin/statistics', requireAuth(['admin']), (req, res) => {
  const students = Object.values(studentsMap);
  const subjectMap = {};
  students.forEach(s => {
    s.subjects.forEach(sub => {
      const key = `${sub.info.subject}||${sub.info.section}`;
      if (!subjectMap[key]) subjectMap[key] = { ...sub.info, students: [] };
      const gs = sub.gradingSummary || {};
      const rawFg = (gs.finalGrade && gs.finalGrade !== '--' && gs.finalGrade !== '-') ? parseFloat(gs.finalGrade) : null;
      const fg = !isNaN(rawFg) ? rawFg : null;
      subjectMap[key].students.push({ studentNo: s.studentNo, name: s.name, finalGrade: fg, remarks: gs.remarks || null });
    });
  });

  const subjectStats = Object.values(subjectMap).map(entry => {
    const isTertiary = entry.templateType === 'tertiary';
    const graded = entry.students.filter(s => s.finalGrade !== null);
    const avg = graded.length > 0 ? (isTertiary ? round2(graded.reduce((sum, s) => sum + s.finalGrade, 0) / graded.length) : Math.round(graded.reduce((sum, s) => sum + s.finalGrade, 0) / graded.length)) : null;
    const passed = graded.filter(s => isTertiary ? s.finalGrade <= 3.0 : s.finalGrade >= 75).length;
    return { subject: entry.subject, section: entry.section, gradeLevel: entry.gradeLevel, instructor: entry.instructor, totalStudents: entry.students.length, gradedStudents: graded.length, average: avg, passed, failed: graded.length - passed, passRate: graded.length > 0 ? Math.round((passed / graded.length) * 100) : null };
  });

  const pendingDeletions = deletionRequests.filter(r => r.status === 'pending').length;
  res.json({ success: true, overview: { totalStudents: students.length, totalSubjects: subjectStats.length, pendingDeletions }, subjectStats });
});

// --- Admin Local Sync ---
app.post('/api/admin/sync', requireAuth(['admin']), (req, res) => {
  loadAllData();
  res.json({ success: true, lastSync, totalStudents: Object.keys(studentsMap).length });
});

// ══════════════════════════════════════════════════════════════════════════════
//  CLOUD SYNCHRONIZATION SYSTEM (Offline <-> AWS Cloud)
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CLOUD_URL = 'http://16.59.47.134';
const DEFAULT_SYNC_SECRET = 'gradeportal-secure-cloud-sync-key-2026';

// 1. Cloud Status Endpoint (Probed by offline app to check if AWS is online)
app.get('/api/sync/cloud-status', (req, res) => {
  const files = fs.existsSync(GRADES_DIR) ? fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')) : [];
  res.json({
    online: true,
    server: 'AWS Cloud Portal',
    version: '2.0.0',
    totalStudents: Object.keys(studentsMap).length,
    filesLoaded: files.length,
    lastSync: settingsConfig.cloudSync?.lastSync || lastSync || null,
    settingsUpdatedAt: settingsConfig.updatedAt || null,
    timestamp: new Date().toISOString()
  });
});

// 1b. Settings Exchange Endpoint (Bidirectional sync based on last update)
app.post('/api/sync/exchange-settings', (req, res) => {
  const secretKey = settingsConfig.cloudSync?.secretKey || DEFAULT_SYNC_SECRET;
  const clientToken = req.headers['x-sync-token'];

  if (!clientToken || clientToken !== secretKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing sync authentication token.' });
  }

  const { localSettings, forcePush, forcePull } = req.body || {};
  if (!localSettings || typeof localSettings !== 'object') {
    return res.status(400).json({ error: 'Invalid settings payload.' });
  }

  const incomingTime = new Date(localSettings.updatedAt || 0).getTime();
  const serverTime = new Date(settingsConfig.updatedAt || 0).getTime();

  if (forcePull) {
    return res.json({
      success: true,
      action: 'incoming_should_update',
      serverSettings: extractSyncableSettings(settingsConfig),
      serverUpdatedAt: settingsConfig.updatedAt
    });
  }

  if (forcePush) {
    applySyncableSettings(localSettings);
    logActivity('sync', 'system', 'Settings Forced from Client', `Server settings forced from incoming payload`);
    return res.json({
      success: true,
      action: 'server_updated_from_incoming',
      serverUpdatedAt: settingsConfig.updatedAt
    });
  }

  if (incomingTime > serverTime) {
    applySyncableSettings(localSettings);
    logActivity('sync', 'system', 'Settings Updated from Client', `Server settings updated because incoming update (${new Date(incomingTime).toLocaleString()}) was newer than server (${new Date(serverTime).toLocaleString()})`);
    return res.json({
      success: true,
      action: 'server_updated_from_incoming',
      serverUpdatedAt: settingsConfig.updatedAt,
      message: 'Server updated from newer incoming settings.'
    });
  } else if (serverTime > incomingTime) {
    return res.json({
      success: true,
      action: 'incoming_should_update',
      serverSettings: extractSyncableSettings(settingsConfig),
      serverUpdatedAt: settingsConfig.updatedAt,
      message: 'Server settings are newer than incoming settings.'
    });
  } else {
    return res.json({
      success: true,
      action: 'already_in_sync',
      serverUpdatedAt: settingsConfig.updatedAt,
      message: 'Settings already synchronized.'
    });
  }
});

// 2. Cloud Receiving Endpoint (Receives Excel files and updates on AWS)
app.post('/api/sync/receive-push', (req, res) => {
  const token = req.headers['x-sync-token'];
  const configuredSecret = settingsConfig.cloudSync?.secretKey || DEFAULT_SYNC_SECRET;
  
  if (token !== configuredSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid sync authorization token.' });
  }

  const { files, classSettings, settings, sender } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided for synchronization.' });
  }

  try {
    let savedCount = 0;
    files.forEach(item => {
      if (item && item.filename && item.contentBase64) {
        const safeName = path.basename(item.filename);
        const targetPath = path.join(GRADES_DIR, safeName);
        if (fs.existsSync(targetPath)) {
          const backupPath = path.join(GRADES_HISTORY_DIR, `${Date.now()}_${safeName}`);
          try { fs.copyFileSync(targetPath, backupPath); } catch (e) {}
        }
        fs.writeFileSync(targetPath, Buffer.from(item.contentBase64, 'base64'));
        savedCount++;
      }
    });

    // Merge class settings if provided
    if (classSettings && typeof classSettings === 'object') {
      classSettingsConfig = { ...classSettingsConfig, ...classSettings };
      saveJSON(CLASS_SETTINGS_FILE, classSettingsConfig);
    }

    // Merge general settings based on last update timestamp
    if (settings && typeof settings === 'object') {
      const incomingTime = new Date(settings.updatedAt || 0).getTime();
      const serverTime = new Date(settingsConfig.updatedAt || 0).getTime();
      if (incomingTime >= serverTime) {
        applySyncableSettings(settings);
      }
    }

    // Immediately reload all class and student data on AWS
    loadAllData();

    const syncTime = new Date().toISOString();
    settingsConfig.cloudSync = {
      ...(settingsConfig.cloudSync || {}),
      lastSync: syncTime
    };
    saveJSON(SETTINGS_FILE, settingsConfig);

    logActivity('sync', 'system', 'Cloud Sync Received', `Received & updated ${savedCount} Excel file(s) authorized by ${sender || 'Authorized User'}`);

    res.json({
      success: true,
      message: `Successfully updated ${savedCount} Excel file(s) on AWS Cloud.`,
      filesUpdated: savedCount,
      totalStudents: Object.keys(studentsMap).length,
      timestamp: syncTime
    });
  } catch (err) {
    console.error('❌ Cloud sync receive error:', err);
    res.status(500).json({ error: 'Failed to process sync files: ' + err.message });
  }
});

// 2b. Remote Endpoint: Serve files to authorized pull requests (Runs on AWS or offline)
app.post('/api/sync/provide-pull', (req, res) => {
  const secretKey = settingsConfig.cloudSync?.secretKey || DEFAULT_SYNC_SECRET;
  const clientToken = req.headers['x-sync-token'];

  if (!clientToken || clientToken !== secretKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing sync authentication token.' });
  }

  const specificFile = req.body?.filename;
  let filesToServe = [];

  if (specificFile) {
    const safeName = path.basename(specificFile);
    if (fs.existsSync(path.join(GRADES_DIR, safeName))) {
      filesToServe.push(safeName);
    } else {
      return res.status(404).json({ error: `File ${safeName} not found on server.` });
    }
  } else {
    filesToServe = fs.existsSync(GRADES_DIR) ? fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')) : [];
  }

  try {
    const packagedFiles = filesToServe.map(fname => {
      const fpath = path.join(GRADES_DIR, fname);
      const stat = fs.statSync(fpath);
      return {
        filename: fname,
        contentBase64: fs.readFileSync(fpath).toString('base64'),
        lastModified: stat.mtime.toISOString(),
        size: stat.size
      };
    });

    logActivity('sync', 'system', 'Cloud Sync Served Pull', `Served ${packagedFiles.length} Excel file(s) to pull client`);

    res.json({
      success: true,
      files: packagedFiles,
      classSettings: classSettingsConfig,
      settings: extractSyncableSettings(settingsConfig),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Cloud sync provide-pull error:', err);
    res.status(500).json({ error: 'Failed to package files for pull: ' + err.message });
  }
});

// 3. Local Status & Connectivity Check (Called by frontend)
app.get('/api/sync/status', requireAuth(['admin', 'teacher']), async (req, res) => {
  const cloudUrl = settingsConfig.cloudSync?.serverUrl || DEFAULT_CLOUD_URL;
  const localFiles = fs.existsSync(GRADES_DIR) ? fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')) : [];
  const localUpdatedAt = settingsConfig.updatedAt || null;
  const localTime = new Date(localUpdatedAt || 0).getTime();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    const resp = await fetch(`${cloudUrl}/api/sync/cloud-status`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const cloudData = await resp.json();
      const cloudUpdatedAt = cloudData.settingsUpdatedAt || null;
      const cloudTime = new Date(cloudUpdatedAt || 0).getTime();

      let syncStatus = 'in_sync';
      if (!cloudUpdatedAt || !localUpdatedAt) {
        syncStatus = 'unknown';
      } else if (localTime > cloudTime) {
        syncStatus = 'local_newer';
      } else if (cloudTime > localTime) {
        syncStatus = 'cloud_newer';
      } else {
        syncStatus = 'in_sync';
      }

      return res.json({
        online: true,
        cloudUrl,
        lastSync: settingsConfig.cloudSync?.lastSync || null,
        localFilesCount: localFiles.length,
        localFiles: localFiles,
        cloudInfo: cloudData,
        settingsSync: {
          localUpdatedAt,
          cloudUpdatedAt,
          status: syncStatus,
          diffSeconds: Math.round(Math.abs(localTime - cloudTime) / 1000)
        }
      });
    } else {
      return res.json({
        online: false,
        cloudUrl,
        lastSync: settingsConfig.cloudSync?.lastSync || null,
        localFilesCount: localFiles.length,
        localFiles: localFiles,
        error: `Cloud server returned status ${resp.status}`,
        settingsSync: {
          localUpdatedAt,
          cloudUpdatedAt: null,
          status: 'offline'
        }
      });
    }
  } catch (err) {
    return res.json({
      online: false,
      cloudUrl,
      lastSync: settingsConfig.cloudSync?.lastSync || null,
      localFilesCount: localFiles.length,
      localFiles: localFiles,
      error: 'Cannot reach AWS cloud server. Offline or network error.',
      settingsSync: {
        localUpdatedAt,
        cloudUpdatedAt: null,
        status: 'offline'
      }
    });
  }
});

// 4. Trigger Push to AWS Cloud (Authorized by Admin or Teacher)
app.post('/api/sync/push-to-cloud', requireAuth(['admin', 'teacher']), async (req, res) => {
  const cloudUrl = settingsConfig.cloudSync?.serverUrl || DEFAULT_CLOUD_URL;
  const secretKey = settingsConfig.cloudSync?.secretKey || DEFAULT_SYNC_SECRET;
  const specificFile = req.body?.filename;

  // Step 1: Pre-flight check AWS connectivity
  try {
    const probeController = new AbortController();
    const probeTimeout = setTimeout(() => probeController.abort(), 4000);
    const probeResp = await fetch(`${cloudUrl}/api/sync/cloud-status`, { signal: probeController.signal });
    clearTimeout(probeTimeout);
    if (!probeResp.ok) throw new Error('Cloud server returned error');
  } catch (probeErr) {
    return res.status(503).json({
      success: false,
      offline: true,
      error: `AWS Cloud server (${cloudUrl}) is currently unreachable. Please check your internet connection and verify the online server is active.`
    });
  }

  // Step 2: Gather files to push
  let filesToSync = [];
  if (specificFile) {
    const safeName = path.basename(specificFile);
    if (fs.existsSync(path.join(GRADES_DIR, safeName))) {
      filesToSync.push(safeName);
    } else {
      return res.status(404).json({ error: `File ${safeName} not found in Grades directory.` });
    }
  } else {
    filesToSync = fs.existsSync(GRADES_DIR) ? fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')) : [];
  }

  if (filesToSync.length === 0) {
    return res.status(400).json({ error: 'No Excel files found to synchronize.' });
  }

  // Step 3: Package files and settings
  try {
    const packagedFiles = filesToSync.map(fname => {
      const fpath = path.join(GRADES_DIR, fname);
      return {
        filename: fname,
        contentBase64: fs.readFileSync(fpath).toString('base64')
      };
    });

    const payload = {
      files: packagedFiles,
      classSettings: classSettingsConfig,
      settings: extractSyncableSettings(settingsConfig),
      sender: `${req.session.userId} (${req.session.role})`
    };

    // Step 4: Transmit payload to AWS
    const pushResp = await fetch(`${cloudUrl}/api/sync/receive-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-token': secretKey
      },
      body: JSON.stringify(payload)
    });

    const result = await pushResp.json();
    if (!pushResp.ok || !result.success) {
      throw new Error(result.error || 'Cloud synchronization failed on remote server.');
    }

    // Step 5: Update local lastSync metadata
    const syncTime = new Date().toISOString();
    settingsConfig.cloudSync = {
      ...(settingsConfig.cloudSync || {}),
      serverUrl: cloudUrl,
      secretKey,
      lastSync: syncTime
    };
    saveJSON(SETTINGS_FILE, settingsConfig);

    logActivity(req.session.userId, req.session.role, 'Cloud Sync Push', `Pushed ${filesToSync.length} Excel file(s) to AWS Cloud (${cloudUrl})`);

    res.json({
      success: true,
      message: `Successfully synchronized ${filesToSync.length} Excel file(s) to AWS Cloud!`,
      filesCount: filesToSync.length,
      cloudResult: result,
      timestamp: syncTime
    });
  } catch (syncErr) {
    console.error('❌ Cloud push error:', syncErr);
    res.status(500).json({
      success: false,
      error: 'Failed to synchronize with AWS: ' + syncErr.message
    });
  }
});

// 4b. Trigger Pull from AWS Cloud (Authorized by Admin or Teacher)
app.post('/api/sync/pull-from-cloud', requireAuth(['admin', 'teacher']), async (req, res) => {
  const cloudUrl = settingsConfig.cloudSync?.serverUrl || DEFAULT_CLOUD_URL;
  const secretKey = settingsConfig.cloudSync?.secretKey || DEFAULT_SYNC_SECRET;
  const specificFile = req.body?.filename;

  // Step 1: Pre-flight check AWS connectivity
  try {
    const probeController = new AbortController();
    const probeTimeout = setTimeout(() => probeController.abort(), 4000);
    const probeResp = await fetch(`${cloudUrl}/api/sync/cloud-status`, { signal: probeController.signal });
    clearTimeout(probeTimeout);
    if (!probeResp.ok) throw new Error('Cloud server returned error');
  } catch (probeErr) {
    return res.status(503).json({
      success: false,
      offline: true,
      error: `AWS Cloud server (${cloudUrl}) is currently unreachable. Please check your internet connection and verify the online server is active.`
    });
  }

  // Step 2: Request files from AWS
  try {
    const pullResp = await fetch(`${cloudUrl}/api/sync/provide-pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-token': secretKey
      },
      body: JSON.stringify({ filename: specificFile })
    });

    const result = await pullResp.json();
    if (!pullResp.ok || !result.success || !Array.isArray(result.files)) {
      throw new Error(result.error || 'Failed to retrieve files from AWS Cloud.');
    }

    if (result.files.length === 0) {
      return res.status(404).json({ error: 'No Excel files available to pull from AWS Cloud.' });
    }

    // Step 3: Write pulled files to local GRADES_DIR
    let savedCount = 0;
    if (!fs.existsSync(GRADES_DIR)) fs.mkdirSync(GRADES_DIR, { recursive: true });

    result.files.forEach(item => {
      if (item && item.filename && item.contentBase64) {
        const safeName = path.basename(item.filename);
        const targetPath = path.join(GRADES_DIR, safeName);
        if (fs.existsSync(targetPath)) {
          const backupPath = path.join(GRADES_HISTORY_DIR, `${Date.now()}_${safeName}`);
          try { fs.copyFileSync(targetPath, backupPath); } catch (e) {}
        }
        fs.writeFileSync(targetPath, Buffer.from(item.contentBase64, 'base64'));
        savedCount++;
      }
    });

    // Step 4: Merge class settings if provided
    if (result.classSettings && typeof result.classSettings === 'object') {
      classSettingsConfig = { ...classSettingsConfig, ...result.classSettings };
      saveJSON(CLASS_SETTINGS_FILE, classSettingsConfig);
    }

    // Step 5: Merge general settings if provided and newer
    if (result.settings && typeof result.settings === 'object') {
      const incomingTime = new Date(result.settings.updatedAt || 0).getTime();
      const localTime = new Date(settingsConfig.updatedAt || 0).getTime();
      if (incomingTime >= localTime) {
        applySyncableSettings(result.settings);
      }
    }

    // Step 6: Reload local data
    loadAllData();

    // Step 7: Update local lastSync metadata
    const syncTime = new Date().toISOString();
    settingsConfig.cloudSync = {
      ...(settingsConfig.cloudSync || {}),
      serverUrl: cloudUrl,
      secretKey,
      lastSync: syncTime
    };
    saveJSON(SETTINGS_FILE, settingsConfig);

    logActivity(req.session.userId, req.session.role, 'Cloud Sync Pull', `Pulled ${savedCount} Excel file(s) from AWS Cloud (${cloudUrl})`);

    res.json({
      success: true,
      message: `Successfully pulled and updated ${savedCount} Excel file(s) from AWS Cloud!`,
      filesCount: savedCount,
      totalStudents: Object.keys(studentsMap).length,
      timestamp: syncTime
    });
  } catch (pullErr) {
    console.error('❌ Cloud pull error:', pullErr);
    res.status(500).json({
      success: false,
      error: 'Failed to pull from AWS: ' + pullErr.message
    });
  }
});

// 4c. Trigger Settings Synchronization Only (Authorized by Admin)
app.post('/api/sync/sync-settings', requireAuth(['admin']), async (req, res) => {
  const { forcePush, forcePull } = req.body || {};
  const result = await syncSettingsWithCloud({ forcePush, forcePull, req });
  res.json(result);
});

// 5. Configure Cloud Server URL (Admin Only)
app.post('/api/sync/configure', requireAuth(['admin']), (req, res) => {
  const { serverUrl, secretKey } = req.body;
  if (!serverUrl) return res.status(400).json({ error: 'Server URL is required.' });

  settingsConfig.cloudSync = {
    ...(settingsConfig.cloudSync || {}),
    serverUrl: serverUrl.trim().replace(/\/+$/, ''),
    secretKey: secretKey ? secretKey.trim() : (settingsConfig.cloudSync?.secretKey || DEFAULT_SYNC_SECRET)
  };
  saveJSON(SETTINGS_FILE, settingsConfig);
  logActivity('admin', 'admin', 'Configured Cloud Sync', `Updated Cloud URL to ${settingsConfig.cloudSync.serverUrl}`);

  res.json({ success: true, cloudSync: settingsConfig.cloudSync });
});

// ─── System Status ───────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ ok: true, version: '2.0.0', developer: 'Sir Markyu', lastSync, totalStudents: Object.keys(studentsMap).length, filesLoaded: fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')).length });
});

// --- Admin Features: Backup, Logs, Sessions, Impersonate ---
app.get('/api/admin/activity-logs', requireAuth(['admin']), (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = activityLogs.filter(l => l.timestamp && l.timestamp.startsWith(todayStr)).length;
  const categories = {};
  activityLogs.forEach(l => {
    const cat = l.category || 'system';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  res.json({
    success: true,
    logs: activityLogs,
    stats: {
      total: activityLogs.length,
      today: todayCount,
      byCategory: categories
    }
  });
});

app.delete('/api/admin/activity-logs', requireAuth(['admin']), (req, res) => {
  const count = activityLogs.length;
  activityLogs = [];
  saveJSON(ACTIVITY_LOGS_FILE, activityLogs);
  logActivity('admin', 'admin', 'Clear Activity Logs', `Cleared ${count} activity logs`, {}, req);
  res.json({ success: true, message: `Successfully cleared ${count} log entries.` });
});

app.get('/api/admin/backup', requireAuth(['admin']), (req, res) => {
  logActivity('admin', 'admin', 'Backup', 'Downloaded system backup', {}, req);
  res.attachment(`GradePortal_Backup_${Date.now()}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  const files = [SETTINGS_FILE, TEACHERS_FILE, PASSWORDS_FILE, STUDENT_PROFILES_FILE, CLASS_SETTINGS_FILE, SESSIONS_FILE, ACCOUNT_STATUS_FILE, ACTIVITY_LOGS_FILE];
  files.forEach(f => {
    if (fs.existsSync(f)) archive.file(f, { name: path.basename(f) });
  });
  if (fs.existsSync(GRADES_DIR)) archive.directory(GRADES_DIR, 'Grades');
  archive.finalize();
});

app.get('/api/admin/sessions', requireAuth(['admin']), (req, res) => {
  const currentToken = req.headers['authorization']?.replace('Bearer ', '');
  const timeout = settingsConfig.sessionTimeout || 7200000;
  const now = Date.now();

  // Purge expired sessions
  let expiredCleaned = 0;
  for (const [t, s] of Object.entries(sessions)) {
    const last = s.lastActive || s.createdAt || 0;
    if (now - last > timeout) {
      delete sessions[t];
      expiredCleaned++;
    }
  }
  if (expiredCleaned > 0) {
    saveJSON(SESSIONS_FILE, sessions);
  }

  const enrichedSessions = {};
  let adminCount = 0;
  let teacherCount = 0;
  let studentCount = 0;
  let activeNowCount = 0;

  for (const [t, s] of Object.entries(sessions)) {
    const last = s.lastActive || s.createdAt || 0;
    const isActiveNow = now - last < 15 * 60 * 1000;
    if (isActiveNow) activeNowCount++;
    if (s.role === 'admin') adminCount++;
    else if (s.role === 'teacher') teacherCount++;
    else if (s.role === 'student') studentCount++;

    enrichedSessions[t] = {
      ...s,
      isCurrent: t === currentToken,
      activeNow: isActiveNow
    };
  }

  res.json({
    success: true,
    sessions: enrichedSessions,
    stats: {
      total: Object.keys(enrichedSessions).length,
      activeNow: activeNowCount,
      adminCount,
      teacherCount,
      studentCount,
      sessionTimeout: timeout
    }
  });
});

app.delete('/api/admin/sessions/:token', requireAuth(['admin']), (req, res) => {
  const targetToken = req.params.token;
  const targetSession = sessions[targetToken];
  const currentToken = req.headers['authorization']?.replace('Bearer ', '');

  if (targetSession) {
    const userDesc = targetSession.meta?.name || targetSession.userId || 'User';
    logActivity('admin', 'admin', 'Revoke Session', `Revoked active session for ${userDesc} (${targetSession.role})`, {}, req);
    destroySession(targetToken);
  }
  res.json({ success: true, selfRevoked: targetToken === currentToken });
});

app.post('/api/admin/sessions/revoke-all', requireAuth(['admin']), (req, res) => {
  const currentToken = req.headers['authorization']?.replace('Bearer ', '');
  const { exceptCurrent = true, role = null } = req.body || {};
  let count = 0;

  for (const token of Object.keys(sessions)) {
    if (exceptCurrent && token === currentToken) continue;
    if (role && sessions[token]?.role !== role) continue;
    delete sessions[token];
    count++;
  }
  saveJSON(SESSIONS_FILE, sessions);
  logActivity('admin', 'admin', 'Revoke Multiple Sessions', `Revoked ${count} sessions${exceptCurrent ? ' (except current)' : ''}`, {}, req);
  res.json({ success: true, revokedCount: count });
});

app.post('/api/admin/sessions/clean-expired', requireAuth(['admin']), (req, res) => {
  const timeout = settingsConfig.sessionTimeout || 7200000;
  const now = Date.now();
  let count = 0;
  for (const [t, s] of Object.entries(sessions)) {
    const last = s.lastActive || s.createdAt || 0;
    if (now - last > timeout) {
      delete sessions[t];
      count++;
    }
  }
  if (count > 0) saveJSON(SESSIONS_FILE, sessions);
  res.json({ success: true, cleanedCount: count });
});

app.post('/api/admin/impersonate/:role/:id', requireAuth(['admin']), (req, res) => {
  const { role, id } = req.params;
  let targetUser = null;
  let meta = {};
  if (role === 'teacher') {
    targetUser = teachersConfig[id];
    if (targetUser) meta = { name: targetUser.name };
  } else if (role === 'student') {
    targetUser = studentsMap[id] || studentsMap['0' + id] || studentsMap[id.replace(/^0+/, '')];
    if (targetUser) meta = { name: targetUser.name };
  }
  const targetId = targetUser?.studentNo || targetUser?.username || id;
  logActivity('admin', 'admin', 'Impersonate', `Impersonated ${role} ${targetId}`, {}, req);
  const token = createSession(targetId, role, meta, req);
  res.json({ success: true, token, user: { id: targetId, name: meta.name || targetId } });
});

app.post('/api/admin/impersonate/revert', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    destroySession(token);
  }
  logActivity('admin', 'admin', 'Revert Impersonation', 'Exited impersonation mode and returned to Admin', {}, req);
  res.json({ success: true });
});

app.get('/api/admin/users', requireAuth(['admin']), (req, res) => {
  const teachers = Object.entries(teachersConfig).map(([id, t]) => ({
    id, name: t.name, role: 'teacher', status: accountStatusConfig[id] || 'active'
  }));
  const students = Object.values(studentsMap).map(s => ({
    id: s.studentNo, name: s.name, role: 'student', status: accountStatusConfig[s.studentNo] || 'active'
  }));
  res.json({ success: true, users: [...teachers, ...students] });
});

app.put('/api/admin/users/:id/status', requireAuth(['admin']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  accountStatusConfig[id] = status;
  saveJSON(ACCOUNT_STATUS_FILE, accountStatusConfig);
  if (status === 'suspended') {
    Object.keys(sessions).forEach(t => {
      if (sessions[t].userId === id) destroySession(t);
    });
  }
  res.json({ success: true });
});

// ─── Frontend Integration ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.get(/^(?!\/api).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎓 Grade Portal v2 API running at http://localhost:${PORT}`);
  console.log(`📁 Grades: ${GRADES_DIR}`);
  console.log(`👥 Students loaded: ${Object.keys(studentsMap).length}\n`);
});
