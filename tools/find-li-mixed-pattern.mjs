#!/usr/bin/env node
/* eslint-env node */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { globSync } from "glob"
import { load } from "cheerio"

const ROOT = process.cwd()
const DEFAULT_PATTERNS = ["*.html", "lesson-*/*.html", "list-*/*.html", "exercise-*/*.html"]
const BLOCK_TAGS = new Set(["p", "div", "ul", "ol", "table", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"])
const INLINE_TAGS = new Set([
  "span",
  "b",
  "strong",
  "em",
  "i",
  "u",
  "small",
  "mark",
  "sup",
  "sub",
  "code",
  "a",
  "abbr",
  "q",
])

const parseArgs = (argv) => {
  const options = {
    all: false,
    max: 20,
    patterns: DEFAULT_PATTERNS.slice(),
    paths: [],
  }

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx]
    if (arg === "--all") {
      options.all = true
      continue
    }
    if (arg === "--max") {
      const raw = argv[idx + 1]
      const value = Number(raw)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--max expects a positive number")
      }
      options.max = Math.floor(value)
      idx += 1
      continue
    }
    if (arg === "--glob") {
      const pattern = argv[idx + 1]
      if (!pattern) throw new Error("--glob requires a value")
      options.patterns.push(pattern)
      idx += 1
      continue
    }
    if (arg === "--path") {
      const filePath = argv[idx + 1]
      if (!filePath) throw new Error("--path requires a value")
      options.paths.push(filePath)
      idx += 1
      continue
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true
      continue
    }
    options.paths.push(arg)
  }
  return options
}

const printHelp = () => {
  console.log(`Usage: node tools/find-li-mixed-pattern.mjs [options]

Finds <li> nodes where block children (like <p>) are mixed with inline/text siblings
at the same level, e.g.:
  <li><p>...</p><strong>...</strong> ...</li>

Options:
  --path <file>           Scan one file (repeatable)
  --glob <pattern>        Add a glob pattern (repeatable)
  --all                   Print all matches found
  --max <n>               Max matches when not using --all (default: 20)
  -h, --help              Show this help
`)
}

const normalizePath = (value) => String(value || "").replace(/\\/g, "/")

const uniqueSorted = (values) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))

const isEmptyTextNode = (node) => node && node.type === "text" && !String(node.data || "").trim()

const hasMixedLiPattern = (children) => {
  let sawBlock = false
  for (let idx = 0; idx < children.length; idx += 1) {
    const node = children[idx]
    if (!node) continue
    if (node.type === "tag") {
      const tag = String(node.name || "").toLowerCase()
      if (BLOCK_TAGS.has(tag)) {
        sawBlock = true
        continue
      }
      if (sawBlock && INLINE_TAGS.has(tag)) return true
      if (sawBlock && !BLOCK_TAGS.has(tag)) return true
    }
    if (sawBlock && node.type === "text" && String(node.data || "").trim()) return true
  }
  return false
}

const lineFromOffset = (source, offset) => {
  if (!Number.isFinite(offset) || offset < 0) return null
  let line = 1
  for (let idx = 0; idx < offset && idx < source.length; idx += 1) {
    if (source.charCodeAt(idx) === 10) line += 1
  }
  return line
}

const getNodeStartOffset = (node) => {
  if (!node) return null
  if (Number.isFinite(node.startIndex)) return node.startIndex
  if (node.sourceCodeLocation && Number.isFinite(node.sourceCodeLocation.startOffset)) {
    return node.sourceCodeLocation.startOffset
  }
  return null
}

const shorten = (value, maxLength = 180) => {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

const collectTargets = (options) => {
  if (options.paths.length) {
    return uniqueSorted(options.paths.map(normalizePath)).filter((filePath) =>
      fs.existsSync(path.join(ROOT, filePath))
    )
  }

  const files = []
  options.patterns.forEach((pattern) => {
    const matches = globSync(pattern, { cwd: ROOT, nodir: true, posix: true })
    matches.forEach((filePath) => {
      if (!filePath.toLowerCase().endsWith(".html")) return
      if (/\.bak-/i.test(filePath)) return
      files.push(normalizePath(filePath))
    })
  })
  return uniqueSorted(files).filter((filePath) => fs.existsSync(path.join(ROOT, filePath)))
}

const findMatchesInFile = (filePath) => {
  const source = fs.readFileSync(path.join(ROOT, filePath), "utf8")
  const $ = load(source, {
    decodeEntities: false,
    sourceCodeLocationInfo: true,
    withStartIndices: true,
  })
  const matches = []

  $("li").each((_, li) => {
    const children = ($(li).contents().toArray() || []).filter((node) => !isEmptyTextNode(node))
    if (!children.length) return
    if (!hasMixedLiPattern(children)) return

    const offset = getNodeStartOffset(li)
    const line = lineFromOffset(source, offset)
    matches.push({
      filePath,
      line,
      snippet: shorten($.html(li)),
    })
  })
  return matches
}

const main = () => {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }

    const targets = collectTargets(options)
    if (!targets.length) {
      console.log("No matching files found.")
      return
    }

    const matches = []
    for (let i = 0; i < targets.length; i += 1) {
      const fileMatches = findMatchesInFile(targets[i])
      if (!fileMatches.length) continue
      matches.push(...fileMatches)
      if (!options.all && matches.length >= options.max) break
    }

    if (!matches.length) {
      console.log("No mixed <li> block+inline pattern found.")
      return
    }

    const visible = options.all ? matches : matches.slice(0, options.max)
    visible.forEach((match, index) => {
      const location = match.line ? `${match.filePath}:${match.line}` : match.filePath
      console.log(`${index + 1}. ${location}`)
      console.log(`   ${match.snippet}`)
    })

    if (!options.all && matches.length > visible.length) {
      console.log(`... ${matches.length - visible.length} more matches not shown.`)
    }
  } catch (error) {
    console.error(`find-li-mixed-pattern error: ${error.message}`)
    process.exitCode = 1
  }
}

main()
