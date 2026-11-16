import React, { useState } from 'react';

export default function PipelineStepper({ stages }) {
  const [expandedStage, setExpandedStage] = useState(null);

  if (!stages || stages.length === 0) return null;

  const toggleExpand = (idx) => {
    setExpandedStage(expandedStage === idx ? null : idx);
  };

  const getStageIcon = (status) => {
    if (status === 'success') return '✓';
    if (status === 'error') return '✕';
    if (status === 'warning') return '⚠';
    return '•';
  };

  const getStageColor = (status) => {
    if (status === 'success') return '#10b981';
    if (status === 'error') return '#ef4444';
    if (status === 'warning') return '#f59e0b';
    return '#64748b';
  };

  return (
    <div style={{ margin: '20px 0', background: '#0f172a', borderRadius: 8, padding: 16, border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', fontWeight: 600 }}>
          Execution Pipeline Telemetry (Real Server Metrics)
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Click any stage card for technical diagnostics</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {stages.map((stg, idx) => {
          const isExpanded = expandedStage === idx;
          const stageColor = getStageColor(stg.status);

          return (
            <div
              key={stg.stage}
              onClick={() => toggleExpand(idx)}
              style={{
                background: '#1e293b',
                border: `1px solid ${isExpanded ? stageColor : '#334155'}`,
                borderRadius: 6,
                padding: 12,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: stageColor,
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                  }}
                >
                  {getStageIcon(stg.status)}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>
                  {stg.stage.replace('_', ' ')}
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.3 }}>
                {stg.summary}
              </div>

              {isExpanded && stg.data && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #334155', fontSize: '0.7rem', color: '#cbd5e1' }}>
                  <pre style={{ margin: 0, background: '#090d16', padding: 6, borderRadius: 4, overflowX: 'auto' }}>
                    {JSON.stringify(stg.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
