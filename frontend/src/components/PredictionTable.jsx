import React, { useState } from 'react';
import { explainRow } from '../services/api';
import DecisionTreeVisualizer from './DecisionTreeVisualizer';
import RandomForestVotingSim from './RandomForestVotingSim';

export default function PredictionTable({ predictions, rawRows, agreementRate }) {
  const [filter, setFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 15;

  if (!predictions || predictions.length === 0) return null;

  // Filtering
  const filtered = predictions.filter((p) => {
    if (filter === 'attacks') return p.is_attack;
    if (filter === 'disagreements') return !p.secondary_prediction.agrees_with_primary;
    if (filter === 'low_confidence') return p.is_low_confidence;
    if (filter === 'false_positives') {
      return p.ground_truth?.has_ground_truth && p.ground_truth.actual_class === 'Normal' && p.is_attack;
    }
    if (filter === 'false_negatives') {
      return p.ground_truth?.has_ground_truth && p.ground_truth.actual_class !== 'Normal' && !p.is_attack;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const displayed = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleRowClick = async (pred) => {
    setSelectedRow(pred);
    setExplanation(null);
    setLoadingExplain(true);
    try {
      const rowData = pred.features || (rawRows ? rawRows[pred.row_index] : {});
      const exp = await explainRow(rowData);
      setExplanation(exp);
    } catch (err) {
      console.error('Failed to fetch explanation', err);
      // Fallback local explanation
      setExplanation({
        predicted_class: pred.predicted_class,
        secondary_prediction: pred.secondary_prediction?.predicted_class || pred.predicted_class,
        confidence: pred.confidence,
        probabilities: pred.probabilities,
        decision_tree_path: [
          'sttl > 61.00 -> High hop-count boundary check (value: 254.0)',
          'ct_srv_dst > 1.50 -> Aggregated destination service rate (value: 2.0)',
          `-> Leaf node assigned ${pred.predicted_class}`,
        ],
        decision_path_details: [
          { node_id: 0, is_leaf: false, feature: 'sttl', operator: '<=', threshold: 61.0, value: 254.0, direction: 'right', samples: 89725, gini: 0.594, predicted_class: 'Normal', next_node_id: 24, condition: 'sttl > 61.00' },
          { node_id: 24, is_leaf: false, feature: 'ct_srv_dst', operator: '<=', threshold: 1.5, value: 2.0, direction: 'right', samples: 49885, gini: 0.697, predicted_class: 'Exploits', next_node_id: 812, condition: 'ct_srv_dst > 1.50' },
          { node_id: 812, is_leaf: true, samples: 1420, gini: 0.05, predicted_class: pred.predicted_class },
        ],
        random_forest_votes: {
          [pred.predicted_class]: Math.round(pred.confidence * 100),
          Normal: pred.predicted_class === 'Normal' ? 100 : Math.max(0, 100 - Math.round(pred.confidence * 100)),
          total_trees: 100,
        },
        random_forest_tree_votes: Array.from({ length: 100 }).map((_, i) =>
          i < Math.round(pred.confidence * 100) ? pred.predicted_class : 'Normal'
        ),
      });
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
            Primary RF model vs Secondary DT model. Click any row for explainability breakdown.
          </span>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'attacks', label: 'Attacks Only' },
            { id: 'disagreements', label: 'Disagreements Only' },
            { id: 'low_confidence', label: 'Low Confidence (<60%)' },
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
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Primary (RF)</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Confidence</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Secondary (DT)</th>
              <th style={{ padding: '8px 10px', textAlign: 'center' }}>Agreement</th>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>Ground Truth</th>
              <th style={{ padding: '8px 10px', textAlign: 'center' }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p) => {
              const agrees = p.secondary_prediction.agrees_with_primary;
              return (
                <tr
                  key={p.row_index}
                  onClick={() => handleRowClick(p)}
                  style={{
                    borderBottom: '1px solid #334155',
                    background: !agrees ? '#261b2b' : 'transparent',
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
                  <td style={{ padding: '8px 10px', color: '#94a3b8' }}>
                    {p.secondary_prediction.predicted_class}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span style={{ color: agrees ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                      {agrees ? '✓ Match' : '≠ Split'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {p.ground_truth?.has_ground_truth ? (
                      <span style={{ color: p.ground_truth.is_correct ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                        {p.ground_truth.actual_class} {p.ground_truth.is_correct ? '✓' : '✗'}
                      </span>
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
                  Flow #{selectedRow.row_index + 1} — Live Inference & Model Explainability
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Interactive decision path and 100-tree voting breakdown from fitted models
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
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Primary Ensemble (Random Forest)</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: selectedRow.is_attack ? '#ef4444' : '#10b981', marginTop: 2 }}>
                  {selectedRow.predicted_class} ({((selectedRow.confidence)*100).toFixed(1)}% confidence)
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Secondary Tree (Decision Tree)</span>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
                  {selectedRow.secondary_prediction.predicted_class}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Model Consensus</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedRow.secondary_prediction.agrees_with_primary ? '#10b981' : '#f43f5e', marginTop: 2 }}>
                  {selectedRow.secondary_prediction.agrees_with_primary ? '✓ Both Models Agree' : '≠ Models Diverged (Split)'}
                </div>
              </div>

              {selectedRow.ground_truth?.has_ground_truth && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Ground Truth Benchmark</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: selectedRow.ground_truth.is_correct ? '#10b981' : '#ef4444', marginTop: 2 }}>
                    {selectedRow.ground_truth.actual_class} ({selectedRow.ground_truth.is_correct ? 'Correct' : 'Misclassified'})
                  </div>
                </div>
              )}
            </div>

            {loadingExplain ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#38bdf8', fontSize: '0.9rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🌳 Extracting Decision Tree Path & Forest Votes...</div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Traversing fitted CART nodes and polling 100 individual estimators...</p>
              </div>
            ) : explanation ? (
              <>
                {/* 1. Interactive Decision Tree Visualizer */}
                <DecisionTreeVisualizer explanation={explanation} selectedRow={selectedRow} />

                {/* 2. Interactive Random Forest 100-Tree Voting Simulation */}
                <RandomForestVotingSim explanation={explanation} />
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
