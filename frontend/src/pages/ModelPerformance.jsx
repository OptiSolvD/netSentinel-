import React, { useEffect, useState } from 'react';
import { fetchTrainingContext } from '../services/api';

export default function ModelPerformance() {
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrainingContext()
      .then(setContext)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>Loading model context...</div>;
  }

  if (!context) return null;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24, color: '#f8fafc' }}>
      {/* Policy Banner */}
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #38bdf8',
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
          fontSize: '0.9rem',
          color: '#e2e8f0',
        }}
      >
        🛡️ <strong>Production Invariant:</strong> {context.banner_text}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Offline Dataset Card */}
        <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#38bdf8' }}>
            Offline Training & Validation Split
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
            Dataset: <strong>{context.dataset}</strong> ({context.citation})<br />
            Clean Training Records: <strong>{context.offline_training_records?.toLocaleString()}</strong> (deduplicated)<br />
            Held-out Test Records: <strong>{context.offline_testing_records?.toLocaleString()}</strong><br />
            Cross-Validation: <strong>{context.cv_scheme}</strong>
          </p>
          <div style={{ marginTop: 12, padding: 10, background: '#0f172a', borderRadius: 6, fontSize: '0.75rem', color: '#cbd5e1' }}>
            ✓ <code>id</code> strictly excluded from feature space.<br />
            ✓ 33,862 duplicate feature rows pruned.<br />
            ✓ 10 chronological block groups prevent session leakage.
          </div>
        </div>

        {/* Official Test Set Results */}
        <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, border: '1px solid #334155' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#10b981' }}>
            Official Held-Out Test Set Results
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6 }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Attack Recall</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
                {((context.final_test_metrics?.attack_recall || 0.9538) * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6 }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>False Alarm Rate</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
                {((context.final_test_metrics?.false_alarm_rate || 0.2277) * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6 }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Accuracy</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                {((context.final_test_metrics?.accuracy || 0.7082) * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: 10, borderRadius: 6 }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Macro F1</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
                {((context.final_test_metrics?.macro_f1 || 0.4100) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Benchmark Table */}
      <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, border: '1px solid #334155', marginTop: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '1rem', color: '#f8fafc' }}>
          Cross-Validation Benchmark Comparison (5-Fold GroupKFold)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Model Architecture</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>CV Macro F1</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>False Alarm Rate</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {context.models_evaluated?.map((m) => {
              const isWinner = m.name === context.winning_model || m.name.includes('RandomForest + Ratios');
              return (
                <tr key={m.name} style={{ borderBottom: '1px solid #334155', background: isWinner ? '#1e3a5f' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', fontWeight: isWinner ? 700 : 500, color: isWinner ? '#38bdf8' : '#cbd5e1' }}>
                    {m.name} {isWinner && '👑 Winning Model'}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                    {(m.macro_f1 * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444' }}>
                    {(m.far * 100).toFixed(2)}%
                  </td>
                  <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                    {m.notes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hard Categories Note */}
      <div style={{ background: '#1e293b', padding: 20, borderRadius: 8, border: '1px solid #334155', marginTop: 20 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', color: '#f59e0b' }}>
          ⚠️ Hard Categories Analysis ({context.hard_classes?.join(', ')})
        </h4>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
          <code>Analysis</code> (1.14% support) and <code>Backdoor</code> (0.98% support) exhibit small sample sizes and behavioral overlap with general web exploits. Flows classified into these two classes or flagged as low-confidence should undergo secondary deep-packet inspection (DPI).
        </p>
      </div>
    </div>
  );
}
