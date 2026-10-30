import { lookupVehicle, warmUp } from './api.js';
import { CATEGORIES, SHOW_UNRESEARCHED } from './benchmarks.js';

warmUp();

let _vehicleData = null;

const vrnForm       = document.getElementById('vrn-form');
const quoteForm     = document.getElementById('quote-form');
const vrnInput      = document.getElementById('vrn-input');
const categorySelect = document.getElementById('category-select');
const priceInput    = document.getElementById('price-input');
const transmissionGroup  = document.getElementById('transmission-group');
const transmissionSelect = document.getElementById('transmission-select');
const vehicleCard   = document.getElementById('vehicle-card');
const resultSection = document.getElementById('result');
const errorSection  = document.getElementById('error');
const quotePrompt   = document.getElementById('quote-prompt');

// Unresearched categories are hidden once the launch switch is off
const LISTED = SHOW_UNRESEARCHED ? CATEGORIES : CATEGORIES.filter(c => c.researched);

if (!SHOW_UNRESEARCHED) {
  document.getElementById('coverage-hint').textContent =
    `Covers ${LISTED.length} common servicing and repair jobs, each researched. Can't see yours? We're adding more regularly.`;
}

// Populate category dropdown, A–Z by label
[...LISTED].sort((a, b) => a.label.localeCompare(b.label, 'en-GB')).forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat.id;
  opt.textContent = cat.label;
  categorySelect.appendChild(opt);
});

// Ask manual or automatic only for gearbox and clutch jobs
categorySelect.addEventListener('change', () => {
  const category = CATEGORIES.find(c => c.id === categorySelect.value);
  transmissionGroup.hidden = !category?.asks_transmission;
  if (transmissionGroup.hidden) transmissionSelect.value = '';
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
    ${renderVehicleStatus(data.vehicle_details)}
  `;
  vehicleCard.hidden = false;
}

function renderVehicleStatus(details) {
  if (!details?.taxStatus) return '';

  const taxClass = { Taxed: 'tax-ok', SORN: 'tax-warn', Untaxed: 'tax-bad' }[details.taxStatus] ?? 'tax-warn';
  const taxText = {
    Taxed: `Taxed${details.taxDueDate ? ` — due ${details.taxDueDate}` : ''}`,
    SORN: 'SORN — declared off the road',
    Untaxed: 'Untaxed — not currently licensed for road use',
  }[details.taxStatus] ?? details.taxStatus;

  return `
    <p class="vehicle-status">
      <span class="tax-badge ${taxClass}">${taxText}</span>
      ${details.markedForExport ? '<span class="tax-badge tax-bad">Marked for export</span>' : ''}
    </p>
    <p class="vehicle-status-source">Tax status from DVLA, checked just now.</p>
  `;
}

function renderBenchmark(data, category, quoted) {
  const { min, max, safety_critical, keywords, label, confidence } = category;
  const inRange = quoted <= max;

  const relevantAdvisories = (data.mot_history?.motTests ?? [])
    .flatMap(t => t.defects ?? [])
    .filter(d => keywords.some(kw => d.text?.toLowerCase().includes(kw)));

  resultSection.innerHTML = `
    <div class="benchmark-card">
      <p class="benchmark-label">${label}</p>
      <p class="benchmark-range">Typical price: <strong>£${min}–£${max}</strong></p>
      <p class="benchmark-basis">Includes parts, labour and VAT</p>
      <p class="vat-note">Compare this with your total price. If your quote is shown before VAT, add 20%.</p>
      <p class="your-quote">Your quote: <strong>£${quoted.toFixed(2)}</strong></p>
      <div class="verdict ${inRange ? 'verdict-ok' : 'verdict-high'}">
        ${inRange ? 'Within typical range' : 'Above typical range'}
      </div>
      ${safety_critical ? '<p class="safety-badge">Safety-critical repair</p>' : ''}
      ${renderTransmissionNote(category.id, transmissionSelect.value)}
      ${confidence === 'low' ? '<p class="confidence-warning">Limited price data for this repair. Treat this range as a rough guide only.</p>' : ''}
      <p class="disclaimer">
        These results compare your quoted price against typical UK independent garage
        prices (parts, labour and VAT) from publicly available data. Benchmarks are indicative
        only and do not account for your specific vehicle, main dealer rates, warranty,
        or supplier arrangements. A higher quote does not mean a garage
        has acted improperly. Kerbside provides data transparency, not professional
        mechanical or legal advice. Always discuss pricing directly with your garage.
      </p>
    </div>
    ${renderUpgradePrompt(label, relevantAdvisories.length)}
    ${renderDefects(data.mot_history?.motTests?.[0]?.defects)}
  `;
  resultSection.hidden = false;
}

function renderTransmissionNote(categoryId, transmission) {
  const notes = {
    'clutch:automatic': "Most automatic cars don't have a clutch replaced this way. If yours is a dual-clutch (DSG or DCT) gearbox, clutch work usually costs more than this range, so treat it as a rough guide.",
    'clutch-dmf:automatic': "Most automatic cars don't have a clutch replaced this way. If yours is a dual-clutch (DSG or DCT) gearbox, clutch work usually costs more than this range, so treat it as a rough guide.",
    'gearbox-manual:automatic': "This is the range for a manual gearbox. For an automatic, choose \"Automatic gearbox replacement / rebuild\" instead.",
    'gearbox-auto:manual': "This is the range for an automatic gearbox. For a manual, choose \"Manual gearbox replacement\" instead.",
  };
  const note = notes[`${categoryId}:${transmission}`];
  return note ? `<p class="confidence-warning">${note}</p>` : '';
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
