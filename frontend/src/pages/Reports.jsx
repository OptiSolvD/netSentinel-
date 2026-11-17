import React, { useState } from 'react';
import ConfusionMatrix from '../components/ConfusionMatrix';

function Metric({ label, value, note }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

export default function Reports({ metadata, metadataError, evaluation, evaluationError }) {
  const [selectedCell, setSelectedCell] = useState(null);
  const metrics = evaluation?.metrics || metadata?.test_metrics;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Reproducible model results</div>
          <h1>Reports</h1>
          <p>Official held-out evaluation results for the active v3 four-class model. These are stored baseline metrics, separate from any CSV you upload.</p>
        </div>
        {evaluation && <span className="pill">Official held-out test set</span>}
      </div>

      {evaluationError && <div className="error-notice" role="alert">Could not load the saved evaluation report: {evaluationError}</div>}
      {!metrics && !evaluationError && <div className="loading">Loading stored test results…</div>}
      {metrics && (
        <>
          <div className="notice">
            Results cover {metrics.test_rows_evaluated.toLocaleString()} supported held-out rows. {metrics.excluded_test_rows.toLocaleString()} rows labeled Analysis or Backdoor were excluded because those classes are outside this model’s scope.
          </div>
          {evaluation?.metric_note && <div className="notice">{evaluation.metric_note}</div>}
          <div className="metric-grid">
            <Metric label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(2)}%`} note="Supported held-out test rows" />
            <Metric label="Macro F1" value={`${(metrics.macro_f1 * 100).toFixed(2)}%`} note="Four-class unweighted average" />
            <Metric label="Weighted F1" value={`${(metrics.weighted_f1 * 100).toFixed(2)}%`} note="Weighted by test support" />
            <Metric label="Pooled attack recall" value={`${(metrics.pooled_attack_recall * 100).toFixed(2)}%`} note="Actual attacks predicted as any attack" />
          </div>
          <div className="metric-grid">
            <Metric label="Mean attack-class recall" value={`${(metrics.mean_attack_class_recall * 100).toFixed(2)}%`} note="Unweighted mean across Exploits, Fuzzers, DoS" />
            <Metric label="Normal false-alarm rate" value={`${(metrics.normal_false_alarm_rate * 100).toFixed(2)}%`} note="Normal rows predicted as any attack" />
            <Metric label="Evaluated rows" value={metrics.test_rows_evaluated.toLocaleString()} note="Supported test classes" />
            <Metric label="Excluded rows" value={metrics.excluded_test_rows.toLocaleString()} note="Analysis and Backdoor labels" />
          </div>
        </>
      )}

      {evaluation?.confusion_matrix && (
        <ConfusionMatrix
          data={evaluation.confusion_matrix}
          title="Official held-out confusion matrix"
          selectedCell={selectedCell}
          onCellClick={(actual, predicted, count) => setSelectedCell({ actual, predicted, count })}
        />
      )}
      {selectedCell && (
        <section className="card">
          <div className="section-heading">
            <div><h2>Selected matrix cell</h2><p>{selectedCell.actual} actual · {selectedCell.predicted} predicted</p></div>
            <strong>{selectedCell.count.toLocaleString()} rows</strong>
          </div>
          <p className="muted small">The official report stores aggregate counts, not row-level test examples; use Test &amp; Evaluate with a labeled CSV to inspect individual flows.</p>
        </section>
      )}

      {evaluation?.per_class_metrics && (
        <section className="card">
          <div className="section-heading">
            <div><h2>Per-class performance</h2><p>Precision, recall, and F1 use the official test-set class support.</p></div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Support</th></tr></thead>
              <tbody>{evaluation.per_class_metrics.map((row) => (
                <tr key={row.class_name}>
                  <td><span className={`class-chip class-${row.class_name}`}>{row.class_name}</span></td>
                  <td>{(row.precision * 100).toFixed(2)}%</td>
                  <td>{(row.recall * 100).toFixed(2)}%</td>
                  <td>{(row.f1 * 100).toFixed(2)}%</td>
                  <td>{row.support.toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {metadataError && !metadata && <div className="error-notice">Model metadata unavailable: {metadataError}</div>}
    </div>
  );
}
