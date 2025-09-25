#!/usr/bin/env node
/*
  Append structured log entries to persistence/history.jsonl
  Usage examples:
    node scripts/log-history.js note "Quick update"
    node scripts/log-history.js decision "Policy change" '{"rationale":"..."}'
    node scripts/log-history.js error "Failure doing X" '{"code":123}'
    node scripts/log-history.js close "Session end summary"
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PERSIST_DIR = path.join(ROOT, 'persistence');
const HISTORY = path.join(PERSIST_DIR, 'history.jsonl');

function toISO(d = Date.now()) { return new Date(d).toISOString(); }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

const type = process.argv[2] || 'note';
const summary = process.argv[3] || '';
const detailsArg = process.argv[4] || null;
let details = undefined;
if (detailsArg) {
  try { details = JSON.parse(detailsArg); } catch { details = { raw: detailsArg }; }
}

if (!summary) {
  console.error('Usage: node scripts/log-history.js <type> <summary> [detailsJson]');
  process.exit(1);
}

const entry = { ts: toISO(), type, summary };
if (details !== undefined) entry.details = details;

ensureDir(path.dirname(HISTORY));
fs.appendFileSync(HISTORY, JSON.stringify(entry) + '\n', 'utf8');
console.log(`[log-history] appended ${type}: ${summary}`);