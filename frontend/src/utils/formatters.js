/**
 * Formatting utilities for StudyVault
 */

export const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

export const getCategoryBadgeClass = (category) => {
  switch (category?.toLowerCase()) {
    case 'notes': return 'badge badge-notes';
    case 'assignment': return 'badge badge-assignment';
    case 'question paper': return 'badge badge-question-paper';
    case 'practical': return 'badge badge-practical';
    case 'ppt': return 'badge badge-ppt';
    case 'reference': return 'badge badge-reference';
    default: return 'badge badge-other';
  }
};

export const getActionColor = (action) => {
  switch (action) {
    case 'UPLOAD': return { color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', text: 'Uploaded' };
    case 'DOWNLOAD': return { color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', text: 'Downloaded' };
    case 'UPDATE': return { color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', text: 'Updated' };
    case 'DELETE': return { color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', text: 'Deleted' };
    case 'FAVORITE': return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)', text: 'Favorited' };
    case 'UNFAVORITE': return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', text: 'Unfavorited' };
    default: return { color: '#cbd5e1', bg: 'rgba(148, 163, 184, 0.15)', text: action };
  }
};
