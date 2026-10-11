import React, { useState, useRef } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatBytes } from '../utils/formatters.js';
import { X, UploadCloud, File, AlertCircle, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  'Notes',
  'Assignment',
  'Question Paper',
  'Practical',
  'PPT',
  'Reference',
  'Other'
];

export const UploadModal = ({ isOpen, onClose, onUploaded }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('Sem 1');
  const [category, setCategory] = useState('Notes');
  const [tags, setTags] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = (selectedFile) => {
    setError('');
    // 10 MB limit check
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File exceeds the 10 MB maximum upload limit.');
      return;
    }
    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select or drop a file to upload');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required (e.g., DBMS, Cloud Computing)');
      return;
    }

    if (!semester.trim()) {
      setError('Semester is required');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject', subject.trim());
    formData.append('semester', semester.trim());
    formData.append('category', category);
    if (tags.trim()) {
      formData.append('tags', tags.trim());
    }

    setUploading(true);
    try {
      const res = await api.documents.upload(formData);
      if (res.success) {
        showToast('Document uploaded successfully to private AWS S3!', 'success');
        if (onUploaded) onUploaded(res.data.document);
        // Reset form
        setFile(null);
        setSubject('');
        setTags('');
        onClose();
      }
    } catch (err) {
      setError(err.message || 'File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Upload Academic Document</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Files are securely stored in private AWS S3 (Sydney region)
            </p>
          </div>
          <button className="btn-icon" onClick={onClose} disabled={uploading}>
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
          {/* Dropzone */}
          <div
            className={`dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ marginBottom: '1.25rem' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
              disabled={uploading}
            />

            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                <CheckCircle2 size={28} color="#34d399" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{file.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatBytes(file.size)}</div>
                </div>
              </div>
            ) : (
              <div>
                <UploadCloud size={36} color="#818cf8" style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  Click to choose a file or drag & drop here
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Supported formats: PDF, DOCX, PPT, TXT, Images (Max: 10 MB)
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Cloud Computing"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={uploading}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select
                className="form-select"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={uploading}
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
              disabled={uploading}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tags (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. s3, ec2, exam, unit1 (comma-separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={uploading}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
            >
              {uploading ? 'Uploading to S3...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
