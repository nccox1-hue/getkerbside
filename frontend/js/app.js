import { lookupVehicle } from './api.js';
import { CATEGORIES } from './benchmarks.js';

let _vehicleData = null;

const vrnForm       = document.getElementById('vrn-form');
const quoteForm     = document.getElementById('quote-form');
const vrnInput      = document.getElementById('vrn-input');
const categorySelect = document.getElementById('category-select');
const priceInput    = document.getElementById('price-input');
const vehicleCard   = document.getElementById('vehicle-card');
const resultSection = document.getElementById('result');
const errorSection  = document.getElementById('error');
const quotePrompt   = document.getElementById('quote-prompt');

// Populate category dropdown
CATEGORIES.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat.id;
  opt.textContent = cat.label;
  categorySelect.appendChild(opt);
});

// Phase 1 — VRM lookup
vrnForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const vrn = vrnInput.value.trim();
  if (!vrn) return;

  setVrnLoading(true);
  clearAll();

  try {
    _vehicleData = await lookupVehicle(vrn);
    renderVehicleCard(_vehicleData);
    quoteForm.hidden = false;
    quotePrompt.hidden = true;
  } catch (err) {
    showError(err.message);
  } finally {
    setVrnLoading(false);
  }
});

// Phase 2 — benchmark check
quoteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const category = CATEGORIES.find(c => c.id === categorySelect.value);
  const quoted = parseFloat(priceInput.value);
  if (!category || isNaN(quoted) || quoted <= 0 || !_vehicleData) return;
  renderBenchmark(_vehicleData, category, quoted);
});

function setVrnLoading(on) {
  const btn = vrnForm.querySelector('button');
  btn.textContent = on ? 'Checking…' : 'Check vehicle';
  btn.disabled = on;
}

function clearAll() {
  vehicleCard.hidden = true;
  vehicleCard.innerHTML = '';
  resultSection.hidden = true;
  resultSection.innerHTML = '';
  errorSection.hidden = true;
  errorSection.textContent = '';
  quoteForm.hidden = true;
  quotePrompt.hidden = false;
  _vehicleData = null;
}

function showError(msg) {
  errorSection.textContent = msg;
  errorSection.hidden = false;
}

function renderVehicleCard(data) {
  const mot = data.mot_history;
  const tests = mot?.motTests;
  const last = tests?.[0];
  vehicleCard.innerHTML = `
    <p class="vehicle-label">Vehicle confirmed</p>
    <p class="vehicle-name">${mot?.make ?? '—'} ${mot?.model ?? ''}</p>
    <p class="vehicle-meta">
      ${mot?.primaryColour ?? '—'}&nbsp;&nbsp;·&nbsp;&nbsp;${mot?.fuelType ?? '—'}&nbsp;&nbsp;·&nbsp;&nbsp;${mot?.firstUsedDate?.slice(0, 4) ?? '—'}
    </p>
    ${last ? `
      <p class="mot-line">
        MOT: <span class="result-${last.testResult?.toLowerCase()}">${last.testResult}</span>
        &nbsp;— expires ${last.expiryDate ?? '—'}
        &nbsp;— ${Number(last.odometerValue ?? 0).toLocaleString('en-GB')} mi
      </p>
    ` : `
      <p class="mot-line mot-none">
        No MOT history found for this vehicle — it may be too new to require a test
        (MOT due ${mot?.motTestDueDate ?? 'see vehicle documents'}).
      </p>
    `}
  `;
  vehicleCard.hidden = false;
}

function renderBenchmark(data, category, quoted) {
  const { min, max, safety_critical, keywords, label } = category;
  const inRange = quoted <= max;

  const relevantAdvisories = (data.mot_history?.motTests ?? [])
    .flatMap(t => t.defects ?? [])
    .filter(d => keywords.some(kw => d.text?.toLowerCase().includes(kw)));

  resultSection.innerHTML = `
    <div class="benchmark-card">
      <p class="benchmark-label">${label}</p>
      <p class="benchmark-range">Typical: <strong>£${min}–£${max}</strong></p>
      <p class="your-quote">Your quote: <strong>£${quoted.toFixed(2)}</strong></p>
      <div class="verdict ${inRange ? 'verdict-ok' : 'verdict-high'}">
        ${inRange ? 'Within typical range' : 'Above typical range'}
      </div>
      ${safety_critical ? '<p class="safety-badge">Safety-critical repair</p>' : ''}
      <p class="disclaimer">
        These results compare your quoted prices against retail benchmark prices from
        publicly available data. Benchmarks are indicative only and do not account for
        labour, warranty, or supplier arrangements. A higher quote does not mean a garage
        has acted improperly. Kerbside provides data transparency, not professional
        mechanical or legal advice. Always discuss pricing directly with your garage.
      </p>
    </div>
    ${renderUpgradePrompt(label, relevantAdvisories.length)}
    ${renderDefects(data.mot_history?.motTests?.[0]?.defects)}
  `;
  resultSection.hidden = false;
}

function renderUpgradePrompt(categoryLabel, advisoryCount) {
  return `
    <div class="upgrade-prompt">
      <p class="upgrade-heading">Get the full picture with Pro</p>
      <ul>
        <li>Exact percentage above or below average</li>
        <li>Parts vs labour cost breakdown</li>
        ${advisoryCount > 0
          ? `<li>${advisoryCount} MOT advisory match${advisoryCount > 1 ? 'es' : ''} found — see if this repair was previously flagged on this vehicle</li>`
          : ''}
        <li>Shareable report you can send to the garage</li>
      </ul>
      <button class="btn-pro" disabled>Upgrade to Pro — £3.99/month</button>
    </div>
  `;
}

function renderDefects(items) {
  if (!items?.length) return '';
  return `
    <div class="defects-section">
      <p class="section-label">Latest MOT — defects &amp; advisories</p>
      <ul>
        ${items.map(item => `
          <li class="defect-${item.type?.toLowerCase()}">
            <span class="defect-type">${item.type}</span> ${item.text}
            ${item.dangerous ? '<span class="badge-danger">DANGEROUS</span>' : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
