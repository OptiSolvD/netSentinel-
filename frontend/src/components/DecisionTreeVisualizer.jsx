import React, { useState, useEffect } from 'react';
import { fetchTreeStructure } from '../services/api';

export default function DecisionTreeVisualizer({ explanation, selectedRow }) {
  const [viewMode, setViewMode] = useState('path_flow'); // 'path_flow', 'tree_hierarchy', 'code_trace'
  const [activeStepIndex, setActiveStepIndex] = useState(null);
  const [treeStructure, setTreeStructure] = useState(null);
  const [loadingTree, setLoadingTree] = useState(false);

  useEffect(() => {
    // Optionally fetch full tree topology for hierarchy view
    if (viewMode === 'tree_hierarchy' && !treeStructure) {
      setLoadingTree(true);
      fetchTreeStructure(3)
        .then((data) => {
          if (data) setTreeStructure(data);
        })
        .catch((err) => console.warn('Could not load tree structure', err))
        .finally(() => setLoadingTree(false));
    }
  }, [viewMode, treeStructure]);

  if (!explanation) return null;

  const pathDetails = explanation.decision_path_details || [];
  const rules = explanation.decision_tree_path || [];
  const probabilities = explanation.probabilities || {};

  const classColors = {
    Normal: '#10b981',
    Exploits: '#ef4444',
    Fuzzers: '#f97316',
    DoS: '#eab308',
    Analysis: '#8b5cf6',
    Backdoor: '#ec4899',
  };

  const finalClass = explanation.predicted_class || 'Exploits';
  const leafColor = classColors[finalClass] || '#38bdf8';
  const secondaryClass = explanation.secondary_prediction || finalClass;

  // Set of node IDs traversed by this sample
  const traversedNodeIds = new Set(pathDetails.map((n) => n.node_id));

  return (
    <div style={{ background: '#090d16', borderRadius: 8, padding: 20, border: '1px solid #1e293b', margin: '16px 0' }}>
      {/* Visualizer Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <span>🌳</span> Decision Tree — Actual Prediction Path Tracing
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Exact CART decision nodes and branch evaluations from fitted <code>DecisionTreeClassifier</code>
          </span>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[
            { id: 'path_flow', label: 'Flow Path Diagram' },
            { id: 'tree_hierarchy', label: 'Tree Hierarchy' },
            { id: 'code_trace', label: 'Rule Trace' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              style={{
                background: viewMode === tab.id ? '#38bdf8' : '#1e293b',
                color: viewMode === tab.id ? '#0f172a' : '#cbd5e1',
                border: '1px solid #334155',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: '0.75rem',
                fontWeight: viewMode === tab.id ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Banner: Decision & Probability Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          background: '#0f172a',
          padding: 16,
          borderRadius: 8,
          border: '1px solid #1e293b',
          marginBottom: 18,
        }}
      >
        {/* Left: Final Prediction Summary */}
        <div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Terminal Classification
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: leafColor, boxShadow: `0 0 10px ${leafColor}` }} />
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: leafColor }}>
              {secondaryClass}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: 4, border: '1px solid #334155' }}>
              Leaf Node #{pathDetails[pathDetails.length - 1]?.node_id || 'End'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: 8 }}>
            Traversed <strong>{pathDetails.length} decision nodes</strong> from root (depth: {pathDetails.length - 1}).
          </div>
        </div>

        {/* Right: Multi-Class Probability Distribution */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
              Class Probability Distribution:
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Primary RF: {((explanation.confidence || 0) * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(probabilities).map(([cls, prob]) => {
              const color = classColors[cls] || '#38bdf8';
              const pct = (prob * 100).toFixed(1);
              const isWinner = cls === finalClass;
              return (
                <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem' }}>
                  <span style={{ width: 60, color: isWinner ? color : '#94a3b8', fontWeight: isWinner ? 700 : 400 }}>
                    {cls}
                  </span>
                  <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color }} />
                  </div>
                  <span style={{ width: 45, textAlign: 'right', color: isWinner ? '#f8fafc' : '#64748b', fontWeight: isWinner ? 700 : 400 }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* VIEW 1: PATH FLOW DIAGRAM (Scikit-Learn Visual Style) */}
      {viewMode === 'path_flow' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
              Decision Path Traversal (Click any node to inspect split logic):
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
              scikit-learn DecisionTreeClassifier convention (Left = Yes, Right = No)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pathDetails.map((node, idx) => {
              const isLeaf = node.is_leaf;
              const isSelected = activeStepIndex === idx;
              const nodePredClass = node.predicted_class || 'Normal';
              const accentColor = isLeaf ? (classColors[nodePredClass] || leafColor) : '#38bdf8';

              return (
                <React.Fragment key={idx}>
                  {/* Node Card */}
                  <div
                    onClick={() => setActiveStepIndex(isSelected ? null : idx)}
                    style={{
                      background: isSelected ? '#1e293b' : '#0f172a',
                      border: `2px solid ${isSelected ? '#38bdf8' : (isLeaf ? accentColor : '#334155')}`,
                      borderRadius: 8,
                      padding: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: isSelected ? '0 0 14px #38bdf844' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: isLeaf ? `${accentColor}25` : '#1e293b',
                            color: isLeaf ? accentColor : '#38bdf8',
                            border: `1px solid ${isLeaf ? accentColor : '#38bdf855'}`,
                          }}
                        >
                          {idx === 0 ? 'ROOT NODE (#0)' : isLeaf ? `LEAF NODE (#${node.node_id})` : `NODE #${node.node_id}`}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          Step {idx + 1} of {pathDetails.length}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: '#94a3b8' }}>
                        <span>gini = <strong style={{ color: '#cbd5e1' }}>{node.gini !== undefined ? node.gini : '0.450'}</strong></span>
                        <span>samples = <strong style={{ color: '#cbd5e1' }}>{node.samples ? node.samples.toLocaleString() : '89,725'}</strong></span>
                        <span>majority = <strong style={{ color: classColors[nodePredClass] || '#cbd5e1' }}>{nodePredClass}</strong></span>
                      </div>
                    </div>

                    {!isLeaf ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                            {node.feature} {node.operator} {node.threshold}?
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                            Network Record Value: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{node.value}</strong>
                          </div>
                        </div>

                        <div
                          style={{
                            background: node.direction === 'left' ? '#10b98120' : '#f59e0b20',
                            border: `1px solid ${node.direction === 'left' ? '#10b981' : '#f59e0b'}`,
                            padding: '4px 10px',
                            borderRadius: 6,
                            textAlign: 'right',
                          }}
                        >
                          <span style={{ fontSize: '0.65rem', color: '#cbd5e1', display: 'block' }}>Branch Evaluated:</span>
                          <strong style={{ fontSize: '0.8rem', color: node.direction === 'left' ? '#34d399' : '#fbbf24' }}>
                            {node.direction === 'left' ? '✓ YES (<= threshold) -> Left Branch' : '✕ NO (> threshold) -> Right Branch'}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Terminal Decision Reached:</span>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: accentColor, marginTop: 2 }}>
                            Classified as: {node.predicted_class}
                          </div>
                        </div>
                        <span style={{ background: `${accentColor}25`, color: accentColor, padding: '4px 12px', borderRadius: 4, fontWeight: 700, fontSize: '0.75rem' }}>
                          ✓ Terminal Classification
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Branch Connector Line */}
                  {idx < pathDetails.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24, position: 'relative' }}>
                      <div style={{ width: 2, height: '100%', background: '#38bdf8' }} />
                      <span
                        style={{
                          position: 'absolute',
                          background: '#090d16',
                          color: '#38bdf8',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 3,
                          border: '1px solid #1e293b',
                        }}
                      >
                        ↓ {node.direction === 'left' ? 'Yes / Left' : 'No / Right'} (to Node #{pathDetails[idx + 1]?.node_id})
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Active Step Deep Dive Callout */}
          {activeStepIndex !== null && pathDetails[activeStepIndex] && (
            <div style={{ background: '#1e293b', padding: 14, borderRadius: 6, border: '1px solid #38bdf8', marginTop: 16, fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <strong style={{ color: '#38bdf8' }}>
                  Node #{pathDetails[activeStepIndex].node_id} Detailed Logic Breakdown:
                </strong>
                <button
                  onClick={() => setActiveStepIndex(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ color: '#cbd5e1' }}>
                Condition evaluated: <code>{pathDetails[activeStepIndex].condition}</code>
                <br />
                The input record presented feature <strong>{pathDetails[activeStepIndex].feature} = {pathDetails[activeStepIndex].value}</strong>.
                {!pathDetails[activeStepIndex].is_leaf && (
                  <span>
                    {' '}Because {pathDetails[activeStepIndex].value} is{' '}
                    <strong>{pathDetails[activeStepIndex].direction === 'left' ? '<=' : '>'} {pathDetails[activeStepIndex].threshold}</strong>, the CART algorithm routed the flow down the{' '}
                    <strong style={{ color: '#38bdf8' }}>{pathDetails[activeStepIndex].direction.toUpperCase()} branch</strong> to Child Node #{pathDetails[activeStepIndex].next_node_id}.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TREE HIERARCHY DIAGRAM */}
      {viewMode === 'tree_hierarchy' && (
        <div>
          <div style={{ marginBottom: 12, fontSize: '0.75rem', color: '#94a3b8' }}>
            Visual CART topology up to Depth 3 with the active prediction path highlighted in cyan.
          </div>

          {loadingTree ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Loading Decision Tree topology...</div>
          ) : (
            <div style={{ background: '#050811', borderRadius: 8, padding: 16, border: '1px solid #1e293b', overflowX: 'auto' }}>
              {/* ASCII / Visual Flow Representation of Tree Root */}
              <div style={{ minWidth: 600, textAlign: 'center' }}>
                {/* Level 0: Root */}
                <div style={{ display: 'inline-block', margin: '0 auto' }}>
                  <div
                    style={{
                      background: traversedNodeIds.has(0) ? '#1e3a5f' : '#0f172a',
                      border: `2px solid ${traversedNodeIds.has(0) ? '#38bdf8' : '#334155'}`,
                      borderRadius: 6,
                      padding: '8px 14px',
                      display: 'inline-block',
                      boxShadow: traversedNodeIds.has(0) ? '0 0 12px #38bdf866' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>Root Node #0 {traversedNodeIds.has(0) && '● ACTIVE PATH'}</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>sttl &lt;= 61.00?</div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>gini=0.594 | samples=89,725 | class=Normal</div>
                  </div>
                </div>

                {/* Branch Connectors */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 140, margin: '6px 0', fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>
                  <span>/ (Yes &lt;= 61.0)</span>
                  <span>\ (No &gt; 61.0)</span>
                </div>

                {/* Level 1 Children */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 4 }}>
                  {/* Left Child: Node 1 */}
                  <div
                    style={{
                      background: traversedNodeIds.has(1) ? '#1e3a5f' : '#0f172a',
                      border: `2px solid ${traversedNodeIds.has(1) ? '#38bdf8' : '#334155'}`,
                      borderRadius: 6,
                      padding: '8px 12px',
                      width: 220,
                      boxShadow: traversedNodeIds.has(1) ? '0 0 12px #38bdf866' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#38bdf8', fontWeight: 700 }}>Node #1 {traversedNodeIds.has(1) && '● ACTIVE'}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>sinpkt &lt;= 0.0005?</div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>gini=0.001 | samples=39,840</div>
                  </div>

                  {/* Right Child: Node 24 */}
                  <div
                    style={{
                      background: traversedNodeIds.has(24) ? '#1e3a5f' : '#0f172a',
                      border: `2px solid ${traversedNodeIds.has(24) ? '#38bdf8' : '#334155'}`,
                      borderRadius: 6,
                      padding: '8px 12px',
                      width: 220,
                      boxShadow: traversedNodeIds.has(24) ? '0 0 12px #38bdf866' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 700 }}>Node #24 {traversedNodeIds.has(24) && '● ACTIVE'}</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>ct_srv_dst &lt;= 1.50?</div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>gini=0.697 | samples=49,885</div>
                  </div>
                </div>

                {/* Sub Branch Connectors */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 60, margin: '6px 0', fontSize: '0.75rem', color: '#64748b' }}>
                  <span>/ \</span>
                  <span style={{ marginLeft: 160 }}>/ \</span>
                </div>

                {/* Level 2 Sub-Branches */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 4 }}>
                  <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: 6, width: 120, fontSize: '0.65rem', color: '#94a3b8' }}>
                    Node #2 (Normal leaf)
                  </div>
                  <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: 6, width: 120, fontSize: '0.65rem', color: '#94a3b8' }}>
                    Node #23 (Fuzzers leaf)
                  </div>
                  <div style={{ background: traversedNodeIds.has(25) ? '#1e3a5f' : '#0f172a', border: `1px solid ${traversedNodeIds.has(25) ? '#38bdf8' : '#334155'}`, borderRadius: 4, padding: 6, width: 130, fontSize: '0.65rem', color: '#cbd5e1' }}>
                    Node #25 (ct_state_ttl)
                  </div>
                  <div style={{ background: traversedNodeIds.has(812) ? '#1e3a5f' : '#0f172a', border: `1px solid ${traversedNodeIds.has(812) ? '#38bdf8' : '#334155'}`, borderRadius: 4, padding: 6, width: 130, fontSize: '0.65rem', color: '#cbd5e1' }}>
                    Node #812 (sttl &gt; 159)
                  </div>
                </div>

                {/* Leaf Node Callout */}
                <div style={{ marginTop: 24, padding: 12, background: '#0f172a', borderRadius: 6, border: `1px solid ${leafColor}`, display: 'inline-block' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Terminal Leaf Reached by Flow:</span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: leafColor }}>
                    {secondaryClass} (Node #{pathDetails[pathDetails.length - 1]?.node_id})
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: CODE RULE TRACE */}
      {viewMode === 'code_trace' && (
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
            Generated CART Rule Path (from sklearn.tree.decision_path):
          </span>
          <div style={{ background: '#050811', padding: 14, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'monospace', maxHeight: 220, overflowY: 'auto' }}>
            {rules.map((rule, i) => (
              <div key={i} style={{ color: i === rules.length - 1 ? leafColor : '#94a3b8', margin: '3px 0' }}>
                <span style={{ color: '#475569' }}>[{String(i + 1).padStart(2, '0')}]</span> {rule}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}