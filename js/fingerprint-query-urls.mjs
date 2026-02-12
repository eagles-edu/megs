#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import { globSync } from "glob"

const usage = `
Usage:
  node js/fingerprint-query-urls.mjs [options] [file-or-glob ...]

Options:
  --write                 Apply changes in place (default: dry-run)
  --version <value>       Use explicit version instead of git short SHA
  --include-versioning    Include files under versioning/
  --help                  Show this help

Examples:
  node js/fingerprint-query-urls.mjs
  node js/fingerprint-query-urls.mjs --write
  node js/fingerprint-query-urls.mjs --write --version 20260212
  node js/fingerprint-query-urls.mjs "exercise-1-nouns/**/*.html"
`.trim()

function parseArgs(argv) {
  const options = {
    write: false,
    version: "",
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
    if (arg === "--write") {
      options.write = true
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
    options.patterns.push(arg)
  }

  return options
}

function resolveVersion(explicitVersion) {
  if (explicitVersion) return explicitVersion
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
  } catch (error) {
    void error
    return ""
  }
}

function normalizeFilePath(filePath) {
  return filePath.split(path.sep).join("/")
}

function collectFiles(patterns, includeVersioning) {
  const cwd = process.cwd()
  const ignore = ["**/node_modules/**", "**/.git/**"]
  if (!includeVersioning) ignore.push("versioning/**")

  const effectivePatterns =
    patterns.length > 0 ? patterns : ["**/*.html", "**/*.htm"]

  const files = new Set()

  for (const token of effectivePatterns) {
    if (fs.existsSync(token) && fs.statSync(token).isFile()) {
      const rel = normalizeFilePath(path.relative(cwd, path.resolve(token)))
      if (!rel.startsWith("..")) files.add(rel)
      continue
    }

    const matches = globSync(token, {
      cwd,
      nodir: true,
      ignore,
      windowsPathsNoEscape: true,
    })
    for (const match of matches) files.add(normalizeFilePath(match))
  }

  if (!includeVersioning) {
    for (const file of Array.from(files)) {
      if (file.startsWith("versioning/")) files.delete(file)
    }
  }

  return Array.from(files).sort()
}

function isExternalUrl(url) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url.trim())
}

function isVersionableAsset(url) {
  return /\.(?:css|m?js)(?:[?#]|$)/i.test(url)
}

function applyVersionQuery(url, version) {
  if (!version) return url
  if (isExternalUrl(url)) return url
  if (!isVersionableAsset(url)) return url

  let baseWithQuery = url
  let hash = ""
  const hashIndex = url.indexOf("#")
  if (hashIndex >= 0) {
    baseWithQuery = url.slice(0, hashIndex)
    hash = url.slice(hashIndex)
  }

  const queryIndex = baseWithQuery.indexOf("?")
  if (queryIndex < 0) return `${baseWithQuery}?v=${version}${hash}`

  const base = baseWithQuery.slice(0, queryIndex)
  const query = baseWithQuery.slice(queryIndex + 1)
  const parts = query ? query.split("&").filter(Boolean) : []

  let hasVersion = false
  for (let i = 0; i < parts.length; i++) {
    if (!/^v=/.test(parts[i])) continue
    parts[i] = `v=${version}`
    hasVersion = true
  }
  if (!hasVersion) parts.push(`v=${version}`)

  return `${base}?${parts.join("&")}${hash}`
}

function rewriteAssetUrls(html, version) {
  let replacements = 0
  const rewritten = html.replace(/<(script|link)\b[^>]*>/gi, (tag, tagName) => {
    const attrName = tagName.toLowerCase() === "script" ? "src" : "href"
    const attrPattern = new RegExp(
      `\\b(${attrName})\\s*=\\s*(["'])([^"']+)\\2`,
      "i"
    )

    return tag.replace(attrPattern, (full, attr, quote, value) => {
      const updated = applyVersionQuery(value, version)
      if (updated === value) return full
      replacements += 1
      return `${attr}=${quote}${updated}${quote}`
    })
  })

  return { rewritten, replacements }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage)
    process.exit(0)
  }

  const version = resolveVersion(options.version)
  if (!version) {
    console.error(
      "error: unable to resolve version. Pass --version <value> or run inside a git repo."
    )
    process.exit(1)
  }

  const files = collectFiles(options.patterns, options.includeVersioning)
  if (!files.length) {
    console.error("error: no HTML files matched.")
    process.exit(1)
  }

  let changedFiles = 0
  let updatedRefs = 0
  const changedPaths = []

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8")
    const { rewritten, replacements } = rewriteAssetUrls(source, version)
    if (!replacements) continue
    changedFiles += 1
    updatedRefs += replacements
    changedPaths.push(file)
    if (options.write) fs.writeFileSync(file, rewritten, "utf8")
  }

  const mode = options.write ? "write" : "dry-run"
  console.log(
    `[${mode}] version=${version} scanned=${files.length} changed=${changedFiles} refs=${updatedRefs}`
  )
  if (changedPaths.length) {
    for (const file of changedPaths) console.log(file)
  }
}

main()
