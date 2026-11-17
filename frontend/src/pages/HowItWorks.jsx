import React, { useEffect, useMemo, useState } from 'react';
import { explainRow, fetchTreeStructure } from '../services/api';

const classNames = ['Normal', 'Exploits', 'Fuzzers', 'DoS'];

function classVariable(className) {
  return `var(--${className === 'Normal' ? 'normal' : className.toLowerCase()})`;
}

function TreeNode({
  nodeId,
  nodes,
  classes,
  visibleDepth,
  pathNodeIds,
  search,
  collapsedNodes,
  onToggle,
  onSelect,
  selectedNodeId,
}) {
  const node = nodes[String(nodeId)];
  if (!node) return null;

  const featureName = node.feature?.replace(/^(num|cat)__/, '') || '';
  const matchesSearch = search && featureName.toLowerCase().includes(search.toLowerCase());
  const isCollapsed = collapsedNodes.has(node.id);
  const hasChildren = !node.is_leaf
    && node.depth < visibleDepth
    && nodes[String(node.left)]
    && nodes[String(node.right)];
  const total = node.class_distribution.reduce((sum, value) => sum + value, 0) || 1;

  return (
    <div className="tree-node-wrap">
      <button
        type="button"
        className={`tree-node-card ${pathNodeIds.has(node.id) ? 'is-path' : ''} ${matchesSearch ? 'is-match' : ''} ${selectedNodeId === node.id ? 'is-selected' : ''}`}
        onClick={() => onSelect(node)}
      >
        <span className="tree-node-title">
          <span>{node.is_leaf ? 'LEAF' : 'SPLIT'} · #{node.id}</span>
          <span>depth {node.depth}</span>
        </span>
        <span className={`tree-rule ${node.is_leaf ? `class-${node.predicted_class}` : ''}`}>
          {node.is_leaf
            ? `Predict ${node.predicted_class}`
            : `${featureName} ≤ ${node.threshold}`}
        </span>
        <span className="tree-node-meta">
          {node.samples.toLocaleString()} training samples · Gini {node.gini.toFixed(3)}
        </span>
        <span className="tree-distribution" aria-label="Training sample class distribution">
          {classes.map((className, index) => {
            const value = node.class_distribution[index] || 0;
            return (
              <span
                key={className}
                style={{ width: `${(value / total) * 100}%`, background: classVariable(className) }}
              />
            );
          })}
        </span>
      </button>
      {!node.is_leaf && hasChildren && (
        <button type="button" className="button-small" onClick={() => onToggle(node.id)}>
          {isCollapsed ? 'Expand branch' : 'Collapse branch'}
        </button>
      )}
      {!node.is_leaf && node.depth < visibleDepth && hasChildren && !isCollapsed && (
          <div className="tree-branches">
            <div className="tree-branch">
              <span className="tree-branch-label">≤ threshold</span>
              <TreeNode
                nodeId={node.left}
                nodes={nodes}
                classes={classes}
                visibleDepth={visibleDepth}
                pathNodeIds={pathNodeIds}
                search={search}
                collapsedNodes={collapsedNodes}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedNodeId={selectedNodeId}
              />
            </div>
            <div className="tree-branch">
              <span className="tree-branch-label">&gt; threshold</span>
              <TreeNode
                nodeId={node.right}
                nodes={nodes}
                classes={classes}
                visibleDepth={visibleDepth}
                pathNodeIds={pathNodeIds}
                search={search}
                collapsedNodes={collapsedNodes}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedNodeId={selectedNodeId}
              />
            </div>
          </div>
      )}
    </div>
  );
}

function FlowPath({ lastAnalysis, onExplanation }) {
  const predictions = lastAnalysis?.predictions || [];
  const displayedPredictions = predictions.slice(0, 100);
  const [selectedIndex, setSelectedIndex] = useState('');
  const [explanation, setExplanation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSelectedIndex(predictions.length ? String(predictions[0].row_index) : '');
    setExplanation(null);
    setError(null);
  }, [lastAnalysis]);

  const inspect = async () => {
    const selected = predictions.find((row) => String(row.row_index) === selectedIndex);
    if (!selected) return;
    setLoading(true);
    setError(null);
    setExplanation(null);
    try {
      const path = await explainRow(selected.features);
      setExplanation(path);
      onExplanation(path);
    } catch (requestError) {
      setError(requestError.message || 'The API could not explain this row.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <div className="section-heading">
        <div><h2>Inspect an actual prediction path</h2><p>Select a flow from the most recent CSV analysis.</p></div>
      </div>
      {predictions.length ? (
        <div className="file-actions">
          <select
            className="select"
            value={selectedIndex}
            onChange={(event) => {
              setSelectedIndex(event.target.value);
              setExplanation(null);
              setError(null);
              onExplanation(null);
            }}
            aria-label="Select a flow row"
          >
            {displayedPredictions.map((row) => (
              <option key={row.row_index} value={row.row_index}>
                Row {row.row_index + 1} · {row.predicted_class} · {(row.confidence * 100).toFixed(1)}%
              </option>
            ))}
          </select>
          <button className="button" onClick={inspect} disabled={loading}>{loading ? 'Inspecting…' : 'Show decision path'}</button>
          <span className="muted small">First {displayedPredictions.length} returned rows</span>
        </div>
      ) : (
        <div className="empty-state">No flow is available yet. Run a CSV in Test &amp; Evaluate, then select one here.</div>
      )}
      {error && <div className="error-notice" role="alert">{error}</div>}
      {explanation && (
        <div className="path-list" style={{ marginTop: 14 }}>
          {explanation.decision_path_details.map((step) => (
            <div className="path-item" key={step.node_id}>
              #{step.node_id} · {step.is_leaf
                ? `leaf → ${step.predicted_class}`
                : `${step.feature} ${step.operator} ${step.threshold} · input ${step.value} → ${step.direction}`}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function HowItWorks({ lastAnalysis, metadata, metadataError }) {
  const [depth, setDepth] = useState(2);
  const [tree, setTree] = useState(null);
  const [treeError, setTreeError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [pathNodeIds, setPathNodeIds] = useState(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setTreeError(null);
    fetchTreeStructure(depth)
      .then((data) => {
        if (active) {
          setTree(data);
          setCollapsedNodes(new Set());
        }
      })
      .catch((error) => active && setTreeError(error.message || 'Unable to load the fitted tree.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [depth]);

  const matches = useMemo(() => {
    if (!tree || !search.trim()) return [];
    const query = search.trim().toLowerCase();
    return Object.values(tree.nodes).filter((node) => (
      node.feature?.replace(/^(num|cat)__/, '').toLowerCase().includes(query)
    ));
  }, [tree, search]);

  const setPathFromExplanation = (explanation) => {
    setPathNodeIds(new Set((explanation?.decision_path_details || []).map((node) => node.node_id)));
  };

  const toggleNode = (nodeId) => {
    setCollapsedNodes((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const collapseAll = () => {
    if (!tree) return;
    setCollapsedNodes(new Set(
      Object.values(tree.nodes).filter((node) => !node.is_leaf && node.depth < depth).map((node) => node.id),
    ));
  };

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Model transparency</div>
          <h1>How It Works</h1>
          <p>Follow the fitted preprocessing and inspect real split thresholds from the deployed four-class Decision Tree.</p>
        </div>
        <span className="pill">No packet parsing or live capture</span>
      </div>

      <section className="card">
        <div className="section-heading">
          <div><h2>Dataset and classification scope</h2><p>The model’s claims are limited to the data and labels it was trained and evaluated to recognize.</p></div>
          <span className="pill">UNSW-NB15</span>
        </div>
        <div className="class-explainer-grid">
          {[
            ['Normal', 'Legitimate network traffic'],
            ['Exploits', 'Exploit-related attack traffic'],
            ['Fuzzers', 'Fuzzing-related attack traffic'],
            ['DoS', 'Denial-of-Service traffic'],
          ].map(([name, description]) => (
            <article className={`class-explainer class-${name}`} key={name}>
              <span className={`class-chip class-${name}`}><span className={`class-dot class-${name}`} />{name}</span>
              <p>{description}</p>
            </article>
          ))}
        </div>
        {metadata && (
          <p className="muted small">
            The active model was fitted on {metadata.stored_metrics.training_rows.toLocaleString()} rows with {metadata.input_features.length} raw predictors. Its official held-out report covers {metadata.test_metrics.test_rows_evaluated.toLocaleString()} supported rows; {metadata.test_metrics.excluded_test_rows.toLocaleString()} Analysis and Backdoor rows were excluded.
          </p>
        )}
      </section>

      <section className="card">
        <div className="section-heading"><div><h2>Flow analysis pipeline</h2><p>Current serving path for a feature-ready CSV flow record.</p></div></div>
        <div className="flow-grid">
          {[
            ['01', 'Flow-feature CSV', 'A row contains the 42 UNSW-NB15 input fields. Raw PCAP is not a supported input.'],
            ['02', 'Schema validation', 'Required feature names are checked; id and target/label columns are not model inputs.'],
            ['03', 'Fitted preprocessing', 'The saved pipeline imputes missing values and one-hot encodes categorical inputs.'],
            ['04', 'Decision Tree', 'A single fitted CART tree follows feature thresholds to one of four leaves.'],
            ['05', 'Prediction & path', 'The API returns a class, leaf probability distribution, and exact decision path.'],
          ].map(([number, title, description]) => (
            <div className="flow-step" key={number}>
              <span className="step-number">STEP {number}</span>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="section-heading"><div><h2>Input contract</h2><p>Model schema and serving scope</p></div></div>
          {metadata ? (
            <>
              <p className="small"><strong>{metadata.input_features.length} raw features</strong> are required. The fitted preprocessing step expands categorical values before tree inference.</p>
              <div className="file-actions">
                {['Normal', 'Exploits', 'Fuzzers', 'DoS'].map((name) => <span key={name} className={`class-chip class-${name}`}><span className={`class-dot class-${name}`} />{name}</span>)}
              </div>
              <p className="muted small">Analysis and Backdoor labels are outside this model’s four-class taxonomy; they are not predicted classes.</p>
            </>
          ) : <p className="muted small">{metadataError || 'Loading model metadata…'}</p>}
        </section>
        <section className="card">
          <div className="section-heading"><div><h2>What this console does not do</h2><p>Important input and interpretation limits</p></div></div>
          <ul className="small muted">
            <li>It does not read raw packets or PCAP files.</li>
            <li>It does not capture from a network interface.</li>
            <li>It does not create packet-to-flow features; CSV inputs must already contain the expected features.</li>
            <li>Tree probabilities come from leaf class distributions and should not be read as calibrated risk scores.</li>
          </ul>
        </section>
      </div>

      <FlowPath
        lastAnalysis={lastAnalysis}
        onExplanation={setPathFromExplanation}
      />

      <section className="card">
        <div className="section-heading">
          <div><h2>Fitted Decision Tree explorer</h2><p>Showing actual nodes from the saved model; only a bounded prefix is loaded to keep navigation responsive.</p></div>
          {tree && <span className="pill">{tree.total_nodes.toLocaleString()} total nodes · depth {tree.max_depth}</span>}
        </div>
        <div className="tree-toolbar">
          <label className="small muted" htmlFor="tree-depth">Visible depth</label>
          <select id="tree-depth" className="select" value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
            {[2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} levels</option>)}
          </select>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Highlight a split feature"
            aria-label="Search tree split features"
          />
          {search && <span className="pill">{matches.length} visible matches</span>}
          <button className="button-small" onClick={collapseAll} disabled={!tree}>Collapse branches</button>
          <button className="button-small" onClick={() => setCollapsedNodes(new Set())} disabled={!tree}>Expand branches</button>
          <button className="button-small" onClick={() => setZoom((value) => Math.max(.65, value - .1))} aria-label="Zoom out">−</button>
          <span className="muted small">{Math.round(zoom * 100)}%</span>
          <button className="button-small" onClick={() => setZoom((value) => Math.min(1.3, value + .1))} aria-label="Zoom in">+</button>
          <span className="muted small">Scroll to pan</span>
        </div>
        {loading && <div className="loading">Loading actual tree nodes…</div>}
        {treeError && <div className="error-notice" role="alert">{treeError}</div>}
        {tree && !loading && (
          <>
            <div className="tree-viewport" aria-label="Scrollable decision tree canvas">
              <div className="tree-canvas" style={{ zoom }}>
                <TreeNode
                  nodeId={tree.root_id}
                  nodes={tree.nodes}
                  classes={tree.classes}
                  visibleDepth={depth}
                  pathNodeIds={pathNodeIds}
                  search={search.trim()}
                  collapsedNodes={collapsedNodes}
                  onToggle={toggleNode}
                  onSelect={setSelectedNode}
                  selectedNodeId={selectedNode?.id}
                />
              </div>
            </div>
            {selectedNode && (
              <div className="tree-detail" style={{ marginTop: 12 }}>
                <strong>Node #{selectedNode.id}</strong> · {selectedNode.is_leaf ? 'leaf' : `${selectedNode.feature} ≤ ${selectedNode.threshold}`}
                <div className="muted">Depth {selectedNode.depth} · {selectedNode.samples.toLocaleString()} training samples · Gini {selectedNode.gini.toFixed(4)} · majority class {selectedNode.predicted_class}</div>
                <div className="file-actions" style={{ marginTop: 7 }}>
                  {tree.classes.map((name, index) => (
                    <span className={`class-chip class-${name}`} key={name}>
                      {name}: {((selectedNode.class_distribution[index] / (selectedNode.class_distribution.reduce((sum, value) => sum + value, 0) || 1)) * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
