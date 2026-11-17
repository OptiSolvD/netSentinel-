import React, { useEffect, useState } from 'react';
import { fetchModelMetadata } from '../services/api';

const metricCards = [
  { key: 'accuracy', label: 'Test Accuracy', color: '#f8fafc' },
  { key: 'macro_f1', label: 'Macro F1', color: '#10b981' },
  { key: 'attack_recall', label: 'Attack Recall', color: '#38bdf8' },
  { key: 'normal_false_positive_rate', label: 'Normal False-Positive Rate', color: '#ef4444' },
];

export default function ModelPerformance() {
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModelMetadata()
      .then((result) => {
        if (!result) throw new Error('The model API is unavailable.');
        setMetadata(result);
      })
      .catch((err) => setError(err.message || 'Failed to load model metadata.'));
  }, []);

  if (error) {
    return <div style={{ color: '#fca5a5', padding: 40, textAlign: 'center' }}>{error}</div>;
  }
  if (!metadata) {
    return <div style={{ color: '#94a3b8', padding: 40, textAlign: 'center' }}>Loading v3 model details...</div>;
  }

  const model = metadata.model;
  const selection = metadata.stored_metrics;
  const test = metadata.test_metrics;
  const classes = metadata.classes || [];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, color: '#f8fafc' }}>
      <div style={{ background: '#0f172a', border: '1px solid #38bdf8', padding: 18, borderRadius: 8, marginBottom: 20 }}>
        <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>{metadata.model_version}</div>
        <h2 style={{ margin: '6px 0', fontSize: '1.3rem' }}>{model.name}</h2>
        <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.85rem' }}>
          The active v3 model predicts only the supported classes below. Test rows labeled Analysis or Backdoor were excluded from its evaluation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        {metricCards.map((metric) => (
          <div key={metric.key} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{metric.label}</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: metric.color, marginTop: 6 }}>
              {((test?.[metric.key] ?? 0) * 100).toFixed(2)}%
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>Official held-out test set</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 18 }}>
        <section style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', color: '#38bdf8', fontSize: '1rem' }}>Model details</h3>
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.8 }}>
            Architecture: <strong>{model.type}</strong><br />
            Tree depth: <strong>{model.max_depth}</strong><br />
            Tree nodes: <strong>{model.total_nodes?.toLocaleString()}</strong><br />
            Input features: <strong>{metadata.input_features?.length}</strong><br />
            Training rows: <strong>{selection.training_rows?.toLocaleString()}</strong><br />
            Test rows evaluated: <strong>{test.test_rows_evaluated?.toLocaleString()}</strong><br />
            Excluded test rows: <strong>{test.excluded_test_rows?.toLocaleString()}</strong>
          </div>
        </section>

        <section style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 18 }}>
          <h3 style={{ margin: '0 0 12px', color: '#38bdf8', fontSize: '1rem' }}>Supported prediction classes</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {classes.map((className) => (
              <span key={className} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 16, padding: '6px 12px', color: '#e2e8f0', fontSize: '0.8rem' }}>
                {className}
              </span>
            ))}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: '0.78rem', color: '#fbbf24', lineHeight: 1.5 }}>
            Out-of-scope labels: {(test.excluded_test_classes || []).join(', ')}. These are not predicted by this model.
          </p>
        </section>
      </div>
    </div>
  );
}
