import React, { useState, useEffect } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatBytes, formatDate, getCategoryBadgeClass, getActionColor } from '../utils/formatters.js';
import {
  FileText,
  HardDrive,
  Star,
  UploadCloud,
  Download,
  Trash2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag
} from 'lucide-react';

export const DashboardView = ({ onOpenUpload, onNavigateToDocs, onNavigateToActivity }) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.dashboard.getStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load dashboard statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDownload = async (docId, fileName) => {
    try {
      setDownloadingId(docId);
      const res = await api.documents.getDownloadUrl(docId);
      if (res.success && res.data?.downloadUrl) {
        // Open or trigger temporary presigned S3 download link
        const link = document.createElement('a');
        link.href = res.data.downloadUrl;
        link.download = fileName || 'document';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Downloading from AWS S3...`, 'success');
      }
    } catch (err) {
      showToast(err.message || 'Failed to generate download URL', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleToggleFavorite = async (docId) => {
    try {
      const res = await api.documents.toggleFavorite(docId);
      if (res.success) {
        showToast(res.message, 'success');
        fetchStats();
      }
    } catch (err) {
      showToast(err.message || 'Failed to toggle favorite', 'error');
    }
  };

  const handleDelete = async (docId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This will permanently delete the file from AWS S3 and MongoDB.`)) {
      return;
    }
    try {
      const res = await api.documents.delete(docId);
      if (res.success) {
        showToast('Document deleted from AWS S3 & MongoDB', 'success');
        fetchStats();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete document', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1.5rem auto'
        }} />
        <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Loading StudyVault cloud metrics from EC2...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const overview = stats?.overview || { totalDocuments: 0, totalStorageBytes: 0, totalFavorites: 0 };
  const byCategory = stats?.byCategory || [];
  const bySubject = stats?.bySubject || [];
  const recentDocs = stats?.recentDocuments || [];
  const recentActivities = stats?.recentActivity || [];

  return (
    <div>
      {/* Top Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Academic Workspace Dashboard
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Multi-tenant student document repository backed by AWS S3 (Sydney) & MongoDB Atlas
          </p>
        </div>
        <button className="btn btn-primary" onClick={onOpenUpload}>
          <UploadCloud size={16} />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <FileText size={26} />
          </div>
          <div>
            <div className="stat-val">{overview.totalDocuments}</div>
            <div className="stat-label">Total Documents</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' }}>
            <HardDrive size={26} />
          </div>
          <div>
            <div className="stat-val">{formatBytes(overview.totalStorageBytes)}</div>
            <div className="stat-label">Private S3 Storage Used</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Star size={26} />
          </div>
          <div>
            <div className="stat-val">{overview.totalFavorites}</div>
            <div className="stat-label">Starred Documents</div>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Category Breakdown */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Documents by Category</h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{byCategory.length} Categories</span>
          </div>

          {byCategory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b', fontSize: '0.85rem' }}>
              No categories recorded yet. Upload a document to start organizing.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {byCategory.map((cat) => {
                const percent = overview.totalDocuments > 0
                  ? Math.round((cat.count / overview.totalDocuments) * 100)
                  : 0;
                return (
                  <div key={cat.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      <span className={getCategoryBadgeClass(cat.category)}>{cat.category}</span>
                      <span style={{ fontWeight: 600 }}>{cat.count} doc{cat.count > 1 ? 's' : ''} ({percent}%)</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                        borderRadius: '999px'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Subjects */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Top Subjects</h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{bySubject.length} Subjects</span>
          </div>

          {bySubject.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b', fontSize: '0.85rem' }}>
              No subjects registered yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {bySubject.map((sub) => (
                <div
                  key={sub.subject}
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Tag size={13} color="#818cf8" />
                  <span style={{ fontWeight: 600 }}>{sub.subject}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'rgba(99, 102, 241, 0.2)',
                    color: '#a5b4fc',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '999px'
                  }}>
                    {sub.count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Cloud architecture security badge */}
          <div style={{
            marginTop: '1.5rem',
            padding: '0.85rem 1rem',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <ShieldCheck size={20} color="#34d399" />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>AWS IAM Protected: </span>
              All uploads write directly to private S3 bucket <code style={{ color: '#a5b4fc' }}>studyvault-priti-documents-2026</code>.
            </div>
          </div>
        </div>
      </div>

      {/* Recent Documents & Activity Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Documents */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent Documents</h3>
            <button
              onClick={onNavigateToDocs}
              style={{
                background: 'none',
                border: 'none',
                color: '#818cf8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>View All</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {recentDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <FileText size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem' }}>No documents uploaded yet.</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '1rem', fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                onClick={onOpenUpload}
              >
                Upload First Note
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentDocs.map((doc) => {
                const docId = doc.id || doc._id;
                return (
                  <div
                    key={docId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(30, 41, 59, 0.45)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      transition: 'border-color var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#818cf8',
                        flexShrink: 0
                      }}>
                        <FileText size={18} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '220px'
                        }}>
                          {doc.originalFileName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                          <span className={getCategoryBadgeClass(doc.category)} style={{ fontSize: '0.65rem' }}>
                            {doc.category}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{doc.subject}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>• {formatBytes(doc.fileSize)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                      <button
                        className={`btn-icon ${doc.isFavorite ? 'active' : ''}`}
                        onClick={() => handleToggleFavorite(docId)}
                        title={doc.isFavorite ? 'Starred' : 'Star document'}
                      >
                        <Star size={15} fill={doc.isFavorite ? '#f59e0b' : 'none'} />
                      </button>

                      <button
                        className="btn-icon"
                        onClick={() => handleDownload(docId, doc.originalFileName)}
                        disabled={downloadingId === docId}
                        title="Download securely from AWS S3"
                      >
                        <Download size={15} />
                      </button>

                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(docId, doc.originalFileName)}
                        title="Delete document"
                      >
                        <Trash2 size={15} color="#f87171" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent Activity</h3>
            <button
              onClick={onNavigateToActivity}
              style={{
                background: 'none',
                border: 'none',
                color: '#818cf8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>Audit Log</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
              <Clock size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem' }}>No activity logged yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentActivities.map((act) => {
                const actId = act.id || act._id;
                const actMeta = getActionColor(act.action);
                return (
                  <div
                    key={actId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: 'rgba(30, 41, 59, 0.45)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          color: actMeta.color,
                          background: actMeta.bg,
                          flexShrink: 0
                        }}
                      >
                        {act.action}
                      </span>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '240px'
                      }}>
                        {act.fileName}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>
                      {formatDate(act.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
