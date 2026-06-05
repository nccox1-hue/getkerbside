// Swap to http://localhost:8000 when running backend locally
const API_BASE = 'https://api.getkerbside.co.uk';

export async function lookupVehicle(vrn) {
  const response = await fetch(`${API_BASE}/api/v1/vehicle/${encodeURIComponent(vrn)}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${response.status}`);
  }
  return response.json();
}
