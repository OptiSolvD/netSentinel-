/**
 * NetSentinel API Client Service.
 * Connects to the FastAPI backend with mock fallback for local UI development.
 */

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export async function fetchHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using mock health', err);
    return {
      status: 'mock_mode',
      model_name: 'RandomForestClassifier',
      model_version: 'v2.0-clean',
      classes: ['Normal', 'Exploits', 'Fuzzers', 'DoS', 'Analysis', 'Backdoor'],
      num_features: 42,
      scikit_learn_version: '1.8.0',
    };
  }
}

export async function fetchTrainingContext() {
  try {
    const res = await fetch(`${API_BASE_URL}/training-context`);
    if (!res.ok) throw new Error('Training context query failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using mock training context', err);
    return {
      dataset: 'UNSW-NB15',
      citation: 'Moustafa & Slay (2015)',
      offline_training_records: 89725,
      offline_testing_records: 59543,
      classes: ['Normal', 'Exploits', 'Fuzzers', 'DoS', 'Analysis', 'Backdoor'],
      cv_scheme: 'Block-Grouped 5-Fold Stratified Cross-Validation',
      models_evaluated: [
        { name: 'Dummy (Stratified)', macro_f1: 0.1407, far: 0.4179, notes: 'Baseline' },
        { name: 'DecisionTree (Depth 12)', macro_f1: 0.4824, far: 0.1893, notes: 'Interpretable' },
        { name: 'RandomForest Baseline', macro_f1: 0.4872, far: 0.1800, notes: 'Raw features' },
        { name: 'RandomForest + Ratios', macro_f1: 0.4940, far: 0.1777, notes: 'Winning Production Model' },
        { name: 'HistGradientBoosting + Ratios', macro_f1: 0.5049, far: 0.1807, notes: 'Gradient Boosted' },
      ],
      winning_model: 'RandomForestClassifier + Ratios',
      hard_classes: ['Analysis', 'Backdoor'],
      banner_text: 'Trained offline on UNSW-NB15 (2015 testbed); this page runs predictions only.',
      final_test_metrics: {
        accuracy: 0.7082,
        macro_f1: 0.4100,
        attack_recall: 0.9538,
        false_alarm_rate: 0.2277,
      },
    };
  }
}

export async function predictTraffic(file, confidenceThreshold = 0.60) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('confidence_threshold', confidenceThreshold);

  const res = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Server returned error status ${res.status}`);
  }

  return await res.json();
}

export async function fetchTreeStructure(depth = 4) {
  try {
    const res = await fetch(`${API_BASE_URL}/model/tree-structure?depth=${depth}`);
    if (!res.ok) throw new Error('Failed to fetch tree structure');
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using fallback tree topology', err);
    return null;
  }
}

export async function fetchModelMetadata() {
  try {
    const res = await fetch(`${API_BASE_URL}/model/metadata`);
    if (!res.ok) throw new Error('Failed to fetch model metadata');
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using fallback metadata', err);
    return null;
  }
}

export async function explainRow(rowFeatures) {
  const res = await fetch(`${API_BASE_URL}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row_features: rowFeatures }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to explain prediction');
  }

  return await res.json();
}

export async function predictSingleFlow(features) {
  const res = await fetch(`${API_BASE_URL}/predict/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to predict single flow');
  }

  return await res.json();
}

export async function predictBatchFlows(rows) {
  const res = await fetch(`${API_BASE_URL}/predict/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to predict batch flows');
  }

  return await res.json();
}
