#!/usr/bin/env node
/*
Bulk-upgrade converted second-level exercise pages to current prototype standards.

Default scope:
  exercise-<group>/<file>.html

What it does per file:
  1) Detects drift from prototype head-shell standards.
  2) Creates a .BAK-<timestamp> copy before writing.
  3) Applies focused fixes only (no full template rebuild).
  4) Verifies post-write completeness.
  5) Continues to the next file.

Usage:
  node tools/bulk-upgrade-exercises.mjs
  node tools/bulk-upgrade-exercises.mjs --write
  node tools/bulk-upgrade-exercises.mjs --write --include-copy --verify-prototype
  node tools/bulk-upgrade-exercises.mjs --write --only exercise-6-prepositions/611-prepositions-in-on.html
*/

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import readline from "node:readline"

const LEAN_CRITICAL_INLINE = [
  "body {",
  "  margin: 0;",
  "}",
  "",
  "@media (max-width: 767px) {",
  "  body.mobile-nav-enabled #sidebar {",
  "    background: transparent;",
  "    height: 100vh;",
  "    left: -260px;",
  "    overflow: auto;",
  "    position: fixed;",
  "    top: 0;",
  "    width: 260px;",
  "    z-index: 1201;",
  "  }",
  "}",
].join("\n")

const CRITICAL_INLINE_BLOCK = `    <style id="critical-inline">\n${LEAN_CRITICAL_INLINE}\n    </style>`
const MOBILE_BOOTSTRAP_BLOCK = `    <script data-mobile-nav-bootstrap>\n      document.body.classList.add("mobile-nav-enabled")\n    </script>\n`

function usage() {
  console.log(`Usage:
  node tools/bulk-upgrade-exercises.mjs [options]

Options:
  --write                  Apply updates in place (default: dry-run report only)
  --include-copy           Include *copy.html / *.copy.html files
  --verify-prototype       Run "npm run verify:prototype" after write pass
  --no-pause               Disable pause prompt after each directory
  --fail-fast              Stop on first per-file failure
  --only <path>            Process one specific exercise file
  --root <path>            Repo root (default: current working directory)
  --help, -h               Show this help
`)
}

function parseArgs(argv) {
  const args = {
    write: false,
    includeCopy: false,
    verifyPrototype: false,
    pausePerDirectory: true,
    failFast: false,
    only: "",
    root: process.cwd(),
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--write") args.write = true
    else if (arg === "--include-copy") args.includeCopy = true
    else if (arg === "--verify-prototype") args.verifyPrototype = true
    else if (arg === "--no-pause") args.pausePerDirectory = false
    else if (arg === "--fail-fast") args.failFast = true
    else if (arg === "--only") args.only = argv[++i] || ""
    else if (arg === "--root") args.root = argv[++i] || args.root
    else if (arg === "--help" || arg === "-h") {
      usage()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  args.root = path.isAbsolute(args.root) ? args.root : path.resolve(process.cwd(), args.root)
  if (args.only) {
    args.only = path.isAbsolute(args.only) ? args.only : path.resolve(args.root, args.only)
  }
  return args
}

function isCopyFile(filePath) {
  const base = path.basename(filePath).toLowerCase()
  return base.endsWith(".copy.html") || base.endsWith("-copy.html")
}

function listSecondLevelExerciseFiles(root, includeCopy) {
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("exercise-"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const files = []
  dirs.forEach((dirName) => {
    const absDir = path.join(root, dirName)
    fs.readdirSync(absDir, { withFileTypes: true }).forEach((entry) => {
      if (!entry.isFile()) return
      if (!entry.name.toLowerCase().endsWith(".html")) return
      const absFile = path.join(absDir, entry.name)
      if (!includeCopy && isCopyFile(absFile)) return
      files.push(absFile)
    })
  })
  return files.sort((a, b) => a.localeCompare(b))
}

function formatStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0")
  return [
    String(date.getFullYear()),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("")
}

function collectDrift(html) {
  const drift = []

  if (/speculationrules/i.test(html) || /injectSpeculation/i.test(html)) {
    drift.push("speculation-script")
  }

  if (
    /<style\b[^>]*id=(["'])pager-style-overrides\1[^>]*>[\s\S]*?<\/style>/i.test(html) ||
    /<style\b[^>]*id=(["'])critical-inline-augment\1[^>]*>[\s\S]*?<\/style>/i.test(html)
  ) {
    drift.push("deprecated-inline-style-block")
  }

  const criticalMatch = html.match(
    /<style\b[^>]*id=(["'])critical-inline\1[^>]*>([\s\S]*?)<\/style>/i
  )
  if (!criticalMatch) {
    drift.push("missing-critical-inline")
  } else {
    const text = criticalMatch[2] || ""
    if (!text.includes("body.mobile-nav-enabled #sidebar")) {
      drift.push("critical-inline-not-lean")
    }
  }

  const bootstrapMatch = html.match(
    /<script\b[^>]*data-mobile-nav-bootstrap[^>]*>\s*document\.body\.classList\.add\(\s*["']mobile-nav-enabled["']\s*\)\s*<\/script>/i
  )
  if (!bootstrapMatch) {
    drift.push("missing-mobile-nav-bootstrap")
  }

  const spriteMatch = html.match(
    /<svg\b[^>]*aria-hidden=(["'])true\1[^>]*class=(["'])[^"']*\bicon-sprite\b[^"']*\2/i
  )
  if (!spriteMatch) {
    drift.push("missing-icon-sprite-class")
  }

  const styledSpriteMatch = html.match(/<svg\b[^>]*aria-hidden=(["'])true\1[^>]*\sstyle=(["']).*?\2/i)
  if (styledSpriteMatch) {
    drift.push("sprite-inline-style")
  }

  return drift
}

function removeSpeculationScripts(html) {
  let removedCount = 0
  let next = html.replace(
    /^[ \t]*<!--\s*Optimized speculationrules[^\n]*-->\s*\n?/gim,
    () => {
      removedCount += 1
      return ""
    }
  )
  next = next.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, (block) => {
    if (/speculationrules/i.test(block) && /injectSpeculation/i.test(block)) {
      removedCount += 1
      return ""
    }
    return block
  })
  return { html: next, removedCount }
}

function removeDeprecatedInlineStyleBlocks(html) {
  let removedCount = 0
  const next = html.replace(
    /<style\b[^>]*id=(["'])(pager-style-overrides|critical-inline-augment)\1[^>]*>[\s\S]*?<\/style>\s*/gi,
    () => {
      removedCount += 1
      return ""
    }
  )
  return { html: next, removedCount }
}

function ensureCriticalInline(html) {
  let changed = false
  let next = html
  const criticalRegex = /<style\b[^>]*id=(["'])critical-inline\1[^>]*>[\s\S]*?<\/style>/i
  if (criticalRegex.test(next)) {
    next = next.replace(criticalRegex, CRITICAL_INLINE_BLOCK)
    changed = true
  } else if (/<!--\s*Icon font not used on Codex variant; removed icomoon\.css includes\s*-->/i.test(next)) {
    next = next.replace(
      /<!--\s*Icon font not used on Codex variant; removed icomoon\.css includes\s*-->/i,
      `${CRITICAL_INLINE_BLOCK}\n    <!-- Icon font not used on Codex variant; removed icomoon.css includes -->`
    )
    changed = true
  } else if (/<\/head>/i.test(next)) {
    next = next.replace(/<\/head>/i, `${CRITICAL_INLINE_BLOCK}\n  </head>`)
    changed = true
  }
  return { html: next, changed }
}

function ensureBodyBootstrap(html) {
  let changed = false
  let next = html

  const bootstrapRegex = /<script\b[^>]*data-mobile-nav-bootstrap[^>]*>[\s\S]*?<\/script>\s*/gi
  if (bootstrapRegex.test(next)) {
    next = next.replace(bootstrapRegex, "")
    changed = true
  }

  next = next.replace(/(<body\b[^>]*>\s*)/i, (match, openTag) => {
    changed = true
    return `${openTag}${MOBILE_BOOTSTRAP_BLOCK}`
  })

  return { html: next, changed }
}

function ensureIconSpriteClass(html) {
  let changed = false
  const next = html.replace(/<svg\b([^>]*\baria-hidden=(["'])true\2[^>]*)>/i, (full, attrs) => {
    let updatedAttrs = attrs
    const withoutInlineStyle = updatedAttrs.replace(/\sstyle=(["']).*?\1/gi, "")
    if (withoutInlineStyle !== updatedAttrs) {
      changed = true
      updatedAttrs = withoutInlineStyle
    }

    const classMatch = updatedAttrs.match(/\sclass=(["'])(.*?)\1/i)
    if (!classMatch) {
      updatedAttrs += ' class="icon-sprite"'
      changed = true
    } else {
      const classes = classMatch[2]
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
      if (!classes.includes("icon-sprite")) {
        classes.push("icon-sprite")
        updatedAttrs = updatedAttrs.replace(classMatch[0], ` class="${classes.join(" ")}"`)
        changed = true
      }
    }

    return `<svg${updatedAttrs}>`
  })

  return { html: next, changed }
}

function normalizeTrailingWhitespace(text) {
  return text.replace(/[ \t]+$/gm, "")
}

function applyPrototypeUpgrade(html) {
  const ops = {
    speculationRemoved: 0,
    deprecatedStylesRemoved: 0,
    criticalInlineTouched: false,
    bootstrapTouched: false,
    iconSpriteTouched: false,
  }

  let next = html

  const speculation = removeSpeculationScripts(next)
  next = speculation.html
  ops.speculationRemoved = speculation.removedCount

  const inlineStyles = removeDeprecatedInlineStyleBlocks(next)
  next = inlineStyles.html
  ops.deprecatedStylesRemoved = inlineStyles.removedCount

  const criticalInline = ensureCriticalInline(next)
  next = criticalInline.html
  ops.criticalInlineTouched = criticalInline.changed

  const bootstrap = ensureBodyBootstrap(next)
  next = bootstrap.html
  ops.bootstrapTouched = bootstrap.changed

  const sprite = ensureIconSpriteClass(next)
  next = sprite.html
  ops.iconSpriteTouched = sprite.changed

  next = normalizeTrailingWhitespace(next)
  return { html: next, ops }
}

function makeBackup(filePath, stamp) {
  const backupPath = `${filePath}.BAK-${stamp}`
  fs.copyFileSync(filePath, backupPath)
  return backupPath
}

function runVerifyPrototype(repoRoot) {
  const result = spawnSync("npm", ["run", "verify:prototype"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  }
}

function toRel(root, absPath) {
  return path.relative(root, absPath).replace(/\\/g, "/")
}

function groupFilesByDirectory(files) {
  const bucket = new Map()
  files.forEach((filePath) => {
    const directory = path.dirname(filePath)
    if (!bucket.has(directory)) bucket.set(directory, [])
    bucket.get(directory).push(filePath)
  })

  return Array.from(bucket.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([directory, groupedFiles]) => ({
      directory,
      files: groupedFiles.sort((a, b) => a.localeCompare(b)),
    }))
}

function printDirectoryCompletionSummary(directoryRel, directoryEntries, writeMode) {
  const touched = directoryEntries.filter(
    (entry) => entry.status === "upgraded" || entry.status === "failed-write"
  )

  if (writeMode) {
    console.log(`[dir-summary] ${directoryRel} touched=${touched.length}`)
    if (!touched.length) {
      console.log("  [PASS] none")
      return
    }
    touched.forEach((entry) => {
      const shortName = entry.file.startsWith(`${directoryRel}/`)
        ? entry.file.slice(directoryRel.length + 1)
        : entry.file
      if (entry.status === "upgraded") console.log(`  [PASS] ${shortName}`)
      else console.log(`  [ERROR] ${shortName} :: ${entry.error || "unknown error"}`)
    })
    return
  }

  const planned = directoryEntries.filter((entry) => entry.status === "would-upgrade")
  const failures = directoryEntries.filter((entry) =>
    ["failed-read", "failed-write"].includes(entry.status)
  )
  console.log(
    `[dir-summary] ${directoryRel} planned=${planned.length} failed=${failures.length}`
  )
}

function promptContinueOrQuit(directoryRel) {
  if (!process.stdin.isTTY) {
    console.log(`[pause] ${directoryRel}: non-interactive session; auto-continue`)
    return Promise.resolve("continue")
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(`[pause] ${directoryRel} complete. Continue or Quit? [C/q]: `, (answer) => {
      rl.close()
      const normalized = String(answer || "")
        .trim()
        .toLowerCase()
      if (normalized === "q" || normalized === "quit") {
        resolve("quit")
        return
      }
      resolve("continue")
    })
  })
}

function generateUndoScript(root, runStamp, upgradedEntries) {
  if (!upgradedEntries.length) return ""

  const undoPath = path.join("/tmp", `bulk-upgrade-exercises-${runStamp}-undo.sh`)
  const pairs = upgradedEntries
    .map((entry) => ({
      file: entry.file,
      backup: entry.backup,
    }))
    .sort((a, b) => a.file.localeCompare(b.file))

  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    `ROOT=${JSON.stringify(root)}`,
    "declare -A BACKUP_MAP=()",
  ]

  pairs.forEach((pair) => {
    lines.push(`BACKUP_MAP[${JSON.stringify(pair.file)}]=${JSON.stringify(pair.backup)}`)
  })

  lines.push(
    "",
    "usage() {",
    '  echo "Usage: $0 single <exercise-path.html> | directory <exercise-dir> | all" >&2',
    "}",
    "",
    "restore_one() {",
    '  local rel="$1"',
    '  if [[ -z "${BACKUP_MAP[$rel]+x}" ]]; then',
    '    echo "[error] no backup mapping for $rel" >&2',
    "    return 1",
    "  fi",
    '  local src="$ROOT/${BACKUP_MAP[$rel]}"',
    '  local dst="$ROOT/$rel"',
    '  if [[ ! -f "$src" ]]; then',
    '    echo "[error] backup missing: $src" >&2',
    "    return 1",
    "  fi",
    '  cp "$src" "$dst"',
    '  echo "[restored] $rel"',
    "}",
    "",
    "restore_directory() {",
    '  local dir="${1%/}"',
    "  local hit=0",
    "  local rel",
    '  while IFS= read -r rel; do',
    '    [[ "$rel" == "$dir/"* ]] || continue',
    '    restore_one "$rel"',
    "    hit=1",
    '  done < <(printf "%s\\n" "${!BACKUP_MAP[@]}" | sort)',
    '  if [[ "$hit" -eq 0 ]]; then',
    '    echo "[error] no upgraded files recorded for directory: $dir" >&2',
    "    return 1",
    "  fi",
    "}",
    "",
    "restore_all() {",
    "  local rel",
    '  while IFS= read -r rel; do',
    '    restore_one "$rel"',
    '  done < <(printf "%s\\n" "${!BACKUP_MAP[@]}" | sort)',
    "}",
    "",
    'cmd="${1:-}"',
    'case "$cmd" in',
    "  single)",
    "    [[ $# -eq 2 ]] || { usage; exit 1; }",
    '    restore_one "$2"',
    "    ;;",
    "  directory)",
    "    [[ $# -eq 2 ]] || { usage; exit 1; }",
    '    restore_directory "$2"',
    "    ;;",
    "  all)",
    "    [[ $# -eq 1 ]] || { usage; exit 1; }",
    "    restore_all",
    "    ;;",
    "  *)",
    "    usage",
    "    exit 1",
    "    ;;",
    "esac",
    ""
  )

  fs.writeFileSync(undoPath, lines.join("\n"), "utf8")
  fs.chmodSync(undoPath, 0o755)
  return undoPath
}

async function main() {
  const args = parseArgs(process.argv)
  const root = args.root
  if (!fs.existsSync(root)) throw new Error(`Root path not found: ${root}`)

  let files = []
  if (args.only) {
    if (!fs.existsSync(args.only)) throw new Error(`--only target not found: ${args.only}`)
    files = [args.only]
  } else {
    files = listSecondLevelExerciseFiles(root, args.includeCopy)
  }

  if (!files.length) {
    console.log("No exercise files found for selection.")
    return
  }

  const directoryGroups = groupFilesByDirectory(files)
  const runStamp = formatStamp()
  const report = {
    runStamp,
    root,
    mode: args.write ? "write" : "dry-run",
    includeCopy: args.includeCopy,
    pausePerDirectory: args.pausePerDirectory,
    filesTotal: files.length,
    directoriesTotal: directoryGroups.length,
    directoriesCompleted: 0,
    aborted: false,
    checked: 0,
    upToDate: 0,
    upgraded: 0,
    failed: 0,
    skipped: 0,
    files: [],
    undoScript: "",
    verifyPrototype: null,
  }

  console.log(
    `[bulk-upgrade] mode=${report.mode} files=${files.length} scope=exercise-*/*.html includeCopy=${String(args.includeCopy)}`
  )

  let stopNow = false
  for (let groupIndex = 0; groupIndex < directoryGroups.length; groupIndex += 1) {
    const group = directoryGroups[groupIndex]
    const directoryRel = toRel(root, group.directory)
    const directoryEntries = []

    console.log(`[dir] ${directoryRel} (${group.files.length} file${group.files.length === 1 ? "" : "s"})`)

    for (const filePath of group.files) {
      report.checked += 1
      const relPath = toRel(root, filePath)

      let original = ""
      try {
        original = fs.readFileSync(filePath, "utf8")
      } catch (error) {
        report.failed += 1
        const entry = {
          file: relPath,
          directory: directoryRel,
          status: "failed-read",
          error: error.message,
        }
        report.files.push(entry)
        directoryEntries.push(entry)
        console.log(`[fail] ${relPath} (read): ${error.message}`)
        if (args.failFast) {
          stopNow = true
          break
        }
        continue
      }

      const beforeDrift = collectDrift(original)
      if (!beforeDrift.length) {
        report.upToDate += 1
        const entry = {
          file: relPath,
          directory: directoryRel,
          status: "up-to-date",
        }
        report.files.push(entry)
        directoryEntries.push(entry)
        console.log(`[ok]   ${relPath} (already aligned)`)
        continue
      }

      const upgraded = applyPrototypeUpgrade(original)
      const changed = upgraded.html !== original
      if (!changed) {
        report.skipped += 1
        const entry = {
          file: relPath,
          directory: directoryRel,
          status: "needs-manual-review",
          drift: beforeDrift,
        }
        report.files.push(entry)
        directoryEntries.push(entry)
        console.log(`[warn] ${relPath} (drift detected, no textual change generated)`)
        if (args.failFast) {
          stopNow = true
          break
        }
        continue
      }

      if (!args.write) {
        report.upgraded += 1
        const entry = {
          file: relPath,
          directory: directoryRel,
          status: "would-upgrade",
          drift: beforeDrift,
          ops: upgraded.ops,
        }
        report.files.push(entry)
        directoryEntries.push(entry)
        console.log(`[plan] ${relPath} (needs update: ${beforeDrift.join(", ")})`)
        continue
      }

      let backupPath = ""
      try {
        backupPath = makeBackup(filePath, runStamp)
        fs.writeFileSync(filePath, upgraded.html, "utf8")
        const reloaded = fs.readFileSync(filePath, "utf8")
        const afterDrift = collectDrift(reloaded)
        if (afterDrift.length) {
          fs.copyFileSync(backupPath, filePath)
          throw new Error(`post-write verification failed: ${afterDrift.join(", ")}`)
        }

        report.upgraded += 1
        const entry = {
          file: relPath,
          directory: directoryRel,
          status: "upgraded",
          drift: beforeDrift,
          ops: upgraded.ops,
          backup: toRel(root, backupPath),
        }
        report.files.push(entry)
        directoryEntries.push(entry)
        console.log(`[done] ${relPath} -> upgraded (.BAK: ${toRel(root, backupPath)})`)
      } catch (error) {
        report.failed += 1
        const entry = {
          file: relPath,
          directory: directoryRel,
          status: "failed-write",
          drift: beforeDrift,
          backup: backupPath ? toRel(root, backupPath) : "",
          error: error.message,
        }
        report.files.push(entry)
        directoryEntries.push(entry)
        console.log(`[fail] ${relPath} (write): ${error.message}`)
        if (args.failFast) {
          stopNow = true
          break
        }
      }
    }

    report.directoriesCompleted += 1
    printDirectoryCompletionSummary(directoryRel, directoryEntries, args.write)
    if (stopNow) break

    const hasNextDirectory = groupIndex < directoryGroups.length - 1
    if (hasNextDirectory && args.pausePerDirectory) {
      const decision = await promptContinueOrQuit(directoryRel)
      if (decision === "quit") {
        report.aborted = true
        break
      }
    }
  }

  if (args.write) {
    const upgradedEntries = report.files.filter(
      (entry) => entry.status === "upgraded" && entry.backup
    )
    report.undoScript = generateUndoScript(root, runStamp, upgradedEntries)
  }

  if (args.write && args.verifyPrototype) {
    const verify = runVerifyPrototype(root)
    report.verifyPrototype = {
      ok: verify.ok,
      status: verify.status,
    }
    console.log(
      `[verify] npm run verify:prototype -> ${verify.ok ? "ok" : `failed (exit ${String(verify.status)})`}`
    )
    if (!verify.ok) {
      const out = `${verify.stdout}\n${verify.stderr}`.trim()
      if (out) console.log(out)
    }
  }

  const reportPath = path.join("/tmp", `bulk-upgrade-exercises-${runStamp}.json`)
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log("---")
  console.log(
    `[summary] checked=${report.checked} upToDate=${report.upToDate} upgraded=${report.upgraded} failed=${report.failed} skipped=${report.skipped}`
  )
  console.log(
    `[summary] directories=${report.directoriesCompleted}/${report.directoriesTotal} aborted=${String(report.aborted)}`
  )
  if (report.undoScript) {
    console.log(`[summary] undo=${report.undoScript}`)
    console.log(
      `[summary] undo-usage: single <file> | directory <exercise-dir> | all`
    )
  }
  console.log(`[summary] report=${reportPath}`)

  if (report.failed > 0) {
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error(`[fatal] ${error.message}`)
  process.exit(1)
})
