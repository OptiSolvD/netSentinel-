import React, { useState } from 'react';
import { explainRow } from '../services/api';
import DecisionTreeVisualizer from './DecisionTreeVisualizer';

export default function PredictionTable({ predictions, rawRows }) {
  const [filter, setFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explanationError, setExplanationError] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 15;

  if (!predictions || predictions.length === 0) return null;

  // Filtering
  const filtered = predictions.filter((p) => {
    if (filter === 'attacks') return p.is_attack;
    if (filter === 'low_confidence') return p.is_low_confidence;
    if (filter === 'unsupported') return p.ground_truth?.has_ground_truth && !p.ground_truth.is_supported;
    if (filter === 'false_positives') {
      return p.ground_truth?.has_ground_truth && p.ground_truth.actual_class === 'Normal' && p.is_attack;
    }
    if (filter === 'false_negatives') {
      return p.ground_truth?.has_ground_truth && p.ground_truth.is_supported && p.ground_truth.actual_class !== 'Normal' && !p.is_attack;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const displayed = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleRowClick = async (pred) => {
    setSelectedRow(pred);
    setExplanation(null);
    setExplanationError(null);
    setLoadingExplain(true);
    try {
      const rowData = pred.features || (rawRows ? rawRows[pred.row_index] : {});
      const exp = await explainRow(rowData);
      setExplanation(exp);
    } catch (err) {
      setExplanationError(err.message || 'Failed to load the model explanation.');
    } finally {
      setLoadingExplain(false);
    }
  };

  return (
    <div style={{ background: '#1e293b', borderRadius: 8, padding: 20, margin: '20px 0', border: '1px solid #334155' }}>
      {/* Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>
            Inference & Triage Table ({filtered.length.toLocaleString()} matching rows)
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Four-class Decision Tree predictions. Click any row to inspect its actual decision path.
          </span>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'attacks', label: 'Attacks Only' },
            { id: 'low_confidence', label: 'Low Confidence (<60%)' },
            { id: 'unsupported', label: 'Out-of-scope labels' },
            { id: 'false_positives', label: 'False Positives' },
            { id: 'false_negatives', label: 'False Negatives' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => { setFilter(btn.id); setPage(0); }}
              style={{
                background: filter === btn.id ? '#38bdf8' : '#0f172a',
                color: filter === btn.id ? '#0f172a' : '#cbd5e1',
                border: '1px solid #334155',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: filter === btn.id ? 700 : 500,
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Row #</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Four-Class Prediction</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Confidence</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Ground Truth</th>
              <th style={{ padding: '8px 10px', textAlign: 'center' }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p) => {
              return (
                <tr
                  key={p.row_index}
                  onClick={() => handleRowClick(p)}
                  style={{
                    borderBottom: '1px solid #334155',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>#{p.row_index}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: p.is_attack ? '#f87171' : '#34d399' }}>
                    {p.predicted_class}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: p.is_attack ? '#ef444422' : '#10b98122',
                        color: p.is_attack ? '#ef4444' : '#10b981',
                        border: `1px solid ${p.is_attack ? '#ef444455' : '#10b98155'}`,
                      }}
                    >
                      {p.is_attack ? 'ATTACK' : 'NORMAL'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: p.is_low_confidence ? '#f59e0b' : '#38bdf8', fontWeight: 600 }}>
                      {(p.confidence * 100).toFixed(1)}%
                    </span>
                    {p.is_low_confidence && (
                      <span style={{ marginLeft: 4, fontSize: '0.65rem', color: '#f59e0b' }}>⚠️ Low</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {p.ground_truth?.has_ground_truth ? (
                      p.ground_truth.is_supported ? (
                        <span style={{ color: p.ground_truth.is_correct ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                          {p.ground_truth.actual_class} {p.ground_truth.is_correct ? '✓' : '✗'}
                        </span>
                      ) : (
                        <span style={{ color: '#f59e0b' }}>{p.ground_truth.actual_class} (out of scope)</span>
                      )
                    ) : (
                      <span style={{ color: '#64748b' }}>Unlabeled</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRowClick(p); }}
                      style={{
                        background: '#0f172a',
                        color: '#38bdf8',
                        border: '1px solid #38bdf8',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                      }}
                    >
                      Why?
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Page {page + 1} of {Math.max(totalPages, 1)}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            style={{ background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            style={{ background: '#0f172a', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Row Explanation Modal / Drawer */}
      {selectedRow && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => setSelectedRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              border: '1px solid #38bdf8',
              borderRadius: 8,
              padding: 24,
              maxWidth: 900,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', fontWeight: 800 }}>
                  Flow #{selectedRow.row_index + 1} — Four-Class Model Explanation
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Prediction and decision path from the fitted Decision Tree model
                </span>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Prediction Summary Header */}
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 6, marginBottom: 16, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>{selectedRow.model_name}</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: selectedRow.is_attack ? '#ef4444' : '#10b981', marginTop: 2 }}>
                  {selectedRow.predicted_class} ({((selectedRow.confidence)*100).toFixed(1)}% confidence)
                </div>
              </div>

              {selectedRow.ground_truth?.has_ground_truth && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Ground Truth Benchmark</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedRow.ground_truth.is_supported ? (selectedRow.ground_truth.is_correct ? '#10b981' : '#ef4444') : '#f59e0b', marginTop: 2 }}>
                    {selectedRow.ground_truth.actual_class} ({selectedRow.ground_truth.is_supported ? (selectedRow.ground_truth.is_correct ? 'Correct' : 'Misclassified') : 'Out of scope'})
                  </div>
                </div>
              )}
            </div>

            {loadingExplain ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#38bdf8', fontSize: '0.9rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🌳 Extracting Decision Tree Path...</div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tracing the flow through the fitted CART nodes.</p>
              </div>
            ) : explanationError ? (
              <div style={{ background: '#451a1a', border: '1px solid #ef4444', color: '#fca5a5', padding: 14, borderRadius: 6 }}>
                {explanationError}
              </div>
            ) : explanation ? (
              <DecisionTreeVisualizer explanation={explanation} selectedRow={selectedRow} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
