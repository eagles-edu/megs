#!/usr/bin/env node
/*
  VS Code Watchdog (background)
  - Runs idle while workspace is open
  - On termination (SIGTERM/SIGINT/SIGHUP), stops the heartbeat daemon to avoid orphaned processes
*/
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const PID_FILE = path.join(ROOT, 'persistence', 'heartbeat.pid');

function stopHeartbeat() {
  try {
    const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'session-heartbeat.js'), '--stop'], {
      stdio: 'inherit'
    });
    if (res.error) console.error('[watchdog] stop error:', res.error.message);
  } catch (e) {
    console.error('[watchdog] stop exception:', e.message);
  }
}

function cleanup(reason) {
  if (fs.existsSync(PID_FILE)) stopHeartbeat();
  process.exit(0);
}

process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGHUP', () => cleanup('SIGHUP'));

// Keep alive
setInterval(() => {}, 1 << 30);