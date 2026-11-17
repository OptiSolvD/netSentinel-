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

function classAverage(rows, metric) {
  if (!rows?.length) return null;
  return rows.reduce((total, row) => total + row[metric], 0) / rows.length;
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
  evaluation,
  health,
  healthError,
  lastAnalysis,
  onNavigate,
}) {
  const metrics = metadata?.test_metrics;
  const classMetrics = evaluation?.per_class_metrics;
  const summaryMetrics = evaluation?.metrics || metrics;
  const counts = lastAnalysis?.summary?.category_counts;
  const recent = lastAnalysis?.predictions?.slice(0, 8) || [];

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Network intrusion detection · UNSW-NB15</div>
          <h1>Understand network traffic, one flow at a time.</h1>
          <p>NetSentinel demonstrates a four-class machine-learning approach to identifying suspicious network flows. Upload a feature-ready CSV to inspect predictions, test-set evidence, and the Decision Tree’s reasoning.</p>
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

      {summaryMetrics && (
        <>
          <div className="metric-grid">
            <Metric label="Held-out accuracy" value={percentage(summaryMetrics.accuracy)} note="Correct predictions across supported test rows" />
            <Metric label="Macro precision" value={percentage(classAverage(classMetrics, 'precision'))} note="Unweighted mean of four class precisions" />
            <Metric label="Macro recall" value={percentage(classAverage(classMetrics, 'recall'))} note="Unweighted mean of four class recalls" />
            <Metric label="Macro F1" value={percentage(summaryMetrics.macro_f1)} note="Unweighted mean across four classes" />
          </div>
          <p className="muted small">
            {summaryMetrics.test_rows_evaluated.toLocaleString()} supported held-out rows were evaluated.
            {' '}{summaryMetrics.excluded_test_rows.toLocaleString()} rows labeled Analysis or Backdoor were excluded because they are outside the model’s four-class scope.
            {Number.isFinite(summaryMetrics.mean_attack_class_recall) && ` Mean recall across the three attack classes: ${percentage(summaryMetrics.mean_attack_class_recall)}.`}
          </p>
          {metadata?.test_metric_note && <p className="muted small">{metadata.test_metric_note}</p>}
        </>
      )}
      {!summaryMetrics && (
        <div className={metadataError ? 'error-notice' : 'empty-state'}>
          {metadataError ? `Could not load stored model metrics: ${metadataError}` : 'Loading the active model results…'}
        </div>
      )}

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>From the detection problem to an evaluated model</h2>
            <p>A concise project map, with the current model’s actual training and evaluation scope.</p>
          </div>
          <span className="pill">Decision Tree · v3</span>
        </div>
        <div className="overview-story-grid">
          <article>
            <span className="step-number">THE PROBLEM</span>
            <h3>Network traffic needs inspection</h3>
            <p>Intrusion detection separates legitimate flows from attack traffic. NetSentinel classifies prepared flow records; it is not a packet capture or live network monitor.</p>
          </article>
          <article>
            <span className="step-number">THE DATA</span>
            <h3>UNSW-NB15 · 42 input features</h3>
            <p>{metadata ? `${metadata.stored_metrics.training_rows.toLocaleString()} training rows and ${summaryMetrics?.test_rows_evaluated?.toLocaleString() || '—'} supported held-out test rows.` : 'A labeled network-flow dataset with numeric and categorical input features.'} The active taxonomy is Normal, Exploits, Fuzzers, and DoS.</p>
          </article>
          <article>
            <span className="step-number">THE METHOD</span>
            <h3>Preprocess, then classify</h3>
            <p>The fitted preprocessing pipeline handles missing values and categorical fields before a single CART Decision Tree predicts a class with a traceable threshold path.</p>
          </article>
          <article>
            <span className="step-number">THE EVIDENCE</span>
            <h3>Check more than accuracy</h3>
            <p>Held-out metrics, per-class results, and a confusion matrix reveal where the model succeeds and which errors remain. Explore them in Reports.</p>
          </article>
        </div>
        <div className="overview-conclusion">
          <strong>Conclusion and limitation</strong>
          <p>{summaryMetrics ? `On its supported held-out set, the model reached ${percentage(summaryMetrics.accuracy)} accuracy and ${percentage(summaryMetrics.macro_f1)} macro F1.` : 'The model is evaluated against supported held-out labels; evaluation results are currently loading.'} Results are specific to UNSW-NB15 and the four supported classes, so they do not establish performance on other networks or excluded labels.</p>
          <button className="button-secondary button-small" onClick={() => onNavigate('reports')}>Explore the evaluation <span aria-hidden="true">→</span></button>
        </div>
      </section>

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
