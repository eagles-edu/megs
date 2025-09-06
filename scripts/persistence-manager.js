// scripts/persistence-manager.js
// Purpose: Single-source persistence manager that ingests persistence/remember.json
// and the structured persistence history log, derives context (last 6 days and last
// session close), updates status, and appends a new startup entry. Legacy .codex is ignored.

import fs from 'fs/promises';
import path from 'path';

const ROOT = path.resolve('.');
const PERSIST_DIR = path.join(ROOT, 'persistence');
const REMEMBER_PATH = path.join(PERSIST_DIR, 'remember.json');
const STATUS_PATH = path.join(PERSIST_DIR, 'status.json');
const HISTORY_PATH = path.join(PERSIST_DIR, 'history.jsonl');
const ARCHIVE_DIR = path.join(PERSIST_DIR, 'archive');
const SESSION_LOG = path.join(ROOT, 'docs', 'session-log.md');

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function loadJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function saveJson(file, obj) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
}

async function append(file, text) {
  await ensureDir(path.dirname(file));
  await fs.appendFile(file, text, 'utf8');
}

function toISO(d) { return new Date(d).toISOString(); }

function parseJSONL(raw) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const items = [];
  for (const line of lines) {
    try { items.push(JSON.parse(line)); } catch {}
  }
  return items;
}

function stringifyJSONL(items) {
  return items.map((o) => JSON.stringify(o)).join('\n') + (items.length ? '\n' : '');
}

function normalizeRemember(remember) {
  const now = toISO(Date.now());
  const base = {
    version: 1,
    updated_at: now,
    owner: 'workspace',
    policy: {
      autoflush: true,
      debounce_ms: 1000,
      max_bytes: 524288,
      prune: { preserve_types: ['decision'], order: 'last_seen_at_asc' }
    },
    sections: {
      dos: [],
      donts: [],
      instructions: { current_focus: [], next_tasks: [], open_questions: [] },
      lessons_learned: [],
      great_modules: [],
      sop: []
    }
  };
  const out = { ...base, ...remember };
  out.updated_at = now;
  out.policy = { ...base.policy, ...(remember?.policy || {}) };
  out.policy.prune = { ...base.policy.prune, ...(remember?.policy?.prune || {}) };
  out.sections = { ...base.sections, ...(remember?.sections || {}) };
  out.sections.instructions = { ...base.sections.instructions, ...(remember?.sections?.instructions || {}) };
  return out;
}

function buildStatus(remember, history, ctx) {
  const now = toISO(Date.now());
  const s = remember.sections;
  return {
    version: remember.version || 1,
    updated_at: now,
    policy: remember.policy,
    summary: {
      dos: s.dos.length,
      donts: s.donts.length,
      focus_count: (s.instructions?.current_focus || []).length,
      next_tasks_count: (s.instructions?.next_tasks || []).length,
      open_questions_count: (s.instructions?.open_questions || []).length,
      lessons_count: (s.lessons_learned || []).length,
      great_modules_count: (s.great_modules || []).length,
      sop_count: (s.sop || []).length,
      history_entries: history.length
    },
    highlights: {
      current_focus: (s.instructions?.current_focus || []).slice(0, 3),
      next_tasks: (s.instructions?.next_tasks || []).slice(0, 3)
    },
    context: ctx
  };
}

function withinDays(ts, days) {
  const t = new Date(ts).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

function findLastSessionClose(history) {
  // Prefer explicit session_close, else last entry
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.type === 'session_close') return history[i];
  }
  return history[history.length - 1] || null;
}

async function loadHistory() {
  try {
    const raw = await fs.readFile(HISTORY_PATH, 'utf8');
    return parseJSONL(raw);
  } catch { return []; }
}

async function appendHistory(entry) {
  const line = JSON.stringify(entry) + '\n';
  await append(HISTORY_PATH, line);
}

async function appendSessionLog(lines) {
  await ensureDir(path.dirname(SESSION_LOG));
  const stamp = toISO(Date.now());
  const block = [`### ${stamp}`, ...lines, ''].join('\n');
  await append(SESSION_LOG, block);
}

async function main() {
  await ensureDir(PERSIST_DIR);
  await ensureDir(ARCHIVE_DIR);

  const rememberRaw = await loadJson(REMEMBER_PATH, null);
  if (!rememberRaw) {
    console.error(`[persistence] ERROR: ${REMEMBER_PATH} missing or invalid.`);
    process.exit(1);
  }

  // Normalize remember and persist it
  const remember = normalizeRemember(rememberRaw);
  await saveJson(REMEMBER_PATH, remember);

  // Load history and compute context
  const history = await loadHistory();
  const last6 = history.filter((h) => withinDays(h?.ts || h?.timestamp || 0, 6));
  const lastClose = findLastSessionClose(history);
  const ctx = {
    last_6_days_entries: last6.length,
    last_session_close: lastClose ? { ts: lastClose.ts || lastClose.timestamp, note: lastClose.note || lastClose.summary || null, type: lastClose.type } : null
  };

  // Build and save status
  const status = buildStatus(remember, history, ctx);
  await saveJson(STATUS_PATH, status);

  // Append a structured startup entry to history
  const entry = {
    ts: toISO(Date.now()),
    type: 'startup_ingest',
    summary: `remember.json ingested; dos=${status.summary.dos}, donts=${status.summary.donts}, next=${status.summary.next_tasks_count}`,
    focus: status.highlights.current_focus,
    next: status.highlights.next_tasks,
    context: ctx
  };
  await appendHistory(entry);

  // Human-readable session-log note
  await appendSessionLog([
    `- Startup: ingested remember.json; last_6_days=${ctx.last_6_days_entries}; picked up after: ${ctx.last_session_close?.ts || 'n/a'}`
  ]);

  console.log('[persistence] remember.json + history ingested.');
  console.log(JSON.stringify(status, null, 2));
}

main().catch((err) => { console.error('[persistence] FATAL', err); process.exit(1); });