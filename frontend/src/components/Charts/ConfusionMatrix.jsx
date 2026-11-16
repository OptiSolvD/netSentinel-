import React from 'react';

export default function ConfusionMatrix({ evalMetrics }) {
  if (!evalMetrics || !evalMetrics.has_ground_truth) return null;

  const { accuracy, macro_f1, attack_recall, false_alarm_rate, confusion_matrix, per_class_metrics } = evalMetrics;
  const classes = confusion_matrix.classes;
  const matrix = confusion_matrix.matrix;

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, margin: '20px 0', border: '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>
            Ground Truth Evaluation (Labelled Traffic Detected)
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Calculated on uploaded CSV target columns ('attack_cat' or 'label')
          </span>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Accuracy</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{(accuracy * 100).toFixed(1)}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Macro F1</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{(macro_f1 * 100).toFixed(1)}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Attack Recall</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{(attack_recall * 100).toFixed(1)}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>False Alarm Rate (FAR)</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>{(false_alarm_rate * 100).toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
        {/* Confusion Matrix Table */}
        <div style={{ overflowX: 'auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 8 }}>
            Confusion Matrix (Rows: Actual, Columns: Predicted)
          </span>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Actual \ Pred</th>
                {classes.map(c => <th key={c} style={{ padding: 6 }}>{c.slice(0, 4)}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={classes[i]} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: 6, textAlign: 'left', fontWeight: 600, color: '#cbd5e1' }}>{classes[i]}</td>
                  {row.map((val, j) => {
                    const isDiagonal = i === j;
                    return (
                      <td
                        key={j}
                        style={{
                          padding: 6,
                          background: isDiagonal ? (val > 0 ? '#1e3a5f' : 'transparent') : (val > 0 ? '#3b1d28' : 'transparent'),
                          color: isDiagonal ? '#38bdf8' : (val > 0 ? '#f87171' : '#64748b'),
                          fontWeight: val > 0 ? 600 : 400,
                        }}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Per-Class Table */}
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 8 }}>
            Per-Class Performance
          </span>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
                <th style={{ padding: 6, textAlign: 'left' }}>Class</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Precision</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Recall</th>
                <th style={{ padding: 6, textAlign: 'right' }}>F1</th>
                <th style={{ padding: 6, textAlign: 'right' }}>Support</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(per_class_metrics).map(([cls, m]) => (
                <tr key={cls} style={{ borderBottom: '1px solid #334155', color: '#cbd5e1' }}>
                  <td style={{ padding: 6, fontWeight: 500 }}>{cls}</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{(m.precision * 100).toFixed(1)}%</td>
                  <td style={{ padding: 6, textAlign: 'right' }}>{(m.recall * 100).toFixed(1)}%</td>
                  <td style={{ padding: 6, textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{(m.f1 * 100).toFixed(1)}%</td>
                  <td style={{ padding: 6, textAlign: 'right', color: '#94a3b8' }}>{m.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
