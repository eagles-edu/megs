#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process"

const usage = `
Usage:
  node js/release-fingerprint.mjs [options] [file-or-glob ...]

Options:
  --version <value>       Override fingerprint version (default: git short SHA)
  --deploy <command>      Command to run after fingerprinting
  --skip-deploy           Run fingerprinting only
  --include-versioning    Also fingerprint files in versioning/
  --help                  Show this help

Deploy command resolution priority:
  1) --deploy "<command>"
  2) RELEASE_DEPLOY_CMD env var
  3) FFS_BATCH_FILE env var (+ optional FFS_BIN, default: FreeFileSync)
`.trim()

function parseArgs(argv) {
  const options = {
    version: "",
    deploy: "",
    skipDeploy: false,
    includeVersioning: false,
    patterns: [],
    help: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }
    if (arg === "--skip-deploy") {
      options.skipDeploy = true
      continue
    }
    if (arg === "--include-versioning") {
      options.includeVersioning = true
      continue
    }
    if (arg === "--version") {
      options.version = String(argv[i + 1] || "").trim()
      i += 1
      continue
    }
    if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length).trim()
      continue
    }
    if (arg === "--deploy") {
      options.deploy = String(argv[i + 1] || "").trim()
      i += 1
      continue
    }
    if (arg.startsWith("--deploy=")) {
      options.deploy = arg.slice("--deploy=".length).trim()
      continue
    }
    options.patterns.push(arg)
  }

  return options
}

function resolveVersion(explicitVersion) {
  if (explicitVersion) return explicitVersion
  return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
}

function runOrExit(result, name) {
  if (!result || typeof result.status !== "number") {
    console.error(`[release:fingerprint] ${name} failed to start.`)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status)
  }
}

function runFingerprint(version, includeVersioning, patterns) {
  const args = ["js/fingerprint-query-urls.mjs", "--write", "--version", version]
  if (includeVersioning) args.push("--include-versioning")
  if (patterns.length) args.push(...patterns)

  console.log(
    `[release:fingerprint] fingerprinting assets with version "${version}"...`
  )
  const result = spawnSync(process.execPath, args, { stdio: "inherit" })
  runOrExit(result, "fingerprint step")
}

function runDeployCommand(command) {
  console.log("[release:fingerprint] running deploy command...")
  const result = spawnSync(command, { stdio: "inherit", shell: true })
  runOrExit(result, "deploy command")
}

function runFreeFileSyncBatch() {
  const batchFile = String(process.env.FFS_BATCH_FILE || "").trim()
  const binary = String(process.env.FFS_BIN || "FreeFileSync").trim()
  if (!batchFile) return false

  console.log("[release:fingerprint] running FreeFileSync batch...")
  const result = spawnSync(binary, [batchFile], { stdio: "inherit" })
  runOrExit(result, "FreeFileSync batch")
  return true
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage)
    process.exit(0)
  }

  const version = resolveVersion(options.version)
  runFingerprint(version, options.includeVersioning, options.patterns)

  if (options.skipDeploy) {
    console.log("[release:fingerprint] done (deploy skipped).")
    return
  }

  if (options.deploy) {
    runDeployCommand(options.deploy)
    console.log("[release:fingerprint] done.")
    return
  }

  const envDeploy = String(process.env.RELEASE_DEPLOY_CMD || "").trim()
  if (envDeploy) {
    runDeployCommand(envDeploy)
    console.log("[release:fingerprint] done.")
    return
  }

  if (runFreeFileSyncBatch()) {
    console.log("[release:fingerprint] done.")
    return
  }

  console.error(
    "[release:fingerprint] no deploy command configured. Set RELEASE_DEPLOY_CMD or FFS_BATCH_FILE."
  )
  process.exit(1)
}

main()
