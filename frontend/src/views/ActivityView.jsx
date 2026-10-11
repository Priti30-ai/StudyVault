import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatDate, getActionColor } from '../utils/formatters.js';
import { History, Filter, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

const ACTIONS = ['ALL', 'UPLOAD', 'DOWNLOAD', 'UPDATE', 'DELETE', 'FAVORITE', 'UNFAVORITE'];

export const ActivityView = () => {
  const { showToast } = useToast();
  const [activities, setActivities] = useState([]);
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 15
      };
      if (selectedAction !== 'ALL') {
        params.action = selectedAction;
      }

      const res = await api.activity.list(params);
      if (res.success && res.data) {
        setActivities(res.data.activities || []);
        setPagination(res.data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch activity log', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedAction, showToast]);

  useEffect(() => {
    fetchActivities(1);
  }, [fetchActivities]);

  return (
    <div>
      {/* View Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Activity & Audit Log
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Real-time tracking of file uploads, S3 downloads, metadata updates, and deletions
        </p>
      </div>

      {/* Action Filter Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        marginBottom: '1.5rem'
      }}>
        {ACTIONS.map((action) => {
          const isActive = selectedAction === action;
          return (
            <button
              key={action}
              className="btn"
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                borderRadius: '999px',
                background: isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(30, 41, 59, 0.6)',
                color: isActive ? '#ffffff' : '#94a3b8',
                border: `1px solid ${isActive ? 'rgba(99, 102, 241, 0.5)' : 'var(--border-subtle)'}`,
                boxShadow: isActive ? '0 2px 10px rgba(99, 102, 241, 0.3)' : 'none'
              }}
              onClick={() => setSelectedAction(action)}
            >
              {action}
            </button>
          );
        })}
      </div>

      {/* Activity Table */}
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
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading activity logs...</p>
        </div>
      ) : activities.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Clock size={44} color="#64748b" style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.4rem' }}>No Activity Recorded</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            No actions recorded matching the "{selectedAction}" filter.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.6)', color: '#94a3b8' }}>
                <th style={{ padding: '0.85rem 1.25rem' }}>Action</th>
                <th style={{ padding: '0.85rem 1.25rem' }}>Document File</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => {
                const actId = act.id || act._id;
                const actMeta = getActionColor(act.action);
                return (
                  <tr key={actId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        color: actMeta.color,
                        background: actMeta.bg,
                        letterSpacing: '0.03em'
                      }}>
                        {act.action}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>
                      {act.fileName}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>
                      {formatDate(act.createdAt)}
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
            onClick={() => fetchActivities(pagination.page - 1)}
            style={{ padding: '0.5rem 0.9rem' }}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} events)
          </span>

          <button
            className="btn btn-secondary"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchActivities(pagination.page + 1)}
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

export default ActivityView;
