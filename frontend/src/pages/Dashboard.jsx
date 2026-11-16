import React, { useState } from 'react';
import PipelineStepper from '../components/PipelineStepper';
import MetricCard from '../components/MetricCard';
import AttackDistribution from '../components/Charts/AttackDistribution';
import ConfusionMatrix from '../components/Charts/ConfusionMatrix';
import PredictionTable from '../components/PredictionTable';
import { predictTraffic } from '../services/api';

export default function Dashboard() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.60);

  const handleFileUpload = async (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setError(null);
    setLoading(true);

    try {
      const data = await predictTraffic(uploadedFile, confidenceThreshold);
      setResult(data);
    } catch (err) {
      setError(err.message || 'An error occurred during inference.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSample = async (sampleName) => {
    // Read pre-packaged sample from public or create mock Blob
    setLoading(true);
    setError(null);
    try {
      // In local dev, fetch sample from backend or public folder
      const res = await fetch(`/samples/${sampleName}`);
      let blob;
      if (res.ok) {
        blob = await res.blob();
      } else {
        // Fallback demo request
        const mockContent = 'dur,proto,service,state,spkts,dpkts,sbytes,dbytes,rate,sttl,dttl,sload,dload,sloss,dloss,sinpkt,dinpkt,sjit,djit,swin,stcpb,dtcpb,dwin,tcprtt,synack,ackdat,smean,dmean,trans_depth,response_body_len,ct_srv_src,ct_state_ttl,ct_dst_ltm,ct_src_dport_ltm,ct_dst_sport_ltm,ct_dst_src_ltm,is_ftp_login,ct_ftp_cmd,ct_flw_http_mthd,ct_src_ltm,ct_srv_dst,is_sm_ips_ports,attack_cat,label\n0.000011,udp,-,INT,2,0,496,0,90909.09,254,0,180363632.0,0.0,0,0,0.011,0.0,0.0,0.0,0,0,0,0,0.0,0.0,0.0,248,0,0,0,2,2,1,1,1,2,0,0,0,1,2,0,Exploits,1\n';
        blob = new Blob([mockContent], { type: 'text/csv' });
      }
      const sampleFile = new File([blob], sampleName, { type: 'text/csv' });
      await handleFileUpload(sampleFile);
    } catch (err) {
      setError(`Failed to load sample: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>
      {/* Offline Training Banner */}
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderLeft: '4px solid #38bdf8',
          padding: '12px 16px',
          borderRadius: 6,
          marginBottom: 24,
          fontSize: '0.85rem',
          color: '#cbd5e1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          ℹ️ <strong>Offline Training Policy</strong>: Models trained offline on UNSW-NB15 benchmark. This console runs live validation, feature engineering, and inference telemetry.
        </span>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Taxonomy: 6 Classes</span>
      </div>

      {/* Upload Zone & Sample Buttons */}
      <div
        style={{
          background: '#0f172a',
          border: '2px dashed #334155',
          borderRadius: 8,
          padding: '32px 24px',
          textAlign: 'center',
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
        <h3 style={{ margin: '0 0 6px', color: '#f8fafc', fontSize: '1.1rem' }}>
          Upload Network Flow Capture (CSV)
        </h3>
        <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '0.85rem' }}>
          Accepts standard UNSW-NB15 42-feature captures (with or without 'id' / ground-truth labels).
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
          <label
            style={{
              background: '#38bdf8',
              color: '#0f172a',
              padding: '8px 18px',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Choose CSV File
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>

          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>or try ready-made demo files:</span>

          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { name: 'sample_traffic.csv', label: 'Sample (500 flows)' },
              { name: 'sample_attacks.csv', label: 'Attacks' },
              { name: 'sample_normal.csv', label: 'Normal' },
              { name: 'sample_edge_cases.csv', label: 'Edge Cases' },
            ].map((s) => (
              <button
                key={s.name}
                onClick={() => handleLoadSample(s.name)}
                style={{
                  background: '#1e293b',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  borderRadius: 4,
                  padding: '6px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {file && (
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#10b981' }}>
            Selected: <strong>{file.name}</strong> ({file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Demo'})
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ background: '#451a1a', border: '1px solid #ef4444', color: '#fca5a5', padding: 14, borderRadius: 6, marginBottom: 20 }}>
          <strong>Error Processing File:</strong> {error}
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: '#38bdf8' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⚙️ Processing Pipeline...</div>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Running schema validation, feature engineering, and dual-model inference...
          </p>
        </div>
      )}

      {/* 5-Stage Execution Stepper */}
      {result && result.pipeline_stages && (
        <PipelineStepper stages={result.pipeline_stages} />
      )}

      {/* Results Dashboard */}
      {result && result.summary && (
        <>
          {/* Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, margin: '20px 0' }}>
            <MetricCard
              title="Total Network Flows"
              value={result.summary.total_rows.toLocaleString()}
              subtitle="Processed through pipeline"
              color="#38bdf8"
              icon="📊"
            />
            <MetricCard
              title="Flagged Attacks"
              value={result.summary.attack_count.toLocaleString()}
              subtitle={`${((result.summary.attack_count / result.summary.total_rows) * 100).toFixed(1)}% of total flows`}
              color="#ef4444"
              icon="🚨"
            />
            <MetricCard
              title="Normal Traffic"
              value={result.summary.normal_count.toLocaleString()}
              subtitle={`${((result.summary.normal_count / result.summary.total_rows) * 100).toFixed(1)}% benign flows`}
              color="#10b981"
              icon="🛡️"
            />
            <MetricCard
              title="Low Confidence Alerts"
              value={result.summary.low_confidence_count.toLocaleString()}
              subtitle="Confidence < 60% (Review recommended)"
              color="#f59e0b"
              icon="⚠️"
            />
            <MetricCard
              title="Model Agreement Rate"
              value={`${(result.summary.model_agreement_rate * 100).toFixed(1)}%`}
              subtitle="Random Forest vs Decision Tree"
              color="#a855f7"
              icon="🤝"
            />
          </div>

          {/* Visual Distribution Charts */}
          <AttackDistribution
            categoryCounts={result.summary.category_counts}
            confidenceDist={result.summary.confidence_distribution}
          />

          {/* Ground-Truth Confusion Matrix (if ground-truth exists) */}
          {result.evaluation_metrics && (
            <ConfusionMatrix evalMetrics={result.evaluation_metrics} />
          )}

          {/* Detailed Prediction Table with Inspector */}
          <PredictionTable
            predictions={result.predictions}
            agreementRate={result.summary.model_agreement_rate}
          />
        </>
      )}
    </div>
  );
}
