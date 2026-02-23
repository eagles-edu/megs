#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { execSync } from "node:child_process"
import { load } from "cheerio"

const SECTION_ROOT_RE = /^(exercise|lesson|list)-\d+[^/]*\.html$/i
const SECTION_SUB_RE = /^((exercise|lesson|list)-\d+[^/]*)\/.+\.html$/i

const HOME_BY_SECTION_TYPE = {
  exercise: "grammar-exercises.html",
  lesson: "grammar-lessons.html",
  list: "lists.html",
}

const normalizeText = (value) =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const normalizeForCompare = (value) =>
  normalizeText(value)
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*\/\s*/g, " and ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

const stripCommonTailWords = (value) =>
  normalizeForCompare(value)
    .replace(/\s+(?:verb\s+)?tenses?$/, "")
    .trim()

const labelsMatchHeuristically = (label, expectedLabel) => {
  const strictLabel = normalizeForCompare(label)
  const strictExpected = normalizeForCompare(expectedLabel)
  if (!strictLabel || !strictExpected) return false
  if (strictLabel === strictExpected) return true
  return stripCommonTailWords(strictLabel) === stripCommonTailWords(strictExpected)
}

const normalizeRepoPath = (value) => {
  let normalized = String(value || "").replace(/\\/g, "/")
  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // Keep original when decoding fails.
  }
  normalized = normalized.replace(/^\/+/, "").replace(/^\.\//, "")
  return path.posix.normalize(normalized)
}

const listHtmlFiles = () => {
  try {
    const output = execSync(
      'rg --files -g "*.html" -g "*.htm" -g "!node_modules/**" -g "!docs/**" -g "!.git/**"',
      { encoding: "utf8" }
    )
    return output
      .split(/\r?\n/)
      .map((line) => normalizeRepoPath(line))
      .filter(Boolean)
      .sort()
  } catch {
    return []
  }
}

const resolvePagerTarget = (sourceFile, hrefValue) => {
  const href = String(hrefValue || "").trim()
  if (!href) return ""
  if (href.startsWith("#")) return ""
  if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return ""

  if (/^https?:\/\//i.test(href)) {
    try {
      const parsed = new URL(href)
      const normalized = normalizeRepoPath(parsed.pathname)
      return normalized
    } catch {
      return ""
    }
  }

  const hrefPath = href.split("#")[0].split("?")[0].trim()
  if (!hrefPath) return ""

  const sourceAbsDir = path.posix.dirname(`/${normalizeRepoPath(sourceFile)}`)
  const resolvedAbs = hrefPath.startsWith("/")
    ? path.posix.normalize(hrefPath)
    : path.posix.normalize(path.posix.join(sourceAbsDir, hrefPath))

  return normalizeRepoPath(resolvedAbs)
}

const HEADING_SELECTORS = [
  ".item-page .page-header h1",
  ".item-page .page-header h2",
  "main#content .page-header h1",
  "main#content .page-header h2",
  "h1[itemprop='headline']",
  "h2[itemprop='headline']",
  "h1",
  "h2",
]

const extractExpectedPageLabel = ($) => {
  for (let i = 0; i < HEADING_SELECTORS.length; i++) {
    const label = normalizeText($(HEADING_SELECTORS[i]).first().text())
    if (label) return label
  }
  return normalizeText($("title").first().text())
}

const extractPagerLabel = ($, anchor) => {
  const labelNode = $(anchor).find(".pager-label").first()
  if (labelNode.length) return normalizeText(labelNode.text())

  const clone = $(anchor).clone()
  clone.find("svg, title, path, use").remove()
  return normalizeText(clone.text())
}

const getPageMeta = async (filePath, cache) => {
  if (cache.has(filePath)) return cache.get(filePath)

  let html = ""
  try {
    html = await fs.readFile(filePath, "utf8")
  } catch {
    const missing = { exists: false, expectedLabel: "" }
    cache.set(filePath, missing)
    return missing
  }

  const $ = load(html)
  const meta = {
    exists: true,
    expectedLabel: extractExpectedPageLabel($),
  }
  cache.set(filePath, meta)
  return meta
}

const issueSort = (a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file)
  const aLine = Number(a.line || 0)
  const bLine = Number(b.line || 0)
  if (aLine !== bLine) return aLine - bLine
  if (a.rel !== b.rel) return a.rel.localeCompare(b.rel)
  if (a.type !== b.type) return a.type.localeCompare(b.type)
  return a.target.localeCompare(b.target)
}

const main = async () => {
  const files = listHtmlFiles()
  if (!files.length) {
    console.error("No HTML files found for pager audit.")
    process.exit(2)
  }

  const fileSet = new Set(files)
  const metaCache = new Map()
  const issues = []
  const labelChecks = []

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex]

    let html = ""
    try {
      html = await fs.readFile(file, "utf8")
    } catch {
      continue
    }

    const $ = load(html, { sourceCodeLocationInfo: true })
    const links = $(".pager a[rel='prev'], .pager a[rel='next']")
    if (!links.length) continue

    const rootMatch = file.match(SECTION_ROOT_RE)
    const subMatch = file.match(SECTION_SUB_RE)
    const rootType = rootMatch && rootMatch[1] ? rootMatch[1].toLowerCase() : ""
    const subSlug = subMatch && subMatch[1] ? subMatch[1] : ""
    const subRootPath = subSlug ? `${subSlug}.html` : ""

    const seen = new Set()

    links.each((_, anchor) => {
      const rel = normalizeText($(anchor).attr("rel")).toLowerCase()
      if (rel !== "prev" && rel !== "next") return

      const line = Number(anchor?.sourceCodeLocation?.startLine || 0) || 1
      const href = normalizeText($(anchor).attr("href"))
      const label = extractPagerLabel($, anchor)
      const target = resolvePagerTarget(file, href)

      const dedupeKey = `${rel}|${href}|${target}|${label}`
      if (seen.has(dedupeKey)) return
      seen.add(dedupeKey)

      if (!href || !target) {
        issues.push({
          type: "invalid-href",
          file,
          line,
          rel,
          href,
          target,
          label,
          expectedLabel: "",
          detail: "Pager link has an empty or non-resolvable href.",
        })
        return
      }

      if (!fileSet.has(target)) {
        issues.push({
          type: "missing-target",
          file,
          line,
          rel,
          href,
          target,
          label,
          expectedLabel: "",
          detail: "Pager target file does not exist.",
        })
        return
      }

      labelChecks.push({
        file,
        line,
        rel,
        href,
        target,
        label,
      })

      if (!label) {
        issues.push({
          type: "missing-label",
          file,
          line,
          rel,
          href,
          target,
          label,
          expectedLabel: "",
          detail: "Pager link is missing visible label text.",
        })
      }

      if (subSlug && target !== subRootPath && !target.startsWith(`${subSlug}/`)) {
        issues.push({
          type: "subpage-outside-section",
          file,
          line,
          rel,
          href,
          target,
          label,
          expectedLabel: "",
          detail: `Subsection pager leaves section '${subSlug}' instead of looping to '${subRootPath}'.`,
        })
      }

      if (rootType) {
        const expectedHome = HOME_BY_SECTION_TYPE[rootType] || ""
        const targetRootMatch = target.match(SECTION_ROOT_RE)
        const targetRootType = targetRootMatch && targetRootMatch[1] ? targetRootMatch[1].toLowerCase() : ""
        const isAllowedRootTarget = Boolean(targetRootType && targetRootType === rootType)
        const isAllowedHomeTarget = expectedHome && target === expectedHome

        if (!isAllowedRootTarget && !isAllowedHomeTarget) {
          issues.push({
            type: "root-outside-category",
            file,
            rel,
            href,
            target,
            label,
            expectedLabel: "",
            detail: `Section root pager should target same-type section roots or '${expectedHome}'.`,
          })
        }
      }
    })
  }

  for (let i = 0; i < labelChecks.length; i++) {
    const check = labelChecks[i]
    const targetMeta = await getPageMeta(check.target, metaCache)
    if (!targetMeta.exists) continue

    const expectedLabel = targetMeta.expectedLabel || ""

    if (expectedLabel && check.label && !labelsMatchHeuristically(check.label, expectedLabel)) {
      issues.push({
        type: "label-mismatch",
        file: check.file,
        line: check.line,
        rel: check.rel,
        href: check.href,
        target: check.target,
        label: check.label,
        expectedLabel,
        detail: "Pager label does not match the target page heading/title.",
      })
    }
  }

  issues.sort(issueSort)

  if (!issues.length) {
    console.log("Pager alignment report: no mismatches found.")
    process.exit(0)
  }

  const byType = new Map()
  for (let i = 0; i < issues.length; i++) {
    const type = issues[i].type
    byType.set(type, (byType.get(type) || 0) + 1)
  }

  console.log(`Pager alignment report: ${issues.length} mismatches found.`)
  console.log("")
  Array.from(byType.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([type, count]) => {
      console.log(`- ${type}: ${count}`)
    })

  console.log("")
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i]
    const location = `${path.resolve(issue.file)}:${issue.line || 1}`
    console.log(`${location} (line 1): [${issue.type}] rel=${issue.rel}`)
    console.log(`  href: "${issue.href}"`)
    console.log(`  target: ${issue.target}`)
    if (issue.label) console.log(`  label: "${issue.label}"`)
    if (issue.expectedLabel) console.log(`  expected: "${issue.expectedLabel}"`)
    if (issue.detail) console.log(`  note: ${issue.detail}`)
    console.log("")
  }

  process.exit(1)
}

main().catch((error) => {
  console.error("Pager alignment report failed:")
  console.error(error)
  process.exit(2)
})
