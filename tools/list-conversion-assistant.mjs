#!/usr/bin/env node
/**
 * List conversion assistant.
 *
 * Purpose:
 * - Coordinate list-page conversion using a modern prototype template.
 * - Wraps js/convert-legacy-list.mjs (write mode by default).
 *
 * Usage examples:
 * - node tools/list-conversion-assistant.mjs --target list-3-collective-nouns/650-collective-nouns-people.html
 * - node tools/list-conversion-assistant.mjs --target list-3-collective-nouns/650-collective-nouns-people.html --no-diff-preview
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import readline from "node:readline"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "..")

const DEFAULTS = {
  prototype: "list-3-collective-nouns/collective-nouns-things.html",
  diffPreview: false,
  ukToUs: true,
  verifyShell: true,
  verifyParity: true,
  bulk: false,
  root: ".",
  includeCopy: false,
  pausePerDirectory: true,
}

const PAUSE_COMMAND =
  "PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS."

function fail(message) {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage:
  node tools/list-conversion-assistant.mjs --target <legacy-path> [options]

Options:
  --target, -f            Legacy list HTML path (required if not positional)
  --prototype, -p         Prototype template (default: ${DEFAULTS.prototype})
  --uk-to-us              Normalize UK spellings/usage to US (optional)
  --verify-shell          Run standalone shell verification (default)
  --no-verify-shell       Skip standalone shell verification
  --verify-parity         Run page parity verification after write (default)
  --no-verify-parity      Skip page parity verification after write
  --diff-preview          Show diff without writing
  --no-diff-preview       Write changes to the legacy file (default)
  --bulk                  Run js/convert-legacy-list.mjs in bulk 2nd-level scan mode
  --root <path>           Root directory for list-* scanning (default: ${DEFAULTS.root})
  --include-copy          Include *.copy.html / *-copy.html files when scanning
  --no-pause              Skip the per-directory pause after each directory summary
  --help, -h              Show help
`)
}

function parseArgs(argv) {
  const args = {
    target: "",
    prototype: DEFAULTS.prototype,
    diffPreview: DEFAULTS.diffPreview,
    ukToUs: DEFAULTS.ukToUs,
    verifyShell: DEFAULTS.verifyShell,
    verifyParity: DEFAULTS.verifyParity,
    bulk: DEFAULTS.bulk,
    root: DEFAULTS.root,
    includeCopy: DEFAULTS.includeCopy,
    pausePerDirectory: DEFAULTS.pausePerDirectory,
  }
  const provided = {
    target: false,
    prototype: false,
    diffPreview: false,
    ukToUs: false,
    verifyShell: false,
    verifyParity: false,
    bulk: false,
    root: false,
    includeCopy: false,
    pausePerDirectory: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else if (arg === "--target" || arg === "-f") {
      args.target = argv[++i] || ""
      provided.target = true
    } else if (arg === "--prototype" || arg === "-p") {
      args.prototype = argv[++i] || ""
      provided.prototype = true
    } else if (arg === "--uk-to-us") {
      args.ukToUs = true
      provided.ukToUs = true
    } else if (arg === "--verify-shell") {
      args.verifyShell = true
      provided.verifyShell = true
    } else if (arg === "--no-verify-shell") {
      args.verifyShell = false
      provided.verifyShell = true
    } else if (arg === "--verify-parity") {
      args.verifyParity = true
      provided.verifyParity = true
    } else if (arg === "--no-verify-parity") {
      args.verifyParity = false
      provided.verifyParity = true
    } else if (arg === "--diff-preview") {
      args.diffPreview = true
      provided.diffPreview = true
    } else if (arg === "--no-diff-preview") {
      args.diffPreview = false
      provided.diffPreview = true
    } else if (arg === "--bulk") {
      args.bulk = true
      provided.bulk = true
    } else if (arg === "--root") {
      args.root = argv[++i] || args.root
      provided.root = true
    } else if (arg === "--include-copy") {
      args.includeCopy = true
      provided.includeCopy = true
    } else if (arg === "--no-pause") {
      args.pausePerDirectory = false
      provided.pausePerDirectory = true
    } else if (!provided.target && !arg.startsWith("-")) {
      args.target = arg
      provided.target = true
    } else {
      fail(`Unknown argument: ${arg}`)
    }
  }

  return { args, provided }
}

function createPrompter() {
  if (!process.stdin.isTTY) return null
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (question) =>
    new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer))
    })
  return { ask, close: () => rl.close() }
}

async function promptTarget(ask) {
  let input = ""
  while (!input) {
    input = (await ask("Enter legacy list <target-path>: ")).trim()
    if (!input) console.log("Target path is required.")
  }
  return input
}

async function promptPrototype(ask, defaultValue) {
  const input = (await ask(`Prototype path [default ${defaultValue}]: `)).trim()
  return input || defaultValue
}

async function promptDiffPreview(ask, defaultValue) {
  const defaultLabel = defaultValue ? "dry" : "write"
  for (;;) {
    const input = (await ask(`write or dry [default ${defaultLabel}]: `))
      .trim()
      .toLowerCase()
    if (!input) return defaultValue
    if (["dry", "d", "preview", "diff"].includes(input)) return true
    if (["write", "w", "run"].includes(input)) return false
    if (["true", "t", "yes", "y", "1"].includes(input)) return true
    if (["false", "f", "no", "n", "0"].includes(input)) return false
    console.log("Enter write or dry.")
  }
}

async function promptUkToUs(ask, defaultValue) {
  const defaultLabel = defaultValue ? "y" : "n"
  for (;;) {
    const input = (await ask(`Normalize UK->US usage/spelling? [${defaultLabel}]: `))
      .trim()
      .toLowerCase()
    if (!input) return defaultValue
    if (["y", "yes"].includes(input)) return true
    if (["n", "no"].includes(input)) return false
    console.log("Enter y or n.")
  }
}

async function promptVerifyShell(ask, defaultValue) {
  const defaultLabel = defaultValue ? "y" : "n"
  for (;;) {
    const input = (await ask(`Verify nav/responsive/perf shell after write? [${defaultLabel}]: `))
      .trim()
      .toLowerCase()
    if (!input) return defaultValue
    if (["y", "yes"].includes(input)) return true
    if (["n", "no"].includes(input)) return false
    console.log("Enter y or n.")
  }
}

async function promptVerifyParity(ask, defaultValue) {
  const defaultLabel = defaultValue ? "y" : "n"
  for (;;) {
    const input = (await ask(`Run page parity check after write? [${defaultLabel}]: `))
      .trim()
      .toLowerCase()
    if (!input) return defaultValue
    if (["y", "yes"].includes(input)) return true
    if (["n", "no"].includes(input)) return false
    console.log("Enter y or n.")
  }
}

async function promptBulkMode(ask, defaultValue) {
  const defaultLabel = defaultValue ? "y" : "n"
  for (;;) {
    const input = (await ask(`Run bulk list conversion scan? [${defaultLabel}]: `))
      .trim()
      .toLowerCase()
    if (!input) return defaultValue
    if (["y", "yes"].includes(input)) return true
    if (["n", "no"].includes(input)) return false
    console.log("Enter y or n.")
  }
}

async function promptRootPath(ask, defaultValue) {
  const input = (await ask(`List root directory [default ${defaultValue}]: `)).trim()
  return input || defaultValue
}

async function promptIncludeCopy(ask, defaultValue) {
  const defaultLabel = defaultValue ? "y" : "n"
  for (;;) {
    const input = (await ask(`Include copy list files when scanning? [${defaultLabel}]: `))
      .trim()
      .toLowerCase()
    if (!input) return defaultValue
    if (["y", "yes"].includes(input)) return true
    if (["n", "no"].includes(input)) return false
    console.log("Enter y or n.")
  }
}

async function promptPausePerDirectory(ask, defaultValue) {
  const defaultLabel = defaultValue ? "y" : "n"
  for (;;) {
    const input = (await ask(`Pause after each directory summary? [${defaultLabel}]: `))
      .trim()
      .toLowerCase()
    if (!input) return defaultValue
    if (["y", "yes"].includes(input)) return true
    if (["n", "no"].includes(input)) return false
    console.log("Enter y or n.")
  }
}

function resolveTarget(targetInput) {
  if (!targetInput) fail("No target provided. Use --target <path> or enter a path.")
  const absolute = path.isAbsolute(targetInput)
    ? targetInput
    : path.resolve(repoRoot, targetInput)
  if (!fs.existsSync(absolute)) {
    fail(`Target file not found: ${absolute}`)
  }
  return { absolute, display: targetInput }
}

function resolvePrototype(protoInput) {
  if (!protoInput) fail("No prototype provided.")
  const absolute = path.isAbsolute(protoInput)
    ? protoInput
    : path.resolve(repoRoot, protoInput)
  if (!fs.existsSync(absolute)) {
    fail(`Prototype file not found: ${absolute}`)
  }
  return { absolute, display: protoInput }
}

function buildCmd(targetDisplay, protoDisplay, args) {
  const cmd = ["node", "js/convert-legacy-list.mjs"]
  if (args.bulk) {
    cmd.push("--bulk")
  } else if (targetDisplay) {
    cmd.push(targetDisplay)
  }
  cmd.push("--prototype", protoDisplay)
  if (args.diffPreview) cmd.push("--diff-preview")
  else cmd.push("--no-diff-preview")
  if (args.ukToUs) cmd.push("--uk-to-us")
  if (args.verifyShell) cmd.push("--verify-shell")
  else cmd.push("--no-verify-shell")
  if (args.bulk) {
    if (args.root) {
      cmd.push("--root", args.root)
    }
    if (args.includeCopy) {
      cmd.push("--include-copy")
    }
    if (!args.pausePerDirectory) {
      cmd.push("--no-pause")
    }
  }
  return cmd
}

function buildParityCmd(targetDisplay, args) {
  const cmd = ["node", "tools/check-page-parity.mjs"]
  if (args.bulk) {
    cmd.push("--all-lists")
  } else if (targetDisplay) {
    cmd.push(targetDisplay)
  }
  return cmd
}

function commandToString(cmd) {
  return cmd.join(" ")
}

async function pauseOrQuit(ask, label) {
  console.log(label)
  if (!ask) return true
  const input = (await ask("Press Enter to continue (Q to quit): ")).trim().toLowerCase()
  return input !== "q"
}

function runCommand(cmd, label) {
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", cwd: repoRoot })
  if (result.error) {
    fail(`${label} failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status}.`)
  }
}

function formatSetting(label, value, source) {
  const suffix = source ? ` (${source})` : ""
  return `- ${label}: ${value}${suffix}`
}

function resolveSettingSource(provided, key) {
  return provided[key] ? "cli" : "default"
}

function printSettings(args, provided, targetDisplay, protoDisplay) {
  console.log("\nList conversion settings:")
  console.log(formatSetting("bulk-mode", args.bulk, resolveSettingSource(provided, "bulk")))
  if (args.bulk) {
    console.log(formatSetting("root", args.root, resolveSettingSource(provided, "root")))
    console.log(
      formatSetting(
        "include-copy",
        args.includeCopy,
        resolveSettingSource(provided, "includeCopy")
      )
    )
    console.log(
      formatSetting(
        "pause-per-directory",
        args.pausePerDirectory,
        resolveSettingSource(provided, "pausePerDirectory")
      )
    )
  }
  if (!args.bulk) {
    console.log(formatSetting("target", targetDisplay, resolveSettingSource(provided, "target")))
  }
  console.log(
    formatSetting("prototype", protoDisplay, resolveSettingSource(provided, "prototype"))
  )
  console.log(
    formatSetting("diff-preview", args.diffPreview, resolveSettingSource(provided, "diffPreview"))
  )
  console.log(formatSetting("uk-to-us", args.ukToUs, resolveSettingSource(provided, "ukToUs")))
  console.log(
    formatSetting("verify-shell", args.verifyShell, resolveSettingSource(provided, "verifyShell"))
  )
  console.log(
    formatSetting(
      "verify-parity",
      args.verifyParity,
      resolveSettingSource(provided, "verifyParity")
    )
  )
}

async function main() {
  const { args, provided } = parseArgs(process.argv)
  const prompter = createPrompter()
  const ask = prompter ? prompter.ask : null

  if (!provided.bulk) {
    args.bulk = ask ? await promptBulkMode(ask, DEFAULTS.bulk) : DEFAULTS.bulk
  }
  if (args.bulk) {
    if (!provided.root) {
      args.root = ask ? await promptRootPath(ask, DEFAULTS.root) : DEFAULTS.root
    }
    if (!provided.includeCopy) {
      args.includeCopy = ask
        ? await promptIncludeCopy(ask, DEFAULTS.includeCopy)
        : DEFAULTS.includeCopy
    }
    if (!provided.pausePerDirectory) {
      args.pausePerDirectory = ask
        ? await promptPausePerDirectory(ask, DEFAULTS.pausePerDirectory)
        : DEFAULTS.pausePerDirectory
    }
  }

  if (!args.bulk) {
    if (!args.target && !ask) {
      fail("No target provided and no TTY available. Use --target <path>.")
    }
    if (!provided.target) {
      args.target = ask ? await promptTarget(ask) : args.target
    }
  }

  if (!provided.prototype) {
    args.prototype = ask ? await promptPrototype(ask, DEFAULTS.prototype) : DEFAULTS.prototype
  }
  if (!provided.diffPreview) {
    args.diffPreview = ask ? await promptDiffPreview(ask, DEFAULTS.diffPreview) : DEFAULTS.diffPreview
  }
  if (!provided.ukToUs) {
    args.ukToUs = ask ? await promptUkToUs(ask, DEFAULTS.ukToUs) : DEFAULTS.ukToUs
  }
  if (!provided.verifyShell) {
    args.verifyShell = ask
      ? await promptVerifyShell(ask, DEFAULTS.verifyShell)
      : DEFAULTS.verifyShell
  }
  if (!provided.verifyParity) {
    args.verifyParity = ask
      ? await promptVerifyParity(ask, DEFAULTS.verifyParity)
      : DEFAULTS.verifyParity
  }

  const targetInfo = args.bulk ? null : resolveTarget(args.target)
  const targetDisplay = targetInfo ? targetInfo.display : ""
  const { display: protoDisplay } = resolvePrototype(args.prototype)

  printSettings(args, provided, targetDisplay, protoDisplay)

  const cmd = buildCmd(targetDisplay, protoDisplay, args)
  console.log("\n1. Execute list conversion:")
  console.log(commandToString(cmd))
  if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
    prompter?.close()
    process.exit(0)
  }
  runCommand(cmd, "List conversion")

  if (!args.verifyParity) {
    console.log("[parity] SKIP --no-verify-parity")
    prompter?.close()
    return
  }
  if (args.diffPreview) {
    console.log("[parity] SKIP diff preview mode")
    prompter?.close()
    return
  }

  const parityCmd = buildParityCmd(targetDisplay, args)
  console.log("\n2. Verify page parity:")
  console.log(commandToString(parityCmd))
  if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
    prompter?.close()
    process.exit(0)
  }
  runCommand(parityCmd, "Page parity check")

  prompter?.close()
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
