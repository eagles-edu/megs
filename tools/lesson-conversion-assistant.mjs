#!/usr/bin/env node
/**
 * Lesson conversion assistant.
 *
 * Purpose:
 * - Coordinate lesson-page conversion using a modern prototype template.
 * - Wraps js/convert-legacy-lesson.mjs (diff preview on by default).
 *
 * Usage examples:
 * - node tools/lesson-conversion-assistant.mjs --target lesson-6-prepositions/2-prepositions-of-place.html
 * - node tools/lesson-conversion-assistant.mjs --target lesson-6-prepositions/2-prepositions-of-place.html --no-diff-preview
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
  prototype: "lesson-6-prepositions/1-prepositions-of-time.html",
  diffPreview: false,
  ukToUs: true,
  verifyShell: true,
}

const PAUSE_COMMAND =
  "PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS."

function fail(message) {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage:
  node tools/lesson-conversion-assistant.mjs --target <legacy-path> [options]

Options:
  --target, -f            Legacy lesson HTML path (required if not positional)
  --prototype, -p         Prototype template (default: ${DEFAULTS.prototype})
  --uk-to-us              Normalize UK spellings/usage to US (optional)
  --verify-shell          Verify nav/responsive/perf shell markers after write (default)
  --no-verify-shell       Skip shell verification
  --diff-preview          Show diff without writing (default)
  --no-diff-preview       Write changes to the legacy file
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
  }
  const provided = {
    target: false,
    prototype: false,
    diffPreview: false,
    ukToUs: false,
    verifyShell: false,
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
    } else if (arg === "--diff-preview") {
      args.diffPreview = true
      provided.diffPreview = true
    } else if (arg === "--no-diff-preview") {
      args.diffPreview = false
      provided.diffPreview = true
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
    input = (await ask("Enter legacy lesson <target-path>: ")).trim()
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

function buildCmd(targetDisplay, protoDisplay, diffPreview, ukToUs) {
  const cmd = ["node", "js/convert-legacy-lesson.mjs", targetDisplay, "--prototype", protoDisplay]
  if (diffPreview) cmd.push("--diff-preview")
  else cmd.push("--no-diff-preview")
  if (ukToUs) cmd.push("--uk-to-us")
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

function verifyLessonShell(targetAbsolute) {
  const html = fs.readFileSync(targetAbsolute, "utf8")
  const checks = [
    { name: "base css", pattern: /href=["'][^"']*web-asset\/css\/base\.css(?:[?#][^"']*)?["']/i },
    { name: "left-menu css", pattern: /href=["'][^"']*web-asset\/css\/left-menu\.css(?:[?#][^"']*)?["']/i },
    { name: "right-rail css", pattern: /href=["'][^"']*web-asset\/css\/right-rail-flyout\.css(?:[?#][^"']*)?["']/i },
    { name: "main bundle js", pattern: /src=["'][^"']*web-asset\/js\/main\.bundle\.js(?:[?#][^"']*)?["']/i },
    { name: "legacy bundle js", pattern: /src=["'][^"']*web-asset\/js\/main\.legacy\.js(?:[?#][^"']*)?["']/i },
    { name: "right-rail js", pattern: /src=["'][^"']*web-asset\/js\/right-rail-flyout\.js(?:[?#][^"']*)?["']/i },
  ]
  const missing = checks.filter((check) => !check.pattern.test(html)).map((check) => check.name)
  if (missing.length) {
    fail(
      "Shell verification failed: missing expected markers in " +
        `${path.relative(repoRoot, targetAbsolute)} -> ${missing.join(", ")}`
    )
  }

  const hasPager = /<ul[^>]*class=["'][^"']*\bpager\b[^"']*\bpagenav\b[^"']*["']/i.test(html)
  const hasPagerLabel = /<span[^>]*class=["'][^"']*\bpager-label\b[^"']*["'][^>]*>/i.test(html)
  if (hasPager && !hasPagerLabel) {
    fail(
      "Shell verification failed: pager exists but no .pager-label found in " +
        path.relative(repoRoot, targetAbsolute)
    )
  }

  console.log(
    `[lesson-conversion-assistant] Shell verification passed (${path.relative(repoRoot, targetAbsolute)}).`
  )
}

function formatSetting(label, value, source) {
  const suffix = source ? ` (${source})` : ""
  return `- ${label}: ${value}${suffix}`
}

function resolveSettingSource(provided, key) {
  return provided[key] ? "cli" : "default"
}

function printSettings(args, provided, targetDisplay, protoDisplay) {
  console.log("\nLesson conversion settings:")
  console.log(formatSetting("target", targetDisplay, resolveSettingSource(provided, "target")))
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
}

async function main() {
  const { args, provided } = parseArgs(process.argv)
  const prompter = createPrompter()
  const ask = prompter ? prompter.ask : null

  if (!args.target && !ask) {
    fail("No target provided and no TTY available. Use --target <path>.")
  }

  if (!provided.target) {
    args.target = ask ? await promptTarget(ask) : args.target
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

  const { absolute: targetAbsolute, display: targetDisplay } = resolveTarget(args.target)
  const { display: protoDisplay } = resolvePrototype(args.prototype)

  printSettings(args, provided, targetDisplay, protoDisplay)

  const cmd = buildCmd(targetDisplay, protoDisplay, args.diffPreview, args.ukToUs)
  console.log("\n1. Execute lesson conversion:")
  console.log(commandToString(cmd))
  if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
    prompter?.close()
    process.exit(0)
  }
  runCommand(cmd, "Lesson conversion")

  if (!args.diffPreview && args.verifyShell) {
    verifyLessonShell(targetAbsolute)
  } else if (args.diffPreview && args.verifyShell) {
    console.log("[lesson-conversion-assistant] verify-shell skipped in diff-preview mode.")
  }

  prompter?.close()
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
