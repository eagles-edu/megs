#!/usr/bin/env bash
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <command> [args]" >&2
  exit 2
fi

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
NVM_EXEC="${NVM_DIR}/nvm-exec"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NVMRC_PATH="${NVMRC_PATH:-$SCRIPT_DIR/.nvmrc}"

if [[ ! -f "$NVMRC_PATH" ]]; then
  search_dir="$PWD"
  while [[ -n "$search_dir" && "$search_dir" != "/" ]]; do
    if [[ -f "$search_dir/.nvmrc" ]]; then
      NVMRC_PATH="$search_dir/.nvmrc"
      break
    fi
    search_dir="$(dirname "$search_dir")"
  done
fi

if [[ -z "${NODE_VERSION:-}" && -f "$NVMRC_PATH" ]]; then
  NODE_VERSION="$(tr -d ' \t\r\n' < "$NVMRC_PATH")"
  export NODE_VERSION
fi

if command -v node >/dev/null 2>&1; then
  node_ver="$(node -v || true)"
  case "$node_ver" in
    v20.*) exec "$@" ;;
  esac
fi

if [[ -x "$NVM_EXEC" ]]; then
  exec "$NVM_EXEC" "$@"
fi

echo "ERROR: Node 20.x required. Install nvm or set NVM_DIR; .nvmrc expects 20.19.4." >&2
exit 1
