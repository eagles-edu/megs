#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { execSync } from "node:child_process"
import { load } from "cheerio"

const SECTION_ROOT_RE = /^(exercise|lesson|list)-\d+[^/]*\.html$/i
const SECTION_SUB_RE = /^((exercise|lesson|list)-\d+[^/]*)\/.+\.html$/i

const HOME_BY_SECTION_TYPE = {
  exercise: "grammar-exercises.html",
  lesson: "grammar-lessons.html",
  list: "lists.html",
}

const ORPHAN_EXEMPT_ROOTS = new Set([
  "index.html",
  "index-2.html",
  "grammar-lessons.html",
  "grammar-exercises.html",
  "lists.html",
  "writing.html",
  "writing-resources.html",
  "vocabulary.html",
])

const LEGACY_RULES = [
  {
    id: "legacy-template592f",
    re: /template592f/i,
    detail: "Legacy Joomla template asset reference found.",
  },
  {
    id: "legacy-jquery592f",
    re: /jquery\.min592f/i,
    detail: "Legacy Joomla jquery reference found.",
  },
  {
    id: "legacy-bootstrap592f",
    re: /bootstrap\.min592f/i,
    detail: "Legacy Joomla bootstrap reference found.",
  },
  {
    id: "legacy-print-css-swap",
    re: /media\s*=\s*["']print["']/i,
    detail: "Legacy print-media stylesheet loading pattern found.",
  },
]

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
  const normalizedLabel = normalizeForCompare(label)
  const normalizedExpected = normalizeForCompare(expectedLabel)
  if (!normalizedLabel || !normalizedExpected) return false
  if (normalizedLabel === normalizedExpected) return true
  return stripCommonTailWords(normalizedLabel) === stripCommonTailWords(normalizedExpected)
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
      return normalizeRepoPath(parsed.pathname)
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

const countLineAtIndex = (content, index) => {
  if (!Number.isFinite(index) || index <= 0) return 1
  let line = 1
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line += 1
  }
  return line
}

const issueSort = (a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file)
  const aLine = Number(a.line || 0)
  const bLine = Number(b.line || 0)
  if (aLine !== bLine) return aLine - bLine
  if (a.type !== b.type) return a.type.localeCompare(b.type)
  const aRel = a.rel || ""
  const bRel = b.rel || ""
  if (aRel !== bRel) return aRel.localeCompare(bRel)
  const aTarget = a.target || ""
  const bTarget = b.target || ""
  return aTarget.localeCompare(bTarget)
}

const formatIssueBlock = (issue) => {
  const location = `${path.resolve(issue.file)}:${issue.line || 1}`
  const relText = issue.rel ? ` rel=${issue.rel}` : ""
  const lines = [`${location} (line 1): [${issue.type}]${relText}`]
  if (issue.href) lines.push(`  href: "${issue.href}"`)
  if (issue.target) lines.push(`  target: ${issue.target}`)
  if (issue.label) lines.push(`  label: "${issue.label}"`)
  if (issue.expectedLabel) lines.push(`  expected: "${issue.expectedLabel}"`)
  if (issue.detail) lines.push(`  note: ${issue.detail}`)
  lines.push("")
  return lines.join("\n")
}

const parseArgs = (argv) => {
  const options = {
    output: "/tmp/navigation-compliance-report.txt",
    json: "",
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--output") {
      options.output = argv[i + 1] || options.output
      i += 1
      continue
    }
    if (arg === "--json") {
      options.json = argv[i + 1] || "/tmp/navigation-compliance-report.json"
      i += 1
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
  console.log(`Usage: node tools/analyze-navigation-compliance.mjs [options]

Options:
  --output <file>   Text report path (default: /tmp/navigation-compliance-report.txt)
  --json <file>     Optional JSON report path
  -h, --help        Show help
`)
}

const isOrphanExempt = (file) => ORPHAN_EXEMPT_ROOTS.has(path.posix.basename(file))

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const files = listHtmlFiles()
  if (!files.length) {
    const message = "Navigation compliance report: no HTML files found."
    await fs.writeFile(options.output, `${message}\n`, "utf8")
    console.log(message)
    process.exit(2)
  }

  const fileSet = new Set(files)
  const pageByFile = new Map()
  const issues = []
  const issueKeys = new Set()

  const pushIssue = (issue) => {
    const key = [
      issue.type || "",
      issue.file || "",
      String(issue.line || 1),
      issue.rel || "",
      issue.href || "",
      issue.target || "",
      issue.detail || "",
    ].join("|")
    if (issueKeys.has(key)) return
    issueKeys.add(key)
    issues.push(issue)
  }

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex]

    let html = ""
    try {
      html = await fs.readFile(file, "utf8")
    } catch {
      continue
    }

    const $ = load(html, { sourceCodeLocationInfo: true })
    const heading = extractExpectedPageLabel($)
    const anchors = []

    const pagerAnchors = $(".pager a")
    pagerAnchors.each((_, anchor) => {
      const rel = normalizeText($(anchor).attr("rel")).toLowerCase()
      const href = normalizeText($(anchor).attr("href"))
      const line = Number(anchor?.sourceCodeLocation?.startLine || 0) || 1
      const hasPagerLabel = $(anchor).find(".pager-label").length > 0
      const label = extractPagerLabel($, anchor)
      const target = resolvePagerTarget(file, href)

      anchors.push({ rel, href, line, hasPagerLabel, label, target })

      if (!hasPagerLabel) {
        pushIssue({
          type: "legacy-pager-markup",
          file,
          line,
          rel,
          href,
          target,
          label,
          expectedLabel: "",
          detail: "Pager link uses legacy text-node markup without .pager-label.",
        })
      }

      if (rel !== "prev" && rel !== "next") {
        pushIssue({
          type: "pager-missing-rel",
          file,
          line,
          rel,
          href,
          target,
          label,
          expectedLabel: "",
          detail: "Pager link should declare rel='prev' or rel='next'.",
        })
      }

      if (!label) {
        pushIssue({
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
    })

    for (let i = 0; i < LEGACY_RULES.length; i++) {
      const rule = LEGACY_RULES[i]
      const match = rule.re.exec(html)
      if (!match || typeof match.index !== "number") continue
      const line = countLineAtIndex(html, match.index)
      pushIssue({
        type: "legacy-nav-code",
        file,
        line,
        rel: "",
        href: "",
        target: "",
        label: rule.id,
        expectedLabel: "",
        detail: rule.detail,
      })
    }

    pageByFile.set(file, {
      file,
      heading,
      anchors,
      hasPager: anchors.length > 0,
    })
  }

  const validEdgesByKey = new Map()
  const incomingCount = new Map()

  for (const [file, page] of pageByFile.entries()) {
    const rootMatch = file.match(SECTION_ROOT_RE)
    const subMatch = file.match(SECTION_SUB_RE)
    const rootType = rootMatch && rootMatch[1] ? rootMatch[1].toLowerCase() : ""
    const subSlug = subMatch && subMatch[1] ? subMatch[1] : ""
    const subRootPath = subSlug ? `${subSlug}.html` : ""

    const seenRelHref = new Map()

    for (let i = 0; i < page.anchors.length; i++) {
      const anchor = page.anchors[i]
      if (anchor.rel !== "prev" && anchor.rel !== "next") continue

      if (!anchor.href || !anchor.target) {
        pushIssue({
          type: "invalid-href",
          file,
          line: anchor.line,
          rel: anchor.rel,
          href: anchor.href,
          target: anchor.target,
          label: anchor.label,
          expectedLabel: "",
          detail: "Pager link has an empty or non-resolvable href.",
        })
        continue
      }

      if (!fileSet.has(anchor.target)) {
        pushIssue({
          type: "missing-target",
          file,
          line: anchor.line,
          rel: anchor.rel,
          href: anchor.href,
          target: anchor.target,
          label: anchor.label,
          expectedLabel: "",
          detail: "Pager target file does not exist.",
        })
        continue
      }

      const relHrefKey = `${anchor.rel}|${anchor.href}`
      if (!seenRelHref.has(relHrefKey)) seenRelHref.set(relHrefKey, new Set())
      seenRelHref.get(relHrefKey).add(anchor.line)

      if (subSlug && anchor.target !== subRootPath && !anchor.target.startsWith(`${subSlug}/`)) {
        pushIssue({
          type: "subpage-outside-section",
          file,
          line: anchor.line,
          rel: anchor.rel,
          href: anchor.href,
          target: anchor.target,
          label: anchor.label,
          expectedLabel: "",
          detail: `Subsection pager leaves section '${subSlug}' instead of looping to '${subRootPath}'.`,
        })
      }

      if (rootType) {
        const expectedHome = HOME_BY_SECTION_TYPE[rootType] || ""
        const targetRootMatch = anchor.target.match(SECTION_ROOT_RE)
        const targetRootType =
          targetRootMatch && targetRootMatch[1] ? targetRootMatch[1].toLowerCase() : ""
        const isAllowedRootTarget = Boolean(targetRootType && targetRootType === rootType)
        const isAllowedHomeTarget = expectedHome && anchor.target === expectedHome

        if (!isAllowedRootTarget && !isAllowedHomeTarget) {
          pushIssue({
            type: "root-outside-category",
            file,
            line: anchor.line,
            rel: anchor.rel,
            href: anchor.href,
            target: anchor.target,
            label: anchor.label,
            expectedLabel: "",
            detail: `Section root pager should target same-type section roots or '${expectedHome}'.`,
          })
        }
      }

      const targetPage = pageByFile.get(anchor.target)
      const expectedLabel = targetPage ? targetPage.heading : ""
      if (expectedLabel && anchor.label && !labelsMatchHeuristically(anchor.label, expectedLabel)) {
        pushIssue({
          type: "label-mismatch",
          file,
          line: anchor.line,
          rel: anchor.rel,
          href: anchor.href,
          target: anchor.target,
          label: anchor.label,
          expectedLabel,
          detail: "Pager label does not match the target page heading/title.",
        })
      }

      const edgeKey = `${file}|${anchor.rel}|${anchor.target}`
      if (!validEdgesByKey.has(edgeKey)) {
        validEdgesByKey.set(edgeKey, {
          source: file,
          line: anchor.line,
          rel: anchor.rel,
          href: anchor.href,
          target: anchor.target,
          label: anchor.label,
        })
      }
    }

    const relTargetMap = new Map()
    for (let i = 0; i < page.anchors.length; i++) {
      const anchor = page.anchors[i]
      if (anchor.rel !== "prev" && anchor.rel !== "next") continue
      if (!anchor.target) continue
      const key = anchor.rel
      if (!relTargetMap.has(key)) relTargetMap.set(key, new Set())
      relTargetMap.get(key).add(anchor.target)
    }

    for (const [rel, targets] of relTargetMap.entries()) {
      if (targets.size <= 1) continue
      pushIssue({
        type: "edge-case-multi-target",
        file,
        line: 1,
        rel,
        href: "",
        target: Array.from(targets).sort().join(", "),
        label: "",
        expectedLabel: "",
        detail: `Page has multiple '${rel}' pager targets; top and bottom pagers may be inconsistent.`,
      })
    }
  }

  for (const edge of validEdgesByKey.values()) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1)

    const oppositeRel = edge.rel === "next" ? "prev" : "next"
    const reverseKey = `${edge.target}|${oppositeRel}|${edge.source}`
    if (!validEdgesByKey.has(reverseKey)) {
      pushIssue({
        type: "broken-loop",
        file: edge.source,
        line: edge.line,
        rel: edge.rel,
        href: edge.href,
        target: edge.target,
        label: edge.label,
        expectedLabel: "",
        detail: `Target page is missing the reverse '${oppositeRel}' pager back to source.`,
      })
    }
  }

  for (const [file, page] of pageByFile.entries()) {
    if (!page.hasPager) continue
    if (isOrphanExempt(file)) continue
    if ((incomingCount.get(file) || 0) > 0) continue

    pushIssue({
      type: "orphaned-page",
      file,
      line: 1,
      rel: "",
      href: "",
      target: "",
      label: "",
      expectedLabel: "",
      detail: "No incoming pager links from any other page were detected.",
    })
  }

  issues.sort(issueSort)

  const byType = new Map()
  for (let i = 0; i < issues.length; i++) {
    const type = issues[i].type
    byType.set(type, (byType.get(type) || 0) + 1)
  }

  const lines = []
  lines.push(`Navigation compliance report: ${issues.length} issue(s) found.`)
  lines.push("")
  Array.from(byType.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([type, count]) => {
      lines.push(`- ${type}: ${count}`)
    })
  lines.push("")

  for (let i = 0; i < issues.length; i++) {
    lines.push(formatIssueBlock(issues[i]))
  }

  const outputBody = `${lines.join("\n")}\n`
  await fs.writeFile(options.output, outputBody, "utf8")

  if (options.json) {
    await fs.writeFile(
      options.json,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          issueCount: issues.length,
          summary: Object.fromEntries(byType.entries()),
          issues,
        },
        null,
        2
      )}\n`,
      "utf8"
    )
  }

  console.log(`Navigation compliance report written to ${options.output}`)
  if (options.json) console.log(`Navigation compliance JSON written to ${options.json}`)

  if (issues.length) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Navigation compliance report failed:")
  console.error(error)
  process.exit(2)
})
