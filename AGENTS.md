# Codex Agent Guide: Persistent Memory on Startup

This workspace expects Codex CLI to enable and execute memory persistence immediately on every startup. Follow these instructions to ensure conversational context and decisions carry over between runs in this repo.

## Intent
- Persist key facts, decisions, todos, and project context across sessions.
- Load persisted memory at startup and flush updates continuously during the session.

## Startup Checklist (execute immediately)
1. Ensure the memory store directory exists: `.codex/` (create if missing).
2. Ensure the memory file exists: `.codex/memory.json` (create if missing with the stub below).
3. Load `.codex/memory.json` into the in‑memory cache.
4. Enable auto‑flush: after each user message and significant tool action, write updates back to `.codex/memory.json`.
5. Stamp `updated_at` on each flush.

## Memory Store
- Path: `.codex/memory.json`
- Encoding: UTF‑8 JSON
- Schema (minimal, extensible):

```json
{
  "version": 1,
  "updated_at": "2025-01-01T00:00:00Z",
  "items": [
    {
      "id": "mem-0001",
      "type": "fact",
      "scope": "workspace",
      "tags": ["setup", "conventions"],
      "content": "Example: Use .codex/memory.json for persistence.",
      "created_at": "2025-01-01T00:00:00Z",
      "last_seen_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

Notes:
- `scope` can be `workspace`, `repo`, or `file:<path>` for file‑scoped memories.
- `type` can be `fact`, `decision`, `todo`, or `preference`.
- `last_seen_at` helps prune stale items.

## Persistence Policy
- Flush Strategy: write after each message/tool step and on graceful exit.
- Debounce: if multiple writes occur within 1s, coalesce to a single write.
- Size Limits: keep file under ~512KB; when exceeded, prune oldest `last_seen_at` memories except `type=decision`.
- Concurrency: read‑modify‑write with retry if file changed since last read.

## Safety & Privacy
- Do not store secrets, API keys, tokens, or raw PII.
- Summarize sensitive content where needed; prefer references over raw data.
- Respect `.gitignore`: `.codex/` should remain untracked unless explicitly opted‑in.

## Status & Maintenance
- Quick status: check existence and timestamp
  - File present: `.codex/memory.json`
  - Last updated: value of `updated_at`.
- Reset memory (manual): delete or rename `.codex/memory.json`; agent will recreate with the stub on next startup.
- Manual edit: keep valid JSON; maintain `version` and timestamps in ISO‑8601 UTC.

## Minimal Stub (create if missing)
```json
{
  "version": 1,
  "updated_at": null,
  "items": []
}
```

## Agent Behavior Summary
- On entering this workspace, immediately initialize persistence and begin writing memory to `.codex/memory.json` without waiting for a user prompt.
- Keep updates small and structured; summarize long content.
- Prefer workspace‑scoped memories unless a narrower file scope is clearly better.

