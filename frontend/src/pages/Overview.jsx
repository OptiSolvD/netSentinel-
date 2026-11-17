import React from 'react';

const classNames = ['Normal', 'Exploits', 'Fuzzers', 'DoS'];

function Metric({ label, value, note }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function percentage(value, digits = 1) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—';
}

function ClassLabel({ name }) {
  return (
    <span className={`class-chip class-${name}`}>
      <span className={`class-dot class-${name}`} />
      {name}
    </span>
  );
}

export default function Overview({
  metadata,
  metadataError,
  health,
  healthError,
  lastAnalysis,
  onNavigate,
}) {
  const metrics = metadata?.test_metrics;
  const counts = lastAnalysis?.summary?.category_counts;
  const recent = lastAnalysis?.predictions?.slice(0, 8) || [];

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Network observability · v3 model</div>
          <h1>Overview</h1>
          <p>Inspect four-class network-flow results from the fitted Decision Tree. The console analyzes flow-feature CSV files; it does not capture packets or monitor a live interface.</p>
        </div>
        <button className="button" onClick={() => onNavigate('evaluate')}>Test a CSV dataset <span aria-hidden="true">→</span></button>
      </div>

      <div className={healthError ? 'error-notice' : 'notice'}>
        {healthError
          ? `The inference API is unavailable: ${healthError}. Model results are not being simulated.`
          : health?.status === 'healthy'
            ? `API connected · ${health.model_name} · ${health.num_features} expected flow features.`
            : 'Checking the inference API…'}
      </div>

      {metrics && (
        <>
          <div className="metric-grid">
            <Metric label="Held-out test accuracy" value={percentage(metrics.accuracy)} note="Official v3 evaluation" />
            <Metric label="Macro F1" value={percentage(metrics.macro_f1)} note="Unweighted mean across four classes" />
            <Metric label="Pooled attack recall" value={percentage(metrics.pooled_attack_recall)} note="Actual attacks predicted as any attack class" />
            <Metric label="Normal false-alarm rate" value={percentage(metrics.normal_false_alarm_rate)} note="Normal rows predicted as an attack" />
          </div>
          <p className="muted small">
            Mean recall across the three attack classes: {percentage(metrics.mean_attack_class_recall)}. Baseline: {metrics.test_rows_evaluated.toLocaleString()} supported held-out rows. {metrics.excluded_test_rows.toLocaleString()} rows from excluded labels (Analysis, Backdoor) were not evaluated.
          </p>
          {metadata?.test_metric_note && <p className="muted small">{metadata.test_metric_note}</p>}
        </>
      )}
      {!metrics && (
        <div className={metadataError ? 'error-notice' : 'empty-state'}>
          {metadataError ? `Could not load stored model metrics: ${metadataError}` : 'Loading the active model metadata…'}
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Traffic classes</h2>
              <p>{counts ? 'Counts from the most recent CSV analysis' : 'Classes supported by the active model'}</p>
            </div>
            <span className="pill">Decision Tree · v3</span>
          </div>
          {classNames.map((name) => {
            const count = counts?.[name];
            const total = lastAnalysis?.summary?.total_rows || 0;
            const percentage = total && count !== undefined ? (count / total) * 100 : null;
            return (
              <div className="bar-row" key={name}>
                <ClassLabel name={name} />
                <div className="bar-track">
                  {percentage !== null && <div className={`bar-fill class-${name}`} style={{ width: `${percentage}%`, background: `var(--${name === 'Normal' ? 'normal' : name.toLowerCase()})` }} />}
                </div>
                <strong>{count === undefined ? '—' : count.toLocaleString()}</strong>
              </div>
            );
          })}
          {!lastAnalysis && <p className="muted small">Run a dataset in Test &amp; Evaluate to populate session counts.</p>}
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Active model</h2>
              <p>Serving artifact and training scope</p>
            </div>
          </div>
          {metadata ? (
            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr><th>Architecture</th><td>{metadata.model.type}</td></tr>
                  <tr><th>Tree size</th><td>{metadata.model.total_nodes.toLocaleString()} nodes · depth {metadata.model.max_depth}</td></tr>
                  <tr><th>Input schema</th><td>{metadata.input_features.length} raw flow features</td></tr>
                  <tr><th>Training rows</th><td>{metadata.stored_metrics.training_rows.toLocaleString()}</td></tr>
                  <tr><th>Dataset</th><td>UNSW-NB15 · offline training</td></tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small">{metadataError || 'Loading model details…'}</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Recent predictions</h2>
            <p>{lastAnalysis ? `${lastAnalysis.summary.total_rows.toLocaleString()} rows analyzed · showing returned examples` : 'Predictions appear here after you analyze a dataset.'}</p>
          </div>
          {lastAnalysis && <span className="pill">{lastAnalysis.model_version}</span>}
        </div>
        {recent.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Row</th><th>Prediction</th><th>Confidence</th><th>Ground truth</th><th>Result</th></tr></thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.row_index}>
                    <td>{row.row_index + 1}</td>
                    <td><ClassLabel name={row.predicted_class} /></td>
                    <td>{(row.confidence * 100).toFixed(1)}%</td>
                    <td>{row.ground_truth?.is_supported ? row.ground_truth.actual_class : row.ground_truth?.has_ground_truth ? 'Unsupported label' : 'Not provided'}</td>
                    <td>{row.ground_truth?.is_correct === true ? 'Correct' : row.ground_truth?.is_correct === false ? 'Incorrect' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No recent inference in this session. Results are shown only after a CSV is actually processed by the API.</div>
        )}
      </section>
    </div>
  );
}
