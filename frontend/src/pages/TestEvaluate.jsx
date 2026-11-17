import React, { useMemo, useState } from 'react';
import ConfusionMatrix from '../components/ConfusionMatrix';
import { explainRow, predictTraffic } from '../services/api';

const samples = [
  { file: 'sample_traffic.csv', label: '500-flow sample' },
  { file: 'sample_attacks.csv', label: 'Attack sample' },
  { file: 'sample_normal.csv', label: 'Normal sample' },
  { file: 'sample_edge_cases.csv', label: 'Edge cases' },
];

function ClassLabel({ name }) {
  return <span className={`class-chip class-${name}`}><span className={`class-dot class-${name}`} />{name}</span>;
}

export default function TestEvaluate({ onAnalysis }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explainError, setExplainError] = useState(null);
  const [explaining, setExplaining] = useState(false);

  const analyzeFile = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedCell(null);
    setSelectedFlow(null);
    setExplanation(null);
    setExplainError(null);
    try {
      const data = await predictTraffic(file);
      setResult(data);
      onAnalysis(data);
    } catch (requestError) {
      setError(requestError.message || 'The CSV could not be analyzed.');
      onAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async (name) => {
    setError(null);
    try {
      const response = await fetch(`/samples/${name}`);
      if (!response.ok) throw new Error(`Sample file request failed (${response.status}).`);
      const file = new File([await response.blob()], name, { type: 'text/csv' });
      await analyzeFile(file);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the sample CSV.');
    }
  };

  const matchingExamples = useMemo(() => {
    if (!selectedCell || !result?.predictions) return [];
    return result.predictions.filter((row) => (
      row.ground_truth?.is_supported
      && row.ground_truth.actual_class === selectedCell.actual
      && row.predicted_class === selectedCell.predicted
    )).slice(0, 10);
  }, [result, selectedCell]);

  const inspectFlow = async (row) => {
    setSelectedFlow(row);
    setExplanation(null);
    setExplainError(null);
    setExplaining(true);
    try {
      setExplanation(await explainRow(row.features));
    } catch (requestError) {
      setExplainError(requestError.message || 'Could not explain this prediction.');
    } finally {
      setExplaining(false);
    }
  };

  const metrics = result?.evaluation_metrics;
  const total = result?.summary?.total_rows || 0;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Dataset workflow</div>
          <h1>Test &amp; Evaluate</h1>
          <p>Upload an UNSW-NB15 flow CSV containing the model’s 42 input features. If supported ground-truth labels are present, the API reports evaluation metrics separately from inference.</p>
        </div>
      </div>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Analyze a flow dataset</h2>
            <p>CSV rows only; a raw packet capture is not a feature-ready dataset.</p>
          </div>
          <span className="pill">42 required features</span>
        </div>
        <div className="file-actions">
          <input
            className="input"
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose flow CSV file"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) analyzeFile(file);
              event.target.value = '';
            }}
          />
          <span className="muted small">or load a repository sample:</span>
          {samples.map((sample) => (
            <button
              className="button-secondary button-small"
              key={sample.file}
              disabled={loading}
              onClick={() => loadSample(sample.file)}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="error-notice" role="alert">{error}</div>}
      {loading && <div className="loading" role="status">Validating the CSV and running the fitted v3 pipeline…</div>}

      {result && (
        <>
          {result.pipeline_stages?.some((stage) => stage.status === 'error') && (
            <div className="error-notice">
              {result.pipeline_stages.find((stage) => stage.status === 'error')?.summary}
            </div>
          )}

          <div className="metric-grid">
            <div className="metric-card"><div className="metric-label">Rows processed</div><div className="metric-value">{total.toLocaleString()}</div><div className="metric-note">CSV flow records</div></div>
            <div className="metric-card"><div className="metric-label">Predicted attacks</div><div className="metric-value">{result.summary.attack_count.toLocaleString()}</div><div className="metric-note">Exploits, Fuzzers, or DoS</div></div>
            <div className="metric-card"><div className="metric-label">Predicted Normal</div><div className="metric-value">{result.summary.normal_count.toLocaleString()}</div><div className="metric-note">Model prediction count</div></div>
            <div className="metric-card"><div className="metric-label">Low-confidence rows</div><div className="metric-value">{result.summary.low_confidence_count.toLocaleString()}</div><div className="metric-note">Confidence below 60%</div></div>
          </div>

          <section className="card">
            <div className="section-heading">
              <div><h2>Inference pipeline</h2><p>Completed stages reported by the backend for this file.</p></div>
              <span className="pill">{result.model_version}</span>
            </div>
            <div className="flow-grid">
              {(result.pipeline_stages || []).map((stage, index) => (
                <div className="flow-step" key={stage.stage}>
                  <span className="step-number">STEP {index + 1} · {stage.status.toUpperCase()}</span>
                  <strong>{stage.stage.replaceAll('_', ' ')}</strong>
                  <p>{stage.summary}</p>
                </div>
              ))}
            </div>
          </section>

          {metrics ? (
            <>
              <div className="metric-grid">
                <div className="metric-card"><div className="metric-label">Accuracy</div><div className="metric-value">{(metrics.accuracy * 100).toFixed(1)}%</div><div className="metric-note">{metrics.supported_rows.toLocaleString()} supported labeled rows</div></div>
                <div className="metric-card"><div className="metric-label">Macro F1</div><div className="metric-value">{(metrics.macro_f1 * 100).toFixed(1)}%</div><div className="metric-note">Mean of per-class F1 scores</div></div>
                <div className="metric-card"><div className="metric-label">Pooled attack recall</div><div className="metric-value">{(metrics.attack_recall * 100).toFixed(1)}%</div><div className="metric-note">Actual attacks predicted as any attack</div></div>
                <div className="metric-card"><div className="metric-label">Excluded labels</div><div className="metric-value">{metrics.excluded_rows.toLocaleString()}</div><div className="metric-note">Unsupported ground-truth classes</div></div>
              </div>

              <ConfusionMatrix
                data={metrics.confusion_matrix}
                title="Uploaded dataset confusion matrix"
                selectedCell={selectedCell}
                onCellClick={(actual, predicted, count) => setSelectedCell({ actual, predicted, count })}
              />
              {selectedCell && (
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2><ClassLabel name={selectedCell.actual} /> <span className="muted">predicted as</span> <ClassLabel name={selectedCell.predicted} /></h2>
                      <p>{selectedCell.count.toLocaleString()} rows in this confusion-matrix cell.</p>
                    </div>
                  </div>
                  {matchingExamples.length ? (
                    <>
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead><tr><th>Row</th><th>Prediction</th><th>Confidence</th><th>Action</th></tr></thead>
                          <tbody>{matchingExamples.map((row) => (
                            <tr key={row.row_index}>
                              <td>{row.row_index + 1}</td>
                              <td><ClassLabel name={row.predicted_class} /></td>
                              <td>{(row.confidence * 100).toFixed(1)}%</td>
                              <td><button className="button-small" onClick={() => inspectFlow(row)}>Inspect path</button></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      {total > (result.predictions?.length || 0) && <p className="muted small">Examples are drawn from the first {result.predictions.length.toLocaleString()} returned rows; the matrix count covers all labeled rows.</p>}
                    </>
                  ) : <div className="empty-state">No matching example is present in the returned prediction sample.</div>}
                </section>
              )}
            </>
          ) : (
            <div className="notice">No supported ground-truth labels were available. This run contains predictions only; accuracy and confusion metrics are not calculated.</div>
          )}

          <section className="card">
            <div className="section-heading">
              <div><h2>Returned flow predictions</h2><p>Rows are limited to the first 1,000 predictions in the API response.</p></div>
              <span className="pill">{result.predictions?.length || 0} rows</span>
            </div>
            {result.predictions?.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Row</th><th>Predicted class</th><th>Confidence</th><th>Ground truth</th><th>Match</th><th>Explanation</th></tr></thead>
                  <tbody>{result.predictions.slice(0, 50).map((row) => (
                    <tr key={row.row_index}>
                      <td>{row.row_index + 1}</td>
                      <td><ClassLabel name={row.predicted_class} /></td>
                      <td>{(row.confidence * 100).toFixed(1)}%</td>
                      <td>{row.ground_truth?.is_supported ? row.ground_truth.actual_class : row.ground_truth?.has_ground_truth ? 'Unsupported' : '—'}</td>
                      <td>{row.ground_truth?.is_correct === true ? 'Correct' : row.ground_truth?.is_correct === false ? 'Incorrect' : '—'}</td>
                      <td><button className="button-small" onClick={() => inspectFlow(row)}>Inspect path</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <div className="empty-state">The API returned no prediction rows.</div>}
          </section>

          {selectedFlow && (
            <section className="card">
              <div className="section-heading">
                <div><h2>Decision path · row {selectedFlow.row_index + 1}</h2><p>Exact route taken through the fitted Decision Tree.</p></div>
                {explanation && <ClassLabel name={explanation.predicted_class} />}
              </div>
              {explaining && <p className="muted small">Loading the fitted tree path…</p>}
              {explainError && <div className="error-notice">{explainError}</div>}
              {explanation && (
                <div className="path-list">
                  {explanation.decision_path_details.map((step) => (
                    <div className="path-item" key={step.node_id}>
                      #{step.node_id} · {step.is_leaf
                        ? `leaf → ${step.predicted_class} (${step.samples.toLocaleString()} training samples)`
                        : `${step.feature} ${step.operator} ${step.threshold} · value ${step.value} → ${step.direction} (${step.samples.toLocaleString()} training samples)`}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
