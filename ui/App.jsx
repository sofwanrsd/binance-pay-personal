import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Docs from './components/Docs.jsx';
import Tutorial from './components/Tutorial.jsx';
import PrivacyPopup from './components/PrivacyPopup.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Toast from './components/Toast.jsx';
import { getCreds } from './clientApi.js';
import { LayoutDashboard, BookOpen, FileText, Menu, X, ShieldCheck, KeyRound } from 'lucide-react';

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [creds, setCredsState] = useState(getCreds());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const check = () => setCredsState(getCreds());
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  const nav = (to) => {
    window.history.pushState({}, '', to);
    setPath(to);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const isDocs = path.startsWith('/docs');
  const isTutorial = path.startsWith('/tutorial');
  const isDash = !isDocs && !isTutorial;
  const isConfigured = Boolean(creds.apiKey && creds.apiSecret);

  return (
    <div className="app-layout">
      <Toast />
      <PrivacyPopup />
      
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>
            <div className="brand-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="topbar-title-wrap">
              <h1>
                <span>Binance Pay Gateway</span>
                <span className="badge-version">v2.0</span>
              </h1>
              <span className="topbar-sub">Stateless Personal Crypto Payment Engine</span>
            </div>
          </div>

          <div className="topbar-right desktop-only">
            <div className={`status-pill ${isConfigured ? 'status-connected' : 'status-disconnected'}`}>
              <span className="status-dot" />
              <span>{isConfigured ? 'API Credentials Active' : 'API Key Belum Diset'}</span>
            </div>

            <nav className="topnav">
              <a className={`nav ${isDash ? 'active' : ''}`} onClick={() => nav('/')}>
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </a>
              <a className={`nav ${isTutorial ? 'active' : ''}`} onClick={() => nav('/tutorial')}>
                <BookOpen size={15} />
                <span>Tutorial</span>
              </a>
              <a className={`nav ${isDocs ? 'active' : ''}`} onClick={() => nav('/docs')}>
                <FileText size={15} />
                <span>API Docs</span>
              </a>
            </nav>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="mobile-only mobile-toggle-wrap">
            <div className={`status-pill ${isConfigured ? 'status-connected' : 'status-disconnected'}`} style={{ padding: '4px 8px', fontSize: '11px' }}>
              <span className="status-dot" />
              <span>{isConfigured ? 'Active' : 'No Key'}</span>
            </div>
            <button
              className="icon-btn-hamburger"
              aria-label="Toggle Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-drawer animate-slide-down">
            <nav className="mobile-nav-list">
              <a className={`mobile-nav-item ${isDash ? 'active' : ''}`} onClick={() => nav('/')}>
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </a>
              <a className={`mobile-nav-item ${isTutorial ? 'active' : ''}`} onClick={() => nav('/tutorial')}>
                <BookOpen size={18} />
                <span>Tutorial Integrasi</span>
              </a>
              <a className={`mobile-nav-item ${isDocs ? 'active' : ''}`} onClick={() => nav('/docs')}>
                <FileText size={18} />
                <span>Dokumentasi API</span>
              </a>
            </nav>
          </div>
        )}
      </header>

      <main className="main-content">
        <ErrorBoundary>
          {isDocs ? <Docs /> : isTutorial ? <div className="container"><Tutorial /></div> : <Dashboard nav={nav} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
