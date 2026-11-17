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
  const [selectedClass, setSelectedClass] = useState('');
  const metrics = evaluation?.metrics || metadata?.test_metrics;
  const selectedClassMetrics = evaluation?.per_class_metrics?.find(
    (row) => row.class_name === selectedClass,
  ) || evaluation?.per_class_metrics?.[0];
  const largestConfusion = evaluation?.confusion_matrix?.matrix?.reduce((largest, row, rowIndex) => (
    row.reduce((currentLargest, count, columnIndex) => (
      rowIndex !== columnIndex && count > currentLargest.count
        ? { actual: evaluation.confusion_matrix.classes[rowIndex], predicted: evaluation.confusion_matrix.classes[columnIndex], count }
        : currentLargest
    ), largest)
  ), { actual: null, predicted: null, count: 0 });

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
            <div><h2>Class-wise performance explorer</h2><p>Select a class to compare precision, recall, and F1 alongside its test-set support.</p></div>
          </div>
          <div className="class-selector" role="group" aria-label="Select a class to explore">
            {evaluation.per_class_metrics.map((row) => (
              <button
                type="button"
                key={row.class_name}
                className={`class-select-button ${selectedClassMetrics?.class_name === row.class_name ? 'is-selected' : ''}`}
                aria-pressed={selectedClassMetrics?.class_name === row.class_name}
                onClick={() => setSelectedClass(row.class_name)}
              >
                <span className={`class-chip class-${row.class_name}`}><span className={`class-dot class-${row.class_name}`} />{row.class_name}</span>
              </button>
            ))}
          </div>
          {selectedClassMetrics && (
            <div className="class-metric-explorer">
              <div>
                <h3><span className={`class-chip class-${selectedClassMetrics.class_name}`}>{selectedClassMetrics.class_name}</span></h3>
                <p className="muted small">{selectedClassMetrics.support.toLocaleString()} actual test examples in this class.</p>
                <p className="small">Precision: of the flows predicted as {selectedClassMetrics.class_name}, this fraction was correct. Recall: of actual {selectedClassMetrics.class_name} flows, this fraction was found. F1 balances precision and recall.</p>
              </div>
              <div className="class-metric-bars">
                {[
                  ['Precision', selectedClassMetrics.precision],
                  ['Recall', selectedClassMetrics.recall],
                  ['F1-score', selectedClassMetrics.f1],
                ].map(([label, value]) => (
                  <div className="class-metric-row" key={label}>
                    <span>{label}</span>
                    <div className="bar-track" role="meter" aria-label={`${selectedClassMetrics.class_name} ${label}`} aria-valuenow={Math.round(value * 100)} aria-valuemin="0" aria-valuemax="100">
                      <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: 'var(--accent)' }} />
                    </div>
                    <strong>{(value * 100).toFixed(2)}%</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {metrics && (
        <section className="card">
          <div className="section-heading">
            <div><h2>What the results tell us</h2><p>Interpretation is based on the saved held-out evaluation, not an uploaded sample.</p></div>
          </div>
          <div className="grid-2">
            <div className="notice">
              <strong>Largest observed confusion</strong>
              {largestConfusion?.actual && largestConfusion.count > 0
                ? <p>{largestConfusion.count.toLocaleString()} actual {largestConfusion.actual} rows were predicted as {largestConfusion.predicted}. The confusion matrix shows the complete distribution.</p>
                : <p>No off-diagonal errors were recorded in the available confusion matrix.</p>}
            </div>
            <div className="notice scope-notice">
              <strong>Scope and next steps</strong>
              <p>The report covers UNSW-NB15 and excludes unsupported Analysis and Backdoor labels. Evaluate on additional datasets and investigate class balance and threshold behavior before applying results to other environments.</p>
            </div>
          </div>
        </section>
      )}

      {metadataError && !metadata && <div className="error-notice">Model metadata unavailable: {metadataError}</div>}
    </div>
  );
}
