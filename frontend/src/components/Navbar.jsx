import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';
import {
  FolderKanban,
  LayoutDashboard,
  FileText,
  History,
  UploadCloud,
  LogOut,
  LogIn,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const Navbar = ({ currentTab, setCurrentTab, onOpenUpload, onOpenAuth }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [apiHealthy, setApiHealthy] = useState(null);

  useEffect(() => {
    // Check backend API health status on mount
    api.health
      .check()
      .then((res) => setApiHealthy(res.success))
      .catch(() => setApiHealthy(false));
  }, []);

  return (
    <header className="navbar">
      <div className="nav-container">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); setCurrentTab('dashboard'); }}>
            <div className="brand-icon-box">
              <FolderKanban size={22} color="#ffffff" />
            </div>
            <span>Study<span style={{ color: '#818cf8' }}>Vault</span></span>
          </a>
          <span className="brand-badge">AWS Cloud</span>

          {/* Backend API Live Status */}
          <div
            title={`Backend EC2 API: ${apiHealthy === true ? 'Healthy & Connected' : apiHealthy === false ? 'Unreachable' : 'Checking...'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              color: apiHealthy ? '#34d399' : '#f87171',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: apiHealthy ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${apiHealthy ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
            }}
          >
            {apiHealthy ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            <span>{apiHealthy ? 'API Online' : 'API Connecting...'}</span>
          </div>
        </div>

        {/* Tab Navigation (when authenticated) */}
        {isAuthenticated && (
          <nav className="nav-tabs">
            <button
              className={`nav-tab-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentTab('dashboard')}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
            <button
              className={`nav-tab-btn ${currentTab === 'documents' ? 'active' : ''}`}
              onClick={() => setCurrentTab('documents')}
            >
              <FileText size={16} />
              <span>Documents</span>
            </button>
            <button
              className={`nav-tab-btn ${currentTab === 'activity' ? 'active' : ''}`}
              onClick={() => setCurrentTab('activity')}
            >
              <History size={16} />
              <span>Activity</span>
            </button>
          </nav>
        )}

        {/* Right Actions */}
        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              <button className="btn btn-primary" onClick={onOpenUpload}>
                <UploadCloud size={16} />
                <span>Upload</span>
              </button>

              <div className="user-badge-chip">
                <div className="avatar-circle">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user?.name}</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{user?.email}</span>
                </div>
              </div>

              <button className="btn-icon" onClick={logout} title="Sign Out">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onOpenAuth}>
              <LogIn size={16} />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
