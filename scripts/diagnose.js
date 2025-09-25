#!/usr/bin/env node
/*
  MEGS Persistence System — Diagnose
  Runs sanity checks and prints PASS/FAIL for:
  - Node version
  - Core files existence
  - Heartbeat status and recent activity
  - Ability to append to history.jsonl
  - Status snapshot recency and counters
  - Session log presence
  - Archive directory presence
  Exit code: 0 if all critical checks pass, 1 otherwise.
*/
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const PERSIST = path.join(ROOT, 'persistence');
const REMEMBER = path.join(PERSIST, 'remember.json');
const HISTORY = path.join(PERSIST, 'history.jsonl');
const STATUS = path.join(PERSIST, 'status.json');
const PID = path.join(PERSIST, 'heartbeat.pid');
const ARCHIVE = path.join(PERSIST, 'archive');
const SESSION_LOG = path.join(ROOT, 'docs', 'session-log.md');

function toISO(d = Date.now()) { return new Date(d).toISOString(); }
function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function readJSON(p, fallback = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function timeWithin(ts, minutes) {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return false;
  const cutoff = Date.now() - minutes * 60 * 1000;
  return t >= cutoff;
}
function ok(msg) { console.log(`PASS  ${msg}`); }
function warn(msg) { console.log(`WARN  ${msg}`); }
function fail(msg) { console.log(`FAIL  ${msg}`); }
function isRunning(pid) { try { return process.kill(pid, 0), true; } catch { return false; } }

(async function main(){
  let failures = 0;
  let warnings = 0;

  // 1) Node version
  const major = Number(process.versions.node.split('.')[0]);
  if (major === 20) ok(`Node version v${process.versions.node}`); else { fail(`Node version v${process.versions.node} (expected v20.x)`); failures++; }

  // 2) Core files
  isFile(REMEMBER) ? ok('persistence/remember.json exists') : (fail('persistence/remember.json missing'), failures++);
  isFile(HISTORY) ? ok('persistence/history.jsonl exists') : (fail('persistence/history.jsonl missing'), failures++);
  isFile(STATUS) ? ok('persistence/status.json exists') : (fail('persistence/status.json missing'), failures++);

  // 3) Heartbeat
  let hbRunning = false;
  if (isFile(PID)) {
    const pid = Number(readText(PID).trim());
    if (pid && isRunning(pid)) { ok(`heartbeat running (pid ${pid})`); hbRunning = true; }
    else { warn('heartbeat pid file present but process not running'); warnings++; }
  } else { warn('heartbeat not running (no pid file)'); warnings++; }

  // 4) Recent heartbeat activity (last 5 min)
  let lastHeartbeat = null;
  if (isFile(HISTORY)) {
    const lines = readText(HISTORY).trim().split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj && obj.type === 'heartbeat') { lastHeartbeat = obj; break; }
      } catch {}
    }
  }
  if (lastHeartbeat && timeWithin(lastHeartbeat.ts || lastHeartbeat.timestamp, 5)) {
    ok('recent heartbeat entry within 5 minutes');
  } else {
    const msg = lastHeartbeat ? `stale heartbeat (last at ${lastHeartbeat.ts || lastHeartbeat.timestamp})` : 'no heartbeat entry found yet';
    hbRunning ? warn(msg) : warn(`${msg}; start heartbeat to enable continuous logging`);
    warnings++;
  }

  // 5) Append test entry to history.jsonl
  try {
    const before = isFile(HISTORY) ? fs.statSync(HISTORY).size : 0;
    const entry = { ts: toISO(), type: 'diagnose', summary: 'diagnostic write test', details: { source: 'scripts/diagnose.js' } };
    fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
    fs.appendFileSync(HISTORY, JSON.stringify(entry) + '\n', 'utf8');
    const after = fs.statSync(HISTORY).size;
    if (after > before) ok('able to append to history.jsonl'); else { fail('failed to grow history.jsonl after append'); failures++; }
  } catch (e) { fail(`append to history.jsonl threw: ${e.message}`); failures++; }

  // 6) Status recency and counters
  const status = readJSON(STATUS);
  if (status) {
    if (timeWithin(status.updated_at, 10)) ok('status.json updated within 10 minutes'); else { warn('status.json is older than 10 minutes'); warnings++; }
    const count = Number(status?.summary?.history_entries || 0);
    count >= 1 ? ok(`status summary shows history_entries=${count}`) : (warn('status summary shows zero history_entries'), warnings++);
  } else { fail('status.json unreadable'); failures++; }

  // 7) Session log presence
  if (isFile(SESSION_LOG)) {
    const text = readText(SESSION_LOG);
    const m = /^(###\s+(.+))$/m.exec(text);
    if (m) ok('session-log.md present'); else { warn('session-log.md present but no headings found'); warnings++; }
  } else { warn('docs/session-log.md not found'); warnings++; }

  // 8) Archive directory presence
  isDir(ARCHIVE) ? ok('archive directory exists') : warn('archive directory not present yet (ok if fresh)');

  console.log('');
  if (failures === 0) {
    console.log(`DIAGNOSE RESULT: PASS with ${warnings} warning(s)`);
    process.exit(0);
  } else {
    console.log(`DIAGNOSE RESULT: FAIL — ${failures} failure(s), ${warnings} warning(s)`);
    process.exit(1);
  }
})().catch((e)=>{ console.error('FATAL', e); process.exit(1); });