'use strict';
/* AI Hacker Lab HQ — client. Talks to the JSON API in server.js. */

let curriculum = null;
let state = null;
let dirty = false; // unsaved-changes guard: true while any editor has un-saved edits
let pendingRestore = null;

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, method, body) {
  const res = await fetch(path, {
    method: method || 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('request failed: ' + res.status));
  return data;
}

function markDirty() { dirty = true; }
function clearDirty() { dirty = false; }

window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});

function labRow(id) { return state.labs.find(r => r.labId === id) || null; }
function lakeraRow(id) { return state.lakera.find(r => r.appId === id) || null; }
function planChecked(id) { const r = state.planChecks.find(p => p.blockId === id); return !!(r && r.done); }

function statusLabel(s) {
  return { not_started: 'Not started', in_progress: 'In progress', solved: 'Solved', passed: 'Passed' }[s] || s;
}

async function load() {
  const data = await api('/api/state');
  curriculum = data.curriculum;
  state = data.state;
  renderAll();
  clearDirty();
}

function renderAll() {
  renderStats();
  renderLabs();
  renderLakera();
  renderPlan();
  renderJournal();
  renderFindings();
}

function renderStats() {
  const solved = state.labs.filter(r => r.status === 'solved').length;
  const passed = state.lakera.filter(r => r.status === 'passed').length;
  const planDone = state.planChecks.filter(r => r.done).length;
  $('stats').innerHTML =
    '<span><strong>' + solved + ' / 7</strong> labs solved</span>' +
    '<span><strong>' + passed + ' / 10</strong> Lakera apps passed</span>' +
    '<span><strong>' + planDone + ' / 7</strong> plan blocks done</span>' +
    '<span><strong>' + state.journal.length + '</strong> journal entries</span>' +
    '<span><strong>' + state.findings.length + '</strong> findings</span>';
  const nextLab = curriculum.labs.find(l => { const r = labRow(l.id); return !r || r.status !== 'solved'; });
  $('next-up').textContent = nextLab
    ? 'Next up: ' + nextLab.title + ' (' + nextLab.id.replace('lab-', 'Lab ') + ').'
    : 'All 7 PortSwigger labs solved. On to the Lakera apps and the portfolio.';
}

function renderLabs() {
  $('labs').innerHTML = curriculum.labs.map(lab => {
    const row = labRow(lab.id);
    const status = row ? row.status : 'not_started';
    return '<article class="card lab-card" data-lab="' + lab.id + '">' +
      '<h3>' + esc(lab.id.replace('lab-', 'Lab ')) + ' — ' + esc(lab.title) + '</h3>' +
      '<p class="meta">' + esc(lab.owasp) + '</p>' +
      '<p class="lesson">' + esc(lab.lesson) + '</p>' +
      '<label>Status <select class="lab-status" data-lab="' + lab.id + '">' +
        ['not_started', 'in_progress', 'solved'].map(s =>
          '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + statusLabel(s) + '</option>').join('') +
      '</select></label>' +
      '<label>Writeup <textarea class="lab-writeup" data-lab="' + lab.id + '" rows="4">' + esc(row ? row.writeup : '') + '</textarea></label>' +
      '<label>Tools <textarea class="lab-tools" data-lab="' + lab.id + '" rows="3">' + esc(row ? row.toolList : '') + '</textarea></label>' +
      '<label>Prompts used <textarea class="lab-prompts" data-lab="' + lab.id + '" rows="3">' + esc(row ? row.promptsUsed : '') + '</textarea></label>' +
      '<button type="button" class="save-lab" data-lab="' + lab.id + '">Save lab</button>' +
      (row && row.updatedAt ? '<span class="updated">Updated ' + esc(row.updatedAt.slice(0, 10)) + '</span>' : '') +
    '</article>';
  }).join('');
}

function renderLakera() {
  $('lakera').innerHTML = curriculum.lakera.map(app => {
    const row = lakeraRow(app.id);
    const status = row ? row.status : 'not_started';
    const score = row && row.score !== null && row.score !== undefined ? row.score : '';
    const passed = row && row.score !== null && row.score >= curriculum.passScore;
    return '<article class="card lakera-card" data-app="' + app.id + '">' +
      '<h3>' + esc(app.name) + '</h3>' +
      '<p class="meta">' + esc(app.focus) + '</p>' +
      '<label>Status <select class="lakera-status" data-app="' + app.id + '">' +
        ['not_started', 'in_progress', 'passed'].map(s =>
          '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + statusLabel(s) + '</option>').join('') +
      '</select></label>' +
      '<label>Score (0–100, 75+ passes) <input type="number" class="lakera-score" data-app="' + app.id + '" min="0" max="100" step="1" value="' + esc(score) + '" placeholder="—"></label>' +
      (passed ? '<span class="pass-badge">Passed ' + esc(score) + '</span>' : '') +
      '<label>Notes <textarea class="lakera-notes" data-app="' + app.id + '" rows="3">' + esc(row ? row.notes : '') + '</textarea></label>' +
      '<button type="button" class="save-lakera" data-app="' + app.id + '">Save app</button>' +
    '</article>';
  }).join('');
}

function renderPlan() {
  $('plan').innerHTML = '<ul class="plan-list">' + curriculum.plan.map(block =>
    '<li><label><input type="checkbox" class="plan-check" data-plan="' + block.id + '"' +
    (planChecked(block.id) ? ' checked' : '') + '> <strong>' + esc(block.range) + '</strong> — ' + esc(block.task) + '</label></li>'
  ).join('') + '</ul>';
}

function renderJournal() {
  if (!state.journal.length) { $('journal-list').innerHTML = '<p class="empty">No journal entries yet.</p>'; return; }
  $('journal-list').innerHTML = state.journal.map(j =>
    '<article class="card journal-card" data-id="' + j.id + '">' +
      '<h3>' + esc(j.title) + '</h3>' +
      '<p class="meta">' + esc(j.labRef || 'no lab ref') + ' · ' + esc(j.createdAt.slice(0, 10)) + '</p>' +
      '<p class="body">' + esc(j.body).replace(/\n/g, '<br>') + '</p>' +
      '<button type="button" class="edit-journal" data-id="' + j.id + '">Edit</button> ' +
      '<button type="button" class="delete-journal" data-id="' + j.id + '">Delete</button>' +
    '</article>'
  ).join('');
}

function renderFindings() {
  if (!state.findings.length) { $('findings-list').innerHTML = '<p class="empty">No findings saved yet.</p>'; return; }
  $('findings-list').innerHTML = state.findings.map(f =>
    '<article class="card finding-card" data-id="' + f.id + '">' +
      '<h3>' + esc(f.finding) + '</h3>' +
      '<p class="meta">Target: ' + esc(f.target) + ' · Impact: ' + esc(f.impact) + ' · ' + esc(f.createdAt.slice(0, 10)) + '</p>' +
      (f.evidence ? '<p><strong>Evidence:</strong> ' + esc(f.evidence) + '</p>' : '') +
      (f.repro ? '<p><strong>Repro:</strong> ' + esc(f.repro) + '</p>' : '') +
      (f.recommendation ? '<p><strong>Recommendation:</strong> ' + esc(f.recommendation) + '</p>' : '') +
      '<button type="button" class="edit-finding" data-id="' + f.id + '">Edit</button> ' +
      '<button type="button" class="delete-finding" data-id="' + f.id + '">Delete</button>' +
    '</article>'
  ).join('');
}

// --- event wiring (delegated; survives re-renders) ---

document.addEventListener('input', e => {
  if (e.target.matches('textarea, input, select')) markDirty();
});

document.addEventListener('click', async e => {
  const saveLab = e.target.closest('.save-lab');
  if (saveLab) {
    const id = saveLab.dataset.lab;
    const card = saveLab.closest('.lab-card');
    try {
      await api('/api/labs', 'POST', {
        labId: id,
        status: card.querySelector('.lab-status').value,
        writeup: card.querySelector('.lab-writeup').value,
        toolList: card.querySelector('.lab-tools').value,
        promptsUsed: card.querySelector('.lab-prompts').value
      });
      await load();
      alert('Lab saved.');
    } catch (err) { alert('Could not save lab: ' + err.message); }
    return;
  }

  const saveLak = e.target.closest('.save-lakera');
  if (saveLak) {
    const id = saveLak.dataset.app;
    const card = saveLak.closest('.lakera-card');
    const raw = card.querySelector('.lakera-score').value;
    const score = raw === '' ? null : parseInt(raw, 10);
    if (score !== null && (Number.isNaN(score) || score < 0 || score > 100)) { alert('Score must be an integer 0–100.'); return; }
    try {
      await api('/api/lakera', 'POST', {
        appId: id,
        status: card.querySelector('.lakera-status').value,
        score,
        notes: card.querySelector('.lakera-notes').value
      });
      await load();
      alert('App saved.');
    } catch (err) { alert('Could not save app: ' + err.message); }
    return;
  }

  const editJ = e.target.closest('.edit-journal');
  if (editJ) {
    const entry = state.journal.find(j => j.id === parseInt(editJ.dataset.id, 10));
    if (!entry) return;
    const title = prompt('Title', entry.title);
    if (title === null) return;
    const body = prompt('Notes', entry.body);
    if (body === null) return;
    const labRef = prompt('Lab / app ref', entry.labRef || '');
    if (labRef === null) return;
    try {
      await api('/api/journal/' + entry.id, 'PUT', { title, body, labRef });
      await load();
    } catch (err) { alert('Could not update entry: ' + err.message); }
    return;
  }

  const delJ = e.target.closest('.delete-journal');
  if (delJ) {
    const id = parseInt(delJ.dataset.id, 10);
    if (!confirm('Delete this journal entry?')) return;
    try { await api('/api/journal/' + id, 'DELETE'); await load(); }
    catch (err) { alert('Could not delete entry: ' + err.message); }
    return;
  }

  const editF = e.target.closest('.edit-finding');
  if (editF) {
    const f = state.findings.find(x => x.id === parseInt(editF.dataset.id, 10));
    if (!f) return;
    const target = prompt('Target', f.target);
    if (target === null) return;
    const finding = prompt('Finding', f.finding);
    if (finding === null) return;
    const impact = prompt('Impact', f.impact || '');
    if (impact === null) return;
    const evidence = prompt('Evidence', f.evidence || '');
    if (evidence === null) return;
    const repro = prompt('Repro steps', f.repro || '');
    if (repro === null) return;
    const recommendation = prompt('Recommendation', f.recommendation || '');
    if (recommendation === null) return;
    try {
      await api('/api/findings/' + f.id, 'PUT', { target, finding, impact, evidence, repro, recommendation });
      await load();
    } catch (err) { alert('Could not update finding: ' + err.message); }
    return;
  }

  const delF = e.target.closest('.delete-finding');
  if (delF) {
    const id = parseInt(delF.dataset.id, 10);
    if (!confirm('Delete this finding?')) return;
    try { await api('/api/findings/' + id, 'DELETE'); await load(); }
    catch (err) { alert('Could not delete finding: ' + err.message); }
    return;
  }
});

document.addEventListener('change', async e => {
  const check = e.target.closest('.plan-check');
  if (check) {
    try {
      await api('/api/plan', 'POST', { blockId: check.dataset.plan, done: check.checked });
      await load();
    } catch (err) { alert('Could not save plan check: ' + err.message); await load(); }
  }
});

$('journal-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/journal', 'POST', {
      title: $('journal-title').value,
      labRef: $('journal-labref').value,
      body: $('journal-body').value
    });
    e.target.reset();
    await load();
  } catch (err) { alert('Could not add entry: ' + err.message); }
});

$('finding-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('/api/findings', 'POST', {
      target: $('finding-target').value,
      finding: $('finding-title').value,
      impact: $('finding-impact').value,
      evidence: $('finding-evidence').value,
      repro: $('finding-repro').value,
      recommendation: $('finding-recommendation').value
    });
    e.target.reset();
    await load();
  } catch (err) { alert('Could not save finding: ' + err.message); }
});

function download(filename, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('download-json').addEventListener('click', async () => {
  try {
    const data = await api('/api/export');
    download('ai-hacker-lab-hq-backup.json', JSON.stringify(data, null, 2), 'application/json');
    $('backup-status').textContent = 'JSON backup downloaded.';
  } catch (err) { $('backup-status').textContent = 'Backup failed: ' + err.message; }
});

$('download-md').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/export/markdown');
    if (!res.ok) throw new Error('export failed: ' + res.status);
    download('ai-hacker-lab-hq-portfolio.md', await res.text(), 'text/markdown');
    $('backup-status').textContent = 'Markdown portfolio downloaded.';
  } catch (err) { $('backup-status').textContent = 'Export failed: ' + err.message; }
});

// Two-step restore: step 1 validates (nothing changes), step 2 applies.
$('restore-form').addEventListener('submit', async e => {
  e.preventDefault();
  const file = $('restore-file').files[0];
  if (!file) return;
  let parsed;
  try { parsed = JSON.parse(await file.text()); }
  catch (err) { $('backup-status').textContent = 'That file is not valid JSON.'; return; }
  const backup = parsed.state || parsed;
  try {
    const result = await api('/api/import', 'POST', { state: backup, confirm: false });
    pendingRestore = backup;
    $('restore-summary').textContent = 'Backup validated: ' + result.summary.labs + ' lab rows, ' +
      result.summary.lakera + ' Lakera rows, ' + result.summary.planChecks + ' plan checks, ' +
      result.summary.journal + ' journal entries, ' + result.summary.findings + ' findings.';
    $('restore-confirm').classList.remove('hidden');
    $('backup-status').textContent = 'Backup is valid. Confirm below to apply it.';
  } catch (err) {
    $('backup-status').textContent = 'Backup rejected — nothing changed: ' + err.message;
  }
});

$('restore-apply').addEventListener('click', async () => {
  if (!pendingRestore) return;
  try {
    await api('/api/import', 'POST', { state: pendingRestore, confirm: true });
    pendingRestore = null;
    $('restore-confirm').classList.add('hidden');
    $('restore-form').reset();
    await load();
    $('backup-status').textContent = 'Backup restored.';
  } catch (err) {
    $('backup-status').textContent = 'Restore failed — nothing changed: ' + err.message;
  }
});

$('restore-cancel').addEventListener('click', () => {
  pendingRestore = null;
  $('restore-confirm').classList.add('hidden');
  $('restore-form').reset();
  $('backup-status').textContent = 'Restore cancelled. Nothing changed.';
});

load().catch(err => {
  document.querySelector('main').insertAdjacentHTML('afterbegin',
    '<p role="alert">Could not load tracker state: ' + esc(err.message) + '</p>');
});
