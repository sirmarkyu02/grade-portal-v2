# Student Grade Portal v2

> **Developed by Sir Markyu**

A modern, responsive academic records and grading portal integrating DepEd-standard automated Excel processing, student progress tracking, teacher grade management, and administrative control.

---

## 👨‍💻 Developer & Attribution
- **Developer**: Sir Markyu
- **System**: Grade Portal v2
- **Architecture**: React + Vite (Frontend) & Node.js + Express (Backend) with Excel Parsing Engine

---

## ✨ Features

### 🎓 Student Portal
- **Dashboard Overview**: Summary of academic standing, GWA / transmuted average, and enrolled subjects.
- **Grades Breakdown**: Real-time view of Written Works (WW), Performance Tasks (PT), and Quarterly Examinations (QA).
- **DepEd Descriptors**: Automatically categorized into DepEd SHS rating descriptors (Outstanding, Very Satisfactory, Satisfactory, Fairly Satisfactory).
- **Attendance & Personalization**: Attendance record tracking and custom UI color theme personalization (Violet, Blue, Orange, Pink, Green).
- **Mobile-First Experience**: Ergonomic mobile navigation bar, drawer menus, and bottom sheets for intuitive smartphone navigation.

### 👩‍🏫 Teacher Dashboard
- **Excel Grade Sheets**: Automated parsing and sync directly from DepEd Excel grade templates (`.xlsx`).
- **Score Management**: Component-level grading with live auto-computation of transmuted grades.
- **Term Lock Awareness**: Respects administrative term locking to maintain grade integrity.
- **Print & Export**: Printable grade summaries and master sheets.

### 🛡️ Administrator Panel
- **System Statistics**: Total students, subjects, file loads, and live sync status.
- **Teacher & Student Management**: Account creation, credential resets, and status management.
- **Access & Term Control**: Granular term locking by subject or whole term.
- **Template Management**: Upload and distribute official DepEd Excel grade templates.
- **User Impersonation**: Seamless previewing of student and teacher views with one-click return.
- **Security & Backups**: Active session revocation, activity audit logs, and full database backups (`.zip`).

---

## 🚀 Running the Project

### Prerequisites
- Node.js (v18 or higher)
- npm

### 1. Backend Server
```bash
# In the project root directory
npm install
npm run dev
# Server runs on http://localhost:3001
```

### 2. Frontend Application
```bash
# In the frontend directory
cd frontend
npm install
npm run dev
# Application runs on http://localhost:5173
```
