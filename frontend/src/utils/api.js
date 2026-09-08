const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch (err) {
    console.warn('API health check error:', err);
    return null;
  }
}

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/api/models`);
  if (!res.ok) throw new Error('Failed to fetch models');
  return await res.json();
}

export async function predictSketch(imageData, model = 'mobilenetv2', saveDrawing = false) {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageData,
      model: model,
      save_drawing: saveDrawing
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Prediction failed' }));
    throw new Error(err.detail || 'Prediction failed');
  }
  return await res.json();
}

export async function saveUserDrawing(imageData, model = 'mobilenetv2') {
  const res = await fetch(`${API_BASE}/api/drawings/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageData,
      model: model
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to save drawing' }));
    throw new Error(err.detail || 'Failed to save drawing');
  }
  return await res.json();
}

export async function fetchUserDrawings() {
  const res = await fetch(`${API_BASE}/api/drawings`);
  if (!res.ok) throw new Error('Failed to fetch user drawings');
  return await res.json();
}

export async function deleteUserDrawing(drawingId) {
  const res = await fetch(`${API_BASE}/api/drawings/${drawingId}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete drawing');
  return await res.json();
}

export function getUserDrawingImageUrl(drawingId) {
  return `${API_BASE}/api/drawings/image/${drawingId}`;
}

export async function fetchFeaturedSamples() {
  const res = await fetch(`${API_BASE}/api/samples`);
  if (!res.ok) throw new Error('Failed to fetch samples');
  return await res.json();
}

export async function fetchRandomSample(category = null) {
  const url = category ? `${API_BASE}/api/samples/random?category=${encodeURIComponent(category)}` : `${API_BASE}/api/samples/random`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch random sample');
  return await res.json();
}

export function getSampleImageUrl(sampleId) {
  return `${API_BASE}/api/samples/image/${sampleId}`;
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return await res.json();
}
