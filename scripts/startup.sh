#!/usr/bin/env bash
set -euo pipefail

# Paths
LOG_WORKING="docs/codex-working.txt"   # legacy (no longer written)
LOG_MD="docs/codex-log.md"             # source of truth
LOG_ARCHIVE_DIR="docs/codex-archive"   # archives for rotations
MEM_DIR=".codex"
MEM_FILE="${MEM_DIR}/memory.json"

# Ensure directories/files exist
mkdir -p "$(dirname "$LOG_MD")" "$MEM_DIR" "$LOG_ARCHIVE_DIR" tmp

# Timestamp
stamp="$(date -Is)"

# 1) Initialize/update memory persistence per AGENTS.md and migrate logs
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const memPath = path.join('.codex', 'memory.json');
const logMd = path.join('docs','codex-log.md');
const logWorking = path.join('docs','codex-working.txt');
fs.mkdirSync(path.dirname(memPath), { recursive: true });
const now = new Date().toISOString();
const stub = { version: 1, updated_at: null, items: [] };
let data;
try {
  data = JSON.parse(fs.readFileSync(memPath, 'utf8'));
  if (typeof data !== 'object' || data === null) data = stub;
} catch {
  data = stub;
}
if (!Array.isArray(data.items)) data.items = [];

// compute next id
const nextId = (() => {
  let max = 0;
  for (const it of data.items) {
    const m = /^mem-(\d+)$/.exec(String(it.id || ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return () => `mem-${String(++max).padStart(4,'0')}`;
})();

function upsertOnce(predicate, newItem) {
  const i = data.items.findIndex(predicate);
  if (i >= 0) {
    data.items[i].last_seen_at = now;
    return;
  }
  data.items.push({ ...newItem, id: nextId(), created_at: now, last_seen_at: now });
}

// Summarize the AGENTS.md startup policy
const startupSummary = [
  'Startup Checklist: 1) ensure .codex/, 2) ensure .codex/memory.json (stub if missing), 3) load memory into cache, 4) enable auto-flush after each user/tool action (debounce ~1s), 5) stamp updated_at on each flush. Size limit ~512KB; prune oldest by last_seen_at except type=decision; avoid secrets/PII; read-modify-write with retry on conflict.'
].join('\n');

upsertOnce(
  it => it.type === 'decision' && /Run scripts\/startup\.sh on workspace entry/i.test(it.content || ''),
  {
    type: 'decision',
    scope: 'workspace',
    tags: ['startup','memory','policy'],
    content: 'Run scripts/startup.sh on workspace entry; first ingest .codex/memory.json and then execute the Startup Checklist per AGENTS.md.'
  }
);

upsertOnce(
  it => it.type === 'fact' && /Startup Checklist:/i.test(it.content || ''),
  {
    type: 'fact',
    scope: 'workspace',
    tags: ['startup','instructions'],
    content: startupSummary
  }
);

upsertOnce(
  it => it.type === 'decision' && /Source of truth: docs\/codex-log\.md/i.test(it.content || ''),
  {
    type: 'decision',
    scope: 'workspace',
    tags: ['logging','source'],
    content: 'Source of truth: docs/codex-log.md (CODEx SESSION START header). Legacy docs/codex-working.txt retained but no longer written.'
  }
);

// Preference: no summaries or extra log files
upsertOnce(
  it => it.type === 'preference' && /No extra summary files/i.test(it.content || ''),
  {
    type: 'preference',
    scope: 'workspace',
    tags: ['logging','policy'],
    content: 'No extra summary files; keep a single canonical log at docs/codex-log.md (prepend legacy codex-working.txt once).'
  }
);

// Policy: Never prune memory; archive logs weekly Mon 08:00 (+07) and when >5MB
upsertOnce(
  it => it.type === 'preference' && /Never prune memory\.json/i.test(it.content || ''),
  {
    type: 'preference',
    scope: 'workspace',
    tags: ['memory','logging','retention'],
    content: 'Never prune memory.json. For logs: roll to docs/codex-archive/ when file > ~5MB or weekly at Mon 08:00 (+07).'
  }
);

// Context digest: choose the larger of last SESSION block vs last 300 lines; store truncated digest
try {
  const text = fs.existsSync(logMd) ? fs.readFileSync(logMd, 'utf8') : '';
  const lines = text.split(/\r?\n/);
  // extract last session block (NOTE old or SESSION START new)
  const headerRe = /^===== CODEx (?:NOTE|SESSION START) @ (.+?) =====$/;
  let lastStart = -1;
  let lastHeader = null;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) {
      lastStart = i;
      lastHeader = lines[i];
    }
  }
  let sessionBlock = '';
  let sessionStamp = null;
  if (lastStart >= 0) {
    // block is from lastStart to before next header; since it's the last header, take to EOF
    sessionBlock = lines.slice(lastStart).join('\n');
    const m = lines[lastStart].match(headerRe);
    if (m) sessionStamp = m[1];
  }
  const tail300 = lines.slice(-300).join('\n');
  const pick = (sessionBlock.length >= tail300.length) ? 'last_session' : 'tail_300';
  const raw = pick === 'last_session' ? sessionBlock : tail300;
  const maxLen = 1000; // keep digest small
  const digest = raw.length > maxLen ? raw.slice(0, maxLen) + '\n…[truncated]' : raw;
  upsertOnce(
    it => it.type === 'fact' && /Context digest \(source:/.test(it.content || ''),
    {
      type: 'fact',
      scope: 'workspace',
      tags: ['context','log-digest'],
      content: `Context digest (source: ${pick}, chars: ${raw.length}${sessionStamp ? `, session_ts: ${sessionStamp}` : ''}):\n${digest}`
    }
  );
} catch {}

upsertOnce(
  it => it.type === 'todo' && /Auto-flush memory\.json after each action/i.test(it.content || ''),
  {
    type: 'todo',
    scope: 'workspace',
    tags: ['memory','flush'],
    content: 'Auto-flush memory.json after each message/tool step (debounce 1s); stamp updated_at.'
  }
);

data.version = 1;
data.updated_at = now;
fs.writeFileSync(memPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`Updated ${memPath} at ${now}`);
NODE

# 2) Migration: prepend docs/codex-working.txt into docs/codex-log.md once; then rotate if needed; then append session note to md
if [[ ! -f "$LOG_MD" ]]; then
  : > "$LOG_MD"
fi
if [[ -f "$LOG_WORKING" ]]; then
  # Clean any non-CODEx header preamble from existing md before prepend
  CLEAN_MD_TMP="tmp/.codex_log_clean.md"
  awk 'BEGIN{started=0} { if(started || $0 ~ /^===== CODEx (NOTE|SESSION START) @ / || $0 ~ /^\s*$/){started=1; print $0} }' "$LOG_MD" > "$CLEAN_MD_TMP" || true
  if ! head -c $(wc -c < "$LOG_WORKING") "$CLEAN_MD_TMP" | cmp -s "$LOG_WORKING" -; then
    cat "$LOG_WORKING" "$CLEAN_MD_TMP" > "$LOG_MD" || true
  else
    mv "$CLEAN_MD_TMP" "$LOG_MD" >/dev/null 2>&1 || true
  fi
fi

# Rotate by size (> ~5MB) or weekly at Mon 08:00 (UTC+7)
rotate_needed=false
size_bytes=$( [ -f "$LOG_MD" ] && stat -c%s "$LOG_MD" 2>/dev/null || echo 0 )
if [[ "$size_bytes" -gt 5242880 ]]; then
  rotate_needed=true
fi

# compute UTC+7 time components
local_ts=$(date -u -d 'now +7 hours' +%Y-%m-%dT%H:%M:%SZ)
local_day=$(date -u -d 'now +7 hours' +%u) # 1=Mon
local_hour=$(date -u -d 'now +7 hours' +%H)
week_key=$(date -u -d 'now +7 hours' +%G-%V)
stamp_file=".codex/.rotated-week-${week_key}"
if [[ "$local_day" == "1" && $((10#$local_hour)) -ge 8 && ! -f "$stamp_file" ]]; then
  rotate_needed=true
fi

if [[ "$rotate_needed" == true && -s "$LOG_MD" ]]; then
  safe_ts=${local_ts//:/-}
  archive_path="${LOG_ARCHIVE_DIR}/codex-log-${safe_ts}+07.md"
  mv "$LOG_MD" "$archive_path" || true
  : > "$LOG_MD"
  date -u -d 'now +7 hours' > "$stamp_file" 2>/dev/null || true
fi

{
  echo ""
  echo ""
  echo "===== CODEx SESSION START @ ${stamp} ====="
  echo "Session start"
} >> "$LOG_MD"

# 2b) Format log for easy reading without wrapping sessions
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const logPath = path.join('docs','codex-log.md');
if (!fs.existsSync(logPath)) process.exit(0);
const raw = fs.readFileSync(logPath,'utf8');
const lines = raw.split(/\r?\n/);
const headerRe = /^===== CODEx (?:NOTE|SESSION START) @ (.+?) =====\s*$/;

// Remove any stray Markdown code fences inserted earlier
const noFences = lines.filter(l => !/^```/.test(l));

// Build formatted output: add a file title, optional preamble heading, HRs between sessions, keep headers as-is, no wrapping
const out = [];
let idx = 0;
let sawTitle = false;
if (noFences.length && /^#\s+CODEx Log\s*$/.test(noFences[0])) { sawTitle = true; }
if (!sawTitle) out.push('# CODEx Log');

// Detect first header
let firstHeader = -1;
for (let i=0;i<noFences.length;i++) { if (headerRe.test(noFences[i])) { firstHeader = i; break; } }

if (firstHeader > 0) {
  const pre = noFences.slice(0, firstHeader).join('\n').trimEnd();
  if (pre.trim()) {
    out.push('');
    out.push('### Legacy Preamble');
    out.push('');
    out.push(pre);
  }
}

let first = true;
for (let i = Math.max(0, firstHeader); i < noFences.length; i++) {
  const ln = noFences[i];
  if (headerRe.test(ln)) {
    if (!first) { out.push(''); out.push('---'); out.push(''); }
    first = false;
    out.push(ln);
    // ensure exactly one blank line after header
    if (noFences[i+1] && noFences[i+1].trim() !== '') out.push('');
    continue;
  }
  out.push(ln);
}

// Trim trailing whitespace lines
while (out.length && out[out.length-1].trim()==='') out.pop();
out.push('');
fs.writeFileSync(logPath, out.join('\n'), 'utf8');
NODE

# 3) Prepare temp files; silently ingest last session block and a 300-line tail (with archive backfill)
NOTE_TMP="tmp/.last_session_block.txt"
TAIL_TMP="tmp/.tail_300.txt"

# Extract the bottom-most CODEx session block from current log (newest header wins)
awk '/^===== CODEx (NOTE|SESSION START) @ /{i++} {blk[i]=blk[i] $0 ORS} END{print blk[i]}' "$LOG_MD" > "$NOTE_TMP" || true

# Build a 300-line tail using current log plus archives (most recent archives first)
> "$TAIL_TMP"
cur_lines=$( [ -f "$LOG_MD" ] && wc -l < "$LOG_MD" | tr -d ' ' || echo 0 )
archives_used=0
if [[ "$cur_lines" -ge 300 ]]; then
  tail -n 300 "$LOG_MD" > "$TAIL_TMP" || true
else
  needed=$((300 - cur_lines))
  # Gather segments from newest archives to oldest until we cover 'needed'
  mapfile -t arcs < <(ls -1 ${LOG_ARCHIVE_DIR}/codex-log-*.md 2>/dev/null | sort | tac)
  declare -a segs=()
  for arc in "${arcs[@]}"; do
    [[ -f "$arc" ]] || continue
    alines=$(wc -l < "$arc" | tr -d ' ')
    if [[ "$alines" -ge "$needed" ]]; then
      tmpseg="tmp/.seg.$(basename "$arc").tail"
      tail -n "$needed" "$arc" > "$tmpseg" || true
      segs+=("$tmpseg")
      archives_used=$((archives_used+1))
      needed=0
      break
    else
      segs+=("$arc")
      archives_used=$((archives_used+1))
      needed=$((needed - alines))
    fi
  done
  # Concatenate oldest -> newest segments, then the whole current log
  if [[ ${#segs[@]} -gt 0 ]]; then
    for (( idx=${#segs[@]}-1 ; idx>=0 ; idx-- )); do
      cat "${segs[$idx]}" >> "$TAIL_TMP" || true
    done
  fi
  [[ -f "$LOG_MD" ]] && cat "$LOG_MD" >> "$TAIL_TMP" || true
  # ensure max 300 lines
  tail -n 300 "$TAIL_TMP" > "$TAIL_TMP.tmp" && mv "$TAIL_TMP.tmp" "$TAIL_TMP"
fi

# Decide which has more data (by character count): last session block vs 300-line tail
note_chars=$(wc -c < "$NOTE_TMP" | tr -d ' ')
tail_chars=$(wc -c < "$TAIL_TMP" | tr -d ' ')
pick="tail_300"
[[ "$note_chars" -gt "$tail_chars" ]] && pick="last_session"

# Save a compact digest (~1000 chars) for memory
max_chars=1000
src_file="$TAIL_TMP"
[[ "$pick" == "last_session" ]] && src_file="$NOTE_TMP"
digest_chars=$(wc -c < "$src_file" | tr -d ' ')
if [[ "$digest_chars" -gt "$max_chars" ]]; then
  head -c "$max_chars" "$src_file" > tmp/.context_digest.txt && printf "\n…[truncated]" >> tmp/.context_digest.txt
else
  cp "$src_file" tmp/.context_digest.txt
fi

# Update memory with the context digest (and metadata)
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const memPath = path.join('.codex', 'memory.json');
const now = new Date().toISOString();
function load() { try { return JSON.parse(fs.readFileSync(memPath,'utf8')); } catch (_) { return {version:1,updated_at:null,items:[]} } }
const data = load();
if (!Array.isArray(data.items)) data.items = [];
const nextId = (()=>{let m=0;for(const it of data.items){const x=/^mem-(\d+)$/.exec(String(it.id||''));if(x)m=Math.max(m,parseInt(x[1],10));}return()=>`mem-${String(++m).padStart(4,'0')}`;})();
function upsertOnce(pred, item){const i=data.items.findIndex(pred); if(i>=0){data.items[i].last_seen_at=now; data.items[i].content=item.content; return;} data.items.push({...item,id:nextId(),created_at:now,last_seen_at:now});}
const pick = process.env.PICK||'tail_300';
const archivesUsed = process.env.ARCHIVES_USED||'0';
const docLines = process.env.DOC_LINES||'0';
const noteChars = process.env.NOTE_CHARS||'0';
const tailChars = process.env.TAIL_CHARS||'0';
const digest = fs.readFileSync(path.join('tmp','.context_digest.txt'),'utf8');
upsertOnce(it=> it.type==='fact' && /Context digest \(source:/.test(it.content||''), {
  type:'fact', scope:'workspace', tags:['context','log-digest'],
  content:`Context digest (source: ${pick}, archives_used: ${archivesUsed}, log_lines: ${docLines}, last_session_chars: ${noteChars}, tail_300_chars: ${tailChars}):\n${digest}`
});
upsertOnce(it=> it.type==='preference' && /Startup ingest: silent, 300-line backfill/i.test(it.content||''), {
  type:'preference', scope:'workspace', tags:['startup','ingest','logging'],
  content:'Startup ingest: silent; pick larger of latest SESSION block vs 300-line tail; if current log <300 lines, backfill from newest archives until 300; print one-line status only.'
});
data.updated_at = now; data.version = 1;
fs.writeFileSync(memPath, JSON.stringify(data,null,2), 'utf8');
NODE

# Final: print a concise status line only (no log content)
note_lines=$(wc -l < "$NOTE_TMP" | tr -d ' ')
tail_lines=$(wc -l < "$TAIL_TMP" | tr -d ' ')
doc_lines=$( [ -f "$LOG_MD" ] && wc -l < "$LOG_MD" | tr -d ' ' || echo 0 )
PICK="$pick" ARCHIVES_USED="$archives_used" DOC_LINES="$doc_lines" NOTE_CHARS="$note_chars" TAIL_CHARS="$tail_chars" node -e "console.log('--- startup initialized --- source=' + process.env.PICK + ' archives_used=' + process.env.ARCHIVES_USED + ' ingested_lines=' + (process.env.PICK==='last_session' ? ${note_lines} : ${tail_lines}) + ' log_lines=' + process.env.DOC_LINES)"
