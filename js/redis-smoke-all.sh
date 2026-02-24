#!/usr/bin/env bash
set -euo pipefail

echo "[redis-smoke] node check"
node js/redis-smoke-node.mjs

echo "[redis-smoke] python check"
python3 js/redis-smoke-python.py

echo "[redis-smoke] all checks passed"
