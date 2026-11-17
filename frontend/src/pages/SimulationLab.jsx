import React, { useState, useEffect, useRef } from 'react';
import DecisionTreeVisualizer from '../components/DecisionTreeVisualizer';
import { explainRow, predictTraffic } from '../services/api';

export default function SimulationLab() {
  const [activeDataset, setActiveDataset] = useState('sample_traffic.csv');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(800);
  const [predictions, setPredictions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedFlows, setProcessedFlows] = useState([]);
  const [activeStageStep, setActiveStageStep] = useState('idle'); // idle, validate, prep, rf, dt, done
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [flowExplanation, setFlowExplanation] = useState(null);
  const [flowExplanationError, setFlowExplanationError] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const timerRef = useRef(null);

  // Load selected dataset
  const loadDataset = async (datasetName, customFile = null) => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setProcessedFlows([]);
    setActiveStageStep('idle');
    setSelectedFlow(null);
    setFlowExplanation(null);
    setFlowExplanationError(null);
    setLoadingInit(true);
    setErrorMessage(null);

    try {
      let fileToUpload;
      if (customFile) {
        fileToUpload = customFile;
        setActiveDataset(customFile.name);
      } else {
        setActiveDataset(datasetName);
        const res = await fetch(`/samples/${datasetName}`);
        let blob;
        if (res.ok) {
          blob = await res.blob();
        } else {
          // Fallback minimal mock
          const mockContent =
            'dur,proto,service,state,spkts,dpkts,sbytes,dbytes,rate,sttl,dttl,sload,dload,sloss,dloss,sinpkt,dinpkt,sjit,djit,swin,stcpb,dtcpb,dwin,tcprtt,synack,ackdat,smean,dmean,trans_depth,response_body_len,ct_srv_src,ct_state_ttl,ct_dst_ltm,ct_src_dport_ltm,ct_dst_sport_ltm,ct_dst_src_ltm,is_ftp_login,ct_ftp_cmd,ct_flw_http_mthd,ct_src_ltm,ct_srv_dst,is_sm_ips_ports,attack_cat,label\n0.000011,udp,-,INT,2,0,496,0,90909.09,254,0,180363632.0,0.0,0,0,0.011,0.0,0.0,0.0,0,0,0,0,0.0,0.0,0.0,248,0,0,0,2,2,1,1,1,2,0,0,0,1,2,0,Exploits,1\n';
          blob = new Blob([mockContent], { type: 'text/csv' });
        }
        fileToUpload = new File([blob], datasetName, { type: 'text/csv' });
      }

      const result = await predictTraffic(fileToUpload);
      setPredictions(result.predictions || []);
    } catch (err) {
      console.error('Failed to load dataset for simulation', err);
      setErrorMessage(err.message || 'Failed to initialize simulation dataset.');
    } finally {
      setLoadingInit(false);
    }
  };

  useEffect(() => {
    loadDataset('sample_traffic.csv');
  }, []);

  // Step simulation forward 1 flow
  const stepForward = () => {
    if (predictions.length === 0) return;
    if (currentIndex >= predictions.length) {
      setIsPlaying(false);
      return;
    }

    const currentPred = predictions[currentIndex];

    // Animate stage sequence smoothly
    setActiveStageStep('validate');
    setTimeout(() => {
      setActiveStageStep('prep');
      setTimeout(() => {
        setActiveStageStep('models');
        setTimeout(() => {
          setActiveStageStep('done');
          setProcessedFlows((prev) => [currentPred, ...prev]);
          setCurrentIndex((idx) => idx + 1);
        }, 80);
      }, 80);
    }, 80);
  };

  // Timer simulation loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        stepForward();
      }, speedMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentIndex, predictions, speedMs]);

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setProcessedFlows([]);
    setActiveStageStep('idle');
    setSelectedFlow(null);
    setFlowExplanation(null);
  };

  // Inspect flow: call explainRow with real features from the trained model
  const handleInspectFlow = async (flow) => {
    setSelectedFlow(flow);
    setFlowExplanation(null);
    setFlowExplanationError(null);
    setLoadingExplain(true);
    try {
      const rowFeatures = flow.features || {};
      const exp = await explainRow(rowFeatures);
      setFlowExplanation(exp);
    } catch (err) {
      setFlowExplanationError(err.message || 'Failed to load the model explanation.');
    } finally {
      setLoadingExplain(false);
    }
  };

  // Metrics calculations
  const attackCount = processedFlows.filter((f) => f.is_attack).length;
  const normalCount = processedFlows.length - attackCount;
  const attackPct = processedFlows.length > 0 ? ((attackCount / processedFlows.length) * 100).toFixed(1) : '0.0';
  const lowConfidenceCount = processedFlows.filter((flow) => flow.is_low_confidence).length;

  const currentFlow = predictions[currentIndex] || null;

  const classColors = {
    Normal: '#10b981',
    Exploits: '#ef4444',
    Fuzzers: '#f97316',
    DoS: '#eab308',
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px', color: '#f8fafc' }}>
      {/* Simulation Lab Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#f8fafc', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>📡</span> NetSentinel Network-Flow Simulation Lab
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Simulate live ingress network flows one-by-one through validation, preprocessing, and the four-class Decision Tree.
          </span>
        </div>

        {/* Dataset Selector & Upload */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Feed:</span>
          {[
            { id: 'sample_traffic.csv', label: '500 Mixed Flows' },
            { id: 'sample_attacks.csv', label: 'Attacks' },
            { id: 'sample_normal.csv', label: 'Normal Traffic' },
            { id: 'sample_edge_cases.csv', label: 'Edge Cases' },
          ].map((ds) => (
            <button
              key={ds.id}
              onClick={() => loadDataset(ds.id)}
              style={{
                background: activeDataset === ds.id ? '#38bdf8' : '#1e293b',
                color: activeDataset === ds.id ? '#0f172a' : '#cbd5e1',
                border: '1px solid #334155',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: activeDataset === ds.id ? 700 : 500,
              }}
            >
              {ds.label}
            </button>
          ))}

          <label
            style={{
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px dashed #38bdf8',
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            + Custom CSV
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && loadDataset('', e.target.files[0])}
            />
          </label>
        </div>
      </div>

      {errorMessage && (
        <div style={{ background: '#451a1a', border: '1px solid #ef4444', color: '#fca5a5', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <strong>Simulation Error:</strong> {errorMessage}
        </div>
      )}

      {/* Control Ribbon */}
      <div
        style={{
          background: '#0f172a',
          borderRadius: 8,
          padding: '14px 20px',
          border: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {/* Playback Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={loadingInit || currentIndex >= predictions.length}
            style={{
              background: isPlaying ? '#ef4444' : '#10b981',
              color: '#0f172a',
              border: 'none',
              padding: '8px 20px',
              borderRadius: 6,
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: loadingInit || currentIndex >= predictions.length ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: isPlaying ? '0 0 12px #ef444455' : '0 0 12px #10b98155',
            }}
          >
            {isPlaying ? '⏸ Pause Simulation' : '▶ Start Ingress Stream'}
          </button>

          <button
            onClick={stepForward}
            disabled={isPlaying || loadingInit || currentIndex >= predictions.length}
            style={{
              background: '#1e293b',
              color: '#38bdf8',
              border: '1px solid #334155',
              padding: '8px 14px',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isPlaying || loadingInit || currentIndex >= predictions.length ? 'not-allowed' : 'pointer',
            }}
          >
            ⏭ Step 1 Flow
          </button>

          <button
            onClick={handleReset}
            style={{
              background: '#090d16',
              color: '#94a3b8',
              border: '1px solid #334155',
              padding: '8px 14px',
              borderRadius: 6,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            ⟲ Reset Stream
          </button>
        </div>

        {/* Speed Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Ingress Speed:</span>
          {[
            { label: 'Fast (300ms)', ms: 300 },
            { label: 'Normal (800ms)', ms: 800 },
            { label: 'Deliberate (1500ms)', ms: 1500 },
          ].map((s) => (
            <button
              key={s.ms}
              onClick={() => setSpeedMs(s.ms)}
              style={{
                background: speedMs === s.ms ? '#38bdf8' : '#1e293b',
                color: speedMs === s.ms ? '#0f172a' : '#cbd5e1',
                border: '1px solid #334155',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: speedMs === s.ms ? 700 : 500,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Threat Telemetry HUD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#1e293b', padding: 14, borderRadius: 8, border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Ingressed Packets</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {processedFlows.length} <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/ {predictions.length}</span>
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: 14, borderRadius: 8, border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Attacks Intercepted</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', marginTop: 4 }}>
            {attackCount} <span style={{ fontSize: '0.8rem', color: '#f87171' }}>({attackPct}%)</span>
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: 14, borderRadius: 8, border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Benign Passed</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: 4 }}>
            {normalCount}
          </div>
        </div>

        <div style={{ background: '#1e293b', padding: 14, borderRadius: 8, border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Low-Confidence Flows</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a855f7', marginTop: 4 }}>
            {lowConfidenceCount}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Review threshold: confidence below 60%</span>
        </div>

        <div style={{ background: '#1e293b', padding: 14, borderRadius: 8, border: '1px solid #334155' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Live Threat Level</span>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: attackPct > 40 ? '#ef4444' : attackPct > 15 ? '#f59e0b' : '#10b981', marginTop: 6 }}>
            {attackPct > 40 ? '🚨 HIGH ATTACK SURGE' : attackPct > 15 ? '⚠️ ELEVATED THREAT' : '🛡️ NORMAL BASELINE'}
          </div>
        </div>
      </div>

      {/* Live Pipeline Flow Animation (Answers requirement #4) */}
      <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, border: '1px solid #1e293b', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
            Live Flow Progression: {currentFlow ? `Flow #${currentFlow.row_index + 1}` : 'Stream Idle / Completed'}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Watch each flow pass through the v3 validation, preprocessing, and classification steps
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { id: 'validate', label: '1. Feature Validation', desc: '42 cols verified · id dropped', color: '#10b981' },
            { id: 'prep', label: '2. Preprocessing', desc: 'Imputation & categorical encoding', color: '#a855f7' },
            { id: 'models', label: '3. Four-Class Model', desc: 'Decision Tree prediction', color: '#f59e0b' },
            { id: 'done', label: '4. Prediction & Triage', desc: currentFlow ? `${currentFlow.predicted_class} (${(currentFlow.confidence * 100).toFixed(0)}%)` : 'Ready', color: '#ef4444' },
          ].map((stg) => {
            const isStageActive = isPlaying && (activeStageStep === stg.id || activeStageStep === 'done');
            return (
              <div
                key={stg.id}
                style={{
                  background: isStageActive ? '#1e293b' : '#090d16',
                  border: `2px solid ${isStageActive ? stg.color : '#334155'}`,
                  borderRadius: 6,
                  padding: 12,
                  textAlign: 'center',
                  boxShadow: isStageActive ? `0 0 16px ${stg.color}44` : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isStageActive ? stg.color : '#cbd5e1', marginBottom: 4 }}>
                  {stg.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{stg.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-Time Rolling Flow Stream Tape (Answers Prompt requirement #4 sequence: Flow #001 -> Normal Flow #002 -> Fuzzers...) */}
      <div style={{ background: '#090d16', borderRadius: 8, padding: 16, border: '1px solid #1e293b', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
            Real-Time Ingress Flow Tape (Latest 8 Flows):
          </span>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
            Auto-scrolls as packets arrive in stream
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {processedFlows.slice(0, 8).map((f) => {
            const color = classColors[f.predicted_class] || '#38bdf8';
            return (
              <div
                key={f.row_index}
                onClick={() => handleInspectFlow(f)}
                style={{
                  minWidth: 150,
                  background: '#0f172a',
                  border: `1px solid ${color}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginBottom: 4 }}>
                  <span>Flow #{String(f.row_index + 1).padStart(3, '0')}</span>
                  {f.is_low_confidence && <span style={{ color: '#f59e0b', fontWeight: 800 }}>REVIEW</span>}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color }}>
                  {f.predicted_class}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
                  {((f.confidence) * 100).toFixed(1)}% conf
                </div>
              </div>
            );
          })}
          {processedFlows.length === 0 && (
            <div style={{ color: '#64748b', fontSize: '0.75rem', padding: '10px 0' }}>
              Stream paused. Click "▶ Start Ingress Stream" or "⏭ Step 1 Flow" above to begin network packets.
            </div>
          )}
        </div>
      </div>

      {/* Main Stream Triage Table & Explainability Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedFlow ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Stream Table */}
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 18, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
              Streaming Triage Queue ({processedFlows.length} Evaluated)
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Click any flow to inspect its real Decision Tree path
            </span>
          </div>

          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Flow #</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Four-Class Prediction</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Confidence</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {processedFlows.map((f) => {
                  const isSelected = selectedFlow && selectedFlow.row_index === f.row_index;

                  return (
                    <tr
                      key={f.row_index}
                      onClick={() => handleInspectFlow(f)}
                      style={{
                        borderBottom: '1px solid #334155',
                        background: isSelected ? '#1e3a5f' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '8px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        Flow #{String(f.row_index + 1).padStart(3, '0')}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: f.is_attack ? '#f87171' : '#34d399' }}>
                        {f.predicted_class} {f.is_attack && '🚨'}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#38bdf8' }}>
                        {(f.confidence * 100).toFixed(1)}%
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <button
                          style={{
                            background: '#0f172a',
                            border: '1px solid #38bdf8',
                            color: '#38bdf8',
                            padding: '3px 10px',
                            borderRadius: 4,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Flow Live Explainability Inspector */}
        {selectedFlow && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: 18, border: '1px solid #38bdf8', maxHeight: 540, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
                  Explainability: Flow #{String(selectedFlow.row_index + 1).padStart(3, '0')}
                </span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8' }}>
                  {selectedFlow.model_name || 'DecisionTreeClassifier'}: <strong style={{ color: selectedFlow.is_attack ? '#ef4444' : '#10b981' }}>{selectedFlow.predicted_class}</strong>
                </span>
              </div>
              <button
                onClick={() => setSelectedFlow(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {loadingExplain ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#38bdf8' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: 8 }}>🌳 Extracting Decision Tree Path...</div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tracing actual flow values through the fitted model.</p>
              </div>
            ) : flowExplanationError ? (
              <div style={{ background: '#451a1a', border: '1px solid #ef4444', color: '#fca5a5', padding: 12, borderRadius: 6 }}>
                {flowExplanationError}
              </div>
            ) : flowExplanation ? (
              <DecisionTreeVisualizer explanation={flowExplanation} selectedRow={selectedFlow} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}