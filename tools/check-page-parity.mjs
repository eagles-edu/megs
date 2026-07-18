#!/usr/bin/env node

import fs from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"
import { globSync } from "glob"
import { load } from "cheerio"

const CHANGED_FILTER = "--diff-filter=ACMR"
const LESSON_GLOB = "lesson-*/*.html"
const LIST_GLOB = "list-*/*.html"
const LESSON_FILE_RE = /^lesson-[^/]+\/[^/]+\.html$/
const LIST_FILE_RE = /^list-[^/]+\/[^/]+\.html$/
const ROOT = process.cwd()
const DEFAULT_MAX_FAILURES = 30
const EXPECTED_GENERATOR = "English Grammar - IELTS intermediate levels A2 and above"
const EMPTY_TREE_SHA = "0000000000000000000000000000000000000000"
const LIST2_NUMBERED_HREF_RE =
  /href=["'][^"']*list-2-uncountable-nouns-made-countable\/(?:1\.activity-cynicism|2\.danger-fruit|3\.l|4\.marble-rum|5\.sadness-sunlight|6\.tea-yogurt)\.html(?:[#?][^"']*)?["']/i
const BASE_CSS_PATH = path.join(ROOT, "web-asset/css/base.css")
const BASE_CSS_PAGER_CHECKS = [
  {
    issue: "base-css-pager-hover-background",
    pattern:
      /\.pager\s*>\s*li\s*>\s*a:focus\s*,\s*\.pager\s*>\s*li\s*>\s*a:hover\s*\{[\s\S]*?background-color:\s*var\(--pager-hover-background,\s*#fff\)/i,
  },
  {
    issue: "base-css-pager-anchor-overflow-hidden",
    pattern: /\.pager\s*>\s*li\s*>\s*a\s*\{[\s\S]*?overflow:\s*hidden/i,
  },
  {
    issue: "base-css-pager-label-min-width",
    pattern: /\.pager\s+\.pager-label\s*\{[\s\S]*?min-width:\s*0/i,
  },
  {
    issue: "base-css-pager-label-overflow-hidden",
    pattern: /\.pager\s+\.pager-label\s*\{[\s\S]*?overflow:\s*hidden/i,
  },
  {
    issue: "base-css-pager-label-ellipsis",
    pattern: /\.pager\s+\.pager-label\s*\{[\s\S]*?text-overflow:\s*var\(--pager-label-truncate,\s*ellipsis\)/i,
  },
  {
    issue: "base-css-pager-label-nowrap",
    pattern: /\.pager\s+\.pager-label\s*\{[\s\S]*?white-space:\s*var\(--pager-label-wrap,\s*nowrap\)/i,
  },
]
const PAGER_LINK_CHECKS = [
  {
    key: "previous",
    selector: "li.previous > a",
    rel: "prev",
    ariaLabel: "Previous",
    iconToken: "angle-left",
    labelPosition: "after",
  },
  {
    key: "next",
    selector: "li.next > a",
    rel: "next",
    ariaLabel: "Next",
    iconToken: "angle-right",
    labelPosition: "before",
  },
]
let cachedBaseCssPagerIssues = null

const parseArgs = (argv) => {
  const options = {
    allLessons: false,
    allLists: false,
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
    if (arg === "--all-lists") {
      options.allLists = true
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

const collectByGlob = (pattern) => globSync(pattern, { cwd: ROOT, nodir: true, posix: true })

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
  if (options.allLessons && options.allLists) {
    return [...collectByGlob(LESSON_GLOB), ...collectByGlob(LIST_GLOB)]
  }
  if (options.allLists) {
    return collectByGlob(LIST_GLOB)
  }
  return collectByGlob(LESSON_GLOB)
}

const uniqueSorted = (values) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))

const regexIndex = (source, pattern) => {
  const match = source.match(pattern)
  return match ? match.index ?? -1 : -1
}

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()

const iconMatchesToken = (iconNode, token) => {
  if (!iconNode || !iconNode.length) return false
  const normalizedToken = String(token || "").toLowerCase()
  const tagName = String(iconNode.prop("tagName") || "").toLowerCase()
  if (tagName === "svg") {
    const titleText = normalizeText(iconNode.find("title").first().text()).toLowerCase()
    if (titleText) return titleText.includes(normalizedToken)
    const useNode = iconNode.find("use").first()
    const useHref = normalizeText(useNode.attr("href") || useNode.attr("xlink:href")).toLowerCase()
    return useHref.includes(normalizedToken)
  }
  if (tagName === "img") {
    const src = normalizeText(iconNode.attr("src")).toLowerCase()
    return src.includes(normalizedToken)
  }
  return false
}

const checkPagerLinkStructure = (anchor, spec, pagerContext, issues) => {
  if (!anchor.length) {
    issues.push(`${pagerContext}-missing-${spec.key}-link`)
    return
  }

  const relValue = normalizeText(anchor.attr("rel")).toLowerCase()
  if (relValue !== spec.rel) {
    issues.push(`${pagerContext}-${spec.key}-rel`)
  }

  const ariaLabel = normalizeText(anchor.attr("aria-label")).toLowerCase()
  if (ariaLabel !== spec.ariaLabel.toLowerCase()) {
    issues.push(`${pagerContext}-${spec.key}-aria-label`)
  }

  const labelNode = anchor.children("span.pager-label").first()
  if (!labelNode.length) {
    issues.push(`${pagerContext}-${spec.key}-missing-pager-label`)
  } else if (!normalizeText(labelNode.text())) {
    issues.push(`${pagerContext}-${spec.key}-empty-pager-label`)
  }

  const iconNode = anchor.children("svg, img").first()
  if (!iconNode.length) {
    issues.push(`${pagerContext}-${spec.key}-missing-icon`)
  }

  if (labelNode.length && iconNode.length) {
    const children = anchor.children().toArray()
    const iconIndex = children.findIndex((node) => node === iconNode.get(0))
    const labelIndex = children.findIndex((node) => node === labelNode.get(0))
    if (spec.labelPosition === "after" && !(iconIndex >= 0 && labelIndex > iconIndex)) {
      issues.push(`${pagerContext}-${spec.key}-icon-label-order`)
    }
    if (spec.labelPosition === "before" && !(labelIndex >= 0 && iconIndex > labelIndex)) {
      issues.push(`${pagerContext}-${spec.key}-label-icon-order`)
    }
  }

  if (iconNode.length && !iconMatchesToken(iconNode, spec.iconToken)) {
    issues.push(`${pagerContext}-${spec.key}-icon-token`)
  }
}

const checkPagerStructure = (source, issues) => {
  const $ = load(source, { decodeEntities: false })
  const pagers = $("ul.pager.pagenav")
  if (!pagers.length) {
    issues.push("missing-pager-pagenav")
    return
  }
  pagers.each((index, pagerNode) => {
    const pager = $(pagerNode)
    const pagerContext = `pager-${index + 1}`
    PAGER_LINK_CHECKS.forEach((spec) => {
      const anchor = pager.find(spec.selector).first()
      checkPagerLinkStructure(anchor, spec, pagerContext, issues)
    })
  })
}

const getBaseCssPagerIssues = () => {
  if (cachedBaseCssPagerIssues !== null) return cachedBaseCssPagerIssues
  if (!fs.existsSync(BASE_CSS_PATH)) {
    cachedBaseCssPagerIssues = ["missing-base-css-file"]
    return cachedBaseCssPagerIssues
  }
  const cssText = fs.readFileSync(BASE_CSS_PATH, "utf8")
  cachedBaseCssPagerIssues = BASE_CSS_PAGER_CHECKS.filter((check) => !check.pattern.test(cssText)).map(
    (check) => check.issue
  )
  return cachedBaseCssPagerIssues
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

const getProfileBodyCheck = (profile) => {
  if (profile === "lesson") {
    return {
      issue: "missing-body-base-lesson-classes",
      pattern: /<body[^>]*\bclass=["'][^"']*\bbase\b[^"']*\blesson\b[^"']*["'][^>]*>/i,
    }
  }
  if (profile === "list") {
    return {
      issue: "missing-body-base-list-classes",
      pattern: /<body[^>]*\bclass=["'][^"']*\bbase\b[^"']*\blist\b[^"']*["'][^>]*>/i,
    }
  }
  return null
}

const pageRuleChecks = (source, issues, profile) => {
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
    { issue: "missing-critical-inline", pattern: /<style[^>]+id=["']critical-inline["']/i },
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
  ]
  const bodyCheck = getProfileBodyCheck(profile)
  if (bodyCheck) requiredChecks.push(bodyCheck)

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
    { issue: "forbidden-list2-numbered-href", pattern: LIST2_NUMBERED_HREF_RE },
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

  checkPagerStructure(source, issues)
  issues.push(...getBaseCssPagerIssues())
}

const resolvePageProfile = (filePath) => {
  if (LESSON_FILE_RE.test(filePath)) return "lesson"
  if (LIST_FILE_RE.test(filePath)) return "list"
  return null
}

const resolveAllowedProfiles = ({ explicitFiles, options }) => {
  if (options.allLessons && options.allLists) return new Set(["lesson", "list"])
  if (options.allLessons) return new Set(["lesson"])
  if (options.allLists) return new Set(["list"])
  if (explicitFiles.length > 0 || options.staged || options.changedRef) {
    return new Set(["lesson", "list"])
  }
  return new Set(["lesson"])
}

const formatProfileSummary = (profileCounts) => {
  const lessonCount = profileCounts.lesson || 0
  const listCount = profileCounts.list || 0
  const parts = []
  if (lessonCount > 0) parts.push(`lesson=${lessonCount}`)
  if (listCount > 0) parts.push(`list=${listCount}`)
  return parts.length > 0 ? parts.join(", ") : "none"
}

const checkFile = (filePath, profile) => {
  const source = fs.readFileSync(path.join(ROOT, filePath), "utf8")
  const issues = []
  pageRuleChecks(source, issues, profile)
  return uniqueSorted(issues)
}

const printHelp = () => {
  console.log(`Usage: node tools/check-page-parity.mjs [options] [page-file ...]

Options:
  --all-lessons           Check lesson-*/*.html files.
  --all-lists             Check list-*/*.html files.
  --staged                Check staged lesson/list files from git index.
  --changed <git-ref>     Check lesson/list files changed in <git-ref>...HEAD.
  --max-failures <n>      Max file-level failures to print (default: ${DEFAULT_MAX_FAILURES}).
  --verbose               Print every failing file.
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
    const allowedProfiles = resolveAllowedProfiles({ explicitFiles, options })
    const targets = uniqueSorted(
      candidates
        .map(normalizePath)
        .filter((file) => fs.existsSync(path.join(ROOT, file)))
        .filter((file) => {
          const profile = resolvePageProfile(file)
          return profile !== null && allowedProfiles.has(profile)
        })
    )

    const profileCounts = targets.reduce(
      (acc, filePath) => {
        const profile = resolvePageProfile(filePath)
        if (profile) {
          acc[profile] = (acc[profile] || 0) + 1
        }
        return acc
      },
      { lesson: 0, list: 0 }
    )
    const profileSummary = formatProfileSummary(profileCounts)

    if (targets.length === 0) {
      console.log("Page parity check: no supported page files to validate.")
      return
    }

    const failures = []
    const issueCounts = new Map()

    targets.forEach((filePath) => {
      const profile = resolvePageProfile(filePath) || "unknown"
      const issues = checkFile(filePath, profile)
      if (issues.length === 0) return
      failures.push({ filePath, profile, issues })
      issues.forEach((issue) => {
        issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1)
      })
    })

    if (failures.length === 0) {
      console.log(`Page parity check passed (${targets.length} file(s); ${profileSummary}).`)
      return
    }

    console.error(
      `Page parity check failed (${failures.length}/${targets.length} file(s) with issues; ${profileSummary}).`
    )
    const visibleFailures = options.verbose
      ? failures
      : failures.slice(0, Math.max(0, options.maxFailures))
    visibleFailures.forEach(({ filePath, profile, issues }) => {
      console.error(`- [${profile}] ${filePath} :: ${issues.join(", ")}`)
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
