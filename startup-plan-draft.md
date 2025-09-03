 1. **Ensure Paths**: create .codex/, .codex/memory.json (stub if missing), docs/, and docs/codex-archive/. | **Category**: immutable startup instructions; | **Edits**: check backup copy of memory.json in @docs/codex-archive/memory-[date stamp].json.bak;
1. **Load Memory**: Read, parse, ingest, then execute the immutable 'startup' block in .codex/memory.json into cache; set malformed - error and items=error, wait for usr input : a. pass-set version=1 and if malformed.**Category**: immutable startup instructions; | **Edits**:
2. Canonical Log: use CODEX.LOG.MD as the unabridged tee sink; do not write extra logs. Note: earlier “source of truth: docs/codex-log.md” is superseded; keep docs/codex-log.md and docs/
codex-archive/ for history/startup digest only.
- Startup Ingest: compute a context digest by selecting the larger of:
    - The latest date-stamped SESSION block (from CODEX.LOG.MD or docs/codex-log.md and its
archives), or
    - The last 300 lines of the most recent log.
Then print a short digest to console (no extra files) and update a fact item in memory.
- Auto‑Flush: flush .codex/memory.json after each user message and significant tool action,
and on graceful exit; coalesce multiple writes with ~1000ms debounce.
- Stamp Timestamps: on each flush set updated_at and bump last_seen_at for touched items.
- Size Cap: keep .codex/memory.json under ~512KB; prune oldest by last_seen_at while
preserving all type=decision.
- Concurrency Safety: read‑modify‑write with retry if the file changed since last read.
- Heartbeat: after significant actions append HEARTBEAT <ISO-UTC> to CODEX.LOG.MD and flush
memory.
- Notify Ready: emit SESSION START <ISO-UTC> and a concise “READY ” line to CODEX.LOG.MD;
upsert a fact (mem-last-session) tracking last_session_started_at and last_session_updated_at.
- Privacy: never store secrets, tokens, or raw PII; summarize sensitive content and prefer
references.
- Archive Rotation: when CODEX.LOG.MD grows large or on weekly cadence, rotate to docs/
codex-archive/ and continue logging in place (archives remain scanable for startup ingest).
- Quick Status: expose a lightweight check that prints presence of .codex/memory.json, its
updated_at, and a small recent-items summary.

Amendments Applied

- Canonical log: docs/codex-log.md → superseded by CODEX.LOG.MD (archives kept).
- Debounce: realtime (0ms) → ~1000ms.
- Memory cap: 5MB → ~512KB.
- Terminal side logs: extra sinks (e.g., .codex/terminal.log) → do not create; keep single
canonical sink.