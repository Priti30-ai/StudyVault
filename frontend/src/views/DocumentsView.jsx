import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatBytes, formatDate, getCategoryBadgeClass } from '../utils/formatters.js';
import {
  Search,
  Filter,
  Star,
  Download,
  Trash2,
  Edit3,
  FileText,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Tag
} from 'lucide-react';

const CATEGORIES = [
  'All Categories',
  'Notes',
  'Assignment',
  'Question Paper',
  'Practical',
  'PPT',
  'Reference',
  'Other'
];

const SEMESTERS = ['All Semesters', 'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];

export const DocumentsView = ({ onOpenUpload, onOpenEdit }) => {
  const { showToast } = useToast();

  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedSemester, setSelectedSemester] = useState('All Semesters');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const fetchDocuments = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 12
      };

      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory !== 'All Categories') params.category = selectedCategory;
      if (selectedSemester !== 'All Semesters') params.semester = selectedSemester;
      if (favoriteOnly) params.favorite = true;

      const res = await api.documents.list(params);
      if (res.success && res.data) {
        setDocuments(res.data.documents || []);
        setPagination(res.data.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedSemester, favoriteOnly, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  const handleDownload = async (docId, fileName) => {
    try {
      setDownloadingId(docId);
      const res = await api.documents.getDownloadUrl(docId);
      if (res.success && res.data?.downloadUrl) {
        const link = document.createElement('a');
        link.href = res.data.downloadUrl;
        link.download = fileName || 'document';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Presigned S3 download initiated!', 'success');
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
        fetchDocuments(pagination.page);
      }
    } catch (err) {
      showToast(err.message || 'Failed to toggle favorite', 'error');
    }
  };

  const handleDelete = async (docId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This will permanently delete the binary file from S3 and metadata from MongoDB.`)) {
      return;
    }
    try {
      const res = await api.documents.delete(docId);
      if (res.success) {
        showToast('Document deleted successfully', 'success');
        fetchDocuments(pagination.page);
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete document', 'error');
    }
  };

  return (
    <div>
      {/* View Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Document Vault
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Browse, search, and download your academic notes directly from AWS S3
          </p>
        </div>
        <button className="btn btn-primary" onClick={onOpenUpload}>
          <UploadCloud size={16} />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'space-between'
        }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.4rem' }}
              placeholder="Search by file name, subject, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Dropdown */}
          <div style={{ minWidth: '150px' }}>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Semester Dropdown */}
          <div style={{ minWidth: '140px' }}>
            <select
              className="form-select"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              {SEMESTERS.map((sem) => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* Starred Filter Button */}
          <button
            className={`btn ${favoriteOnly ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.9rem' }}
          >
            <Star size={15} fill={favoriteOnly ? '#fbbf24' : 'none'} color={favoriteOnly ? '#fbbf24' : 'currentColor'} />
            <span>Starred</span>
          </button>

          {/* View Toggle */}
          <div style={{ display: 'flex', gap: '0.35rem', background: '#0b1329', padding: '0.2rem', borderRadius: '8px' }}>
            <button
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                background: viewMode === 'grid' ? '#1e293b' : 'transparent',
                color: viewMode === 'grid' ? '#f8fafc' : '#64748b'
              }}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                background: viewMode === 'list' ? '#1e293b' : 'transparent',
                color: viewMode === 'list' ? '#f8fafc' : '#64748b'
              }}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Documents Grid / List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <div style={{
            width: '36px',
            height: '36px',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }} />
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading documents from MongoDB Atlas...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <FileText size={48} color="#6366f1" style={{ margin: '0 auto 1rem auto', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Documents Found</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
            {searchTerm || selectedCategory !== 'All Categories' || favoriteOnly
              ? 'No documents matched your filters. Try clearing your search query or category filter.'
              : 'You have not uploaded any study materials yet. Upload your first document to secure it in AWS S3.'}
          </p>
          <button className="btn btn-primary" onClick={onOpenUpload}>
            <UploadCloud size={16} />
            <span>Upload Document Now</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}>
          {documents.map((doc) => {
            const docId = doc.id || doc._id;
            return (
              <div
                key={docId}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.25rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className={getCategoryBadgeClass(doc.category)}>
                      {doc.category}
                    </span>
                    <button
                      className={`btn-icon ${doc.isFavorite ? 'active' : ''}`}
                      onClick={() => handleToggleFavorite(docId)}
                      title={doc.isFavorite ? 'Remove star' : 'Star document'}
                      style={{ width: '30px', height: '30px' }}
                    >
                      <Star size={14} fill={doc.isFavorite ? '#f59e0b' : 'none'} />
                    </button>
                  </div>

                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      marginBottom: '0.35rem',
                      wordBreak: 'break-word',
                      lineHeight: 1.3
                    }}
                    title={doc.originalFileName}
                  >
                    {doc.originalFileName}
                  </h3>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>{doc.subject}</span>
                    <span>•</span>
                    <span>{doc.semester}</span>
                    <span>•</span>
                    <span>{formatBytes(doc.fileSize)}</span>
                  </div>

                  {/* Tags */}
                  {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.45rem',
                            background: 'rgba(30, 41, 59, 0.7)',
                            borderRadius: '6px',
                            color: '#cbd5e1'
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div style={{
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {formatDate(doc.uploadedAt)}
                  </span>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      className="btn-icon"
                      onClick={() => onOpenEdit(doc)}
                      title="Edit metadata"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDownload(docId, doc.originalFileName)}
                      disabled={downloadingId === docId}
                      title="Download from AWS S3"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(docId, doc.originalFileName)}
                      title="Delete document"
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Trash2 size={14} color="#f87171" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Document</th>
                <th style={{ padding: '0.85rem 1rem' }}>Category</th>
                <th style={{ padding: '0.85rem 1rem' }}>Subject</th>
                <th style={{ padding: '0.85rem 1rem' }}>Semester</th>
                <th style={{ padding: '0.85rem 1rem' }}>Size</th>
                <th style={{ padding: '0.85rem 1rem' }}>Uploaded</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const docId = doc.id || doc._id;
                return (
                  <tr key={docId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{doc.originalFileName}</td>
                    <td style={{ padding: '0.85rem 1rem' }}><span className={getCategoryBadgeClass(doc.category)}>{doc.category}</span></td>
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>{doc.subject}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>{doc.semester}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#94a3b8' }}>{formatBytes(doc.fileSize)}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.78rem' }}>{formatDate(doc.uploadedAt)}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button className="btn-icon" onClick={() => handleToggleFavorite(docId)} style={{ width: '30px', height: '30px' }}>
                          <Star size={13} fill={doc.isFavorite ? '#f59e0b' : 'none'} />
                        </button>
                        <button className="btn-icon" onClick={() => onOpenEdit(doc)} style={{ width: '30px', height: '30px' }}>
                          <Edit3 size={13} />
                        </button>
                        <button className="btn-icon" onClick={() => handleDownload(docId, doc.originalFileName)} disabled={downloadingId === docId} style={{ width: '30px', height: '30px' }}>
                          <Download size={13} />
                        </button>
                        <button className="btn-icon" onClick={() => handleDelete(docId, doc.originalFileName)} style={{ width: '30px', height: '30px' }}>
                          <Trash2 size={13} color="#f87171" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            className="btn btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() => fetchDocuments(pagination.page - 1)}
            style={{ padding: '0.5rem 0.9rem' }}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} documents)
          </span>

          <button
            className="btn btn-secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchDocuments(pagination.page + 1)}
            style={{ padding: '0.5rem 0.9rem' }}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentsView;
