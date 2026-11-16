import React from 'react';

export default function Navbar({ activeTab, setActiveTab, modelVersion = 'v2.0-clean' }) {
  return (
    <header style={{ background: '#0f172a', color: '#f8fafc', borderBottom: '1px solid #1e293b', padding: '12px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
            NetSentinel <span style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: 500 }}>IDS Console</span>
          </h1>
          <span style={{ fontSize: '0.75rem', background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: 4, border: '1px solid #334155' }}>
            Model {modelVersion}
          </span>
        </div>

        <nav style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              background: activeTab === 'dashboard' ? '#38bdf8' : 'transparent',
              color: activeTab === 'dashboard' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Triage Dashboard
          </button>
          <button
            onClick={() => setActiveTab('context')}
            style={{
              background: activeTab === 'context' ? '#38bdf8' : 'transparent',
              color: activeTab === 'context' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Training Context & Metrics
          </button>
        </nav>
      </div>
    </header>
  );
}
