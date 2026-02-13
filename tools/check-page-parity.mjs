#!/usr/bin/env node
/* eslint-env node */

import fs from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"
import { globSync } from "glob"

const CHANGED_FILTER = "--diff-filter=ACMR"
const LESSON_GLOB = "lesson-*/*.html"
const LESSON_FILE_RE = /^lesson-[^/]+\/[^/]+\.html$/
const ROOT = process.cwd()
const DEFAULT_MAX_FAILURES = 30
const EXPECTED_GENERATOR = "English Grammar - IELTS intermediate levels A2 and above"
const EMPTY_TREE_SHA = "0000000000000000000000000000000000000000"

const parseArgs = (argv) => {
  const options = {
    allLessons: false,
    changedRef: null,
    maxFailures: Number(process.env.PARITY_MAX_FAILURES || DEFAULT_MAX_FAILURES),
    staged: false,
    verbose: false,
  }
  const explicitFiles = []

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx]
    if (arg === "--all-lessons") {
      options.allLessons = true
      continue
    }
    if (arg === "--staged") {
      options.staged = true
      continue
    }
    if (arg === "--verbose") {
      options.verbose = true
      continue
    }
    if (arg === "--changed") {
      const ref = argv[idx + 1]
      if (!ref) {
        throw new Error("--changed requires a git ref")
      }
      options.changedRef = ref
      idx += 1
      continue
    }
    if (arg === "--max-failures") {
      const raw = argv[idx + 1]
      const parsed = Number(raw)
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("--max-failures expects a non-negative number")
      }
      options.maxFailures = parsed
      idx += 1
      continue
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true
      continue
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`)
    }
    explicitFiles.push(arg)
  }

  if (options.staged && options.changedRef) {
    throw new Error("Use only one of --staged or --changed")
  }
  return { explicitFiles, options }
}

const runGit = (args) => {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" })
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || result.stdout?.trim() || "git command failed"
    throw new Error(stderr)
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const normalizePath = (filePath) => filePath.replace(/\\/g, "/")

const collectTargets = ({ explicitFiles, options }) => {
  if (explicitFiles.length > 0) {
    return explicitFiles
  }
  if (options.staged) {
    return runGit(["diff", "--cached", "--name-only", CHANGED_FILTER])
  }
  if (options.changedRef) {
    if (options.changedRef === EMPTY_TREE_SHA) {
      return []
    }
    return runGit(["diff", "--name-only", CHANGED_FILTER, `${options.changedRef}...HEAD`])
  }
  if (options.allLessons) {
    return globSync(LESSON_GLOB, { cwd: ROOT, nodir: true, posix: true })
  }
  return globSync(LESSON_GLOB, { cwd: ROOT, nodir: true, posix: true })
}

const uniqueSorted = (values) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))

const regexIndex = (source, pattern) => {
  const match = source.match(pattern)
  return match ? match.index ?? -1 : -1
}

const checkMetaOrder = (source, issues) => {
  const metaChecks = [
    { key: "charset", pattern: /<meta\s+charset=/i },
    { key: "viewport", pattern: /<meta\s+name=["']viewport["']/i },
    { key: "theme-color", pattern: /<meta\s+name=["']theme-color["']/i },
    { key: "keywords", pattern: /<meta\s+name=["']keywords["']/i },
    { key: "description", pattern: /<meta\s+name=["']description["']/i },
    { key: "generator", pattern: /<meta\s+name=["']generator["']/i },
  ]

  const positions = metaChecks.map(({ key, pattern }) => ({ key, index: regexIndex(source, pattern) }))
  positions.forEach(({ key, index }) => {
    if (index < 0) {
      issues.push(`missing-${key}-meta`)
    }
  })

  let outOfOrder = false
  for (let idx = 0; idx < positions.length - 1; idx += 1) {
    if (positions[idx].index < 0 || positions[idx + 1].index < 0) {
      outOfOrder = false
      break
    }
    if (positions[idx].index > positions[idx + 1].index) {
      outOfOrder = true
      break
    }
  }
  if (outOfOrder) {
    issues.push("meta-order")
  }
}

const lessonRuleChecks = (source, issues) => {
  checkMetaOrder(source, issues)

  const requiredChecks = [
    {
      issue: "generator-content",
      pattern: new RegExp(
        `<meta\\s+name=["']generator["'][^>]*content=["']${EXPECTED_GENERATOR}["']`,
        "i"
      ),
    },
    { issue: "missing-theme-vars-critical", pattern: /<style[^>]+id=["']theme-vars-critical["']/i },
    {
      issue: "missing-base-css",
      pattern: /<link[^>]+href=["'][^"']*web-asset\/css\/base\.css["'][^>]*>/i,
    },
    {
      issue: "missing-right-rail-css",
      pattern: /<link[^>]+href=["'][^"']*web-asset\/css\/right-rail-flyout\.css["'][^>]*>/i,
    },
    {
      issue: "missing-left-menu-css",
      pattern: /<link[^>]+href=["'][^"']*web-asset\/css\/left-menu\.css["'][^>]*>/i,
    },
    {
      issue: "missing-page-classes-css",
      pattern: /<link[^>]+href=["'][^"']*web-asset\/css\/page-classes\.css["'][^>]*>/i,
    },
    {
      issue: "missing-main-bundle-modulepreload",
      pattern: /<link[^>]+rel=["']modulepreload["'][^>]+href=["'][^"']*web-asset\/js\/main\.bundle\.js["'][^>]*>/i,
    },
    {
      issue: "missing-main-bundle-module-script",
      pattern:
        /<script(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=["'][^"']*web-asset\/js\/main\.bundle\.js["'])[^>]*><\/script>/i,
    },
    {
      issue: "missing-main-legacy-nomodule-script",
      pattern:
        /<script(?=[^>]*\bnomodule\b)(?=[^>]*\bsrc=["'][^"']*web-asset\/js\/main\.legacy\.js["'])(?=[^>]*\bdefer\b)[^>]*><\/script>/i,
    },
    {
      issue: "missing-right-rail-script",
      pattern:
        /<script(?=[^>]*\bsrc=["'][^"']*web-asset\/js\/right-rail-flyout\.js["'])(?=[^>]*\bdefer\b)[^>]*><\/script>/i,
    },
    {
      issue: "missing-mobile-bootstrap-script",
      pattern: /<script[^>]*\bdata-mobile-nav-bootstrap(?:\s*=\s*["'][^"']*["'])?[^>]*>/i,
    },
    {
      issue: "missing-icon-sprite-svg-xmlns",
      pattern: /<svg(?=[^>]*\bclass=["'][^"']*\bicon-sprite\b[^"']*["'])(?=[^>]*\bxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["'])[^>]*>/i,
    },
    {
      issue: "missing-body-base-lesson-classes",
      pattern: /<body[^>]*\bclass=["'][^"']*\bbase\b[^"']*\blesson\b[^"']*["'][^>]*>/i,
    },
  ]

  requiredChecks.forEach(({ issue, pattern }) => {
    if (!pattern.test(source)) {
      issues.push(issue)
    }
  })

  const forbiddenChecks = [
    { issue: "forbidden-exercise-attribute", pattern: /\bdata-exercise-[a-z0-9-]*\b/i },
    { issue: "forbidden-exercise-answer-key", pattern: /exercise-answer-key/i },
    { issue: "forbidden-exercise-config", pattern: /exercise-config/i },
    { issue: "forbidden-exercise-gate", pattern: /web-asset\/js\/exercise-gate\.js/i },
    { issue: "forbidden-exercise-devtools", pattern: /web-asset\/js\/exercise-devtools\.js/i },
    { issue: "forbidden-print-css-swap", pattern: /\bmedia=["']print["']/i },
    { issue: "forbidden-speculationrules", pattern: /speculationrules/i },
    { issue: "forbidden-template592f", pattern: /template592f/i },
    { issue: "forbidden-jquery592f", pattern: /jquery\.min592f/i },
    { issue: "forbidden-bootstrap592f", pattern: /bootstrap\.min592f/i },
  ]

  forbiddenChecks.forEach(({ issue, pattern }) => {
    if (pattern.test(source)) {
      issues.push(issue)
    }
  })

  const bootstrapIdx = regexIndex(
    source,
    /<script[^>]*\bdata-mobile-nav-bootstrap(?:\s*=\s*["'][^"']*["'])?[^>]*>/i
  )
  const spriteIdx = regexIndex(source, /<svg[^>]*\bclass=["'][^"']*\bicon-sprite\b[^"']*["'][^>]*>/i)
  const gridIdx = regexIndex(source, /<div[^>]*\bclass=["'][^"']*\bbody\s+grid-modern\b[^"']*["'][^>]*>/i)
  if (bootstrapIdx >= 0 && spriteIdx >= 0 && gridIdx >= 0) {
    if (!(bootstrapIdx < spriteIdx && spriteIdx < gridIdx)) {
      issues.push("dom-order-bootstrap-sprite-grid")
    }
  } else {
    if (spriteIdx < 0) issues.push("missing-icon-sprite")
    if (gridIdx < 0) issues.push("missing-body-grid-modern")
  }
}

const checkFile = (filePath) => {
  const source = fs.readFileSync(path.join(ROOT, filePath), "utf8")
  const issues = []
  lessonRuleChecks(source, issues)
  return issues
}

const printHelp = () => {
  console.log(`Usage: node tools/check-page-parity.mjs [options] [lesson-file ...]

Options:
  --all-lessons           Check lesson-*/*.html files.
  --staged                Check staged lesson files from git index.
  --changed <git-ref>     Check lesson files changed in <git-ref>...HEAD.
  --max-failures <n>      Max file-level failures to print (default: ${DEFAULT_MAX_FAILURES}).
  --verbose               Print every failing lesson file.
  -h, --help              Show this help.
`)
}

const main = () => {
  try {
    const { explicitFiles, options } = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }

    const candidates = collectTargets({ explicitFiles, options })
    const targets = uniqueSorted(
      candidates
        .map(normalizePath)
        .filter((file) => LESSON_FILE_RE.test(file))
        .filter((file) => fs.existsSync(path.join(ROOT, file)))
    )

    if (targets.length === 0) {
      console.log("Page parity check: no lesson files to validate.")
      return
    }

    const failures = []
    const issueCounts = new Map()

    targets.forEach((filePath) => {
      const issues = checkFile(filePath)
      if (issues.length === 0) return
      failures.push({ filePath, issues })
      issues.forEach((issue) => {
        issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1)
      })
    })

    if (failures.length === 0) {
      console.log(`Page parity check passed (${targets.length} lesson file(s)).`)
      return
    }

    console.error(
      `Page parity check failed (${failures.length}/${targets.length} lesson file(s) with issues).`
    )
    const visibleFailures = options.verbose
      ? failures
      : failures.slice(0, Math.max(0, options.maxFailures))
    visibleFailures.forEach(({ filePath, issues }) => {
      console.error(`- ${filePath} :: ${issues.join(", ")}`)
    })
    if (!options.verbose && visibleFailures.length < failures.length) {
      console.error(
        `... ${failures.length - visibleFailures.length} more failing file(s). Re-run with --verbose for full output.`
      )
    }

    const issueSummary = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1])
    console.error("Issue counts:")
    issueSummary.forEach(([issue, count]) => {
      console.error(`  ${issue}: ${count}`)
    })
    process.exitCode = 1
  } catch (error) {
    console.error(`Page parity check error: ${error.message}`)
    process.exitCode = 1
  }
}

main()
