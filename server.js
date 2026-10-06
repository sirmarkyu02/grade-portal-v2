const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const multer = require('multer');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

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
    features: { grades: true, attendance: true }, sessionTimeout: 7200000
  });
  teachersConfig = loadJSON(TEACHERS_FILE);
  passwordsConfig = loadJSON(PASSWORDS_FILE);
  studentProfilesConfig = loadJSON(STUDENT_PROFILES_FILE);
  classSettingsConfig = loadJSON(CLASS_SETTINGS_FILE);
  sessions = loadJSON(SESSIONS_FILE);
  accountStatusConfig = loadJSON(ACCOUNT_STATUS_FILE);
  activityLogs = loadJSON(ACTIVITY_LOGS_FILE, []);
}

reloadAll();

// Watch config files
[SETTINGS_FILE, TEACHERS_FILE, PASSWORDS_FILE, STUDENT_PROFILES_FILE, CLASS_SETTINGS_FILE, ACCOUNT_STATUS_FILE].forEach(f => {
  chokidar.watch(f, { persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 500 } })
    .on('change', () => reloadAll());
});

// ─── Session Management ──────────────────────────────────────────────────────
function createSession(userId, role, meta = {}) {
  const token = uuidv4();
  sessions[token] = { userId, role, meta, createdAt: Date.now(), lastActive: Date.now() };
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

function logActivity(userId, role, action, details) {
  activityLogs.unshift({ id: uuidv4(), userId, role, action, details, timestamp: new Date().toISOString() });
  if (activityLogs.length > 1000) activityLogs = activityLogs.slice(0, 1000);
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
    students[String(studentNo)] = {
      studentName, records,
      summary: {
        term1: { present: cell(r, 104), absent: cell(r, 105), late: cell(r, 106), excused: cell(r, 107) },
        term2: { present: cell(r, 108), absent: cell(r, 109), late: cell(r, 110), excused: cell(r, 111) },
        term3: { present: cell(r, 112), absent: cell(r, 113), late: cell(r, 114), excused: cell(r, 115) },
      },
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

// ─── Load All Grade Data ─────────────────────────────────────────────────────
function loadAllData() {
  console.log(`[${new Date().toLocaleTimeString()}] 📂 Loading grade data...`);
  const newMap = {};
  const files = fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx'));

  for (const fname of files) {
    try {
      const fpath = path.join(GRADES_DIR, fname);
      const wb = XLSX.readFile(fpath);
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
          classStudentsList.push({
            studentNo: String(sNo),
            studentName: String(sName),
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

  const id = String(userId).trim();
  const pw = String(password).trim();

  // Admin
  if (id.toLowerCase() === 'admin') {
    if (pw === settingsConfig.adminPassword) {
      logActivity('admin', 'admin', 'Login', 'Admin logged in');
      const token = createSession('admin', 'admin');
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
      logActivity(teacherId, 'teacher', 'Login', 'Teacher logged in');
      const token = createSession(teacherId, 'teacher', { name: t.name });
      return res.json({ success: true, role: 'teacher', token, user: { id: teacherId, name: t.name, email: t.email, department: t.department } });
    }
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Student
  const student = studentsMap[id];
  if (!student) return res.status(404).json({ error: 'User not found. Please check your ID.' });
  if (accountStatusConfig[id] === 'suspended') return res.status(403).json({ error: 'Account suspended.' });

  const expectedPw = passwordsConfig[id] ? String(passwordsConfig[id]) : id;
  if (pw !== expectedPw) return res.status(401).json({ error: 'Incorrect password.' });

  const profile = studentProfilesConfig[id] || {};
  const isOnboarded = !!profile.onboarded;
  const token = createSession(id, 'student', { name: student.name });
  logActivity(id, 'student', 'Login', 'Student logged in');

  res.json({ success: true, role: 'student', token, isOnboarded, user: { id, name: student.name, ...profile } });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
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
//  SETTINGS ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.get('/api/settings/public', (req, res) => {
  const { adminPassword, ...safe } = settingsConfig;
  res.json(safe);
});

app.get('/api/settings', requireAuth(['admin']), (req, res) => {
  res.json(settingsConfig);
});

app.put('/api/settings', requireAuth(['admin']), (req, res) => {
  const { adminPassword, portalName, schoolName, visibleTerms, termLocks, features, sessionTimeout, gradeRelease, schoolInfo, notification } = req.body;
  if (portalName !== undefined) settingsConfig.portalName = portalName;
  if (schoolName !== undefined) settingsConfig.schoolName = schoolName;
  if (visibleTerms !== undefined) settingsConfig.visibleTerms = visibleTerms;
  if (termLocks !== undefined) settingsConfig.termLocks = termLocks;
  if (features !== undefined) settingsConfig.features = features;
  if (sessionTimeout !== undefined) settingsConfig.sessionTimeout = sessionTimeout;
  if (gradeRelease !== undefined) settingsConfig.gradeRelease = gradeRelease;
  if (schoolInfo !== undefined) settingsConfig.schoolInfo = schoolInfo;
  if (notification !== undefined) settingsConfig.notification = notification;
  if (adminPassword && adminPassword.trim()) settingsConfig.adminPassword = adminPassword.trim();
  console.log('--- DEBUG ---');
  console.log('req.body.termLocks:', termLocks);
  console.log('settingsConfig before save:', settingsConfig);
  saveJSON(SETTINGS_FILE, settingsConfig);
  logActivity('admin', 'admin', 'Update Settings', 'Updated system settings');
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
//  STUDENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post('/api/student/onboard', requireAuth(['student']), uploadPhoto.single('photo'), (req, res) => {
  const studentNo = req.session.userId;
  const { newPassword, contactNo, parentName, parentContactNo, address } = req.body;

  if (!studentsMap[studentNo]) return res.status(404).json({ error: 'Student not found.' });

  if (newPassword && newPassword.trim()) {
    passwordsConfig[studentNo] = newPassword.trim();
    saveJSON(PASSWORDS_FILE, passwordsConfig);
  }

  const photo = req.file ? `/photos/${req.file.filename}` : (studentProfilesConfig[studentNo]?.photo || null);
  studentProfilesConfig[studentNo] = {
    ...studentProfilesConfig[studentNo],
    contactNo, parentName, parentContactNo, address, photo, onboarded: true, onboardedAt: new Date().toISOString()
  };
  saveJSON(STUDENT_PROFILES_FILE, studentProfilesConfig);
  res.json({ success: true });
});

app.post('/api/student/change-password', requireAuth(['student']), (req, res) => {
  const studentNo = req.session.userId;
  const { currentPassword, newPassword } = req.body;
  const expectedPw = passwordsConfig[studentNo] ? String(passwordsConfig[studentNo]) : studentNo;
  if (String(currentPassword) !== expectedPw) return res.status(401).json({ error: 'Incorrect current password.' });
  passwordsConfig[studentNo] = newPassword.trim();
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
    const cs = { 
      hideTerm1: false, hideTerm2: true, hideTerm3: true, hideTerm4: true, 
      ...(classSettingsConfig[fname] || {}) 
    };
    if (cs.blockedStudents?.includes(studentNo)) {
      sub.isBlocked = true; sub.terms = {}; sub.gradingSummary = null; sub.attendance = null;
    } else {
      if (cs.hideTerm1) {
        if (sub.terms['Term 1']) delete sub.terms['Term 1'];
        if (sub.gradingSummary) sub.gradingSummary.term1 = null;
      }
      if (cs.hideTerm2) {
        if (sub.terms['Term 2']) delete sub.terms['Term 2'];
        if (sub.gradingSummary) sub.gradingSummary.term2 = null;
      }
      if (cs.hideTerm3) {
        if (sub.terms['Term 3']) delete sub.terms['Term 3'];
        if (sub.gradingSummary) sub.gradingSummary.term3 = null;
      }
      if (cs.hideTerm4) {
        if (sub.terms['Term 4']) delete sub.terms['Term 4'];
        if (sub.gradingSummary) sub.gradingSummary.term4 = null;
      }
      if (cs.hideAttendance) sub.attendance = null;
    }
    // Apply global visible terms filter
    const vt = settingsConfig.visibleTerms || {};
    const releaseFinals = cs.releaseFinals || {};
    Object.keys(sub.terms).forEach(t => { 
      if (vt[t] === false) {
        delete sub.terms[t]; 
      } else if (releaseFinals[t] === false) {
        if (sub.terms[t].summary) {
          sub.terms[t].summary.transmutedGrade = null;
          sub.terms[t].summary.initialGrade = null;
          sub.terms[t].summary.status = 'Hidden';
        }
      }
    });

    if (sub.gradingSummary && Object.keys(releaseFinals).length > 0) {
      if (releaseFinals['Term 1'] === false) sub.gradingSummary.term1 = null;
      if (releaseFinals['Term 2'] === false) sub.gradingSummary.term2 = null;
      if (releaseFinals['Term 3'] === false) sub.gradingSummary.term3 = null;
      if (releaseFinals['Term 4'] === false) sub.gradingSummary.term4 = null;
      
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
    return { ...info, studentCount, lastModified: s.mtime };
  });
  res.json({ success: true, classes });
});

app.post('/api/teacher/upload', requireAuth(['teacher']), uploadGrade.single('gradesFile'), (req, res) => {
  const teacherId = req.session.userId;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const wb = XLSX.readFile(req.file.path);
    const required = ['Data Input', 'Term 1', 'Term 2', 'Term 3'];
    const missing = required.filter(s => !wb.Sheets[s]);
    if (missing.length > 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Invalid file. Missing sheets: ${missing.join(', ')}` });
    }
    const fname = req.file.filename;
    const historyPath = path.join(GRADES_HISTORY_DIR, `${Date.now()}_${fname}`);
    fs.copyFileSync(req.file.path, historyPath);
    if (!teachersConfig[teacherId]) teachersConfig[teacherId] = { files: [] };
    if (!teachersConfig[teacherId].files) teachersConfig[teacherId].files = [];
    if (!teachersConfig[teacherId].files.includes(fname)) teachersConfig[teacherId].files.push(fname);
    saveJSON(TEACHERS_FILE, teachersConfig);
    res.json({ success: true, message: 'Grades uploaded successfully.' });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
    classStudents.push({
      studentNo, name: data.name, gradingSummary: sub.gradingSummary,
      terms: {
        'Term 1': sub.terms['Term 1'] ? { transmutedGrade: sub.terms['Term 1'].summary?.transmutedGrade, status: sub.terms['Term 1'].summary?.status } : null,
        'Term 2': sub.terms['Term 2'] ? { transmutedGrade: sub.terms['Term 2'].summary?.transmutedGrade, status: sub.terms['Term 2'].summary?.status } : null,
        'Term 3': sub.terms['Term 3'] ? { transmutedGrade: sub.terms['Term 3'].summary?.transmutedGrade, status: sub.terms['Term 3'].summary?.status } : null,
      }
    });
  }
  classStudents.sort((a, b) => a.name.localeCompare(b.name));
  const classSettings = { hideTerm1: false, hideTerm2: true, hideTerm3: true, hideTerm4: true, hideAttendance: false, blockedStudents: [], ...(classSettingsConfig[filename] || {}) };
  res.json({ success: true, students: classStudents, settings: classSettings });
});

app.get('/api/teacher/class/:filename/full', requireAuth(['teacher']), (req, res) => {
  const teacherId = req.session.userId;
  const filename = req.params.filename;
  if (!teachersConfig[teacherId]?.files?.includes(filename)) return res.status(403).json({ error: 'Forbidden.' });

  const classStudents = [];
  for (const [studentNo, data] of Object.entries(studentsMap)) {
    const sub = data.subjects.find(s => s.info.fileName === filename);
    if (sub) classStudents.push({ studentNo, name: data.name, terms: sub.terms, info: sub.info, attendance: sub.attendance });
  }
  classStudents.sort((a, b) => a.name.localeCompare(b.name));
  const classSettings = { hideTerm1: false, hideTerm2: true, hideTerm3: true, hideTerm4: true, hideAttendance: false, blockedStudents: [], releaseFinals: {}, ...(classSettingsConfig[filename] || {}) };
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
    
    res.json({ success: true, columns, attendance });
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
    const wbSheetJS = XLSX.readFile(fpath);

    for (const update of updates) {
      const sheet = workbook.sheet(update.termName);
      if (sheet) {
        const c = sheet.cell(update.row + 1, update.col + 1);
        if (update.termName === 'Attendance') {
          c.value((update.value === '' || update.value === null) ? null : update.value);
        } else {
          c.value((update.value === '' || update.value === null) ? null : Number(update.value));
          if (update.hps !== undefined && update.hps !== null && update.hps !== '') sheet.cell(6, update.col + 1).value(Number(update.hps));
          if (update.label) sheet.cell(8, update.col + 1).value(update.label);
        }
        
        if (studentsMap[studentNo]) {
          const sub = studentsMap[studentNo].subjects.find(s => s.info.fileName === filename);
          if (sub && update.termName === 'Attendance' && sub.attendance) {
             const record = sub.attendance.records.find(r => r.col === update.col); // wait, parseAttendance records don't have col saved! Let's check parseAttendance.
             // I'll just rely on `loadAllData()` explicitly being called after await workbook.toFileAsync(fpath); 
             // That's much safer than trying to keep track of attendance manually here.
          } else if (sub && sub.terms[update.termName]) {
            const term = sub.terms[update.termName];
            for (const key of ['performanceTasks', 'writtenWorks']) {
              if (term[key]) {
                 const item = term[key].find(i => i.col === update.col);
                 if (item) item.score = update.value === null ? null : Number(update.value);
              }
            }
            if (term.exams) {
              for (const exam of Object.values(term.exams)) {
                if (exam.col === update.col) exam.score = update.value === null ? null : Number(update.value);
              }
            }
            
            const wsTerm = wbSheetJS.Sheets[update.termName];
            const getVal = (r, c) => {
              const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
              return wsTerm && wsTerm[addr] ? wsTerm[addr].v : null;
            };
            const wwW = getVal(6, 27) || 0.2;
            const ptW = getVal(6, 45) || 0.5;
            const exW = getVal(7, 53) || 0.3;
            
            let hasScore = false;
            let wT=0, wM=0;
            term.writtenWorks.forEach(w => { wM += w.hps; if (w.score !== null && w.score !== undefined) { wT += w.score; hasScore = true; } });
            const wPS = wM > 0 ? (wT / wM) * 100 : 0;
            const wWS = wPS * wwW;

            let pT=0, pM=0;
            term.performanceTasks.forEach(p => { pM += p.hps; if (p.score !== null && p.score !== undefined) { pT += p.score; hasScore = true; } });
            const pPS = pM > 0 ? (pT / pM) * 100 : 0;
            const pWS = pPS * ptW;

            let eT=0, eM=0;
            Object.values(term.exams).forEach(e => { eM += e.hps; if (e.score !== null && e.score !== undefined) { eT += e.score; hasScore = true; } });
            const ePS = eM > 0 ? (eT / eM) * 100 : 0;
            const eWS = ePS * exW;

            const iG = hasScore ? Math.round((wWS + pWS + eWS) * 100) / 100 : null;
            
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
            const tG = hasScore ? getTransmuted(iG) : null;
            
            let st = null;
            if (hasScore) {
              st = "Failed [E]";
              if (tG >= 90) st = "Passed [A]";
              else if (tG >= 80) st = "Passed [B]";
              else if (tG >= 75) st = "Passed [C]";
              else if (tG >= 65) st = "Failed [D]";
            }

            term.summary = {
              wwTotal: wT, wwPS: Math.round(wPS * 100) / 100, wwWS: Math.round(wWS * 100) / 100,
              ptTotal: pT, ptPS: Math.round(pPS * 100) / 100, ptWS: Math.round(pWS * 100) / 100,
              examWS: Math.round(eWS * 100) / 100, initialGrade: iG, transmutedGrade: tG, status: st
            };

            const t1 = sub.terms['Term 1']?.summary?.transmutedGrade ?? null;
            const t2 = sub.terms['Term 2']?.summary?.transmutedGrade ?? null;
            const t3 = sub.terms['Term 3']?.summary?.transmutedGrade ?? null;
            const t4 = sub.terms['Term 4']?.summary?.transmutedGrade ?? null;
            const validTerms = [t1, t2, t3, t4].filter(t => t !== null);
            const finalGrade = validTerms.length > 0 ? Math.round(validTerms.reduce((a,b)=>a+b, 0) / validTerms.length) : null;
            
            let remarks = "";
            if (finalGrade !== null) {
              if (finalGrade >= 90) remarks = "Passed [Outstanding]";
              else if (finalGrade >= 85) remarks = "Passed [Very Satisfactory]";
              else if (finalGrade >= 80) remarks = "Passed [Satisfactory]";
              else if (finalGrade >= 75) remarks = "Passed [Fairly Satisfactory]";
              else remarks = "Failed [Did Not Meet Expectations]";
            }
            sub.gradingSummary = { term1: t1, term2: t2, term3: t3, term4: t4, finalGrade, remarks };
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
    const required = ['Data Input', 'Term 1', 'Term 2', 'Term 3'];
    const missing = required.filter(s => !wb.Sheets[s]);
    if (missing.length > 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: `Invalid template. Missing sheets: ${missing.join(', ')}` });
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
      const fg = gs.finalGrade && gs.finalGrade !== '--' ? parseInt(gs.finalGrade) : null;
      subjectMap[key].students.push({ studentNo: s.studentNo, name: s.name, finalGrade: fg, remarks: gs.remarks || null });
    });
  });

  const subjectStats = Object.values(subjectMap).map(entry => {
    const graded = entry.students.filter(s => s.finalGrade !== null);
    const avg = graded.length > 0 ? Math.round(graded.reduce((sum, s) => sum + s.finalGrade, 0) / graded.length) : null;
    const passed = graded.filter(s => s.finalGrade >= 75).length;
    return { subject: entry.subject, section: entry.section, gradeLevel: entry.gradeLevel, instructor: entry.instructor, totalStudents: entry.students.length, gradedStudents: graded.length, average: avg, passed, failed: graded.length - passed, passRate: graded.length > 0 ? Math.round((passed / graded.length) * 100) : null };
  });

  res.json({ success: true, overview: { totalStudents: students.length, totalSubjects: subjectStats.length }, subjectStats });
});

// --- Admin Sync ---
app.post('/api/admin/sync', requireAuth(['admin']), (req, res) => {
  loadAllData();
  res.json({ success: true, lastSync, totalStudents: Object.keys(studentsMap).length });
});

// ─── System Status ───────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ ok: true, lastSync, totalStudents: Object.keys(studentsMap).length, filesLoaded: fs.readdirSync(GRADES_DIR).filter(f => f.endsWith('.xlsx')).length });
});

// --- Admin Features: Backup, Logs, Sessions, Impersonate ---
app.get('/api/admin/activity-logs', requireAuth(['admin']), (req, res) => {
  res.json({ success: true, logs: activityLogs });
});

app.get('/api/admin/backup', requireAuth(['admin']), (req, res) => {
  logActivity('admin', 'admin', 'Backup', 'Downloaded system backup');
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
  res.json({ success: true, sessions });
});

app.delete('/api/admin/sessions/:token', requireAuth(['admin']), (req, res) => {
  destroySession(req.params.token);
  res.json({ success: true });
});

app.post('/api/admin/impersonate/:role/:id', requireAuth(['admin']), (req, res) => {
  const { role, id } = req.params;
  logActivity('admin', 'admin', 'Impersonate', `Impersonated ${role} ${id}`);
  let meta = {};
  if (role === 'teacher' && teachersConfig[id]) meta = { name: teachersConfig[id].name };
  if (role === 'student' && studentsMap[id]) meta = { name: studentsMap[id].name };
  const token = createSession(id, role, meta);
  res.json({ success: true, token });
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

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎓 Grade Portal v2 API running at http://localhost:${PORT}`);
  console.log(`📁 Grades: ${GRADES_DIR}`);
  console.log(`👥 Students loaded: ${Object.keys(studentsMap).length}\n`);
});
