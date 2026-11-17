import React from 'react';

export default function AttackDistribution({ categoryCounts, confidenceDist }) {
  if (!categoryCounts) return null;

  const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  const colors = {
    Normal: '#10b981',
    Exploits: '#ef4444',
    Fuzzers: '#f97316',
    DoS: '#eab308',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '20px 0' }}>
      {/* Category Counts Breakdown */}
      <div style={{ background: '#1e293b', padding: 16, borderRadius: 8, border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#f8fafc' }}>
          Taxonomy Breakdown (4 Classes)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(categoryCounts).map(([cat, count]) => {
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            const barColor = colors[cat] || '#38bdf8';
            return (
              <div key={cat} style={{ fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', marginBottom: 2 }}>
                  <span>{cat}</span>
                  <span>{count.toLocaleString()} ({pct}%)</span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confidence Distribution */}
      <div style={{ background: '#1e293b', padding: 16, borderRadius: 8, border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#f8fafc' }}>
          Prediction Confidence Histogram
        </h4>
        {confidenceDist && (
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 130, gap: 12, paddingBottom: 10 }}>
            {confidenceDist.bins.map((bin, i) => {
              const count = confidenceDist.counts[i] || 0;
              const maxCount = Math.max(...confidenceDist.counts, 1);
              const heightPct = Math.round((count / maxCount) * 100);
              return (
                <div key={bin} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 4 }}>
                    {count}
                  </span>
                  <div
                    style={{
                      width: '80%',
                      height: `${Math.max(heightPct, 6)}%`,
                      background: i < 3 ? '#f59e0b' : '#38bdf8',
                      borderRadius: '4px 4px 0 0',
                    }}
                  />
                  <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 6, whiteSpace: 'nowrap' }}>
                    {bin}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
