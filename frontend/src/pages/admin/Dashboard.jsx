import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, FileUp, Settings, Trash2, Edit3, Plus, Download, RotateCcw, Search, ChevronRight, Eye, EyeOff, BarChart2, RefreshCw, FileSpreadsheet, Cloud, CloudUpload, CloudDownload, ExternalLink, Globe, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { AppLayout, PageHeader, GradePill, StatusBadge, EmptyState, LoadingSpinner, Modal, ConfirmModal } from '../../components/Layout';
import { useAuth } from '../../App';
import { Shield, Clock, HardDrive, Key, UserCheck, AlertTriangle, Lock, Unlock, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, X, Check, Calendar, User, FileText, Server, Laptop, Wifi, WifiOff, Copy, ArrowRight, Radio } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import SystemLogsAndSessions from './SystemLogsAndSessions';
import { UiInlineSwitcher } from '../../components/UiSwitcher';

// ─── Overview Page ─────────────────────────────────────────────────────────────
function OverviewPage() {
  const navigate = useNavigate();
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
    const t0 = performance.now();
    try {
      const res = await api.get('/sync/status');
      const latency = Math.round(performance.now() - t0);
      setCloudStatus({ ...res.data, latency, checking: false });
    } catch {
      setCloudStatus(prev => ({ ...prev, online: false, checking: false, latency: null }));
    }
  };

  const isOnlineCloud = (() => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    if (hostname === '16.59.47.134') return true;
    if (cloudStatus?.cloudUrl) {
      try {
        const u = new URL(cloudStatus.cloudUrl.startsWith('http') ? cloudStatus.cloudUrl : `http://${cloudStatus.cloudUrl}`);
        if (hostname === u.hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') return true;
      } catch {}
    }
    return false;
  })();

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
  const localStudentsCount = ov.totalStudents || stats?.status?.totalStudents || 0;
  const localFilesCount = cloudStatus.localFilesCount || stats?.status?.filesLoaded || 0;
  const cloudStudentsCount = cloudStatus.cloudInfo?.totalStudents;
  const cloudFilesCount = cloudStatus.cloudInfo?.filesLoaded;
  const hasRosterDiff = cloudStatus.online && cloudStudentsCount !== undefined && cloudStudentsCount !== localStudentsCount;
  const studentDiff = (cloudStudentsCount || 0) - localStudentsCount;
  const filesDiff = (cloudFilesCount || 0) - localFilesCount;

  return (
    <div className="page-content fade-in">
      <div className="overview-quick-actions">
        <a className="btn btn-primary btn-sm overview-action-btn" href="/api/admin/backup" download>
          <HardDrive size={14} /> <span>Download Backup</span>
        </a>
        <button className="btn btn-secondary btn-sm overview-action-btn" onClick={handleSync} disabled={syncing}>
          {syncing ? <LoadingSpinner size="sm" /> : <RefreshCw size={14} />} <span>Reload Local</span>
        </button>
      </div>

      {/* Pending Class Deletions Banner */}
      {stats?.overview?.pendingDeletions > 0 && (
        <div style={{
          borderRadius: 16,
          padding: '16px 20px',
          marginBottom: 20,
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b45309',
              flexShrink: 0
            }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#92400e' }}>
                  {stats.overview.pendingDeletions} Subject/Class Deletion Request{stats.overview.pendingDeletions > 1 ? 's' : ''} Pending Approval
                </h4>
                <span className="deletion-pulse-dot" />
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.8125rem', color: '#b45309' }}>
                Teachers have submitted requests to delete classes. Review teacher reasons and approve or reject them.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ background: '#d97706', borderColor: '#d97706', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => navigate('/admin/deletion-requests')}
          >
            <span>Review Requests</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ─── AWS Cloud Synchronization Center ─── */}
      <div className="cloud-sync-card fade-in">
        {/* Header Bar */}
        <div className="cloud-sync-header">
          <div className="cloud-sync-header-left">
            <div className="cloud-sync-icon-badge" style={{
              background: isOnlineCloud ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'linear-gradient(135deg, #0284c7, #2563eb)',
              boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.25)',
            }}>
              {isOnlineCloud ? <Server size={22} /> : <CloudUpload size={22} />}
            </div>
            <div className="cloud-sync-header-content">
              <div className="cloud-sync-badges-row">
                <span className="badge cloud-sync-badge-node" style={{
                  background: isOnlineCloud ? '#e0e7ff' : '#f0fdf4',
                  color: isOnlineCloud ? '#3730a3' : '#166534',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5
                }}>
                  {isOnlineCloud ? <Server size={12} /> : <Laptop size={12} />}
                  <span>{isOnlineCloud ? 'AWS Cloud Hub' : 'Local Offline Node'}</span>
                  <span className="desktop-only-badge-text">{isOnlineCloud ? ' (Production Instance)' : ' (Desktop Authority)'}</span>
                </span>

                {cloudStatus.checking ? (
                  <span className="badge badge-neutral" style={{ fontSize: '0.725rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <LoadingSpinner size="sm" /> Pinging AWS...
                  </span>
                ) : cloudStatus.online ? (
                  <span className="badge badge-success" style={{ fontSize: '0.725rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="cloud-pulse-online" />
                    <span>AWS Connected</span>
                    {cloudStatus.latency && <span style={{ opacity: 0.8, fontFamily: 'var(--font-mono)' }}>({cloudStatus.latency}ms)</span>}
                  </span>
                ) : (
                  <span className="badge badge-error" style={{ fontSize: '0.725rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span className="cloud-pulse-offline" />
                    <span>AWS Offline</span>
                  </span>
                )}
              </div>

              <h3 className="cloud-sync-title">
                {isOnlineCloud ? 'AWS Cloud Production Portal' : 'AWS Cloud Synchronization Bridge'}
              </h3>
              <p className="cloud-sync-desc">
                {isOnlineCloud
                  ? 'Active production instance on AWS EC2. Online students view live published grades and offline teacher nodes transmit updates to this server.'
                  : 'Local offline authority. Grade and attendance records can be edited without internet, then securely synchronized with the live AWS cloud portal.'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="cloud-actions-container">
            <button 
              type="button"
              className="btn btn-secondary btn-sm cloud-action-btn cloud-action-ping" 
              onClick={checkCloudStatus} 
              disabled={cloudStatus.checking || cloudSyncing}
              title="Ping AWS server to verify connection health and latency"
            >
              <RefreshCw size={13} className={cloudStatus.checking ? 'spin' : ''} />
              <span>{cloudStatus.checking ? 'Testing...' : 'Test Ping'}</span>
            </button>

            {!isOnlineCloud && (
              <>
                <button 
                  type="button"
                  className="btn btn-secondary btn-sm cloud-action-btn cloud-action-pull" 
                  onClick={() => { setSyncMode('pull'); setAuthorizedConfirm(false); setSyncModalOpen(true); }}
                  disabled={cloudSyncing}
                  title="Download latest online edits from AWS Cloud into this offline app"
                >
                  <CloudDownload size={14} style={{ color: 'var(--brand-600)' }} />
                  <span>Pull from AWS</span>
                </button>
                <button 
                  type="button"
                  className="btn btn-primary btn-sm cloud-action-btn cloud-action-push" 
                  onClick={() => { setSyncMode('push'); setAuthorizedConfirm(false); setSyncModalOpen(true); }}
                  disabled={cloudSyncing}
                  title="Push offline grade sheets and settings to AWS Cloud"
                >
                  <CloudUpload size={14} />
                  <span>Push to AWS</span>
                </button>
              </>
            )}

            {isOnlineCloud && (
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm cloud-action-btn cloud-action-portal"
              >
                <Globe size={14} />
                <span>Open Student Portal ↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Visual Bidirectional Pipeline Diagram */}
        <div className="cloud-pipeline-diagram">
          {/* Node 1: Local Machine */}
          <div className="cloud-pipeline-node">
            <div className="cloud-pipeline-node-icon" style={{ borderRadius: 10, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-600)', flexShrink: 0 }}>
              <Laptop size={16} />
            </div>
            <div className="cloud-pipeline-node-text" style={{ minWidth: 0 }}>
              <div className="cloud-pipeline-node-title">
                {isOnlineCloud ? 'Client Nodes' : 'Local Node'}
              </div>
              <div className="cloud-pipeline-node-detail">
                {localFilesCount} Classes • {localStudentsCount} Students
              </div>
            </div>
          </div>

          {/* Pipeline Track */}
          <div className="cloud-pipeline-track">
            <div className="cloud-pipeline-track-header">
              <span className="cloud-pipeline-tag">
                <Lock size={10} style={{ display: 'inline', marginRight: 3 }} />
                AES-256 TLS Encrypted Sync
              </span>
              {hasRosterDiff && (
                <span className="badge cloud-pipeline-diff-badge" style={{ fontSize: '0.65rem', padding: '2px 8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>
                  Roster: {localStudentsCount} vs {cloudStudentsCount} ({studentDiff > 0 ? `+${studentDiff}` : studentDiff})
                </span>
              )}
            </div>
            <div className="cloud-pipeline-line" />
            <div className="cloud-pipeline-track-status">
              {cloudStatus.online ? '● Ready' : '○ Standby'}
            </div>
          </div>

          {/* Node 2: AWS Cloud Server */}
          <div className="cloud-pipeline-node">
            <div className="cloud-pipeline-node-icon" style={{ borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', flexShrink: 0 }}>
              <Server size={16} />
            </div>
            <div className="cloud-pipeline-node-text" style={{ minWidth: 0 }}>
              <div className="cloud-pipeline-node-title">
                AWS Cloud Hub
              </div>
              <div className="cloud-pipeline-node-detail" style={{ color: '#4338ca' }}>
                {cloudFilesCount !== undefined ? `${cloudFilesCount} Files • ${cloudStudentsCount || 0} Students` : '16.59.47.134'}
              </div>
            </div>
          </div>
        </div>

        {/* Sync Info Grid */}
        <div className="cloud-sync-metrics-grid">
          <div className="cloud-sync-metric">
            <span className="cloud-sync-metric-title">
              Offline Local Records
            </span>
            <span className="cloud-sync-metric-value" style={{ fontFamily: 'var(--font-mono)' }}>
              {localFilesCount} Files <span className="cloud-sync-metric-count">({localStudentsCount} Students)</span>
            </span>
            <span className="cloud-sync-metric-subtitle">
              Ready in local Grades folder
            </span>
          </div>

          <div className="cloud-sync-metric">
            <span className="cloud-sync-metric-title">
              Target AWS Server
            </span>
            <a 
              href={cloudStatus.cloudUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="cloud-sync-metric-link"
            >
              <span>{cloudStatus.cloudUrl.replace('http://', '').replace('https://', '')}</span>
              <ExternalLink size={12} />
            </a>
            <span className="cloud-sync-metric-subtitle">
              Live public EC2 instance
            </span>
          </div>

          <div className="cloud-sync-metric">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="cloud-sync-metric-title">
                Online AWS Cloud Roster
              </span>
              {hasRosterDiff && (
                <span className="badge" style={{ fontSize: '0.625rem', padding: '1px 6px', background: '#dbeafe', color: '#1e40af', fontWeight: 700 }}>
                  {studentDiff > 0 ? `+${studentDiff}` : studentDiff}
                </span>
              )}
            </div>
            <span className="cloud-sync-metric-value" style={{ color: cloudStatus.online ? '#059669' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {cloudStatus.online && cloudStudentsCount !== undefined ? `${cloudStudentsCount} Students` : '—'}
            </span>
            <span className="cloud-sync-metric-subtitle">
              {cloudStatus.online ? `${cloudFilesCount || 0} classes serving online` : 'Connect to check roster'}
            </span>
          </div>

          <div className="cloud-sync-metric">
            <span className="cloud-sync-metric-title">
              Last Cloud Sync
            </span>
            <span className="cloud-sync-metric-value" style={{ fontSize: '0.95rem' }}>
              {cloudStatus.lastSync ? new Date(cloudStatus.lastSync).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never Synced Yet'}
            </span>
            <span className="cloud-sync-metric-subtitle">
              Encrypted bidirectional sync
            </span>
          </div>
        </div>

        {/* Roster Reconciliation Status Notice (if discrepancy detected) */}
        {hasRosterDiff && (
          <div style={{
            marginTop: 14,
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(240, 253, 250, 0.95) 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
                <Users size={16} />
              </div>
              <div>
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1e3a8a' }}>
                  Roster Reconciliation Notice: Local ({localStudentsCount} Students across {localFilesCount} files) vs Cloud ({cloudStudentsCount} Students across {cloudFilesCount} files)
                </div>
                <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: 2 }}>
                  AWS Cloud currently hosts {filesDiff} additional class file{filesDiff > 1 ? 's' : ''} with {studentDiff} extra students (e.g., BSTM 1A). Your local desktop authority is working with {localFilesCount} files ({localStudentsCount} students). To synchronize them locally, use <strong>Pull from AWS</strong>.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 10px', height: 'auto', background: 'white', borderColor: '#bfdbfe', color: '#1d4ed8' }}
              onClick={() => { setSyncMode('pull'); setAuthorizedConfirm(false); setSyncModalOpen(true); }}
            >
              <CloudDownload size={12} style={{ marginRight: 4 }} />
              Pull Remote Classes
            </button>
          </div>
        )}
      </div>

      {/* Cloud Sync Authorization Modal */}
      {/* Cloud Sync Authorization Modal */}
      <Modal 
        open={syncModalOpen} 
        onClose={() => !cloudSyncing && setSyncModalOpen(false)} 
        title={syncMode === 'pull' ? 'Authorize Pull from AWS Cloud (Online ➔ Offline)' : 'Authorize Push to AWS Cloud (Offline ➔ Online)'} 
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSyncModalOpen(false)} disabled={cloudSyncing}>
              Cancel
            </button>
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={syncMode === 'pull' ? handlePullFromCloud : handlePushToCloud} 
              disabled={!authorizedConfirm || cloudSyncing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
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
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Visual Direction Transfer Box */}
          <div className={`cloud-transfer-box ${syncMode}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-600)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {syncMode === 'push' ? <Laptop size={20} /> : <Server size={20} />}
              </div>
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'block' }}>
                  {syncMode === 'push' ? 'Local Offline Node' : 'AWS Cloud Hub'}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {syncMode === 'push' 
                    ? `${localFilesCount} Classes (${localStudentsCount} Students)` 
                    : `${cloudFilesCount !== undefined ? cloudFilesCount : '11'} Classes (${cloudStudentsCount || 0} Students)`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: syncMode === 'push' ? '#059669' : '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {syncMode === 'push' ? 'Push ➔' : 'Pull ➔'}
              </span>
              <ArrowRight size={18} style={{ color: syncMode === 'push' ? '#10b981' : '#f59e0b' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {syncMode === 'push' ? <Server size={20} /> : <Laptop size={20} />}
              </div>
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'block' }}>
                  {syncMode === 'push' ? 'AWS Cloud Hub' : 'Local Offline Node'}
                </strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {syncMode === 'push' 
                    ? `Live Cloud (${cloudStudentsCount || 0} Students Online)` 
                    : `Local Grades Folder (${localStudentsCount} Students)`}
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 18px', background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <ShieldCheck size={18} color="var(--brand-600)" />
              <strong style={{ fontSize: '0.9375rem', color: 'var(--text-main)' }}>
                {syncMode === 'pull' ? 'Download Latest Online Data from AWS Cloud' : 'Publish Local Offline Records to AWS Cloud'}
              </strong>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {syncMode === 'pull' ? (
                <>
                  You are about to pull and download files from the live AWS Cloud Server (<strong>{cloudStatus.cloudUrl}</strong>) into this computer. <strong>Existing local files are automatically archived to Grades_History as a safety precaution.</strong>
                </>
              ) : (
                <>
                  You are about to push <strong>{localFilesCount} Excel grade files ({localStudentsCount} students)</strong> and active visibility settings up to the live AWS Cloud Server (<strong>{cloudStatus.cloudUrl}</strong>). Online students will immediately see these published grades.
                </>
              )}
            </p>
          </div>

          {syncMode === 'pull' && (
            <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 10, color: '#92400e', fontSize: '0.8125rem' }}>
              <AlertTriangle size={18} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', marginBottom: 2 }}>Caution: Pull Overwrites Local Files</strong>
                <span>"Pull from AWS" replaces your local offline sheets with what is currently stored online. If you made changes offline on this machine, choose <strong>"Push to AWS"</strong> instead to preserve them!</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '14px 16px', borderRadius: 12 }}>
            {syncMode === 'pull' ? (
              <>
                <div>✓ Downloads latest online Excel grade sheets from AWS into your local Grades folder</div>
                <div>✓ Automatically reloads and recalculates student ratings and attendance records</div>
                <div>✓ Existing local files are automatically backed up to Grades_History</div>
              </>
            ) : (
              <>
                <div>✓ Uploads offline Excel sheets to AWS Cloud via secure token authentication</div>
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

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem' }}>
            <input 
              type="checkbox" 
              checked={authorizedConfirm} 
              onChange={e => setAuthorizedConfirm(e.target.checked)} 
              disabled={cloudSyncing} 
              style={{ width: 18, height: 18, marginTop: 2, cursor: 'pointer', accentColor: 'var(--brand-600)' }} 
            />
            <span style={{ fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4 }}>
              {syncMode === 'pull' 
                ? 'I understand and authorize updating local offline files with data from AWS Cloud.' 
                : 'I authorize updating the live AWS Cloud portal with offline Excel data.'}
            </span>
          </label>
        </div>
      </Modal>

      {/* Stats */}
      <div className="overview-stats-grid">
        {[
          { 
            label: 'Total Students (Offline Local)', 
            value: localStudentsCount, 
            subValue: cloudStatus.online && cloudStudentsCount !== undefined ? `${cloudStudentsCount} on AWS Cloud` : null,
            icon: Users, 
            colorClass: 'brand' 
          },
          { 
            label: 'Total Subjects', 
            value: ov.totalSubjects || 0, 
            icon: BookOpen, 
            colorClass: 'green' 
          },
          { 
            label: 'Files Loaded (Offline Local)', 
            value: localFilesCount, 
            subValue: cloudStatus.online && cloudFilesCount !== undefined ? `${cloudFilesCount} on AWS Cloud` : null,
            icon: FileUp, 
            colorClass: 'blue' 
          },
          { 
            label: 'Last Sync', 
            value: stats?.status?.lastSync ? new Date(stats.status.lastSync).toLocaleTimeString() : '—', 
            icon: RefreshCw, 
            colorClass: 'amber' 
          },
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
            <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 800, marginTop: 8, marginBottom: 2 }}>{s.value}</div>
            <div className="stat-label" style={{ fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', fontSize: '0.75rem' }}>{s.label}</div>
            {s.subValue && (
              <div style={{ fontSize: '0.72rem', color: 'var(--brand-600)', fontWeight: 700, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span>☁️</span>
                <span>{s.subValue}</span>
              </div>
            )}
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
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const fetchSyncStatus = async () => {
    const t0 = performance.now();
    try {
      const res = await api.get('/sync/status');
      const latency = Math.round(performance.now() - t0);
      setSyncStatus({ ...res.data, latency });
    } catch {
      const latency = Math.round(performance.now() - t0);
      setSyncStatus({ online: false, latency, settingsSync: { status: 'offline' } });
    }
  };

  const testConnection = async () => {
    setPingTesting(true);
    setPingResult(null);
    const t0 = performance.now();
    try {
      const res = await api.get('/sync/status');
      const latency = Math.round(performance.now() - t0);
      setPingResult({ success: res.data.online, latency, data: res.data });
      setSyncStatus({ ...res.data, latency });
      if (res.data.online) {
        toast.success(`AWS Cloud is reachable! Latency: ${latency}ms`);
      } else {
        toast.error('AWS Cloud server responded with offline status.');
      }
    } catch (err) {
      const latency = Math.round(performance.now() - t0);
      setPingResult({ success: false, latency, error: err.message });
      toast.error('Could not reach AWS Cloud server.');
    } finally {
      setPingTesting(false);
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
                <label className="form-label">Portal UI / UX Design Version</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <UiInlineSwitcher size="md" />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Toggle between Nova Modern UI (clean glassmorphism design) and Classic Portal v2.
                </p>
              </div>
              <div className="divider" />
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
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Server size={18} color="var(--brand-600)" />
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>AWS Cloud Integration & Connection</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${syncStatus?.online ? 'badge-success' : 'badge-neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: syncStatus?.online ? '#10b981' : '#94a3b8' }} />
                    {syncStatus?.online ? `Online (${syncStatus.latency ? `${syncStatus.latency}ms` : 'Active'})` : 'Offline / Standalone'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={testConnection}
                    disabled={pingTesting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    <RefreshCw size={12} className={pingTesting ? 'spin' : ''} />
                    <span>{pingTesting ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ padding: '14px 16px', background: 'var(--grad-soft)', borderRadius: 12, border: '1px solid var(--violet-200)', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Configure the secure bridge between this offline desktop environment and your public AWS EC2 portal.
                  When you initiate a push or pull, Excel spreadsheets and system visibility preferences are securely synchronized over HTTPS/REST with end-to-end token validation.
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Live AWS Cloud Server URL</span>
                    <a
                      href={form.cloudSync?.serverUrl || 'http://16.59.47.134'}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.75rem', color: 'var(--brand-600)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      Open Live Portal <ExternalLink size={11} />
                    </a>
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      className="form-input" 
                      type="text" 
                      value={form.cloudSync?.serverUrl || 'http://16.59.47.134'} 
                      onChange={e => setForm(f => ({ ...f, cloudSync: { ...(f.cloudSync || {}), serverUrl: e.target.value } }))} 
                      placeholder="e.g. http://16.59.47.134" 
                      style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={testConnection}
                      disabled={pingTesting}
                      title="Ping this AWS Server URL"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    >
                      <Activity size={14} color="var(--brand-600)" />
                      <span>{pingTesting ? 'Pinging...' : 'Ping Server'}</span>
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    The public IP or hostname of your AWS EC2 instance running Grade Portal v2 backend.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Cloud Sync Authorization Secret Key</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        className="form-input" 
                        type={showSecretKey ? 'text' : 'password'} 
                        value={form.cloudSync?.secretKey || 'gradeportal-secure-cloud-sync-key-2026'} 
                        onChange={e => setForm(f => ({ ...f, cloudSync: { ...(f.cloudSync || {}), secretKey: e.target.value } }))} 
                        placeholder="Secret synchronization token" 
                        style={{ width: '100%', paddingRight: 40, fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title={showSecretKey ? 'Hide Secret Key' : 'Reveal Secret Key'}
                      >
                        {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const key = form.cloudSync?.secretKey || 'gradeportal-secure-cloud-sync-key-2026';
                        navigator.clipboard?.writeText(key);
                        setCopiedKey(true);
                        toast.success('Secret key copied to clipboard!');
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      title="Copy Secret Key"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    >
                      {copiedKey ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                    </button>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Shared bearer secret token (<code style={{ fontSize: '0.75rem', background: 'var(--bg-main)', padding: '2px 4px', borderRadius: 4 }}>x-sync-token</code>) required to authorize pushes/pulls between local and cloud nodes.
                  </p>
                </div>

                {/* Connection Telemetry Panel */}
                <div style={{
                  background: syncStatus?.online ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-input)',
                  border: `1px solid ${syncStatus?.online ? 'rgba(16, 185, 129, 0.25)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Wifi size={16} color={syncStatus?.online ? '#10b981' : 'var(--text-muted)'} />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>Live AWS Connection Telemetry</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Checked: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 4 }}>
                    <div style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Host Status</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: syncStatus?.online ? '#059669' : '#dc2626', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: syncStatus?.online ? '#10b981' : '#ef4444' }} />
                        {syncStatus?.online ? 'Online (AWS)' : 'Unreachable'}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Ping Roundtrip</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                        {syncStatus?.latency !== undefined ? `${syncStatus.latency} ms` : '—'}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Cloud Spreadsheets</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                        {syncStatus?.cloudInfo?.filesLoaded !== undefined ? `${syncStatus.cloudInfo.filesLoaded} Files` : (syncStatus?.online ? 'Loaded' : '—')}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Enrolled on Cloud</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                        {syncStatus?.cloudInfo?.studentsCount !== undefined ? `${syncStatus.cloudInfo.studentsCount} Students` : (syncStatus?.online ? 'Active' : '—')}
                      </div>
                    </div>
                  </div>
                </div>

                <button className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={handleSave} disabled={saving}>
                  {saving ? <><LoadingSpinner /> Saving...</> : <><ShieldCheck size={16} /> Save Cloud Settings</>}
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

// ─── Class Deletion Requests Page ──────────────────────────────────────────
function DeletionRequestsPage({ onRefreshPending }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending'); // 'pending' | 'all' | 'approved' | 'rejected'
  const [search, setSearch] = useState('');
  const [selectedApproveReq, setSelectedApproveReq] = useState(null);
  const [selectedRejectReq, setSelectedRejectReq] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);

  const approvePresets = [
    'Approved per teacher request',
    'Verified duplicate class record',
    'Curriculum schedule revised',
    'Empty class with 0 enrollments'
  ];

  const rejectPresets = [
    'Active grading term in progress',
    'Missing department head endorsement',
    'Students currently require grade viewing access',
    'Incorrect class file selected — please re-check'
  ];

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/deletion-requests');
      setRequests(res.data.requests || []);
      if (onRefreshPending) onRefreshPending();
    } catch {
      toast.error('Failed to load deletion requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async () => {
    if (!selectedApproveReq) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/deletion-requests/${selectedApproveReq.id}/approve`, {
        adminNote: adminNote.trim()
      });
      toast.success(res.data?.message || 'Class deleted and safely backed up.');
      setSelectedApproveReq(null);
      setAdminNote('');
      setSafetyConfirmed(false);
      loadRequests();
      window.dispatchEvent(new CustomEvent('deletion-requests-updated'));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve deletion.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRejectReq) return;
    if (!adminNote.trim()) {
      toast.error('Please provide a reason for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.post(`/admin/deletion-requests/${selectedRejectReq.id}/reject`, {
        adminNote: adminNote.trim()
      });
      toast.success(res.data?.message || 'Deletion request rejected.');
      setSelectedRejectReq(null);
      setAdminNote('');
      loadRequests();
      window.dispatchEvent(new CustomEvent('deletion-requests-updated'));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingList = requests.filter(r => r.status === 'pending');
  const approvedList = requests.filter(r => r.status === 'approved');
  const rejectedList = requests.filter(r => r.status === 'rejected');

  const filteredRequests = requests.filter(r => {
    if (tab === 'pending') return r.status === 'pending';
    if (tab === 'approved') return r.status === 'approved';
    if (tab === 'rejected') return r.status === 'rejected';
    return true; // 'all'
  }).filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.subject && r.subject.toLowerCase().includes(q)) ||
      (r.section && r.section.toLowerCase().includes(q)) ||
      (r.teacherName && r.teacherName.toLowerCase().includes(q)) ||
      (r.teacherId && r.teacherId.toLowerCase().includes(q)) ||
      (r.fileName && r.fileName.toLowerCase().includes(q)) ||
      (r.reason && r.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-content fade-in">
      {/* Top Header & Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Subject & Class Deletion Requests
            </h2>
            <span className="badge badge-brand" style={{ fontSize: '0.725rem', fontWeight: 700 }}>
              Audit-Controlled
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Verify, authorize, or decline teacher subject removal requests with automated safety backups.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadRequests}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          title="Refresh deletion request records"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh Records'}</span>
        </button>
      </div>

      {/* Security Safeguard Callout Banner */}
      <div className="del-security-banner">
        <div className="del-security-content">
          <div className="del-security-icon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="del-security-title">
              Dual-Authorization Academic Record Safeguard
            </div>
            <div className="del-security-text">
              To protect student academic data, teachers cannot delete classes unilaterally. All removals require administrator review. Approving a deletion automatically generates a permanent archive snapshot in <code style={{ background: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: '0.775rem' }}>Grades_History</code> before purging active rosters.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.775rem', fontWeight: 700, color: 'var(--brand-700)', background: 'rgba(255,255,255,0.85)', padding: '6px 14px', borderRadius: 999, border: '1px solid rgba(99,102,241,0.25)' }}>
          <span className="deletion-pulse-dot" style={{ background: '#10b981', boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.6)' }} />
          <span>Protection Active</span>
        </div>
      </div>

      {/* Interactive 4-Card Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {/* 1. Pending Approval Card */}
        <div
          className={`del-stat-card pending ${tab === 'pending' ? 'active' : ''}`}
          onClick={() => setTab('pending')}
          title="Click to view pending requests"
        >
          <div className="del-stat-top">
            <div className="del-stat-icon-box amber">
              <Clock size={20} />
            </div>
            <span className="del-stat-pill amber">
              {pendingList.length > 0 ? (
                <>
                  <span className="deletion-pulse-dot" />
                  <span>Action Needed</span>
                </>
              ) : (
                <span>All Clear</span>
              )}
            </span>
          </div>
          <div>
            <div className="del-stat-num" style={{ color: '#b45309' }}>
              {pendingList.length}
            </div>
            <div className="del-stat-label">Pending Approval</div>
            <div className="del-stat-desc">
              {pendingList.length === 1 ? '1 request requires review' : `${pendingList.length} requests awaiting review`}
            </div>
          </div>
        </div>

        {/* 2. Approved & Deleted Card */}
        <div
          className={`del-stat-card approved ${tab === 'approved' ? 'active' : ''}`}
          onClick={() => setTab('approved')}
          title="Click to view approved deletions"
        >
          <div className="del-stat-top">
            <div className="del-stat-icon-box emerald">
              <CheckCircle2 size={20} />
            </div>
            <span className="del-stat-pill emerald">
              <span>Archived</span>
            </span>
          </div>
          <div>
            <div className="del-stat-num" style={{ color: '#059669' }}>
              {approvedList.length}
            </div>
            <div className="del-stat-label">Approved & Deleted</div>
            <div className="del-stat-desc">Safely archived to backup</div>
          </div>
        </div>

        {/* 3. Rejected Requests Card */}
        <div
          className={`del-stat-card rejected ${tab === 'rejected' ? 'active' : ''}`}
          onClick={() => setTab('rejected')}
          title="Click to view rejected requests"
        >
          <div className="del-stat-top">
            <div className="del-stat-icon-box rose">
              <XCircle size={20} />
            </div>
            <span className="del-stat-pill rose">
              <span>Kept Active</span>
            </span>
          </div>
          <div>
            <div className="del-stat-num" style={{ color: '#dc2626' }}>
              {rejectedList.length}
            </div>
            <div className="del-stat-label">Rejected Requests</div>
            <div className="del-stat-desc">Returned to teacher active roster</div>
          </div>
        </div>

        {/* 4. Total Requests Card */}
        <div
          className={`del-stat-card total ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
          title="Click to view all requests"
        >
          <div className="del-stat-top">
            <div className="del-stat-icon-box indigo">
              <FileSpreadsheet size={20} />
            </div>
            <span className="del-stat-pill indigo">
              <span>Lifetime</span>
            </span>
          </div>
          <div>
            <div className="del-stat-num" style={{ color: 'var(--brand-700)' }}>
              {requests.length}
            </div>
            <div className="del-stat-label">Total Requests</div>
            <div className="del-stat-desc">Complete audit log records</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          {/* Segmented Tab Buttons */}
          <div className="tabs" style={{ margin: 0, gap: 6 }}>
            <button
              className={`tab-btn ${tab === 'pending' ? 'active' : ''}`}
              onClick={() => setTab('pending')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>Pending</span>
              <span className="badge" style={{
                background: tab === 'pending' ? 'white' : '#fef3c7',
                color: tab === 'pending' ? '#b45309' : '#92400e',
                fontSize: '0.7rem',
                padding: '1px 7px',
                fontWeight: 700
              }}>
                {pendingList.length}
              </span>
            </button>
            <button
              className={`tab-btn ${tab === 'approved' ? 'active' : ''}`}
              onClick={() => setTab('approved')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>Approved</span>
              <span className="badge" style={{
                background: tab === 'approved' ? 'white' : '#d1fae5',
                color: tab === 'approved' ? '#065f46' : '#047857',
                fontSize: '0.7rem',
                padding: '1px 7px',
                fontWeight: 700
              }}>
                {approvedList.length}
              </span>
            </button>
            <button
              className={`tab-btn ${tab === 'rejected' ? 'active' : ''}`}
              onClick={() => setTab('rejected')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>Rejected</span>
              <span className="badge" style={{
                background: tab === 'rejected' ? 'white' : '#fee2e2',
                color: tab === 'rejected' ? '#991b1b' : '#b91c1c',
                fontSize: '0.7rem',
                padding: '1px 7px',
                fontWeight: 700
              }}>
                {rejectedList.length}
              </span>
            </button>
            <button
              className={`tab-btn ${tab === 'all' ? 'active' : ''}`}
              onClick={() => setTab('all')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>All History</span>
              <span className="badge" style={{
                background: tab === 'all' ? 'white' : 'var(--bg-input)',
                color: tab === 'all' ? 'var(--brand-700)' : 'var(--text-secondary)',
                fontSize: '0.7rem',
                padding: '1px 7px',
                fontWeight: 700
              }}>
                {requests.length}
              </span>
            </button>
          </div>

          {/* Search Box with Clear Button */}
          <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input input-sm"
              placeholder="Search by subject, teacher, section..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, paddingRight: search ? 32 : 12, width: '100%' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Active Search / Filter Summary */}
        {search && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>
              Showing <strong>{filteredRequests.length}</strong> matching "{search}"
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setSearch('')}
              style={{ color: 'var(--brand-600)', fontSize: '0.775rem' }}
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* Requests List */}
      {loading ? (
        <div style={{ padding: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <LoadingSpinner size="lg" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading deletion requests...</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          {tab === 'pending' && !search ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.15)' }}>
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                All Caught Up — No Pending Deletions
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 460, margin: 0, lineHeight: 1.5 }}>
                There are currently no teacher deletion requests awaiting administrator approval. All subject and grade sheets remain active and secured.
              </p>
            </div>
          ) : tab === 'approved' && !search ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>No Approved Deletions</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                No classes have been deleted through the authorization workflow yet.
              </p>
            </div>
          ) : tab === 'rejected' && !search ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <XCircle size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>No Rejected Requests</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                No teacher deletion requests have been rejected.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-input)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Search size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>No Matching Records Found</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                {search ? `No deletion requests matched "${search}".` : 'No deletion records are available.'}
              </p>
              {search && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredRequests.map((req) => {
            const isPending = req.status === 'pending';
            const isApproved = req.status === 'approved';
            const isRejected = req.status === 'rejected';

            return (
              <div key={req.id} className={`deletion-request-card ${req.status}`}>
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                        {req.subject}
                      </h3>
                      {req.section && (
                        <span className="badge badge-brand" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          {req.section}
                        </span>
                      )}
                      {req.gradeLevel && (
                        <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                          {req.gradeLevel}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileSpreadsheet size={13} style={{ color: 'var(--brand-600)' }} />
                      <span>Spreadsheet:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {req.fileName}
                      </span>
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isPending && (
                      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.775rem', fontWeight: 700 }}>
                        <span className="deletion-pulse-dot" />
                        Pending Admin Approval
                      </span>
                    )}
                    {isApproved && (
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.775rem', fontWeight: 700 }}>
                        <CheckCircle2 size={14} />
                        Approved & Deleted
                      </span>
                    )}
                    {isRejected && (
                      <span className="badge badge-error" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.775rem', fontWeight: 700 }}>
                        <XCircle size={14} />
                        Request Rejected
                      </span>
                    )}
                    {req.status === 'cancelled' && (
                      <span className="badge badge-neutral" style={{ padding: '6px 14px', fontSize: '0.775rem', fontWeight: 700 }}>
                        Cancelled by Teacher
                      </span>
                    )}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="deletion-meta-grid">
                  <div className="deletion-meta-item">
                    <span className="deletion-meta-label">
                      <User size={12} /> Requested By
                    </span>
                    <span className="deletion-meta-value">
                      {req.teacherName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({req.teacherId})</span>
                    </span>
                  </div>
                  <div className="deletion-meta-item">
                    <span className="deletion-meta-label">
                      <Users size={12} /> Students Impacted
                    </span>
                    <span className="deletion-meta-value">
                      {req.studentCount || 0} Enrolled
                    </span>
                  </div>
                  <div className="deletion-meta-item">
                    <span className="deletion-meta-label">
                      <Calendar size={12} /> Date Submitted
                    </span>
                    <span className="deletion-meta-value">
                      {req.createdAt ? new Date(req.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  {req.reviewedAt && (
                    <div className="deletion-meta-item">
                      <span className="deletion-meta-label">
                        <Shield size={12} /> Reviewed Date
                      </span>
                      <span className="deletion-meta-value">
                        {new Date(req.reviewedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Teacher's Stated Reason Box */}
                <div className="deletion-reason-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4, fontSize: '0.825rem' }}>
                    <MessageSquare size={14} style={{ color: 'var(--brand-600)' }} />
                    <span>Teacher's Stated Justification:</span>
                  </div>
                  <div style={{ fontStyle: 'italic', color: 'var(--text-main)', paddingLeft: 20, fontSize: '0.875rem' }}>
                    "{req.reason || 'No justification provided by teacher'}"
                  </div>
                </div>

                {/* Admin Note if already reviewed */}
                {req.adminNote && !isPending && (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: isApproved ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${isApproved ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                    fontSize: '0.825rem'
                  }}>
                    <strong style={{ color: isApproved ? '#065f46' : '#991b1b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Shield size={14} /> Administrator Decision Note:
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{req.adminNote}</span>
                  </div>
                )}

                {/* Action Buttons (For Pending Requests) */}
                {isPending && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 18,
                    borderTop: '1px solid var(--border)',
                    paddingTop: 16,
                    flexWrap: 'wrap',
                    gap: 12
                  }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Requires administrator decision before file removal.
                    </span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedRejectReq(req);
                          setAdminNote('');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      >
                        <XCircle size={14} />
                        <span>Reject Request</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setSelectedApproveReq(req);
                          setAdminNote('Approved per teacher request');
                          setSafetyConfirmed(false);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Trash2 size={14} />
                        <span>Approve & Delete Class</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Approve & Delete Modal */}
      {selectedApproveReq && (
        <Modal
          open={!!selectedApproveReq}
          onClose={() => { if (!actionLoading) setSelectedApproveReq(null); }}
          title="Confirm Class Deletion Authorization"
          size="md"
        >
          <div style={{ padding: '4px 0' }}>
            {/* Warning & Backup Hero Notice */}
            <div style={{
              padding: 16,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.12) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 14,
              marginBottom: 20,
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.18)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={22} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.975rem', color: '#991b1b', marginBottom: 4 }}>
                  Permanent Removal from Active Roster
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                  Authorizing will purge <strong>{selectedApproveReq.fileName}</strong> from active portal data. All {selectedApproveReq.studentCount || 0} student grade records for this class will be cleared.
                  <br />
                  <span style={{ color: '#065f46', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, background: '#d1fae5', padding: '3px 8px', borderRadius: 6 }}>
                    ✓ Automated Safety Backup: A timestamped copy will be archived to Grades_History.
                  </span>
                </div>
              </div>
            </div>

            {/* Target Class Info */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '14px 16px',
              marginBottom: 18,
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target Subject:</span>
                <strong>{selectedApproveReq.subject} {selectedApproveReq.section ? `(${selectedApproveReq.section})` : ''}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Instructor:</span>
                <span>{selectedApproveReq.teacherName} ({selectedApproveReq.teacherId})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Students Affected:</span>
                <span style={{ color: '#b91c1c', fontWeight: 700 }}>{selectedApproveReq.studentCount || 0} Students</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Teacher's Reason:</span>
                <span style={{ fontStyle: 'italic', maxWidth: '65%', textAlign: 'right' }}>"{selectedApproveReq.reason}"</span>
              </div>
            </div>

            {/* Quick Presets for Admin Note */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Quick Preset Remarks:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {approvePresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`quick-reason-chip ${adminNote === preset ? 'selected' : ''}`}
                    onClick={() => setAdminNote(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin Note Input */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Administrator Decision Remarks
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Approved and verified duplicate class"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Safety Confirmation Checkbox */}
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 14px',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 10,
              cursor: 'pointer',
              marginBottom: 20
            }}>
              <input
                type="checkbox"
                checked={safetyConfirmed}
                onChange={e => setSafetyConfirmed(e.target.checked)}
                style={{ width: 17, height: 17, marginTop: 2, cursor: 'pointer', accentColor: '#ef4444' }}
              />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                I authorize the permanent deletion of <strong>{selectedApproveReq.fileName}</strong> and understand that its active grade records will be removed from student portals.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedApproveReq(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleApprove}
                disabled={actionLoading || !safetyConfirmed}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {actionLoading ? <LoadingSpinner size="sm" /> : <Trash2 size={15} />}
                <span>{actionLoading ? 'Deleting Class...' : 'Authorize & Purge Class'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Reject Deletion Modal */}
      {selectedRejectReq && (
        <Modal
          open={!!selectedRejectReq}
          onClose={() => { if (!actionLoading) setSelectedRejectReq(null); }}
          title="Decline Class Deletion Request"
          size="md"
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{
              padding: 14,
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: 12,
              marginBottom: 18,
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              Rejecting this request will keep <strong>"{selectedRejectReq.subject}"</strong> active in the teacher's dashboard and maintain student grade records intact.
            </div>

            {/* Quick Preset Rejection Reasons */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Quick Select Rejection Reason:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {rejectPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`quick-reason-chip ${adminNote === preset ? 'selected' : ''}`}
                    onClick={() => setAdminNote(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Rejection Explanation for Teacher <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Explain why this deletion cannot be approved at this time..."
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
                required
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                This explanation will be visible to the instructor in their class records.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedRejectReq(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReject}
                disabled={actionLoading || !adminNote.trim()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderColor: '#ef4444', color: '#dc2626' }}
              >
                {actionLoading ? <LoadingSpinner size="sm" /> : <XCircle size={15} />}
                <span>{actionLoading ? 'Rejecting...' : 'Confirm Rejection'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const page = location.pathname.replace('/admin', '').replace('/', '') || 'overview';
  const [pendingDeletionsCount, setPendingDeletionsCount] = useState(0);

  const loadPendingDeletions = async () => {
    try {
      const res = await api.get('/admin/deletion-requests');
      setPendingDeletionsCount(res.data.pendingCount || 0);
    } catch {}
  };

  useEffect(() => {
    loadPendingDeletions();
    const handleUpdate = () => loadPendingDeletions();
    window.addEventListener('deletion-requests-updated', handleUpdate);
    window.addEventListener('grades-synced', handleUpdate);
    return () => {
      window.removeEventListener('deletion-requests-updated', handleUpdate);
      window.removeEventListener('grades-synced', handleUpdate);
    };
  }, []);

  const nav = [
    { type: 'section', label: 'Dashboard' },
    { icon: LayoutDashboard, label: 'Overview', active: page === 'overview' || page === '', onClick: () => navigate('/admin') },
    {
      icon: Trash2,
      label: 'Deletion Requests',
      shortLabel: 'Requests',
      active: page === 'deletion-requests',
      badge: pendingDeletionsCount > 0 ? pendingDeletionsCount : null,
      onClick: () => navigate('/admin/deletion-requests')
    },
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
        <Route path="/deletion-requests" element={<><PageHeader title="Class Deletion Requests" subtitle="Review and authorize subject/class deletion requests submitted by teachers" /><DeletionRequestsPage onRefreshPending={loadPendingDeletions} /></>} />
        <Route path="/teachers" element={<><PageHeader title="Teacher Management" subtitle="Add, edit, and manage teacher accounts" /><TeachersPage /></>} />
        <Route path="/students" element={<><PageHeader title="Students Overview" subtitle="View and manage students" /><div className="page-content fade-in"><div className="card"><div className="card-header"><h3 style={{ fontSize: '1rem' }}>Students Overview</h3></div><StudentsOverview /></div></div></>} />
        <Route path="/templates" element={<><PageHeader title="Grade Templates" subtitle="Manage Excel grade sheet templates for teachers" /><TemplatesPage /></>} />
        <Route path="/settings" element={<><PageHeader title="Settings" subtitle="Configure portal settings and visibility" /><SettingsPage /></>} />
      </Routes>
    </AppLayout>
  );
}
