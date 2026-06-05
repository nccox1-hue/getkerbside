const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? ''
  : 'https://api.getkerbside.co.uk';

export async function lookupVehicle(vrn) {
  const response = await fetch(`${API_BASE}/api/v1/vehicle/${encodeURIComponent(vrn)}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${response.status}`);
  }
  return response.json();
}
