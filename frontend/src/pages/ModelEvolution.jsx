import React, { useMemo, useState } from 'react';

const formatPercent = (value) => (
  value == null || Number.isNaN(value) ? '—' : `${(value * 100).toFixed(1)}%`
);

const formatDelta = (value) => {
  if (value == null || Number.isNaN(value)) return '—';
  const points = value * 100;
  return `${points > 0 ? '+' : ''}${points.toFixed(2)} pp`;
};

const formatCount = (value) => (
  value == null ? '—' : Number(value).toLocaleString()
);

function MetricCards({ metrics, labels }) {
  return (
    <div className="metric-grid evolution-metric-grid">
      {labels.map(({ key, label, note }) => (
        <div className="metric-card" key={key}>
          <div className="metric-label">{label}</div>
          <div className="metric-value">{formatPercent(metrics?.[key])}</div>
          {note && <div className="metric-note">{note}</div>}
        </div>
      ))}
    </div>
  );
}

function ModelCard({ title, model, metrics, splitLabel, final = false }) {
  if (!model) return null;
  const metricLabels = [
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'macro_f1', label: 'Macro-F1' },
    { key: 'weighted_f1', label: 'Weighted-F1' },
    { key: 'normal_false_alarm_rate', label: 'Normal FAR', note: 'Lower is better' },
    { key: 'pooled_attack_recall', label: 'Pooled attack recall' },
  ];

  return (
    <article className="card evolution-model-card">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{splitLabel}</div>
          <h2>{title}</h2>
        </div>
        <span className={`pill ${final ? 'evolution-final-pill' : ''}`}>
          {final ? 'Serving model' : model.artifact_available ? 'Artifact available' : 'Validation record'}
        </span>
      </div>
      <p className="muted small">
        {model.algorithm} · {model.dataset} · {model.feature_count} raw predictors
        {model.training_rows ? ` · ${formatCount(model.training_rows)} training rows` : ''}
      </p>
      <MetricCards metrics={metrics} labels={metricLabels} />
      {model.selection_reason && (
        <p className="evolution-reason"><strong>Selection note:</strong> {model.selection_reason}</p>
      )}
      <details className="evolution-details">
        <summary>Model configuration and input features</summary>
        <div className="evolution-detail-grid">
          <div>
            <h3>Preprocessing</h3>
            <ul>
              <li>{model.preprocessing?.numeric}</li>
              <li>{model.preprocessing?.categorical}</li>
              <li>{model.preprocessing?.unknown_categories}</li>
              <li>{formatCount(model.preprocessing?.transformed_feature_count)} encoded features</li>
            </ul>
          </div>
          <div>
            <h3>Parameters</h3>
            <pre>{JSON.stringify(model.parameters, null, 2)}</pre>
          </div>
        </div>
        <h3>Raw predictors ({model.features?.length || 0})</h3>
        <p className="evolution-feature-list">{model.features?.join(', ')}</p>
      </details>
    </article>
  );
}

function ValidationChart({ comparison }) {
  const metrics = [
    { key: 'macro_f1', label: 'Macro-F1', higher: true },
    { key: 'accuracy', label: 'Accuracy', higher: true },
    { key: 'weighted_f1', label: 'Weighted-F1', higher: true },
    { key: 'normal_false_alarm_rate', label: 'Normal FAR', higher: false },
    { key: 'pooled_attack_recall', label: 'Pooled attack recall', higher: true },
  ];
  const baseline = comparison.baseline.metrics;
  const challenger = comparison.challenger.metrics;

  return (
    <div className="card">
      <div className="section-heading">
        <div>
          <h2>Same-split validation comparison</h2>
          <p>
            {comparison.baseline.model} vs. {comparison.challenger.model} ·{' '}
            {formatCount(comparison.rows)} validation rows
          </p>
        </div>
        <span className="pill">Validation only</span>
      </div>
      <div className="evolution-legend">
        <span><i className="evolution-swatch baseline" /> Baseline</span>
        <span><i className="evolution-swatch challenger" /> Highest validation Macro-F1 candidate</span>
      </div>
      <div className="evolution-chart">
        {metrics.map((metric) => (
          <div className="evolution-chart-row" key={metric.key}>
            <div className="evolution-chart-heading">
              <strong>{metric.label}</strong>
              <span>
                {formatPercent(baseline[metric.key])} → {formatPercent(challenger[metric.key])}
                <b className="evolution-delta">
                  {formatDelta(comparison.deltas?.[metric.key])}
                </b>
              </span>
            </div>
            <div className="evolution-bars">
              <div
                className="evolution-bar baseline"
                style={{ width: `${Math.min(100, Math.max(0, baseline[metric.key] * 100))}%` }}
                aria-label={`Baseline ${metric.label}: ${formatPercent(baseline[metric.key])}`}
              />
              <div
                className={`evolution-bar challenger ${!metric.higher ? 'lower-is-better' : ''}`}
                style={{ width: `${Math.min(100, Math.max(0, challenger[metric.key] * 100))}%` }}
                aria-label={`Candidate ${metric.label}: ${formatPercent(challenger[metric.key])}`}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="evolution-footnote">
        Bars show metric values on a 0–100% scale. Higher is better except for Normal FAR.
        Deltas are candidate minus baseline, in percentage points.
      </p>
    </div>
  );
}

function ConfusionMatrix({ title, data, onSelectCell }) {
  if (!data) return null;
  const { classes, matrix } = data;
  return (
    <div className="card">
      <div className="section-heading">
        <div>
          <h3>{title}</h3>
          <p>Rows are actual classes; columns are predicted classes.</p>
        </div>
      </div>
      <div className="matrix-wrap">
        <table className="matrix evolution-matrix">
          <thead>
            <tr>
              <th aria-label="Actual / predicted">Actual ↓<br />Predicted →</th>
              {classes.map((className) => <th key={className}>{className}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={classes[rowIndex]}>
                <th className="row-label">{classes[rowIndex]}</th>
                {row.map((count, columnIndex) => (
                  <td key={classes[columnIndex]}>
                    <button
                      className={`matrix-cell ${rowIndex === columnIndex ? 'diagonal' : ''}`}
                      onClick={() => onSelectCell({
                        actual: classes[rowIndex],
                        predicted: classes[columnIndex],
                        count,
                        title,
                      })}
                      aria-label={`${title}: ${count} actual ${classes[rowIndex]} predicted ${classes[columnIndex]}`}
                    >
                      {formatCount(count)}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExperimentHistory({ validation, crossValidation, finalConfusion }) {
  const [sort, setSort] = useState({ key: 'macro_f1', descending: true });
  const [selectedCell, setSelectedCell] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const baselineRecord = validation.find(
    (item) => item.model === 'Decision Tree' && item.phase === 'baseline',
  );
  const candidateRecord = validation.find((item) => item.model === 'Random Forest tuned');

  const history = useMemo(() => {
    const records = validation.map((record) => ({
      ...record,
      metrics: record.metrics,
      configuration: record.configuration,
      record_type: 'validation',
    }));
    crossValidation.forEach((record) => {
      records.push({
        ...record,
        phase: 'grouped CV',
        record_type: 'cross-validation',
      });
    });
    return records.sort((left, right) => {
      const leftValue = sort.key === 'model'
        ? left.model.toLowerCase()
        : left.metrics?.[sort.key];
      const rightValue = sort.key === 'model'
        ? right.model.toLowerCase()
        : right.metrics?.[sort.key];
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      const order = typeof leftValue === 'string'
        ? leftValue.localeCompare(rightValue)
        : leftValue - rightValue;
      return sort.descending ? -order : order;
    });
  }, [validation, crossValidation, sort]);

  const setSortKey = (key) => {
    setSort((previous) => ({
      key,
      descending: previous.key === key ? !previous.descending : true,
    }));
  };

  const sortButton = (key, label) => (
    <button className="evolution-sort-button" onClick={() => setSortKey(key)}>
      {label}{sort.key === key ? (sort.descending ? ' ↓' : ' ↑') : ''}
    </button>
  );

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Experiment history</h2>
          <p>Sort by model or recorded score; expand a row for parameters and metric provenance.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table evolution-history-table">
          <thead>
            <tr>
              <th>{sortButton('model', 'Model')}</th>
              <th>Experiment</th>
              <th>Evaluation split</th>
              <th>{sortButton('macro_f1', 'Macro-F1')}</th>
              <th>{sortButton('accuracy', 'Accuracy')}</th>
              <th>{sortButton('normal_false_alarm_rate', 'Normal FAR')}</th>
              <th>{sortButton('pooled_attack_recall', 'Pooled attack recall')}</th>
              <th>Outcome</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <React.Fragment key={record.experiment_id}>
                <tr>
                  <td>{record.model}</td>
                  <td>{record.phase}</td>
                  <td>{record.evaluation_split}</td>
                  <td>{formatPercent(record.metrics?.macro_f1)}</td>
                  <td>{formatPercent(record.metrics?.accuracy)}</td>
                  <td>{formatPercent(record.metrics?.normal_false_alarm_rate)}</td>
                  <td>{formatPercent(record.metrics?.pooled_attack_recall)}</td>
                  <td>{record.selection_status || (
                    record.record_type === 'cross-validation' ? 'CV record' : 'Recorded'
                  )}</td>
                  <td>
                    <button
                      className="button-small"
                      onClick={() => setExpanded(
                        expanded === record.experiment_id ? null : record.experiment_id,
                      )}
                    >
                      {expanded === record.experiment_id ? 'Hide' : 'Details'}
                    </button>
                  </td>
                </tr>
                {expanded === record.experiment_id && (
                  <tr className="evolution-expanded-row">
                    <td colSpan="9">
                      <div className="evolution-detail-grid">
                        <div>
                          <strong>Recorded configuration</strong>
                          <pre>{JSON.stringify(record.configuration || {}, null, 2)}</pre>
                        </div>
                        <div>
                          <strong>Metric provenance</strong>
                          <p>{record.reason || record.metric_note || record.source}</p>
                          {record.metrics?.per_class_metrics && (
                            <p>
                              Class recalls:{' '}
                              {record.metrics.per_class_metrics
                                .map((item) => `${item.class_name} ${formatPercent(item.recall)}`)
                                .join(' · ')}
                            </p>
                          )}
                          {record.metrics?.class_recalls && (
                            <p>
                              Available CV class recalls:{' '}
                              {Object.entries(record.metrics.class_recalls)
                                .map(([name, value]) => `${name} ${formatPercent(value)}`)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="evolution-matrices">
        <ConfusionMatrix
          title="Baseline validation confusion matrix"
          data={baselineRecord?.confusion_matrix}
          onSelectCell={setSelectedCell}
        />
        <ConfusionMatrix
          title={`${candidateRecord?.model || 'Candidate'} validation confusion matrix`}
          data={candidateRecord?.confusion_matrix}
          onSelectCell={setSelectedCell}
        />
        <ConfusionMatrix
          title="Final official-test confusion matrix"
          data={finalConfusion}
          onSelectCell={setSelectedCell}
        />
      </div>
      {selectedCell && (
        <div className="notice evolution-cell-note" role="status">
          {selectedCell.title}: {formatCount(selectedCell.count)} flows were actually{' '}
          <strong>{selectedCell.actual}</strong> and predicted as{' '}
          <strong>{selectedCell.predicted}</strong>. Individual predictions were not retained,
          so this aggregate cannot link to row-level examples.
          <button className="button-small evolution-clear-button" onClick={() => setSelectedCell(null)}>
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}

export default function ModelEvolution({ data, error }) {
  if (error) {
    return (
      <div className="page-shell">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Experiment record</span>
            <h1>Model Evolution</h1>
          </div>
        </div>
        <div className="error-notice" role="alert">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-shell">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Experiment record</span>
            <h1>Model Evolution</h1>
            <p>Loading saved model metadata and experiment results…</p>
          </div>
        </div>
      </div>
    );
  }

  const validation = data.validation_comparison;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Transparent experiment record</span>
          <h1>Model Evolution</h1>
          <p>
            See how the four-class Decision Tree was chosen, what alternatives changed,
            and which conclusions are supported by saved results.
          </p>
        </div>
        <span className="pill">UNSW-NB15 · 4 classes</span>
      </div>

      <div className="notice evolution-pending-notice" role="status">
        <strong>Official-test baseline comparison pending.</strong>{' '}
        {data.official_comparison.reason} No baseline-to-final test delta is shown.
      </div>

      <div className="grid-2 evolution-model-grid">
        <ModelCard
          title={data.baseline.name}
          model={data.baseline}
          metrics={data.baseline.validation_metrics}
          splitLabel="Baseline · validation only"
        />
        <ModelCard
          title={data.final.name}
          model={data.final}
          metrics={data.final.metrics}
          splitLabel="Final · official held-out test"
          final
        />
      </div>

      <ValidationChart comparison={validation} />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Class-by-class validation results</h2>
            <p>
              Baseline and highest validation Macro-F1 candidate, on the same{' '}
              {formatCount(validation.rows)} rows.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th><th>Support</th>
                <th>Baseline recall</th><th>Candidate recall</th><th>Δ recall</th>
                <th>Baseline F1</th><th>Candidate F1</th>
              </tr>
            </thead>
            <tbody>
              {validation.per_class?.map((row) => (
                <tr key={row.class_name}>
                  <td>{row.class_name}</td>
                  <td>{formatCount(row.support)}</td>
                  <td>{formatPercent(row.baseline.recall)}</td>
                  <td>{formatPercent(row.challenger.recall)}</td>
                  <td>{formatDelta(row.recall_delta)}</td>
                  <td>{formatPercent(row.baseline.f1)}</td>
                  <td>{formatPercent(row.challenger.f1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Final model class results · official test</h2>
            <p>
              {formatCount(data.final.metrics.rows)} held-out rows. There is no baseline
              official-test class report to compare against.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Class</th><th>Support</th><th>Precision</th><th>Recall</th><th>F1</th></tr>
            </thead>
            <tbody>
              {data.final.per_class_metrics.map((row) => (
                <tr key={row.class_name}>
                  <td>{row.class_name}</td>
                  <td>{formatCount(row.support)}</td>
                  <td>{formatPercent(row.precision)}</td>
                  <td>{formatPercent(row.recall)}</td>
                  <td>{formatPercent(row.f1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>How the model changed</h2>
            <p>Ordered stages built from saved model metadata, comparison CSVs, and evaluation reports.</p>
          </div>
        </div>
        <ol className="evolution-timeline">
          {data.evolution_stages.map((stage, index) => (
            <li className="evolution-stage" key={stage.stage}>
              <span className="evolution-stage-number">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{stage.stage}</h3>
                <p>{stage.summary}</p>
                {stage.metrics && (
                  <p className="evolution-stage-metrics">
                    Validation Macro-F1 {formatPercent(stage.metrics.macro_f1)} · Accuracy{' '}
                    {formatPercent(stage.metrics.accuracy)} · Normal FAR{' '}
                    {formatPercent(stage.metrics.normal_false_alarm_rate)}
                  </p>
                )}
                {stage.retained_feature_count && (
                  <p className="evolution-stage-metrics">
                    {stage.retained_feature_count} raw predictors retained; no derived-feature
                    engineering recorded.
                  </p>
                )}
                {stage.largest_test_errors?.length > 0 && (
                  <ul className="evolution-errors">
                    {stage.largest_test_errors.map((item) => (
                      <li key={`${item.actual_class}-${item.predicted_class}`}>
                        {formatCount(item.count)} {item.actual_class} flows predicted as {item.predicted_class}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Grouped cross-validation snapshots</h2>
            <p>{data.cross_validation_note}</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Candidate</th><th>Model</th><th>Macro-F1</th><th>Accuracy</th>
                <th>Weighted-F1</th><th>DoS recall</th><th>Fuzzers recall</th><th>Runtime</th>
              </tr>
            </thead>
            <tbody>
              {data.cross_validation_experiments.map((record) => (
                <tr key={record.experiment_id}>
                  <td>{record.candidate}</td>
                  <td>{record.model}</td>
                  <td>{formatPercent(record.metrics.macro_f1)}</td>
                  <td>{formatPercent(record.metrics.accuracy)}</td>
                  <td>{formatPercent(record.metrics.weighted_f1)}</td>
                  <td>{formatPercent(record.metrics.class_recalls.DoS)}</td>
                  <td>{formatPercent(record.metrics.class_recalls.Fuzzers)}</td>
                  <td>{record.cv_seconds.toFixed(1)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="evolution-footnote">
          Saved CV Normal FAR and attack-recall fields are intentionally not displayed:
          their formulas were incorrect, and fold confusion matrices are unavailable for correction.
        </p>
      </section>

      <ExperimentHistory
        validation={data.validation_experiments}
        crossValidation={data.cross_validation_experiments}
        finalConfusion={data.final.confusion_matrix}
      />

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Data and comparison caveats</h2>
            <p>These constraints are part of the experiment record, not hidden from the comparison.</p>
          </div>
        </div>
        <ul className="evolution-notes">
          {data.data_quality_notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
        <p className="evolution-footnote">
          Validation confusion-matrix cells are clickable for aggregate counts. Flow-level
          examples are not available because per-row predictions were not retained.
        </p>
      </section>
    </div>
  );
}
