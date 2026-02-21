#!/usr/bin/env node
/**
 * Bulk-trim trailing whitespace for HTML/HTM/CSS files.
 *
 * Usage:
 *   node tools/trim-trailing-whitespace.mjs
 *   node tools/trim-trailing-whitespace.mjs --target lesson-1-nouns --dry-run
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "..")
const EXTENSIONS = new Set([".html", ".htm", ".css"])
const IGNORED_DIRS = new Set(
  [
    ".codacy",
    ".codex",
    ".continue",
    ".devcontainer",
    ".gemini",
    ".git",
    ".githooks",
    ".github",
    ".history-memo",
    ".playwright",
    ".sto",
    ".vscode",
    ".zencoder",
    "build",
    "coverage",
    "dist",
    "hts-cache",
    "node_modules",
    "output",
    "reports",
    "tmp",
  ].sort()
)

function fail(message) {
  console.error(`trim-trailing-whitespace: ${message}`)
  process.exit(1)
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/")
}

function printUsage() {
  console.log(`Usage:
  node tools/trim-trailing-whitespace.mjs [options]

Options:
  --target, -f <path>  File or directory (default: .)
  --write, --apply     Write updates (default: enabled)
  --dry-run            Preview only
  -h, --help           Show help
`)
}

function parseArgs(argv) {
  const args = {
    target: ".",
    write: true,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    }
    if (arg === "--target" || arg === "-f") {
      args.target = argv[++index] || ""
      continue
    }
    if (arg === "--dry-run") {
      args.write = false
      continue
    }
    if (arg === "--write" || arg === "--apply") {
      args.write = true
      continue
    }
    if (!arg.startsWith("-") && args.target === ".") {
      args.target = arg
      continue
    }
    fail(`Unknown argument: ${arg}`)
  }

  if (!args.target) fail("Missing target path.")
  return args
}

function isSupportedFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return EXTENSIONS.has(ext)
}

function collectFilesRecursively(dirPath, out) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectFilesRecursively(fullPath, out)
      continue
    }
    if (!entry.isFile()) continue
    if (!isSupportedFile(fullPath)) continue
    out.push(fullPath)
  }
}

function resolveTargets(targetInput) {
  const absolute = path.isAbsolute(targetInput)
    ? targetInput
    : path.resolve(repoRoot, targetInput)
  if (!fs.existsSync(absolute)) fail(`Target path does not exist: ${absolute}`)

  const stat = fs.statSync(absolute)
  if (stat.isFile()) {
    if (!isSupportedFile(absolute)) {
      fail(`Unsupported file extension. Expected one of: ${Array.from(EXTENSIONS).join(", ")}`)
    }
    return [absolute]
  }
  if (!stat.isDirectory()) fail(`Target is neither file nor directory: ${absolute}`)

  const files = []
  collectFilesRecursively(absolute, files)
  return files.sort((a, b) => a.localeCompare(b))
}

function trimTrailingWhitespace(source) {
  let trimmedLineCount = 0
  const output = String(source || "").replace(/[ \t]+(?=\r?$)/gm, () => {
    trimmedLineCount += 1
    return ""
  })
  return { output, trimmedLineCount }
}

function main() {
  const options = parseArgs(process.argv)
  const targets = resolveTargets(options.target)

  if (!targets.length) {
    console.log("No matching HTML/CSS files found.")
    return
  }

  let changedFiles = 0
  let writtenFiles = 0
  let trimmedLinesTotal = 0

  for (const absolutePath of targets) {
    const input = fs.readFileSync(absolutePath, "utf8")
    const { output, trimmedLineCount } = trimTrailingWhitespace(input)
    if (output === input) continue

    changedFiles += 1
    trimmedLinesTotal += trimmedLineCount
    if (options.write) {
      fs.writeFileSync(absolutePath, output)
      writtenFiles += 1
    }
    const relativePath = normalizePath(path.relative(repoRoot, absolutePath))
    const mode = options.write ? "write" : "dry-run"
    console.log(`[${mode}] ${relativePath}: trimmed-lines:${trimmedLineCount}`)
  }

  const modeText = options.write ? "applied" : "would change"
  console.log(
    `\nSummary: scanned ${targets.length} file(s), ${changedFiles} ${modeText}, ` +
      `${writtenFiles} written, ${trimmedLinesTotal} trailing-whitespace lines trimmed.`
  )
}

main()
