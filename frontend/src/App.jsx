import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import Navbar from './components/Navbar.jsx';
import AuthModal from './components/AuthModal.jsx';
import UploadModal from './components/UploadModal.jsx';
import EditDocModal from './components/EditDocModal.jsx';
import DashboardView from './views/DashboardView.jsx';
import DocumentsView from './views/DocumentsView.jsx';
import ActivityView from './views/ActivityView.jsx';
import {
  FolderKanban,
  ShieldCheck,
  HardDrive,
  Lock,
  Layers,
  ArrowRight,
  Server,
  Database,
  Cloud
} from 'lucide-react';

const MainContent = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard', 'documents', 'activity'
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  if (isLoading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '44px',
            height: '44px',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.25rem auto'
          }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>StudyVault</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Authenticating with AWS EC2...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="content-wrapper">
        {isAuthenticated ? (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                onOpenUpload={() => setIsUploadOpen(true)}
                onNavigateToDocs={() => setCurrentTab('documents')}
                onNavigateToActivity={() => setCurrentTab('activity')}
              />
            )}
            {currentTab === 'documents' && (
              <DocumentsView
                onOpenUpload={() => setIsUploadOpen(true)}
                onOpenEdit={(doc) => setEditingDoc(doc)}
              />
            )}
            {currentTab === 'activity' && (
              <ActivityView />
            )}
          </>
        ) : (
          /* Unauthenticated Landing Hero */
          <div style={{ padding: '3rem 0', maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              color: '#a5b4fc',
              fontWeight: 600,
              marginBottom: '1.5rem'
            }}>
              <Cloud size={14} />
              <span>Cloud-Native Academic Management System</span>
            </div>

            <h1 style={{
              fontSize: '3rem',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '1.25rem'
            }}>
              Your Academic Notes & Documents,{' '}
              <span style={{
                background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Secured on AWS Cloud
              </span>
            </h1>

            <p style={{
              fontSize: '1.1rem',
              color: '#94a3b8',
              lineHeight: 1.6,
              maxWidth: '680px',
              margin: '0 auto 2.5rem auto'
            }}>
              StudyVault provides students with a private, scalable vault to upload, search, and access syllabus notes, past question papers, and assignments backed by Amazon S3 & MongoDB Atlas.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '4rem' }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: '1rem', padding: '0.85rem 1.85rem' }}
                onClick={() => setIsAuthOpen(true)}
              >
                <span>Get Started / Sign In</span>
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Feature Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.5rem',
              textAlign: 'left'
            }}>
              <div className="card">
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', marginBottom: '1rem' }}>
                  <HardDrive size={20} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>AWS S3 Private Storage</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Binary files stay 100% private in Sydney region (<code style={{ color: '#a5b4fc' }}>ap-southeast-2</code>) and are served via temporary expiring presigned URLs.
                </p>
              </div>

              <div className="card">
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: '1rem' }}>
                  <Database size={20} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>MongoDB Atlas Cloud</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Student profiles, metadata, categories, semesters, and search indexes are stored and strictly tenant-isolated in MongoDB Atlas.
                </p>
              </div>

              <div className="card">
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', marginBottom: '1rem' }}>
                  <Server size={20} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>Docker on AWS EC2</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Express backend containerized with non-root security and deployed on AWS EC2 using IAM Instance Profiles for credential-free S3 access.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'rgba(11, 15, 25, 0.8)',
        padding: '1.75rem 1.5rem',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.825rem',
          color: '#64748b'
        }}>
          <div>
            © 2026 StudyVault — Cloud Computing Mini-Project. Built with React, Express, MongoDB Atlas & AWS S3.
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Domain: <code style={{ color: '#94a3b8' }}>studyvault-priti.duckdns.org</code></span>
            <span>Region: <code style={{ color: '#94a3b8' }}>ap-southeast-2</code></span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploaded={() => {
          // Switch to documents tab or trigger refetch
          setCurrentTab('documents');
        }}
      />

      <EditDocModal
        isOpen={Boolean(editingDoc)}
        document={editingDoc}
        onClose={() => setEditingDoc(null)}
        onUpdated={() => {
          setEditingDoc(null);
        }}
      />
    </div>
  );
};

export const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainContent />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
