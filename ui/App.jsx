import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Docs from './components/Docs.jsx';
import Tutorial from './components/Tutorial.jsx';
import PrivacyPopup from './components/PrivacyPopup.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const nav = (to) => {
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  };

  const isDocs = path.startsWith('/docs');
  const isTutorial = path.startsWith('/tutorial');
  const isDash = !isDocs && !isTutorial;

  return (
    <>
      <PrivacyPopup />
      <div className="topbar">
        <div className="topbar-left">
          <span className="logo-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#0a0c14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1>Binance Pay Gateway</h1>
        </div>
        <nav className="topnav">
          <a className={`nav ${isDash ? 'active' : ''}`} onClick={() => nav('/')}>Dashboard</a>
          <a className={`nav ${isTutorial ? 'active' : ''}`} onClick={() => nav('/tutorial')}>Tutorial</a>
          <a className={`nav ${isDocs ? 'active' : ''}`} onClick={() => nav('/docs')}>API Docs</a>
        </nav>
      </div>

      <ErrorBoundary>
        {isDocs ? <Docs /> : isTutorial ? <div className="container"><Tutorial /></div> : <Dashboard />}
      </ErrorBoundary>
    </>
  );
}
