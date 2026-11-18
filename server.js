'use strict';
/**
 * AI Hacker Lab HQ — standalone server.
 *
 * Node.js standard library only (zero dependencies).
 * Serves public/ and a JSON API for the curriculum tracker.
 * Progress is persisted to data/data.json, created from data/seed.json
 * on first run. data/data.json is gitignored; seed.json is committed.
 *
 * Port: process.env.PORT or 3000.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');
const MAX_BODY_BYTES = 1024 * 1024; // 1 MiB

// ---------------------------------------------------------------------------
// Curriculum (static; ids are the only ones the server ever accepts)
// ---------------------------------------------------------------------------

const LAB_IDS = ['lab-1', 'lab-2', 'lab-3', 'lab-4', 'lab-5', 'lab-6', 'lab-7'];
const APP_IDS = ['app-1', 'app-2', 'app-3', 'app-4', 'app-5', 'app-6', 'app-7', 'app-8', 'app-9', 'app-10'];
const PLAN_IDS = ['plan-1', 'plan-2', 'plan-3', 'plan-4', 'plan-5', 'plan-6', 'plan-7'];

const LAB_STATUSES = ['not_started', 'in_progress', 'solved'];
const LAKERA_STATUSES = ['not_started', 'in_progress', 'passed'];

const CURRICULUM = {
  labs: [
    { id: 'lab-1', title: 'Excessive Agency', owasp: 'LLM06 / LLM01', lesson: 'A chatbot with a dangerous tool is an agent with a loaded gun. Lesson: never give an LLM a destructive tool without backend auth and human approval.' },
    { id: 'lab-2', title: 'Exploiting Vulnerabilities in LLM APIs', owasp: 'LLM01 / LLM06', lesson: 'Vulnerabilities in LLM APIs — a normal tool whose backend passes input through unsanitized. Lesson: validate and sanitize every input at the API boundary; never trust a call just because the LLM made it.' },
    { id: 'lab-3', title: 'Indirect Prompt Injection', owasp: 'LLM01', lesson: 'Instructions hidden in web pages, files, or tool output can steer the model. Lesson: treat retrieved content as data, never as instructions; verify before acting on it.' },
    { id: 'lab-4', title: 'Insecure Output Handling', owasp: 'LLM02', lesson: 'Model output rendered as code can execute in the browser. Lesson: encode and validate output before rendering; never inject model text into the page unsanitized.' },
    { id: 'lab-5', title: 'AI Agents Triggering Secondary Vulnerabilities', owasp: 'LLM06', lesson: 'An agent with tools can reach internal systems and chain calls into real impact. Lesson: scope every tool to the minimum it needs; validate each action, not just the first.' },
    { id: 'lab-6', title: 'Destructive Actions and CSRF', owasp: 'LLM06', lesson: 'Agents that can act can also destroy. Lesson: require human approval for irreversible actions; protect state-changing calls against forged requests.' },
    { id: 'lab-7', title: 'Bypassing Scanner Defenses', owasp: 'LLM01 / LLM07', lesson: 'Filters and scanners can be evaded. Lesson: defense in depth — never rely on a single filter as the security boundary.' }
  ],
  lakera: [
    { id: 'app-1', name: 'Thingularity', focus: 'Tool enumeration' },
    { id: 'app-2', name: 'MindfulChat', focus: 'Memory poisoning' },
    { id: 'app-3', name: 'System Prompt Exfiltration', focus: 'Prompt extraction' },
    { id: 'app-4', name: 'Phishing / Malicious Link Insertion', focus: 'Malicious link insertion' },
    { id: 'app-5', name: 'Unauthorized Tool Call', focus: 'Unauthorized tool use' },
    { id: 'app-6', name: 'Malicious Code / Command', focus: 'Code and command injection' },
    { id: 'app-7', name: 'Data Exfiltration', focus: 'Getting data out' },
    { id: 'app-8', name: 'DoS / Resource Abuse', focus: 'Resource exhaustion' },
    { id: 'app-9', name: 'Multi-Step Agent', focus: 'Chained multi-step attacks' },
    { id: 'app-10', name: 'Expert / Combined', focus: 'Combined techniques' }
  ],
  plan: [
    { id: 'plan-1', range: 'Days 1–3', task: 'PortSwigger Labs 1–2 + writeups' },
    { id: 'plan-2', range: 'Days 4–7', task: 'Labs 3–4' },
    { id: 'plan-3', range: 'Days 8–11', task: 'Labs 5–7' },
    { id: 'plan-4', range: 'Days 12–18', task: 'Lakera 1 app/day, aim 75+, prompt journal' },
    { id: 'plan-5', range: 'Days 19–23', task: 'Arcanum classify 20 prompts on 4 axes' },
    { id: 'plan-6', range: 'Days 24–27', task: 'First full red-team report on a lab app' },
    { id: 'plan-7', range: 'Days 28–30', task: 'Review defenses, re-test, update portfolio' }
  ],
  passScore: 75
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function emptyState() {
  return { labs: [], lakera: [], planChecks: [], journal: [], findings: [], nextJournalId: 1, nextFindingId: 1 };
}

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return normalizeState(parsed);
    }
  } catch (err) {
    console.error('data.json unreadable, falling back to seed:', err.message);
  }
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const state = normalizeState(seed);
  saveState(state);
  return state;
}

// Keep only known fields; fill missing counters from existing rows.
function normalizeState(raw) {
  const s = emptyState();
  if (Array.isArray(raw.labs)) s.labs = raw.labs.filter(isValidLabRow);
  if (Array.isArray(raw.lakera)) s.lakera = raw.lakera.filter(isValidLakeraRow);
  if (Array.isArray(raw.planChecks)) s.planChecks = raw.planChecks.filter(isValidPlanRow);
  if (Array.isArray(raw.journal)) s.journal = raw.journal.filter(isValidJournalRow);
  if (Array.isArray(raw.findings)) s.findings = raw.findings.filter(isValidFindingRow);
  s.nextJournalId = positiveInt(raw.nextJournalId) || (maxId(s.journal) + 1);
  s.nextFindingId = positiveInt(raw.nextFindingId) || (maxId(s.findings) + 1);
  return s;
}

function maxId(rows) {
  return rows.reduce((m, r) => Math.max(m, r.id || 0), 0);
}

function saveState(state) {
  const tmp = DATA_FILE + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

let state = loadState();

// ---------------------------------------------------------------------------
// Validation (strict: unknown curriculum ids are rejected, never stored)
// ---------------------------------------------------------------------------

function isStr(v, max, min) {
  return typeof v === 'string' && v.length >= (min || 0) && v.length <= max;
}
function isIsoDate(v) {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v);
}
function positiveInt(v) {
  return Number.isInteger(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER ? v : null;
}

function isValidLabRow(r) {
  return r && LAB_IDS.includes(r.labId) && LAB_STATUSES.includes(r.status)
    && isStr(r.writeup || '', 8000) && isStr(r.toolList || '', 4000)
    && isStr(r.promptsUsed || '', 8000) && isIsoDate(r.updatedAt);
}
function isValidLakeraRow(r) {
  return r && APP_IDS.includes(r.appId) && LAKERA_STATUSES.includes(r.status)
    && (r.score === null || (Number.isInteger(r.score) && r.score >= 0 && r.score <= 100))
    && isStr(r.notes || '', 8000) && isIsoDate(r.updatedAt);
}
function isValidPlanRow(r) {
  return r && PLAN_IDS.includes(r.blockId) && typeof r.done === 'boolean';
}
function isValidJournalRow(r) {
  return r && positiveInt(r.id) && isStr(r.title, 200, 1) && isStr(r.body || '', 8000)
    && isStr(r.labRef || '', 60) && isIsoDate(r.createdAt);
}
function isValidFindingRow(r) {
  return r && positiveInt(r.id) && isStr(r.target, 200, 1) && isStr(r.finding, 200, 1)
    && isStr(r.impact || '', 200) && isStr(r.evidence || '', 8000)
    && isStr(r.repro || '', 8000) && isStr(r.recommendation || '', 8000)
    && isIsoDate(r.createdAt);
}

// Full backup validation: every row must be valid, no duplicates, no extras.
function validateBackup(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['backup must be a JSON object'];
  const keys = ['labs', 'lakera', 'planChecks', 'journal', 'findings'];
  for (const k of keys) {
    if (!Array.isArray(input[k])) errors.push(k + ' must be an array');
  }
  if (errors.length) return errors;
  if (input.labs.length > 7) errors.push('labs: at most 7 rows');
  if (input.lakera.length > 10) errors.push('lakera: at most 10 rows');
  if (input.planChecks.length > 7) errors.push('planChecks: at most 7 rows');
  if (input.journal.length > 1000) errors.push('journal: at most 1000 rows');
  if (input.findings.length > 1000) errors.push('findings: at most 1000 rows');
  const seen = new Set();
  const dup = (kind, id) => {
    const key = kind + ':' + id;
    if (seen.has(key)) errors.push(kind + ' ' + id + ': duplicate id');
    seen.add(key);
  };
  input.labs.forEach((r, i) => { if (!isValidLabRow(r)) errors.push('labs[' + i + ']: invalid row (bad id, status, or field)'); else dup('lab', r.labId); });
  input.lakera.forEach((r, i) => { if (!isValidLakeraRow(r)) errors.push('lakera[' + i + ']: invalid row (bad id, status, score, or field)'); else dup('lakera', r.appId); });
  input.planChecks.forEach((r, i) => { if (!isValidPlanRow(r)) errors.push('planChecks[' + i + ']: invalid row (bad id or done flag)'); else dup('plan', r.blockId); });
  input.journal.forEach((r, i) => { if (!isValidJournalRow(r)) errors.push('journal[' + i + ']: invalid row'); else dup('journal', r.id); });
  input.findings.forEach((r, i) => { if (!isValidFindingRow(r)) errors.push('findings[' + i + ']: invalid row'); else dup('finding', r.id); });
  return errors;
}

// ---------------------------------------------------------------------------
// Markdown portfolio export
// ---------------------------------------------------------------------------

function labById(id) { return CURRICULUM.labs.find(l => l.id === id); }
function appById(id) { return CURRICULUM.lakera.find(a => a.id === id); }
function planById(id) { return CURRICULUM.plan.find(p => p.id === id); }
function labRow(id) { return state.labs.find(r => r.labId === id); }
function lakeraRow(id) { return state.lakera.find(r => r.appId === id); }
function planDone(id) { const r = state.planChecks.find(p => p.blockId === id); return !!(r && r.done); }

function statusLabel(s) {
  return { not_started: 'Not started', in_progress: 'In progress', solved: 'Solved', passed: 'Passed' }[s] || s;
}

function markdownExport() {
  const now = new Date().toISOString();
  const lines = [];
  lines.push('# AI Hacker Lab HQ — Portfolio');
  lines.push('');
  lines.push('Exported ' + now + '.');
  lines.push('');
  const solved = state.labs.filter(r => r.status === 'solved').length;
  const passed = state.lakera.filter(r => r.status === 'passed').length;
  const planDoneCount = state.planChecks.filter(r => r.done).length;
  lines.push('## Progress');
  lines.push('');
  lines.push('- PortSwigger labs solved: ' + solved + ' / 7');
  lines.push('- Lakera apps passed (75+): ' + passed + ' / 10');
  lines.push('- 30-day plan blocks done: ' + planDoneCount + ' / 7');
  lines.push('- Journal entries: ' + state.journal.length);
  lines.push('- Report findings: ' + state.findings.length);
  lines.push('');
  lines.push('## PortSwigger Web LLM Attacks Labs');
  lines.push('');
  for (const lab of CURRICULUM.labs) {
    const row = labRow(lab.id);
    lines.push('### ' + lab.id.replace('lab-', 'Lab ') + ' — ' + lab.title);
    lines.push('');
    lines.push('Status: ' + (row ? statusLabel(row.status) : 'Not started'));
    lines.push('');
    lines.push('Lesson: ' + lab.lesson);
    if (row && row.writeup) { lines.push(''); lines.push('Writeup:'); lines.push(''); lines.push(row.writeup); }
    if (row && row.toolList) { lines.push(''); lines.push('Tools:'); lines.push(''); lines.push(row.toolList); }
    if (row && row.promptsUsed) { lines.push(''); lines.push('Prompts used:'); lines.push(''); lines.push(row.promptsUsed); }
    lines.push('');
  }
  lines.push('## Lakera Gandalf Agent Breaker');
  lines.push('');
  for (const app of CURRICULUM.lakera) {
    const row = lakeraRow(app.id);
    const score = row && row.score !== null && row.score !== undefined ? row.score : '—';
    lines.push('- ' + app.name + ' (' + app.focus + '): ' + (row ? statusLabel(row.status) : 'Not started') + ', score ' + score);
    if (row && row.notes) lines.push('  Notes: ' + row.notes.replace(/\n/g, ' '));
  }
  lines.push('');
  lines.push('## 30-Day Plan');
  lines.push('');
  for (const block of CURRICULUM.plan) {
    lines.push('- [' + (planDone(block.id) ? 'x' : ' ') + '] ' + block.range + ' — ' + block.task);
  }
  lines.push('');
  if (state.journal.length) {
    lines.push('## Prompt Journal');
    lines.push('');
    for (const j of state.journal) {
      lines.push('### ' + j.title + (j.labRef ? ' (' + j.labRef + ')' : ''));
      lines.push('');
      lines.push(j.body);
      lines.push('');
    }
  }
  if (state.findings.length) {
    lines.push('## Report Findings');
    lines.push('');
    for (const f of state.findings) {
      lines.push('### ' + f.finding + ' — ' + f.target);
      lines.push('');
      lines.push('Impact: ' + f.impact);
      lines.push('');
      if (f.evidence) { lines.push('Evidence: ' + f.evidence); lines.push(''); }
      if (f.repro) { lines.push('Repro: ' + f.repro); lines.push(''); }
      if (f.recommendation) { lines.push('Recommendation: ' + f.recommendation); lines.push(''); }
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function sendText(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function badRequest(res, message) { sendJson(res, 400, { ok: false, error: message }); }
function notFound(res, message) { sendJson(res, 404, { ok: false, error: message || 'not found' }); }

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function publicState() {
  return {
    labs: state.labs,
    lakera: state.lakera,
    planChecks: state.planChecks,
    journal: state.journal,
    findings: state.findings
  };
}

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

async function handleApi(req, res, pathname, method) {
  // GET /api/state — full tracker state + curriculum
  if (method === 'GET' && pathname === '/api/state') {
    return sendJson(res, 200, { ok: true, curriculum: CURRICULUM, state: publicState() });
  }

  // GET /api/export — complete JSON backup
  if (method === 'GET' && pathname === '/api/export') {
    return sendJson(res, 200, { ok: true, exportedAt: new Date().toISOString(), state: publicState() });
  }

  // GET /api/export/markdown — portfolio as Markdown
  if (method === 'GET' && pathname === '/api/export/markdown') {
    return sendText(res, 200, markdownExport(), 'text/markdown; charset=utf-8');
  }

  // POST /api/labs — save one lab's progress (id must be a real lab)
  if (method === 'POST' && pathname === '/api/labs') {
    const b = await readJsonBody(req);
    if (!LAB_IDS.includes(b.labId)) return badRequest(res, 'unknown labId: ' + String(b.labId));
    if (!LAB_STATUSES.includes(b.status)) return badRequest(res, 'unknown status: ' + String(b.status));
    if (!isStr(b.writeup || '', 8000) || !isStr(b.toolList || '', 4000) || !isStr(b.promptsUsed || '', 8000)) {
      return badRequest(res, 'writeup/toolList/promptsUsed exceed length limits');
    }
    const row = { labId: b.labId, status: b.status, writeup: b.writeup || '', toolList: b.toolList || '', promptsUsed: b.promptsUsed || '', updatedAt: new Date().toISOString() };
    const i = state.labs.findIndex(r => r.labId === b.labId);
    if (i >= 0) state.labs[i] = row; else state.labs.push(row);
    saveState(state);
    return sendJson(res, 200, { ok: true, lab: row });
  }

  // POST /api/lakera — save one Lakera app's progress (id must be real)
  if (method === 'POST' && pathname === '/api/lakera') {
    const b = await readJsonBody(req);
    if (!APP_IDS.includes(b.appId)) return badRequest(res, 'unknown appId: ' + String(b.appId));
    if (!LAKERA_STATUSES.includes(b.status)) return badRequest(res, 'unknown status: ' + String(b.status));
    if (!(b.score === null || b.score === undefined || (Number.isInteger(b.score) && b.score >= 0 && b.score <= 100))) {
      return badRequest(res, 'score must be an integer 0–100 or null');
    }
    if (!isStr(b.notes || '', 8000)) return badRequest(res, 'notes exceed length limit');
    const row = { appId: b.appId, status: b.status, score: (b.score === undefined ? null : b.score), notes: b.notes || '', updatedAt: new Date().toISOString() };
    const i = state.lakera.findIndex(r => r.appId === b.appId);
    if (i >= 0) state.lakera[i] = row; else state.lakera.push(row);
    saveState(state);
    return sendJson(res, 200, { ok: true, lakera: row });
  }

  // POST /api/plan — check/uncheck one 30-day plan block
  if (method === 'POST' && pathname === '/api/plan') {
    const b = await readJsonBody(req);
    if (!PLAN_IDS.includes(b.blockId)) return badRequest(res, 'unknown blockId: ' + String(b.blockId));
    if (typeof b.done !== 'boolean') return badRequest(res, 'done must be a boolean');
    const i = state.planChecks.findIndex(r => r.blockId === b.blockId);
    if (i >= 0) state.planChecks[i].done = b.done; else state.planChecks.push({ blockId: b.blockId, done: b.done });
    saveState(state);
    return sendJson(res, 200, { ok: true, planChecks: state.planChecks });
  }

  // POST /api/journal — add a journal entry
  if (method === 'POST' && pathname === '/api/journal') {
    const b = await readJsonBody(req);
    if (!isStr(b.title, 200, 1)) return badRequest(res, 'title is required (max 200 chars)');
    if (!isStr(b.body || '', 8000) || !isStr(b.labRef || '', 60)) return badRequest(res, 'body/labRef exceed length limits');
    const entry = { id: state.nextJournalId++, title: b.title, body: b.body || '', labRef: b.labRef || '', createdAt: new Date().toISOString() };
    state.journal.push(entry);
    saveState(state);
    return sendJson(res, 200, { ok: true, id: entry.id, entry });
  }

  // PUT /api/journal/:id — edit a journal entry in place
  const jm = pathname.match(/^\/api\/journal\/(\d+)$/);
  if (jm && method === 'PUT') {
    const id = parseInt(jm[1], 10);
    const b = await readJsonBody(req);
    const entry = state.journal.find(j => j.id === id);
    if (!entry) return notFound(res, 'journal entry not found');
    if (!isStr(b.title, 200, 1)) return badRequest(res, 'title is required (max 200 chars)');
    if (!isStr(b.body || '', 8000) || !isStr(b.labRef || '', 60)) return badRequest(res, 'body/labRef exceed length limits');
    entry.title = b.title; entry.body = b.body || ''; entry.labRef = b.labRef || '';
    saveState(state);
    return sendJson(res, 200, { ok: true, entry });
  }

  // DELETE /api/journal/:id
  if (jm && method === 'DELETE') {
    const id = parseInt(jm[1], 10);
    const i = state.journal.findIndex(j => j.id === id);
    if (i < 0) return notFound(res, 'journal entry not found');
    state.journal.splice(i, 1);
    saveState(state);
    return sendJson(res, 200, { ok: true });
  }

  // POST /api/findings — save a report finding
  if (method === 'POST' && pathname === '/api/findings') {
    const b = await readJsonBody(req);
    if (!isStr(b.target, 200, 1) || !isStr(b.finding, 200, 1)) return badRequest(res, 'target and finding are required (max 200 chars)');
    if (!isStr(b.impact || '', 200) || !isStr(b.evidence || '', 8000) || !isStr(b.repro || '', 8000) || !isStr(b.recommendation || '', 8000)) {
      return badRequest(res, 'a field exceeds its length limit');
    }
    const f = { id: state.nextFindingId++, target: b.target, finding: b.finding, impact: b.impact || '', evidence: b.evidence || '', repro: b.repro || '', recommendation: b.recommendation || '', createdAt: new Date().toISOString() };
    state.findings.push(f);
    saveState(state);
    return sendJson(res, 200, { ok: true, id: f.id, finding: f });
  }

  // PUT /api/findings/:id — edit a finding in place
  const fm = pathname.match(/^\/api\/findings\/(\d+)$/);
  if (fm && method === 'PUT') {
    const id = parseInt(fm[1], 10);
    const b = await readJsonBody(req);
    const f = state.findings.find(x => x.id === id);
    if (!f) return notFound(res, 'finding not found');
    if (!isStr(b.target, 200, 1) || !isStr(b.finding, 200, 1)) return badRequest(res, 'target and finding are required (max 200 chars)');
    if (!isStr(b.impact || '', 200) || !isStr(b.evidence || '', 8000) || !isStr(b.repro || '', 8000) || !isStr(b.recommendation || '', 8000)) {
      return badRequest(res, 'a field exceeds its length limit');
    }
    f.target = b.target; f.finding = b.finding; f.impact = b.impact || '';
    f.evidence = b.evidence || ''; f.repro = b.repro || ''; f.recommendation = b.recommendation || '';
    saveState(state);
    return sendJson(res, 200, { ok: true, finding: f });
  }

  // DELETE /api/findings/:id
  if (fm && method === 'DELETE') {
    const id = parseInt(fm[1], 10);
    const i = state.findings.findIndex(x => x.id === id);
    if (i < 0) return notFound(res, 'finding not found');
    state.findings.splice(i, 1);
    saveState(state);
    return sendJson(res, 200, { ok: true });
  }

  // POST /api/import — two-step confirmed restore.
  // Body: { state: {...backup...}, confirm: true }
  // Without confirm:true, validates and returns a summary WITHOUT applying.
  // A bad backup changes nothing either way.
  if (method === 'POST' && pathname === '/api/import') {
    const b = await readJsonBody(req);
    const errors = validateBackup(b.state);
    if (errors.length) return sendJson(res, 400, { ok: false, error: 'backup rejected: ' + errors.join('; ') });
    const summary = {
      labs: b.state.labs.length,
      lakera: b.state.lakera.length,
      planChecks: b.state.planChecks.length,
      journal: b.state.journal.length,
      findings: b.state.findings.length
    };
    if (b.confirm !== true) {
      return sendJson(res, 200, { ok: true, needsConfirmation: true, summary });
    }
    // Atomic swap: the validated backup replaces everything at once,
    // preserving original ids and timestamps.
    state = normalizeState(b.state);
    saveState(state);
    return sendJson(res, 200, { ok: true, restored: true, summary });
  }

  return notFound(res, 'unknown API route');
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) return notFound(res);
  fs.readFile(file, (err, data) => {
    if (err) return notFound(res);
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': data.length });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, req.method).catch(err => {
      console.error('API error:', err.message);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'internal error' });
    });
    return;
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method not allowed' });
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log('AI Hacker Lab HQ listening on http://localhost:' + PORT);
});
