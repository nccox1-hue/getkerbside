import { lookupVehicle, warmUp } from './api.js';
import { CATEGORIES, SHOW_UNRESEARCHED, REGIONS, NOT_REGIONAL } from './benchmarks.js';

warmUp();

let _vehicleData = null;

const vrnForm       = document.getElementById('vrn-form');
const quoteForm     = document.getElementById('quote-form');
const vrnInput      = document.getElementById('vrn-input');
const categorySelect = document.getElementById('category-select');
const priceInput    = document.getElementById('price-input');
const transmissionGroup  = document.getElementById('transmission-group');
const transmissionSelect = document.getElementById('transmission-select');
const variantGroup  = document.getElementById('variant-group');
const variantSelect = document.getElementById('variant-select');
const variantLabel  = document.getElementById('variant-label');
const variantHint   = document.getElementById('variant-hint');
const vehicleCard   = document.getElementById('vehicle-card');
const resultSection = document.getElementById('result');
const errorSection  = document.getElementById('error');
const quotePrompt   = document.getElementById('quote-prompt');
const regionSelect  = document.getElementById('region-select');

// Remember the region between visits; storage can be unavailable, so failures are ignored
try { regionSelect.value = localStorage.getItem('kerbside-region') || 'other'; } catch {}
regionSelect.addEventListener('change', () => {
  try { localStorage.setItem('kerbside-region', regionSelect.value); } catch {}
});

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

  // Jobs priced differently by type (e.g. battery: standard or stop-start) ask one extra question
  const variants = category?.variants;
  variantGroup.hidden = !variants;
  variantSelect.innerHTML = '';
  if (variants) {
    variantLabel.textContent = variants.question;
    variantHint.textContent = variants.hint ?? '';
    [{ value: '', label: 'Not sure' }, ...variants.options].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      variantSelect.appendChild(opt);
    });
  }
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
  const { safety_critical, confidence, keywords } = category;
  const range = pickRange(category, variantSelect.value);
  const label = range.label ? `${category.label} – ${range.label}` : category.label;
  const region = REGIONS[regionSelect.value] ?? REGIONS.other;
  const regional = region.factor !== 1 && !NOT_REGIONAL.has(category.id);
  // Round adjusted ranges to the nearest £5 so they don't imply false precision
  const adjust = v => regional ? Math.round(v * region.factor / 5) * 5 : v;
  const min = adjust(range.min);
  const max = adjust(range.max);
  // Three-way verdict: a quote below the range is flagged too, not passed as typical
  const verdict = quoted < min ? 'low' : quoted > max ? 'high' : 'ok';
  const verdictText = { low: 'Below typical range', ok: 'Within typical range', high: 'Above typical range' }[verdict];
  // How far outside the range, measured from the nearest edge (we hold ranges, not averages)
  const gap = verdict === 'high' ? quoted - max : verdict === 'low' ? min - quoted : 0;
  const gapPct = Math.round(gap / (verdict === 'high' ? max : min) * 100);
  const gapText = verdict === 'ok' ? '' :
    `£${gap.toFixed(2)} (${gapPct}%) ${verdict === 'high' ? 'above the top' : 'below the bottom'} of the typical range`;

  resultSection.innerHTML = `
    <div class="benchmark-card">
      <p class="benchmark-label">${label}</p>
      <p class="benchmark-range">Typical price: <strong>£${min}–£${max}</strong></p>
      <p class="benchmark-basis">Includes parts, labour and VAT${regional ? `. Adjusted for ${region.label} garage labour rates` : region.factor !== 1 ? `. Same price in ${region.label} as the rest of the UK, because this job is mostly parts or a fixed fee` : ''}</p>
      <p class="vat-note">Compare this with your total price. If your quote is shown before VAT, add 20%.</p>
      <p class="your-quote">Your quote: <strong>£${quoted.toFixed(2)}</strong></p>
      <div class="verdict verdict-${verdict}">${verdictText}</div>
      ${gapText ? `<p class="verdict-gap">${gapText}</p>` : ''}
      ${verdict === 'low' ? `<p class="confidence-warning">${category.low_note ?? 'A price this low can mean cheaper parts, part of the job left out, or a price that goes up once work starts. Check exactly what the quote includes.'}</p>` : ''}
      ${safety_critical ? '<p class="safety-badge">Safety-critical repair</p>' : ''}
      ${renderTransmissionNote(category.id, transmissionSelect.value)}
      ${category.note ? `<p class="confidence-warning">${category.note}</p>` : ''}
      ${range.note ? `<p class="confidence-warning">${range.note}</p>` : ''}
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
    ${renderMotMatches(data.mot_history?.motTests, keywords)}
    ${renderDefects(data.mot_history?.motTests?.[0]?.defects)}
    ${renderComingSoon()}
  `;
  resultSection.hidden = false;
}

// The range for the chosen type; "Not sure" spans every type so no fair quote is flagged
function pickRange(category, value) {
  const variants = category.variants;
  if (!variants) return category;
  const chosen = variants.options.find(o => o.value === value);
  if (chosen) return { min: chosen.min, max: chosen.max, label: chosen.short };
  return {
    min: Math.min(...variants.options.map(o => o.min)),
    max: Math.max(...variants.options.map(o => o.max)),
    note: variants.unsure_note,
  };
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

// MOT items across all tests that mention this repair, newest first
function renderMotMatches(tests, keywords) {
  if (!tests?.length || !keywords?.length) return '';
  const matches = tests.flatMap(t => (t.defects ?? [])
    .filter(d => matchesKeywords(d.text, keywords))
    .map(d => ({ ...d, date: t.completedDate?.slice(0, 10) })));
  if (!matches.length) return '';
  const shown = matches.slice(0, 5);
  return `
    <div class="defects-section">
      <p class="section-label">This repair in your MOT history (${matches.length} match${matches.length > 1 ? 'es' : ''})</p>
      <ul>
        ${shown.map(d => `
          <li class="defect-${esc(d.type?.toLowerCase())}">
            <span class="defect-type">${esc(d.type)}</span> ${esc(d.date ?? '')}: ${esc(d.text)}
          </li>
        `).join('')}
      </ul>
      <p class="field-hint">Matched on keywords, so check each item relates to this job.</p>
    </div>
  `;
}

// Every keyword must appear; 'a|b' accepts either alternative (e.g. front pads must say brake, pad and front)
function matchesKeywords(text, keywords) {
  const t = text?.toLowerCase() ?? '';
  return keywords.every(kw => kw.split('|').some(alt => t.includes(alt)));
}

// Planned features only: no price, no button, nothing that implies it can be bought today
function renderComingSoon() {
  return `
    <div class="coming-soon">
      <p class="coming-soon-heading">Coming soon</p>
      <p>We're working on:</p>
      <ul>
        <li>A shareable report you can send to your garage</li>
        <li>Prices for your make and model</li>
        <li>A parts and labour breakdown, where the data supports it</li>
      </ul>
    </div>
  `;
}

// DVSA text is external data, so escape it before it goes into the page
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderDefects(items) {
  if (!items?.length) return '';
  return `
    <div class="defects-section">
      <p class="section-label">Latest MOT — defects &amp; advisories</p>
      <ul>
        ${items.map(item => `
          <li class="defect-${esc(item.type?.toLowerCase())}">
            <span class="defect-type">${esc(item.type)}</span> ${esc(item.text)}
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
