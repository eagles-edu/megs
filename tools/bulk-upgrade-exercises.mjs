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

const DEFAULT_PROTOTYPE = "exercise-1-nouns/111-common-nouns.html"
const REQUIRED_SHARED_CSS = [
  "web-asset/css/base.css",
  "web-asset/css/exercises.css",
  "web-asset/css/right-rail-flyout.css",
  "web-asset/css/left-menu.css",
]
const QA_ACCORDION_CSS_TOKEN = "web-asset/css/qa-accordion.css"
const IGNORED_RELATIVE_PATHS = new Set(["exercise-1-nouns/gender-neu.html"])

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
  --prototype <path>       Prototype source file (default: ${DEFAULT_PROTOTYPE})
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
    prototype: DEFAULT_PROTOTYPE,
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
    else if (arg === "--prototype") args.prototype = argv[++i] || ""
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
  args.prototype = path.isAbsolute(args.prototype)
    ? args.prototype
    : path.resolve(args.root, args.prototype)
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

function isVersioningPath(root, filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/")
  return rel === "versioning" || rel.startsWith("versioning/")
}

function isIgnoredExercisePath(root, filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/")
  return IGNORED_RELATIVE_PATHS.has(rel)
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function extractTaggedBlockById(html, tagName, id) {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*id=(["'])${escapeRegExp(id)}\\1[^>]*>[\\s\\S]*?<\\/${tagName}>`,
    "i"
  )
  const match = html.match(pattern)
  return match ? match[0] : ""
}

function extractTaggedBlockByAttribute(html, tagName, attributeName) {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*\\b${escapeRegExp(attributeName)}(?:=(["'])[^"']*\\1)?[^>]*>[\\s\\S]*?<\\/${tagName}>`,
    "i"
  )
  const match = html.match(pattern)
  return match ? match[0] : ""
}

function normalizeBlockForCompare(block) {
  return String(block || "")
    .replace(/\s+/g, " ")
    .trim()
}

function blocksEquivalent(a, b) {
  return normalizeBlockForCompare(a) === normalizeBlockForCompare(b)
}

function ensureTaggedBlockById(html, tagName, id, block, anchors = []) {
  if (!block) {
    return { html, changed: false }
  }

  let changed = false
  let next = html
  const blockPattern = new RegExp(
    `<${tagName}\\b[^>]*id=(["'])${escapeRegExp(id)}\\1[^>]*>[\\s\\S]*?<\\/${tagName}>`,
    "i"
  )

  if (blockPattern.test(next)) {
    next = next.replace(blockPattern, (currentBlock) => {
      if (blocksEquivalent(currentBlock, block)) {
        return currentBlock
      }
      changed = true
      return block
    })
    return { html: next, changed }
  }

  for (const anchorPattern of anchors) {
    const anchorMatch = next.match(anchorPattern)
    if (!anchorMatch || anchorMatch.index == null) continue
    const anchorLineStart = next.lastIndexOf("\n", anchorMatch.index - 1) + 1
    next = `${next.slice(0, anchorLineStart)}${block}\n\n${next.slice(anchorLineStart)}`
    changed = true
    return { html: next, changed }
  }

  if (/<\/head>/i.test(next)) {
    next = next.replace(/<\/head>/i, `${block}\n  </head>`)
    changed = true
  }

  return { html: next, changed }
}

function loadPrototypeStandard(root, prototypePath) {
  if (!fs.existsSync(prototypePath)) {
    throw new Error(`Prototype source not found: ${prototypePath}`)
  }
  const html = fs.readFileSync(prototypePath, "utf8")
  const criticalInlineBlock = extractTaggedBlockById(html, "style", "critical-inline") || CRITICAL_INLINE_BLOCK
  const pagerStyleOverridesBlock = extractTaggedBlockById(html, "style", "pager-style-overrides")
  const criticalInlineAugmentBlock = extractTaggedBlockById(html, "style", "critical-inline-augment")
  const qaAccordionInlineBlock = extractTaggedBlockById(html, "style", "qa-accordion-inline")
  const mobileBootstrapBlock =
    extractTaggedBlockByAttribute(html, "script", "data-mobile-nav-bootstrap") ||
    MOBILE_BOOTSTRAP_BLOCK.trim()

  return {
    pathAbs: prototypePath,
    pathRel: path.relative(root, prototypePath).replace(/\\/g, "/"),
    pagerStyleOverridesBlock,
    criticalInlineBlock,
    criticalInlineAugmentBlock,
    qaAccordionInlineBlock,
    mobileBootstrapBlock,
  }
}

function hasHrefForCss(html, cssPathToken) {
  const pattern = new RegExp(
    `href=(["'])[^"']*${escapeRegExp(cssPathToken)}(?:\\?[^"']*)?\\1`,
    "i"
  )
  return pattern.test(html)
}

function detectOffloadCoverage(html) {
  const missingSharedCss = REQUIRED_SHARED_CSS.filter((token) => !hasHrefForCss(html, token))
  const hasQaCoverage =
    /<style\b[^>]*id=(["'])qa-accordion-inline\1[^>]*>/i.test(html) ||
    hasHrefForCss(html, QA_ACCORDION_CSS_TOKEN)

  return {
    missingSharedCss,
    hasQaCoverage,
    safeToRemoveDeprecatedInline: missingSharedCss.length === 0 && hasQaCoverage,
  }
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

function collectDrift(html, prototypeStandard) {
  const drift = []

  if (/speculationrules/i.test(html) || /injectSpeculation/i.test(html)) {
    drift.push("speculation-script")
  }

  const expectedPager = prototypeStandard?.pagerStyleOverridesBlock || ""
  const currentPager = extractTaggedBlockById(html, "style", "pager-style-overrides")
  if (expectedPager) {
    if (!currentPager) drift.push("missing-pager-style-overrides")
    else if (!blocksEquivalent(currentPager, expectedPager)) drift.push("pager-style-overrides-mismatch")
  } else if (currentPager) {
    drift.push("deprecated-inline-style-block")
  }

  const expectedCritical = prototypeStandard?.criticalInlineBlock || CRITICAL_INLINE_BLOCK
  const currentCritical = extractTaggedBlockById(html, "style", "critical-inline")
  if (!currentCritical) {
    drift.push("missing-critical-inline")
  } else if (!blocksEquivalent(currentCritical, expectedCritical)) {
    drift.push("critical-inline-mismatch")
  }

  const expectedAugment = prototypeStandard?.criticalInlineAugmentBlock || ""
  const currentAugment = extractTaggedBlockById(html, "style", "critical-inline-augment")
  if (expectedAugment) {
    if (!currentAugment) drift.push("missing-critical-inline-augment")
    else if (!blocksEquivalent(currentAugment, expectedAugment)) drift.push("critical-inline-augment-mismatch")
  } else if (currentAugment) {
    drift.push("deprecated-inline-style-block")
  }

  const expectedQaAccordion = prototypeStandard?.qaAccordionInlineBlock || ""
  const currentQaAccordion = extractTaggedBlockById(html, "style", "qa-accordion-inline")
  if (expectedQaAccordion) {
    if (!currentQaAccordion) drift.push("missing-qa-accordion-inline")
    else if (!blocksEquivalent(currentQaAccordion, expectedQaAccordion)) {
      drift.push("qa-accordion-inline-mismatch")
    }
    if (hasHrefForCss(html, QA_ACCORDION_CSS_TOKEN)) {
      drift.push("qa-accordion-external-link-present")
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

function removeDeprecatedInlineStyleBlocks(html, prototypeStandard) {
  let removedCount = 0
  let next = html

  if (!prototypeStandard?.pagerStyleOverridesBlock) {
    next = next.replace(
      /<style\b[^>]*id=(["'])pager-style-overrides\1[^>]*>[\s\S]*?<\/style>\s*/gi,
      () => {
        removedCount += 1
        return ""
      }
    )
  }

  if (!prototypeStandard?.criticalInlineAugmentBlock) {
    next = next.replace(
      /<style\b[^>]*id=(["'])critical-inline-augment\1[^>]*>[\s\S]*?<\/style>\s*/gi,
      () => {
        removedCount += 1
        return ""
      }
    )
  }

  return { html: next, removedCount }
}

function ensurePagerStyleOverrides(html, prototypeStandard) {
  const block = prototypeStandard?.pagerStyleOverridesBlock || ""
  if (!block) return { html, changed: false }
  return ensureTaggedBlockById(html, "style", "pager-style-overrides", block, [
    /<!--\s*Critical resource hints for better performance\s*-->/i,
    /<!--\s*Icon font not used on Codex variant; removed icomoon\.css includes\s*-->/i,
  ])
}

function ensureCriticalInline(html, prototypeStandard) {
  const block = prototypeStandard?.criticalInlineBlock || CRITICAL_INLINE_BLOCK
  return ensureTaggedBlockById(html, "style", "critical-inline", block, [
    /<!--\s*Icon font not used on Codex variant; removed icomoon\.css includes\s*-->/i,
    /<!--\s*Critical resource hints for better performance\s*-->/i,
  ])
}

function ensureCriticalInlineAugment(html, prototypeStandard) {
  const block = prototypeStandard?.criticalInlineAugmentBlock || ""
  if (!block) return { html, changed: false }
  return ensureTaggedBlockById(html, "style", "critical-inline-augment", block, [
    /<!--\s*Icon font not used on Codex variant; removed icomoon\.css includes\s*-->/i,
    /<!--\s*Layout styles for exercises \+ mobile nav \(blocking for CLS stability\)\s*-->/i,
  ])
}

function ensureQaAccordionInline(html, prototypeStandard) {
  const block = prototypeStandard?.qaAccordionInlineBlock || ""
  if (!block) return { html, changed: false }
  return ensureTaggedBlockById(html, "style", "qa-accordion-inline", block, [
    /<!--\s*No-JS fallback: show all answers if scripting is disabled\s*-->/i,
    /<script\b[^>]*data-mobile-nav-bootstrap[^>]*>/i,
  ])
}

function removeQaAccordionStylesheetLink(html, prototypeStandard) {
  const block = prototypeStandard?.qaAccordionInlineBlock || ""
  if (!block) return { html, removedCount: 0 }

  let removedCount = 0
  const next = html.replace(
    /[ \t]*<link\b[^>]*href=(["'])[^"']*web-asset\/css\/qa-accordion\.css(?:\?[^"']*)?\1[^>]*>\s*\n?/gi,
    () => {
      removedCount += 1
      return ""
    }
  )
  return { html: next, removedCount }
}

function ensureBodyBootstrap(html, prototypeStandard) {
  let changed = false
  let next = html
  const blockSource = String(prototypeStandard?.mobileBootstrapBlock || MOBILE_BOOTSTRAP_BLOCK).trim()

  const bootstrapRegex = /<script\b[^>]*data-mobile-nav-bootstrap[^>]*>[\s\S]*?<\/script>\s*/gi
  if (bootstrapRegex.test(next)) {
    next = next.replace(bootstrapRegex, "")
    changed = true
  }

  next = next.replace(/(<body\b[^>]*>)(\s*)/i, (match, openTag, spacingAfterBody) => {
    changed = true
    const spacing = spacingAfterBody || "\n"
    const indentMatch = spacing.match(/\n([ \t]*)$/)
    const indent = indentMatch ? indentMatch[1] : "    "
    const indentedBlock = blockSource
      .split("\n")
      .map((line) => `${indent}${line.trimStart()}`)
      .join("\n")
    return `${openTag}${spacing}${indentedBlock}\n${indent}`
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

function applyPrototypeUpgrade(html, prototypeStandard) {
  const ops = {
    speculationRemoved: 0,
    deprecatedStylesRemoved: 0,
    qaAccordionExternalLinksRemoved: 0,
    pagerStyleTouched: false,
    criticalInlineTouched: false,
    criticalInlineAugmentTouched: false,
    qaAccordionTouched: false,
    bootstrapTouched: false,
    iconSpriteTouched: false,
  }

  let next = html

  const speculation = removeSpeculationScripts(next)
  next = speculation.html
  ops.speculationRemoved = speculation.removedCount

  const inlineStyles = removeDeprecatedInlineStyleBlocks(next, prototypeStandard)
  next = inlineStyles.html
  ops.deprecatedStylesRemoved = inlineStyles.removedCount

  const pagerStyles = ensurePagerStyleOverrides(next, prototypeStandard)
  next = pagerStyles.html
  ops.pagerStyleTouched = pagerStyles.changed

  const criticalInline = ensureCriticalInline(next, prototypeStandard)
  next = criticalInline.html
  ops.criticalInlineTouched = criticalInline.changed

  const criticalInlineAugment = ensureCriticalInlineAugment(next, prototypeStandard)
  next = criticalInlineAugment.html
  ops.criticalInlineAugmentTouched = criticalInlineAugment.changed

  const qaAccordion = ensureQaAccordionInline(next, prototypeStandard)
  next = qaAccordion.html
  ops.qaAccordionTouched = qaAccordion.changed

  const qaAccordionLink = removeQaAccordionStylesheetLink(next, prototypeStandard)
  next = qaAccordionLink.html
  ops.qaAccordionExternalLinksRemoved = qaAccordionLink.removedCount

  const bootstrap = ensureBodyBootstrap(next, prototypeStandard)
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
  const prototypeStandard = loadPrototypeStandard(root, args.prototype)

  let files = []
  if (args.only) {
    if (!fs.existsSync(args.only)) throw new Error(`--only target not found: ${args.only}`)
    if (isVersioningPath(root, args.only)) {
      throw new Error(`--only target is under versioning/: ${toRel(root, args.only)}`)
    }
    if (isIgnoredExercisePath(root, args.only)) {
      throw new Error(`--only target is ignored by policy: ${toRel(root, args.only)}`)
    }
    files = [args.only]
  } else {
    files = listSecondLevelExerciseFiles(root, args.includeCopy)
  }

  files = files.filter(
    (filePath) => !isVersioningPath(root, filePath) && !isIgnoredExercisePath(root, filePath)
  )

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
    prototype: prototypeStandard.pathRel,
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
    `[bulk-upgrade] mode=${report.mode} files=${files.length} scope=exercise-*/*.html includeCopy=${String(args.includeCopy)} prototype=${prototypeStandard.pathRel}`
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

      const beforeDrift = collectDrift(original, prototypeStandard)
      const offloadCoverage = detectOffloadCoverage(original)
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

      if (beforeDrift.includes("deprecated-inline-style-block") && !offloadCoverage.safeToRemoveDeprecatedInline) {
        report.skipped += 1
        const entry = {
          file: relPath,
          directory: directoryRel,
          status: "needs-manual-review",
          drift: beforeDrift,
          guard: "unsafe-inline-offload-coverage",
          missingSharedCss: offloadCoverage.missingSharedCss,
          hasQaCoverage: offloadCoverage.hasQaCoverage,
        }
        report.files.push(entry)
        directoryEntries.push(entry)
        const missingCssLabel = offloadCoverage.missingSharedCss.length
          ? offloadCoverage.missingSharedCss.join(", ")
          : "(none)"
        console.log(
          `[warn] ${relPath} (manual review: inline offload coverage incomplete; missingCss=${missingCssLabel}; qaCoverage=${String(offloadCoverage.hasQaCoverage)})`
        )
        if (args.failFast) {
          stopNow = true
          break
        }
        continue
      }

      const upgraded = applyPrototypeUpgrade(original, prototypeStandard)
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
          offloadCoverage,
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
        const afterDrift = collectDrift(reloaded, prototypeStandard)
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
          offloadCoverage,
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
