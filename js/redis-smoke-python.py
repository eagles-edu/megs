#!/usr/bin/env python3

import os
import subprocess
import sys
import time


def base_args():
    redis_url = os.getenv("REDIS_URL", "").strip()
    if redis_url:
        return ["-u", redis_url]

    host = os.getenv("REDIS_HOST", "127.0.0.1").strip()
    port = os.getenv("REDIS_PORT", "6379").strip()
    db = os.getenv("REDIS_DB", "0").strip()
    password = os.getenv("REDIS_PASSWORD", os.getenv("REDISCLI_AUTH", "")).strip()

    args = ["-h", host, "-p", port, "-n", db]
    if password:
        args.extend(["-a", password])
    return args


def run_redis(extra_args):
    cmd = ["redis-cli", *base_args(), *extra_args]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)

    if proc.returncode != 0:
        details = (proc.stderr or proc.stdout).strip()
        raise RuntimeError(f"redis-cli exited with code {proc.returncode}: {details}")

    return (proc.stdout or "").strip()


def main():
    key = f"smoke:python:{int(time.time() * 1000)}"
    value = "ok-python"

    run_redis(["SET", key, value, "EX", "30"])
    got = run_redis(["--raw", "GET", key])

    if got != value:
        raise RuntimeError(f'unexpected value for {key}: "{got}"')

    run_redis(["DEL", key])
    print("python redis smoke: ok")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"python redis smoke: failed - {exc}", file=sys.stderr)
        sys.exit(1)
