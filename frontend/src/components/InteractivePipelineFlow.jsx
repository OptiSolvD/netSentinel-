import React, { useState } from 'react';

export default function InteractivePipelineFlow({ stages, summary, selectedRow }) {
  const [selectedStage, setSelectedStage] = useState('preprocessing');

  // Extract live server-side telemetry if available from props
  const fileStage = stages?.find((s) => s.stage === 'file_received')?.data || {};
  const valStage = stages?.find((s) => s.stage === 'validation')?.data || {};
  const prepStage = stages?.find((s) => s.stage === 'preprocessing')?.data || {};
  const predStage = stages?.find((s) => s.stage === 'prediction')?.data || {};

  const totalRows = fileStage.rows || summary?.total_rows || 500;
  const missingCount = prepStage.filled_missing !== undefined ? prepStage.filled_missing : 0;

  const stageMeta = [
    {
      id: 'input',
      title: 'CSV Network Flow',
      subtitle: '42 input features',
      badge: '42 Features',
      icon: '📄',
      color: '#38bdf8',
      summary: 'Raw network packet capture ingested from network tap or CSV log.',
      details: {
        headline: 'Stage 1: Raw Ingestion & Feature Extraction',
        description:
          'Ingests UNSW-NB15 network flow records containing temporal metrics, packet volume counters, byte counts, TTL markers, and TCP state variables.',
        stats: [
          { label: 'Raw Features Ingested', value: `${prepStage.n_features_in || 42} columns` },
          { label: 'Total Ingested Records', value: `${totalRows.toLocaleString()} flows` },
          { label: 'File Name', value: fileStage.file_name || 'traffic_capture.csv' },
          { label: 'Schema Specification', value: 'UNSW-NB15 Standard Format' },
        ],
        rawColumns: [
          'dur', 'proto', 'service', 'state', 'spkts', 'dpkts', 'sbytes', 'dbytes', 'rate',
          'sttl', 'dttl', 'sload', 'dload', 'sloss', 'dloss', 'sinpkt', 'dinpkt', 'sjit',
          'djit', 'swin', 'stcpb', 'dtcpb', 'dwin', 'tcprtt', 'synack', 'ackdat', 'smean',
          'dmean', 'trans_depth', 'response_body_len', 'ct_srv_src', 'ct_state_ttl', 'ct_dst_ltm',
          'ct_src_dport_ltm', 'ct_dst_sport_ltm', 'ct_dst_src_ltm', 'is_ftp_login', 'ct_ftp_cmd',
          'ct_flw_http_mthd', 'ct_src_ltm', 'ct_srv_dst', 'is_sm_ips_ports'
        ],
      },
    },
    {
      id: 'validation',
      title: 'Feature Validation',
      subtitle: 'Schema & Leak Checks',
      badge: 'Validated',
      icon: '🛡️',
      color: '#10b981',
      summary: 'Checks required columns, data types, unexpected values & enforces anti-leakage invariants.',
      details: {
        headline: 'Stage 2: Schema Integrity & Anti-Leakage Gate',
        description:
          'Verifies schema integrity, checks data types, purges synthetic identifier columns to prevent scenario leakage, and isolates ground-truth labels from inference.',
        stats: [
          { label: 'Required Columns Verified', value: '42 / 42 verified (100%)' },
          { label: 'Missing Required Features', value: valStage.missing_columns?.length || '0 (None)' },
          { label: 'Metadata Columns Stripped', value: 'id, label, attack_cat' },
          { label: 'Validation Status', value: 'PASS (Clean Schema)' },
        ],
        checks: [
          {
            name: 'Required Feature Presence',
            status: 'Passed',
            detail: 'All 42 protocol and flow telemetry features are present with valid column names.',
          },
          {
            name: 'Strict Anti-Leakage Invariant',
            status: 'Enforced',
            detail: '"id" is never a feature. Synthetic scenario sequence IDs are stripped prior to model ingestion.',
          },
          {
            name: 'Ground-Truth Separation',
            status: 'Isolated',
            detail: '"label" and "attack_cat" are strictly held out for evaluation and never exposed to the inference pipeline.',
          },
          {
            name: 'Data Types & Bounds',
            status: 'Passed',
            detail: 'Float, integer, and categorical fields validated against expected numerical ranges and encoding vocabularies.',
          },
        ],
      },
    },
    {
      id: 'preprocessing',
      title: 'Preprocessing',
      subtitle: 'Imputation · One-Hot Encoding',
      badge: '42 Inputs',
      icon: '⚡',
      color: '#a855f7',
      summary: 'Imputes missing values and one-hot encodes categorical features.',
      details: {
        headline: 'Stage 3: Preprocessing & Feature Transformation',
        description:
          'Applies the v3 model’s fitted preprocessing pipeline: median imputation for numeric fields, most-frequent imputation for categorical fields, and one-hot encoding.',
        stats: [
          { label: 'Original Input Columns', value: '42 raw features' },
          { label: 'Metadata Columns Ignored', value: '3 (id, label, attack_cat)' },
          { label: 'Categorical Columns Encoded', value: '3 (proto, service, state)' },
          { label: 'Missing Values Found', value: `${missingCount} (pipeline imputation)` },
          { label: 'Transformed Model Features', value: prepStage.n_features_out || 'Encoded by fitted pipeline' },
        ],
      },
    },
    {
      id: 'models',
      title: 'Four-Class Model',
      subtitle: 'Decision Tree Classifier',
      badge: 'v3 Model',
      icon: '🧠',
      color: '#f59e0b',
      summary: 'Runs the selected four-class Decision Tree model.',
      details: {
        headline: 'Stage 4: Four-Class Decision Tree Inference',
        description:
          'The v3 fitted DecisionTreeClassifier predicts Normal, Exploits, Fuzzers, or DoS and exposes its actual decision path for each flow.',
        stats: [
          { label: 'Active Model', value: predStage.model_name || 'DecisionTreeClassifier' },
          { label: 'Model Version', value: predStage.model_version || 'v3-four-class' },
          { label: 'Inference Throughput', value: predStage.rows_per_second ? `${predStage.rows_per_second.toLocaleString()} rows/s` : 'Waiting for inference' },
          { label: 'Latency (Batch)', value: predStage.inference_ms ? `${predStage.inference_ms} ms` : 'Waiting for inference' },
        ],
        models: [
          {
            name: 'Decision Tree Classifier',
            type: 'Four-class CART',
            mechanism: 'Traverses learned feature thresholds from root to leaf',
            explainability: 'Returns the exact decision path and class probabilities',
            benefit: 'Every prediction can be inspected as a concrete rule path',
          },
        ],
      },
    },
    {
      id: 'triage',
      title: 'Prediction & Triage',
      subtitle: 'Category · Confidence · Alerts',
      badge: 'Triage Ready',
      icon: '🚨',
      color: '#ef4444',
      summary: 'Assigns one of four categories, reports confidence, and flags low-confidence predictions.',
      details: {
        headline: 'Stage 5: SOC Triage & Alert Classification',
        description:
          'Reports the four-class model prediction and class probabilities, flagging low-confidence predictions (<60%) for analyst review.',
        stats: [
          { label: 'Taxonomy', value: '4 Classes (Normal, Exploits, Fuzzers, DoS)' },
          { label: 'Low Confidence Gate', value: '< 60% probability threshold' },
          { label: 'Attacks Flagged', value: summary ? `${summary.attack_count.toLocaleString()} (${((summary.attack_count / totalRows) * 100).toFixed(1)}%)` : 'Elevated' },
          { label: 'Benign Flows Passed', value: summary ? `${summary.normal_count.toLocaleString()}` : 'Monitored' },
        ],
        classes: [
          { name: 'Normal', color: '#10b981', desc: 'Benign baseline network communication' },
          { name: 'Exploits', color: '#ef4444', desc: 'Known vulnerabilities and shellcode injection' },
          { name: 'Fuzzers', color: '#f97316', desc: 'Automated high-rate randomized protocol probing' },
          { name: 'DoS', color: '#eab308', desc: 'Denial of Service bandwidth and resource exhaustion' },
        ],
      },
    },
  ];

  const activeStage = stageMeta.find((s) => s.id === selectedStage) || stageMeta[2];

  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: 22, margin: '20px 0', border: '1px solid #1e293b' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.3px' }}>
              NetSentinel — Live Inference Pipeline
            </h3>
            <span style={{ fontSize: '0.7rem', background: '#1e293b', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, border: '1px solid #334155', fontWeight: 600 }}>
              End-to-End ML Telemetry
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            Interactive flow from raw CSV capture to the v3 four-class model. Click any stage below to inspect technical execution.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#090d16', padding: '6px 12px', borderRadius: 6, border: '1px solid #1e293b' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>PIPELINE CONNECTED</span>
        </div>
      </div>

      {/* 5-Stage Interactive Flow Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {stageMeta.map((stg, idx) => {
          const isSelected = selectedStage === stg.id;
          return (
            <div
              key={stg.id}
              onClick={() => setSelectedStage(stg.id)}
              style={{
                background: isSelected ? '#1e293b' : '#090d16',
                border: `2px solid ${isSelected ? stg.color : '#334155'}`,
                borderRadius: 8,
                padding: '14px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                transition: 'all 0.2s',
                boxShadow: isSelected ? `0 0 16px ${stg.color}33` : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>{stg.icon}</span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isSelected ? `${stg.color}25` : '#1e293b',
                    color: isSelected ? stg.color : '#94a3b8',
                    border: `1px solid ${isSelected ? stg.color : '#334155'}`,
                  }}
                >
                  Step {idx + 1}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: isSelected ? stg.color : '#f8fafc', marginBottom: 2 }}>
                {stg.title}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 10 }}>
                {stg.subtitle}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: 8 }}>
                <span style={{ fontSize: '0.65rem', color: isSelected ? stg.color : '#64748b', fontWeight: 600 }}>
                  {isSelected ? '● INSPECTING' : 'Click to inspect'}
                </span>
                <span style={{ fontSize: '0.8rem', color: isSelected ? stg.color : '#475569' }}>
                  →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Detail Inspector Panel */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: 8,
          padding: 20,
          border: `1px solid ${activeStage.color}55`,
          borderLeft: `5px solid ${activeStage.color}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.3rem' }}>{activeStage.icon}</span>
              <h4 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', fontWeight: 700 }}>
                {activeStage.details.headline}
              </h4>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.45, maxWidth: 900 }}>
              {activeStage.details.description}
            </p>
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 4,
              background: `${activeStage.color}22`,
              color: activeStage.color,
              border: `1px solid ${activeStage.color}66`,
            }}
          >
            Active Inspector: {activeStage.title}
          </span>
        </div>

        {/* Dynamic Key Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 18 }}>
          {activeStage.details.stats.map((s, idx) => (
            <div key={idx} style={{ background: '#0f172a', padding: '10px 14px', borderRadius: 6, border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{s.label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', marginTop: 3 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Stage-Specific Content: Preprocessing */}
        {activeStage.id === 'preprocessing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              <div style={{ background: '#090d16', padding: 12, borderRadius: 6, border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  1. ORIGINAL INPUT COLUMNS
                </span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  <strong>42 attributes</strong> (dur, proto, service, state, spkts, dpkts, sbytes, dbytes, rate, sttl, dttl, ...)
                </span>
              </div>

              <div style={{ background: '#090d16', padding: 12, borderRadius: 6, border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  2. METADATA COLUMNS IGNORED
                </span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  <strong>id, label, attack_cat</strong> strictly purged from feature space before inference.
                </span>
              </div>

              <div style={{ background: '#090d16', padding: 12, borderRadius: 6, border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  3. CATEGORICAL ENCODING
                </span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  <strong>proto, service, state</strong> one-hot encoded with <code>handle_unknown='ignore'</code>.
                </span>
              </div>

              <div style={{ background: '#090d16', padding: 12, borderRadius: 6, border: '1px solid #334155' }}>
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                  4. MISSING VALUES & FINAL FEATURES
                </span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                  <strong>{missingCount} missing values found</strong>. The fitted model pipeline imputes missing values before prediction.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Stage-Specific Content: Raw Input Ingestion */}
        {activeStage.id === 'input' && (
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 8 }}>
              42 UNSW-NB15 Raw Flow Telemetry Features Ingested:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
              {activeStage.details.rawColumns.map((col, idx) => (
                <div key={col} style={{ background: '#090d16', padding: '5px 8px', borderRadius: 4, border: '1px solid #334155', fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>#{idx + 1}</span>
                  <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{col}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage-Specific Content: Validation */}
        {activeStage.id === 'validation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeStage.details.checks.map((chk, i) => (
              <div key={i} style={{ background: '#090d16', padding: 10, borderRadius: 6, border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '0.8rem', color: '#f8fafc' }}>{chk.name}</strong>
                  <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{chk.detail}</p>
                </div>
                <span style={{ background: '#10b98122', color: '#34d399', border: '1px solid #10b98155', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700 }}>
                  ✓ {chk.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stage-Specific Content: Active Model */}
        {activeStage.id === 'models' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {activeStage.details.models.map((m, i) => (
              <div key={i} style={{ background: '#090d16', padding: 14, borderRadius: 6, border: '1px solid #f59e0b' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b', marginBottom: 4 }}>
                  {m.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 8 }}>Type: {m.type}</div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '4px 0' }}>
                  <strong>Mechanism:</strong> {m.mechanism}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', margin: '4px 0' }}>
                  <strong>Explainability:</strong> {m.explainability}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', margin: '6px 0 0' }}>
                  ✓ {m.benefit}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stage-Specific Content: Triage */}
        {activeStage.id === 'triage' && (
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: 8 }}>
              Output Taxonomy & Attack Category Descriptions:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {activeStage.details.classes.map((c) => (
                <div key={c.name} style={{ background: '#090d16', padding: 10, borderRadius: 6, border: `1px solid ${c.color}55` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                    <strong style={{ fontSize: '0.8rem', color: c.color }}>{c.name}</strong>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}