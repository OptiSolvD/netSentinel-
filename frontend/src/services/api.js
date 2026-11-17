/** NetSentinel API client for the active v3 inference service. */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.PROD
    ? 'https://netsentinel-api-zvqk.onrender.com/api/v1'
    : 'http://localhost:8000/api/v1'
);

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed (${res.status}).`);
  return await res.json();
}

export async function fetchTrainingContext() {
  const res = await fetch(`${API_BASE_URL}/training-context`);
  if (!res.ok) throw new Error(`Training context request failed (${res.status}).`);
  return await res.json();
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
  const res = await fetch(`${API_BASE_URL}/model/tree-structure?depth=${depth}`);
  if (!res.ok) throw new Error(`Failed to fetch tree structure (${res.status}).`);
  return await res.json();
}

export async function fetchModelMetadata() {
  const res = await fetch(`${API_BASE_URL}/model/metadata`);
  if (!res.ok) throw new Error(`Failed to fetch model metadata (${res.status}).`);
  return await res.json();
}

export async function fetchModelEvaluation() {
  const res = await fetch(`${API_BASE_URL}/model/evaluation`);
  if (!res.ok) throw new Error(`Failed to fetch evaluation report (${res.status}).`);
  return await res.json();
}

export async function fetchModelEvolution() {
  const res = await fetch(`${API_BASE_URL}/model-evolution/comparison`);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `Failed to fetch model evolution (${res.status}).`);
  }
  return await res.json();
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
