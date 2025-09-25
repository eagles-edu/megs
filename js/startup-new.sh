#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(pwd)"
PERSIST_DIR="persistence"
REMEMBER_JSON="${PERSIST_DIR}/remember.json"
STATUS_JSON="${PERSIST_DIR}/status.json"
LEGACY_DIR=".codex"
ARCHIVE_DIR="docs/codex-archive"
STAMP="$(date -Is)"

# 1) Ensure directories
mkdir -p "$PERSIST_DIR" "$ARCHIVE_DIR" "docs" "tmp"

# 2) Legacy notice (one-time migration handled manually)
if [[ -d "$LEGACY_DIR" ]]; then
  echo "[startup-new] Legacy ${LEGACY_DIR} detected and ignored. Run: npm run migrate:legacy (one-time)."
fi

# 3) Validate remember.json exists
if [[ ! -f "$REMEMBER_JSON" ]]; then
  echo "[startup-new] ERROR: ${REMEMBER_JSON} is missing. Create it and rerun."
  exit 1
fi

# 3.5) Ensure persistence/history.jsonl exists and, if absent, seed with last session close
if [[ ! -f "persistence/history.jsonl" ]]; then
  node - <<'NODE'
  const fs = require('fs');
  const path = require('path');
  const hist = path.join('persistence','history.jsonl');
  const sessionLog = path.join('docs','session-log.md');
  let lastTs = new Date().toISOString();
  if (fs.existsSync(sessionLog)) {
    const raw = fs.readFileSync(sessionLog,'utf8');
    const lines = raw.split(/\r?\n/);
    for (let i=lines.length-1;i>=0;i--) {
      const m = /^###\s+(.+?)\s*$/.exec(lines[i]);
      if (m) { lastTs = new Date(m[1]).toISOString(); break; }
    }
  }
  const seed = { ts: lastTs, type: 'session_close', note: 'Seeded from session-log.md (migration to new persistence).'};
  fs.mkdirSync(path.dirname(hist), { recursive: true });
  fs.writeFileSync(hist, JSON.stringify(seed)+'\n', 'utf8');
  console.log('[startup-new] Seeded persistence/history.jsonl with last session_close:', lastTs);
NODE
fi

# 4) Ingest remember.json via persistence manager
node scripts/persistence-manager.js

# 5) Start a new session entry in session-log.md (lightweight)
{
  echo "### ${STAMP}"
  echo "- Startup: new persistence initialized (remember.json -> status.json)."
  echo
} >> docs/session-log.md

# 6) Start heartbeat (safe single-instance)
npm run -s heartbeat:start || true

# 7) Print quick status pointer
if [[ -f "$STATUS_JSON" ]]; then
  echo "[startup-new] OK: See ${STATUS_JSON} for current status snapshot."
fi

# 7) Retention: roll persistence/history.jsonl to archive on a 15-day FIFO basis
#    - Keep entries for the most recent 15 days in history.jsonl
#    - Move older entries into a dated archive file
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const persist = path.join('persistence');
const historyPath = path.join(persist, 'history.jsonl');
const archiveDir = path.join(persist, 'archive');
if (!fs.existsSync(historyPath)) process.exit(0);
const raw = fs.readFileSync(historyPath,'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const items = [];
for (const l of lines) { try { items.push(JSON.parse(l)); } catch {} }
const now = Date.now();
const cutoff = now - 15*24*60*60*1000;
const keep = []; const old = [];
for (const it of items) {
  const t = new Date(it.ts || it.timestamp || 0).getTime();
  if (!t || t < cutoff) old.push(it); else keep.push(it);
}
if (old.length) {
  fs.mkdirSync(archiveDir, { recursive: true });
  const iso = new Date().toISOString().replace(/[:]/g,'-');
  const out = path.join(archiveDir, `history-archive-before-${iso}.jsonl`);
  fs.writeFileSync(out, old.map(o=>JSON.stringify(o)).join('\n')+'\n','utf8');
}
fs.writeFileSync(historyPath, keep.map(o=>JSON.stringify(o)).join('\n')+(keep.length?'\n':''),'utf8');
console.log(`[startup-new] history pruned: kept=${keep.length}, archived=${old.length}`);
NODE