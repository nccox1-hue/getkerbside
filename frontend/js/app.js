import { lookupVehicle } from './api.js';

const form = document.getElementById('vrn-form');
const input = document.getElementById('vrn-input');
const resultSection = document.getElementById('result');
const errorSection = document.getElementById('error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const vrn = input.value.trim();
  if (!vrn) return;

  setLoading(true);
  clearOutput();

  try {
    const data = await lookupVehicle(vrn);
    renderResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

function setLoading(on) {
  form.querySelector('button').textContent = on ? 'Checking…' : 'Check my quote';
  form.querySelector('button').disabled = on;
}

function clearOutput() {
  resultSection.hidden = true;
  errorSection.hidden = true;
  resultSection.innerHTML = '';
}

function showError(message) {
  errorSection.textContent = message;
  errorSection.hidden = false;
}

function renderResult(data) {
  const mot = data.mot_history;
  const lastTest = mot?.motTests?.[0];

  resultSection.innerHTML = `
    <h2>Vehicle confirmed</h2>
    <p><strong>${mot?.make ?? '—'} ${mot?.model ?? ''}</strong></p>
    <p>Colour: ${mot?.primaryColour ?? '—'} &nbsp;|&nbsp; Fuel: ${mot?.fuelType ?? '—'}</p>
    ${lastTest ? `
      <h3>Last MOT</h3>
      <p>${lastTest.completedDate?.slice(0, 10) ?? '—'} —
         <strong class="result-${lastTest.testResult?.toLowerCase()}">${lastTest.testResult}</strong>
      </p>
      ${renderDefects(lastTest.rfrAndComments)}
    ` : '<p>No MOT history found.</p>'}
  `;
  resultSection.hidden = false;
}

function renderDefects(items) {
  if (!items?.length) return '';
  return `
    <h3>Advisories / failures</h3>
    <ul>
      ${items.map(item => `
        <li class="defect-${item.type?.toLowerCase()}">
          <span class="defect-type">${item.type}</span> ${item.text}
          ${item.dangerous ? '<span class="badge-danger">DANGEROUS</span>' : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
