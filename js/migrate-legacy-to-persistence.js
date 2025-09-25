#!/usr/bin/env node
/**
 * One-time migration: glean legacy DOCS/CODEX remnants and codify into new persistence.
 * - Reads docs/codex-log.md and docs/codex-archive/*.md
 * - Extracts CODEx NOTE blocks and key settings/decisions
 * - Appends structured entries to persistence/history.jsonl
 * - Updates persistence/remember.json sections where applicable
 * - Finally, removes legacy remnants: docs/codex-log.md, docs/codex-archive/, CODEX.LOG.MD, AGENTS.md
 *
 * Safe by default: dry-run unless --apply is passed.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PERSIST_DIR = path.join(ROOT, 'persistence');
const REMEMBER = path.join(PERSIST_DIR, 'remember.json');
const HISTORY = path.join(PERSIST_DIR, 'history.jsonl');
const DOCS = path.join(ROOT, 'docs');
const CODEX_LOG = path.join(DOCS, 'codex-log.md');
const CODEX_ARCH = path.join(DOCS, 'codex-archive');
const CODEX_SUMMARY = path.join(ROOT, 'CODEX.LOG.MD');
const AGENTS_GUIDE = path.join(ROOT, 'AGENTS.md');

const APPLY = process.argv.includes('--apply');

function toISO(d = Date.now()) { return new Date(d).toISOString(); }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function write(file, data) { ensureDir(path.dirname(file)); fs.writeFileSync(file, data, 'utf8'); }
function append(file, data) { ensureDir(path.dirname(file)); fs.appendFileSync(file, data, 'utf8'); }

function parseJSONL(raw) {
  return raw.split(/\r?\n/).filter(Boolean).map(l=>{ try { return JSON.parse(l);} catch { return null; } }).filter(Boolean);
}
function stringifyJSONL(items) { return items.map(x=>JSON.stringify(x)).join('\n') + (items.length?'\n':''); }

function loadRemember() {
  const raw = read(REMEMBER);
  if (!raw) throw new Error('persistence/remember.json missing');
  const j = JSON.parse(raw);
  j.sections ||= {};
  j.sections.instructions ||= { current_focus: [], next_tasks: [], open_questions: [] };
  j.sections.dos ||= [];
  j.sections.donts ||= [];
  j.sections.lessons_learned ||= [];
  j.sections.great_modules ||= [];
  j.sections.sop ||= [];
  return j;
}

function addOnce(arr, item, keyFn = (x)=>JSON.stringify(x)) {
  const key = keyFn(item);
  if (!arr.some(v => keyFn(v) === key)) arr.push(item);
}

function gleanFromText(text) {
  const entries = [];
  const lines = text.split(/\r?\n/);
  for (let i=0;i<lines.length;i++) {
    const L = lines[i];
    const m = /^===== CODEx NOTE @\s+(.+?)\s+=====/.exec(L);
    if (m) {
      const ts = new Date(m[1]).toISOString();
      const block = [];
      for (let j=i+1;j<Math.min(i+80, lines.length);j++) {
        if (/^=====\s/.test(lines[j])) break;
        block.push(lines[j]);
      }
      const text = block.join('\n').trim();
      entries.push({ ts, type: 'legacy_note', summary: text.slice(0, 160), details: { source: 'codex-note', length: text.length } });
    }
  }
  // Heuristics for decisions from the logs
  if (/close-order:\s*disabled/i.test(text)) {
    entries.push({ ts: toISO(), type: 'decision', summary: 'HTML rule close-order disabled initially to reduce noise', details: { tool: 'html-validate', rule: 'close-order', value: 'off' } });
  }
  if (/memory system updated/i.test(text)) {
    entries.push({ ts: toISO(), type: 'decision', summary: 'Legacy memory system replaced by new persistence', details: { from: 'codex', to: 'persistence/*' } });
  }
  return entries;
}

function mergeRemember(remember) {
  // Codify durable decisions from legacy
  addOnce(remember.sections.lessons_learned, { title: 'Legacy logs migrated', notes: 'CODEx logs gleaned; new persistence established.', tags: ['process','migration'] }, x=>x.title);
  remember.updated_at = toISO();
  return remember;
}

function migrate() {
  const remember = loadRemember();
  const histRaw = read(HISTORY);
  const history = histRaw ? parseJSONL(histRaw) : [];

  let gleaned = [];
  const sources = [CODEX_LOG, CODEX_SUMMARY];
  for (const s of sources) if (fs.existsSync(s)) gleaned.push(gleanFromText(read(s)));
  if (fs.existsSync(CODEX_ARCH)) {
    for (const f of fs.readdirSync(CODEX_ARCH)) {
      if (f.endsWith('.md')) gleaned.push(gleanFromText(read(path.join(CODEX_ARCH, f))));
    }
  }
  gleaned = gleaned.flat();

  const before = history.length;
  const mergedHistory = history.concat(gleaned);

  const updatedRemember = mergeRemember(remember);

  if (!APPLY) {
    console.log('[migrate:legacy] DRY-RUN');
    console.log('  gleaned entries:', gleaned.length);
    console.log('  history before/after:', before, '/', mergedHistory.length);
    console.log('  would update remember.json updated_at');
    console.log('  would remove: docs/codex-log.md, docs/codex-archive/, CODEX.LOG.MD, AGENTS.md');
    return;
  }

  write(HISTORY, stringifyJSONL(mergedHistory));
  write(REMEMBER, JSON.stringify(updatedRemember, null, 2));

  // Remove legacy remnants
  const rm = (p) => { try {
    if (fs.existsSync(p)) {
      if (fs.lstatSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
      else fs.unlinkSync(p);
    }
  } catch {}
  };
  rm(CODEX_LOG);
  rm(CODEX_ARCH);
  rm(CODEX_SUMMARY);
  rm(AGENTS_GUIDE);
  console.log('[migrate:legacy] Applied. Gleaned:', gleaned.length, 'Removed legacy docs.');
}

try { migrate(); } catch (e) { console.error('[migrate:legacy] FATAL', e.message); process.exit(1); }