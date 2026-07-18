#!/usr/bin/env node
// / /* eslint-env node */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { globSync } from "glob"
import { load } from "cheerio"

const ROOT = process.cwd()
const DEFAULT_PATTERNS = [
  "*.html",
  "lesson-*/*.html",
  "list-*/*.html",
  "exercise-*/*.html",
]
const DEFAULT_MAX_FAILURES = 200

const parseArgs = (argv) => {
  const options = {
    includeDefaultPatterns: true,
    maxFailures: DEFAULT_MAX_FAILURES,
    patterns: [],
    verbose: false,
  }

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx]
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
    if (arg === "--pattern") {
      const pattern = argv[idx + 1]
      if (!pattern) throw new Error("--pattern requires a glob value")
      options.patterns.push(pattern)
      idx += 1
      continue
    }
    if (arg === "--no-default-patterns") {
      options.includeDefaultPatterns = false
      continue
    }
    if (arg === "--verbose") {
      options.verbose = true
      continue
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true
      continue
    }
    throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

const printHelp = () => {
  console.log(`Usage: node tools/check-internal-links.mjs [options]

Options:
  --max-failures <n>      Max failing entries to print (default: ${DEFAULT_MAX_FAILURES})
  --pattern <glob>        Additional glob pattern for HTML pages (repeatable)
  --no-default-patterns   Use only --pattern values (skip built-in page patterns)
  --verbose               Print all failures
  -h, --help              Show this help
`)
}

const normalizeHref = (value) => String(value || "").trim()

const shouldSkipHref = (href) => {
  if (!href) return true
  if (href.startsWith("#")) return true
  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(href)) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return true
  if (href.startsWith("//")) return true
  if (/\{\{|\}\}|\$\{|<%|%>/.test(href)) return true
  return false
}

const stripHashQuery = (href) => String(href || "").split("#")[0].split("?")[0].trim()

const uniqueSorted = (values) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))

const collectHtmlFiles = (patterns) => {
  const files = []
  patterns.forEach((pattern) => {
    const matches = globSync(pattern, { cwd: ROOT, nodir: true, posix: true })
    matches.forEach((file) => {
      if (!file.toLowerCase().endsWith(".html")) return
      if (/\.bak-/i.test(file)) return
      files.push(file.replace(/\\/g, "/"))
    })
  })
  return uniqueSorted(files).filter((file) => fs.existsSync(path.join(ROOT, file)))
}

const resolveCandidates = (sourceFile, cleanedHref) => {
  if (!cleanedHref || cleanedHref === "." || cleanedHref === "./") return []

  const sourceAbs = path.join(ROOT, sourceFile)
  const fromDir = path.dirname(sourceAbs)
  const rawTarget = cleanedHref.startsWith("/")
    ? path.join(ROOT, cleanedHref.replace(/^\/+/, ""))
    : path.resolve(fromDir, cleanedHref)

  const ext = path.extname(rawTarget)
  const candidates = [rawTarget]

  const isBarePath =
    !cleanedHref.startsWith("/") &&
    !cleanedHref.startsWith("./") &&
    !cleanedHref.startsWith("../")
  if (isBarePath) {
    candidates.push(path.join(ROOT, cleanedHref))
  }

  if (!ext) {
    candidates.push(`${rawTarget}.html`)
    candidates.push(path.join(rawTarget, "index.html"))
    if (isBarePath) {
      const rootBased = path.join(ROOT, cleanedHref)
      candidates.push(`${rootBased}.html`)
      candidates.push(path.join(rootBased, "index.html"))
    }
  }

  return uniqueSorted(candidates.map((candidate) => path.normalize(candidate)))
}

const linkExists = (sourceFile, href) => {
  const cleanedHref = stripHashQuery(href)
  if (!cleanedHref) return true

  const candidates = resolveCandidates(sourceFile, cleanedHref)
  if (!candidates.length) return true
  return candidates.some((candidate) => fs.existsSync(candidate))
}

const checkFile = (filePath) => {
  const absolute = path.join(ROOT, filePath)
  const html = fs.readFileSync(absolute, "utf8")
  const $ = load(html, { decodeEntities: false })
  const failures = []

  $("a[href]").each((_, anchor) => {
    const href = normalizeHref($(anchor).attr("href"))
    if (shouldSkipHref(href)) return
    if (linkExists(filePath, href)) return

    const cleanedHref = stripHashQuery(href)
    const candidates = resolveCandidates(filePath, cleanedHref)
      .map((candidate) => path.relative(ROOT, candidate).replace(/\\/g, "/"))
      .join(" | ")
    failures.push({
      filePath,
      href,
      candidates,
    })
  })

  return failures
}

const main = () => {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }

    const activePatterns = options.includeDefaultPatterns
      ? DEFAULT_PATTERNS.concat(options.patterns)
      : options.patterns.slice()
    if (!activePatterns.length) {
      throw new Error("No patterns selected. Provide --pattern or remove --no-default-patterns.")
    }

    const files = collectHtmlFiles(activePatterns)
    if (!files.length) {
      console.log("Internal link check: no HTML files matched.")
      return
    }

    const failures = []
    files.forEach((filePath) => {
      const fileFailures = checkFile(filePath)
      if (!fileFailures.length) return
      failures.push(...fileFailures)
    })

    if (!failures.length) {
      console.log(`Internal link check passed (${files.length} page files scanned).`)
      return
    }

    console.error(
      `Internal link check failed (${failures.length} broken link(s) across ${files.length} page files).`
    )
    const visible = options.verbose
      ? failures
      : failures.slice(0, Math.max(0, options.maxFailures))

    visible.forEach((failure) => {
      console.error(
        `- ${failure.filePath} :: href="${failure.href}" :: tried ${failure.candidates || "(no file candidates)"}`
      )
    })

    if (!options.verbose && visible.length < failures.length) {
      console.error(
        `... ${failures.length - visible.length} more broken link(s). Re-run with --verbose for full output.`
      )
    }

    process.exitCode = 1
  } catch (error) {
    console.error(`Internal link check error: ${error.message}`)
    process.exitCode = 1
  }
}

main()
