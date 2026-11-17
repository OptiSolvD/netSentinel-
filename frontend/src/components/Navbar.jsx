import React from 'react';

const navigation = [
  { id: 'overview', label: 'Overview' },
  { id: 'how', label: 'How It Works' },
  { id: 'evaluate', label: 'Test & Evaluate' },
  { id: 'live', label: 'Live Traffic' },
  { id: 'reports', label: 'Reports' },
  { id: 'evolution', label: 'Model Evolution' },
];

export default function Navbar({ activeTab, setActiveTab, health, healthError }) {
  const connected = health?.status === 'healthy';

  return (
    <header className="topbar">
      <div className="topbar-main">
        <button
          className="brand"
          onClick={() => setActiveTab('overview')}
          aria-label="NetSentinel overview"
        >
          <span className="brand-mark" aria-hidden="true">N</span>
          <span className="brand-copy">
            <strong>NetSentinel</strong>
            <small>Network threat analysis</small>
          </span>
        </button>
        <div className="topbar-status">
          <span className={`status-dot ${connected ? 'is-online' : ''}`} />
          <span>{connected ? 'API connected' : healthError ? 'API unavailable' : 'Connecting…'}</span>
          <span className="version-badge">v3 · 4 classes</span>
        </div>
      </div>
      <nav className="nav-tabs" aria-label="Main navigation">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={`nav-tab ${activeTab === item.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
