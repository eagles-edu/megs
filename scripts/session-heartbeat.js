#!/usr/bin/env node
/*
  Session Heartbeat Daemon
  - Purpose: crash-harden memory by appending periodic heartbeat entries to persistence/history.jsonl
  - Interval: randomized 60–180s (avg ~120s) to avoid synchronized spikes
  - Writes minimal stats (history count/size, session-log size, remember.updated_at)
  - PID management via persistence/heartbeat.pid for safe single-instance
  Usage:
    node scripts/session-heartbeat.js --start   # daemonize and exit
    node scripts/session-heartbeat.js --stop    # stop running daemon
*/
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const PERSIST_DIR = path.join(ROOT, 'persistence');
const HISTORY = path.join(PERSIST_DIR, 'history.jsonl');
const REMEMBER = path.join(PERSIST_DIR, 'remember.json');
const SESSION_LOG = path.join(ROOT, 'docs', 'session-log.md');
const PID_FILE = path.join(PERSIST_DIR, 'heartbeat.pid');
const STATE_FILE = path.join(PERSIST_DIR, '.heartbeat-state.json');

function toISO(d = Date.now()) { return new Date(d).toISOString(); }
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function size(file) { try { return fs.statSync(file).size; } catch { return 0; } }
function fileExists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function writeHistory(entry) {
  ensureDir(path.dirname(HISTORY));
  fs.appendFileSync(HISTORY, JSON.stringify(entry) + '\n', 'utf8');
}

function getStats() {
  const histRaw = read(HISTORY);
  const historyEntries = histRaw ? histRaw.split(/\r?\n/).filter(Boolean).length : 0;
  const rememberRaw = read(REMEMBER);
  let rememberUpdatedAt = null;
  try { rememberUpdatedAt = JSON.parse(rememberRaw)?.updated_at || null; } catch {}
  return {
    history_entries: historyEntries,
    history_bytes: size(HISTORY),
    session_log_bytes: size(SESSION_LOG),
    remember_updated_at: rememberUpdatedAt
  };
}

function loadState() {
  try { return JSON.parse(read(STATE_FILE)) || {}; } catch { return {}; }
}
function saveState(st) { ensureDir(path.dirname(STATE_FILE)); fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2), 'utf8'); }

function isRunning(pid) {
  try { return process.kill(pid, 0), true; } catch { return false; }
}

async function stop() {
  if (!fileExists(PID_FILE)) { console.log('[heartbeat] no pid file'); return; }
  const pid = Number(read(PID_FILE).trim());
  if (!pid || !isRunning(pid)) {
    try { fs.unlinkSync(PID_FILE); } catch {}
    console.log('[heartbeat] not running');
    return;
  }
  process.kill(pid, 'SIGTERM');
  console.log('[heartbeat] sent SIGTERM to', pid);
}

async function daemon() {
  // Daemon loop
  let seq = 0;
  let running = true;
  process.on('SIGTERM', () => { running = false; });
  process.on('SIGINT', () => { running = false; });

  while (running) {
    const wait = randInt(60, 180); // seconds
    await new Promise(r => setTimeout(r, wait * 1000));
    if (!running) break;

    const prev = loadState();
    const stats = getStats();
    const changed = (
      prev.history_bytes !== stats.history_bytes ||
      prev.session_log_bytes !== stats.session_log_bytes ||
      prev.remember_updated_at !== stats.remember_updated_at
    );

    const entry = {
      ts: toISO(),
      type: 'heartbeat',
      seq: ++seq,
      interval_sec: wait,
      changed_since_last: Boolean(changed),
      stats
    };
    writeHistory(entry);
    saveState(stats);

    // On meaningful change, refresh status.json (non-invasive, no history write)
    if (changed) {
      try {
        const { spawnSync } = await import('node:child_process');
        const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'status-refresh.js')], { stdio: 'ignore' });
        // ignore errors; heartbeat must not crash
      } catch {}
    }
  }
  // graceful close marker
  writeHistory({ ts: toISO(), type: 'heartbeat_stop', reason: 'signal', note: 'daemon exiting' });
}

async function start() {
  ensureDir(PERSIST_DIR);
  if (fileExists(PID_FILE)) {
    const pid = Number(read(PID_FILE).trim());
    if (pid && isRunning(pid)) {
      console.log('[heartbeat] already running with pid', pid);
      return;
    } else {
      try { fs.unlinkSync(PID_FILE); } catch {}
    }
  }

  const SELF = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [SELF, '--run'], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');
  console.log('[heartbeat] started pid', child.pid);
}

(async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--stop')) return stop();
  if (args.has('--run')) return daemon();
  return start();
})();