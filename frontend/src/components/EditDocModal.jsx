import React, { useState, useEffect } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { X, AlertCircle } from 'lucide-react';

const CATEGORIES = [
  'Notes',
  'Assignment',
  'Question Paper',
  'Practical',
  'PPT',
  'Reference',
  'Other'
];

export const EditDocModal = ({ isOpen, document, onClose, onUpdated }) => {
  const { showToast } = useToast();

  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('Sem 1');
  const [category, setCategory] = useState('Notes');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (document) {
      setFileName(document.originalFileName || '');
      setSubject(document.subject || '');
      setSemester(document.semester || 'Sem 1');
      setCategory(document.category || 'Notes');
      setTags(Array.isArray(document.tags) ? document.tags.join(', ') : '');
    }
  }, [document]);

  if (!isOpen || !document) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fileName.trim()) {
      setError('File name cannot be empty');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }

    setSaving(true);
    try {
      const res = await api.documents.update(document.id || document._id, {
        originalFileName: fileName.trim(),
        subject: subject.trim(),
        semester: semester.trim(),
        category,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean)
      });

      if (res.success) {
        showToast('Document metadata updated successfully!', 'success');
        if (onUpdated) onUpdated(res.data.document);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Edit Document Details</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Update metadata stored in MongoDB Atlas
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">File Display Name *</label>
            <input
              type="text"
              className="form-input"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={saving}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input
                type="text"
                className="form-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={saving}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select
                className="form-select"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={saving}
              >
                {['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'].map((sem) => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Category *</label>
            <select
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tags (comma-separated)</label>
            <input
              type="text"
              className="form-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={saving}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditDocModal;
