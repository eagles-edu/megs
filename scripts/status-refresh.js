#!/usr/bin/env node
/*
  Lightweight status refresh
  - Rebuilds persistence/status.json based on current remember.json and history.jsonl
  - Does NOT append to history (read-only except writing status)
*/
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PERSIST = path.join(ROOT, 'persistence');
const REMEMBER = path.join(PERSIST, 'remember.json');
const STATUS = path.join(PERSIST, 'status.json');
const HISTORY = path.join(PERSIST, 'history.jsonl');

function toISO(d = Date.now()) { return new Date(d).toISOString(); }

async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }
async function loadJson(file, fallback) { try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return fallback; } }
function parseJSONL(raw) {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const items = [];
  for (const l of lines) { try { items.push(JSON.parse(l)); } catch {} }
  return items;
}
function withinDays(ts, days) {
  const t = new Date(ts).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}
function findLastSessionClose(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.type === 'session_close') return history[i];
  }
  return history[history.length - 1] || null;
}

function buildStatus(remember, history, ctx) {
  const now = toISO();
  const s = remember.sections || {};
  return {
    version: remember.version || 1,
    updated_at: now,
    policy: remember.policy || {},
    summary: {
      dos: (s.dos || []).length,
      donts: (s.donts || []).length,
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

(async function main(){
  const remember = await loadJson(REMEMBER, null);
  if (!remember) { console.error('[status-refresh] ERROR: remember.json missing'); process.exit(1); }
  let history = [];
  try {
    const raw = await fsp.readFile(HISTORY, 'utf8');
    history = parseJSONL(raw);
  } catch {}

  const last6 = history.filter((h) => withinDays(h?.ts || h?.timestamp || 0, 6));
  const lastClose = findLastSessionClose(history);
  const ctx = {
    last_6_days_entries: last6.length,
    last_session_close: lastClose ? { ts: lastClose.ts || lastClose.timestamp, note: lastClose.note || lastClose.summary || null, type: lastClose.type } : null
  };

  const status = buildStatus(remember, history, ctx);
  await ensureDir(path.dirname(STATUS));
  await fsp.writeFile(STATUS, JSON.stringify(status, null, 2), 'utf8');
  console.log('[status-refresh] status.json updated');
})();