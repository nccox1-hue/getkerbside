const API_BASE = ['getkerbside.co.uk', 'www.getkerbside.co.uk'].includes(window.location.hostname)
  ? 'https://api.getkerbside.co.uk'
  : '';

// Fire-and-forget ping so Render starts waking from cold while the user types their reg
export function warmUp() {
  fetch(`${API_BASE}/health`, { cache: 'no-store' }).catch(() => {});
}

export async function lookupVehicle(vrn) {
  const response = await fetch(`${API_BASE}/api/v1/vehicle/${encodeURIComponent(vrn)}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${response.status}`);
  }
  return response.json();
}
