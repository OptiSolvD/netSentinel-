import React, { useState } from 'react';
import { predictTraffic } from '../services/api';

export default function LiveTraffic() {
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      setResult(await predictTraffic(file));
    } catch (requestError) {
      setError(requestError.message || 'The flow CSV could not be analyzed.');
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async () => {
    setError(null);
    try {
      const response = await fetch('/samples/sample_traffic.csv');
      if (!response.ok) throw new Error(`Sample file request failed (${response.status}).`);
      analyze(new File([await response.blob()], 'sample_traffic.csv', { type: 'text/csv' }));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load the flow sample.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Offline flow replay</div>
          <h1>Live Traffic</h1>
          <p>This page currently analyzes uploaded flow-feature CSV files. It does not show live packets, capture from an interface, or accept PCAP files.</p>
        </div>
        <span className="pill">Live capture disabled</span>
      </div>

      <div className="error-notice">
        <strong>PCAP replay is not implemented.</strong> The model expects 42 engineered flow features. A packet parser and validated bidirectional flow-feature extractor are required before PCAP or live-capture predictions can be supported.
      </div>

      <section className="card">
        <div className="section-heading">
          <div><h2>Analyze precomputed flows</h2><p>Upload an UNSW-NB15-compatible CSV for a real backend inference run.</p></div>
          <span className="pill">No synthetic traffic</span>
        </div>
        <div className="file-actions">
          <input
            className="input"
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose precomputed flow CSV"
            disabled={loading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) analyze(file);
              event.target.value = '';
            }}
          />
          <button className="button-secondary" disabled={loading} onClick={loadSample}>Analyze repository sample</button>
        </div>
      </section>

      {error && <div className="error-notice" role="alert">{error}</div>}
      {loading && <div className="loading" role="status">Sending {fileName} to the v3 inference API…</div>}
      {result && (
        <section className="card">
          <div className="section-heading">
            <div><h2>CSV analysis result</h2><p>{fileName} · backend model {result.model_version}</p></div>
            <span className="pill">Offline analysis</span>
          </div>
          <div className="metric-grid">
            <div className="metric-card"><div className="metric-label">Rows analyzed</div><div className="metric-value">{result.summary.total_rows.toLocaleString()}</div><div className="metric-note">Precomputed flow rows</div></div>
            <div className="metric-card"><div className="metric-label">Predicted attacks</div><div className="metric-value">{result.summary.attack_count.toLocaleString()}</div><div className="metric-note">Four-class prediction output</div></div>
            <div className="metric-card"><div className="metric-label">Predicted Normal</div><div className="metric-value">{result.summary.normal_count.toLocaleString()}</div><div className="metric-note">Four-class prediction output</div></div>
            <div className="metric-card"><div className="metric-label">Low confidence</div><div className="metric-value">{result.summary.low_confidence_count.toLocaleString()}</div><div className="metric-note">Below the API’s 60% review threshold</div></div>
          </div>
          {result.predictions?.length ? (
            <div className="table-wrap" style={{ marginTop: 18 }}>
              <table className="data-table">
                <thead><tr><th>Flow row</th><th>Class</th><th>Confidence</th><th>Ground truth</th></tr></thead>
                <tbody>{result.predictions.slice(0, 25).map((row) => (
                  <tr key={row.row_index}>
                    <td>{row.row_index + 1}</td>
                    <td><span className={`class-chip class-${row.predicted_class}`}>{row.predicted_class}</span></td>
                    <td>{(row.confidence * 100).toFixed(1)}%</td>
                    <td>{row.ground_truth?.is_supported ? row.ground_truth.actual_class : row.ground_truth?.has_ground_truth ? 'Unsupported label' : 'Not provided'}</td>
                  </tr>
                ))}</tbody>
              </table>
              <p className="muted small">This is a completed batch CSV inference result, not a live stream or packet-by-packet capture.</p>
            </div>
          ) : <div className="empty-state">No prediction rows were returned by the API.</div>}
        </section>
      )}
    </div>
  );
}
