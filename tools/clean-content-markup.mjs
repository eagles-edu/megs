#!/usr/bin/env node
/**
 * Bulk finder/cleaner for lesson/list/writing content markup noise.
 *
 * Scope:
 * - Operates inside article content root only:
 *   - preferred: div[itemprop='articleBody']
 *   - fallback: .item-page, then <body>.
 * - Can be limited to one heading section with --section <heading>.
 *
 * Section filter semantics (--section):
 * - Matching is normalized by lowercase + collapsed whitespace.
 * - Applies from the matched heading through the next heading of same/higher level.
 * - If not found in a file, that file is skipped.
 *
 * Cleanup directives:
 * - Remove unclassed/unattributed <span> wrappers.
 * - Remove empty classless spans.
 * - Warn on empty classed spans/blocks; do not delete them.
 * - Denoise standalone non-list wrapper blocks (<p>, <div>, <blockquote>).
 * - Flatten classless <p> directly inside <li> into inline content with <br>.
 *   - Only when meaningful content exists after </p> in the same <li>.
 *   - Skips complex list items and attributed <p>.
 * - Normalize bold tags to one style (<strong> default, or --bold-tag b).
 *
 * Flag table (effective defaults):
 * - --all-pages: true
 * - --pause-per-dir: true
 * - --write: true
 * - --section: ""
 * - --bold-tag: "strong"
 * - --skip-category: "exercises,root-main" when --all-pages is enabled
 *
 * Interactive preamble (when no flags are provided):
 * 1) Run on all pages?
 * 2) Target file/directory (if all-pages is no)
 * 3) Section heading filter (blank = none)
 * 4) Bold tag normalization (strong/b)
 * 5) Apply writes?
 * 6) Pause per directory?
 * 7) Use default skip categories (exercises,root-main)?
 * 8) Additional skip categories (comma/space-separated)
 *
 * Examples:
 *   node tools/clean-content-markup.mjs --target writing/3-subject-complement.html --dry-run
 *   node tools/clean-content-markup.mjs --target writing/3-subject-complement.html --section "Indirect object" --write
 *   node tools/clean-content-markup.mjs --all-pages --pause-per-dir --dry-run
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import readline from "node:readline"
import { fileURLToPath } from "node:url"
import { load } from "cheerio"
import { render } from "dom-serializer"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "..")
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6"
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
    "dev",
    "dist",
    "docs",
    "hts-cache",
    "images",
    "js",
    "media",
    "node_modules",
    "output",
    "persistence",
    "reports",
    "schemas",
    "server",
    "test",
    "tmp",
    "tools",
  ].sort()
)
const DISALLOWED_LI_CHILD_BLOCKS = new Set([
  "div",
  "ul",
  "ol",
  "table",
  "blockquote",
  "pre",
  "section",
  "article",
  "aside",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
])
const NONLIST_DENOISE_TAGS = new Set(["p", "div", "blockquote"])
const HTML_BOOLEAN_ATTRIBUTES = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "inert",
  "ismap",
  "itemscope",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "selected",
]
const BOOLEAN_ATTRIBUTE_PATTERNS = HTML_BOOLEAN_ATTRIBUTES.map((attribute) => {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\s(${escaped})\\s*=\\s*(?:""|''|"${escaped}"|'${escaped}'|${escaped})`, "gi")
})
const CATEGORY_ALIAS_ENTRIES = [
  ["exercise", "exercises"],
  ["exercises", "exercises"],
  ["lesson", "lessons"],
  ["lessons", "lessons"],
  ["list", "lists"],
  ["lists", "lists"],
  ["tense", "tenses"],
  ["tenses", "tenses"],
  ["writing", "writing"],
  ["vocab", "vocab"],
  ["vocabulary", "vocab"],
  ["glossary", "glossary"],
  ["root", "root-main"],
  ["main", "root-main"],
  ["root-main", "root-main"],
]
const CATEGORY_ALIASES = new Map(CATEGORY_ALIAS_ENTRIES)
const CANONICAL_SKIP_CATEGORIES = Array.from(
  new Set(CATEGORY_ALIAS_ENTRIES.map(([, canonical]) => canonical))
).sort()
const CANONICAL_SKIP_CATEGORY_SET = new Set(CANONICAL_SKIP_CATEGORIES)
const DEFAULT_SKIP_CATEGORIES = ["exercises", "root-main"]
const SKIP_CATEGORY_HELP = CANONICAL_SKIP_CATEGORIES.join("|")

function fail(message) {
  console.error(`clean-content-markup: ${message}`)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage:
  node tools/clean-content-markup.mjs [options]

Options:
  --target, -f <path>    File or directory to process (auto-disables --all-pages)
  --all-pages            Scan all repo HTML pages with content roots (default: enabled)
  --no-all-pages         Disable all-pages default
  --pause-per-dir        Pause before each new directory (default: enabled; TTY only)
  --no-pause-per-dir     Disable pause-per-directory
  --section <heading>    Match heading text (normalized); scope runs to next same/higher heading
  --bold-tag <strong|b>  Normalize bold tags (default: strong)
  --skip-category <name> Add skip categories (repeatable, comma list, or space list). Names: ${SKIP_CATEGORY_HELP}
  --no-default-skip-categories
                         Disable default category skips (exercises,root-main) for --all-pages
  --write, --apply       Enable writes (default: enabled)
  --dry-run              Disable writes
  (no flags)             Interactive global set-flag preamble with query prompts
  -h, --help             Show help

Interactive preamble queries (no flags):
  1. Run on all pages? (default: yes)
  2. Target file/directory [.] (only when #1 = no)
  3. Section heading filter (match heading text; applies only within that section; blank = none)
  4. Bold tag normalization (strong/b)
  5. Apply writes? (default: yes)
  6. Pause per directory? (default: yes)
  7. Use default skip categories? (default with all-pages: yes; exercises,root-main)
  8. Additional skip categories (comma/space list; optional)

Pause-per-directory commands:
  [Enter] continue
  q       quit run
  d       skip this directory
  n       skip next directory
  s       skip heading section filter for this directory
  c <cat> add skip categories for remainder of run (comma/space list)

Skip category quick guide:
  - all-pages default skips: exercises + root-main
  - keep defaults and skip lessons too:
      --all-pages --skip-category lessons
  - include exercises/root-main by default:
      --all-pages --no-default-skip-categories
`)
}

function parseArgs(argv) {
  const rawArgs = argv.slice(2)
  const args = {
    target: "",
    allPages: true,
    pausePerDir: true,
    section: "",
    boldTag: "strong",
    write: true,
    skipCategories: [],
    useDefaultSkipCategories: true,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    }
    if (arg === "--target" || arg === "-f") {
      args.target = rawArgs[++index] || ""
      args.allPages = false
      continue
    }
    if (arg === "--all-pages") {
      args.allPages = true
      continue
    }
    if (arg === "--no-all-pages") {
      args.allPages = false
      continue
    }
    if (arg === "--pause-per-dir") {
      args.pausePerDir = true
      continue
    }
    if (arg === "--no-pause-per-dir") {
      args.pausePerDir = false
      continue
    }
    if (arg === "--section") {
      args.section = rawArgs[++index] || ""
      continue
    }
    if (arg === "--bold-tag") {
      args.boldTag = (rawArgs[++index] || "").toLowerCase()
      continue
    }
    if (arg === "--skip-category") {
      const value = rawArgs[++index] || ""
      if (!value.trim()) fail("Missing value for --skip-category")
      const parsedCategories = splitCategoryTokens(value, { strict: true })
      if (parsedCategories.invalid.length) {
        fail(
          `Unknown skip categories: ${parsedCategories.invalid.join(", ")}. ` +
            `Allowed: ${CANONICAL_SKIP_CATEGORIES.join(", ")}`
        )
      }
      if (!parsedCategories.categories.length) {
        fail(`Missing value for --skip-category (allowed: ${CANONICAL_SKIP_CATEGORIES.join(", ")})`)
      }
      args.skipCategories.push(...parsedCategories.categories)
      continue
    }
    if (arg === "--no-default-skip-categories") {
      args.useDefaultSkipCategories = false
      continue
    }
    if (arg === "--write" || arg === "--apply") {
      args.write = true
      continue
    }
    if (arg === "--dry-run") {
      args.write = false
      continue
    }
    if (!arg.startsWith("-") && !args.target) {
      args.target = arg
      args.allPages = false
      continue
    }
    fail(`Unknown argument: ${arg}`)
  }

  return { args, noFlags: rawArgs.length === 0 }
}

function finalizeArgs(args) {
  if (args.allPages) {
    args.target = "."
  }
  if (!args.target) fail("Missing target path. Use --target <file-or-dir> or --all-pages.")
  if (args.boldTag !== "strong" && args.boldTag !== "b") {
    fail("--bold-tag must be one of: strong, b")
  }
  const activeCategories = new Set()
  if (args.allPages && args.useDefaultSkipCategories) {
    for (const category of DEFAULT_SKIP_CATEGORIES) activeCategories.add(category)
  }
  for (const category of args.skipCategories) {
    const normalizedCategory = normalizeCategoryToken(category)
    if (!normalizedCategory || !CANONICAL_SKIP_CATEGORY_SET.has(normalizedCategory)) {
      fail(`Unknown skip category: ${category}. Allowed: ${CANONICAL_SKIP_CATEGORIES.join(", ")}`)
    }
    activeCategories.add(normalizedCategory)
  }
  args.skipCategories = activeCategories
  return args
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase()
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/")
}

function normalizeCategoryToken(value) {
  const normalized = normalizeText(value).replace(/_/g, "-")
  if (!normalized) return ""
  return CATEGORY_ALIASES.get(normalized) || normalized
}

function splitCategoryTokens(value, { strict = false } = {}) {
  const categories = []
  const invalid = []
  const uniqueTokens = new Set()
  const tokens = String(value || "")
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const normalized = normalizeCategoryToken(token)
    if (!normalized) continue
    if (strict && !CANONICAL_SKIP_CATEGORY_SET.has(normalized)) {
      invalid.push(token)
      continue
    }
    uniqueTokens.add(normalized)
  }

  categories.push(...uniqueTokens)
  return { categories, invalid: Array.from(new Set(invalid)) }
}

function deriveCategoryFromToken(rawToken, fallback = "root-main") {
  const token = normalizeText(rawToken)
  if (!token) return fallback
  if (token.startsWith("exercise-") || token.includes("exercise")) return "exercises"
  if (token.startsWith("lesson-") || token.includes("lesson")) return "lessons"
  if (token.startsWith("list-") || token.startsWith("lists") || token === "list") return "lists"
  if (token.includes("tense")) return "tenses"
  if (token.startsWith("writing")) return "writing"
  if (token.startsWith("vocab") || token.startsWith("vocabulary")) return "vocab"
  if (token.startsWith("glossary")) return "glossary"
  return normalizeCategoryToken(token) || fallback
}

function deriveCategoryFromRelativePath(relativePath) {
  const normalized = normalizePath(relativePath)
  const parts = normalized.split("/").filter(Boolean)
  if (!parts.length) return "root-main"
  if (parts.length === 1) return deriveCategoryFromToken(parts[0], "root-main")
  return deriveCategoryFromToken(parts[0], parts[0])
}

function deriveCategoryFromRelativeDir(relativeDir) {
  const normalized = normalizePath(relativeDir)
  if (!normalized || normalized === ".") return "root-main"
  const root = normalized.split("/")[0] || normalized
  return deriveCategoryFromToken(root, root)
}

function findNextDirectory(targets, startIndex) {
  const currentDir =
    normalizePath(path.relative(repoRoot, path.dirname(targets[startIndex]))) || "."
  for (let index = startIndex + 1; index < targets.length; index += 1) {
    const candidateDir =
      normalizePath(path.relative(repoRoot, path.dirname(targets[index]))) || "."
    if (candidateDir !== currentDir) return candidateDir
  }
  return ""
}

function normalizeBooleanAttributeStyle(html) {
  return String(html || "").replace(/<[^>]+>/g, (tag) => {
    let normalizedTag = tag
    for (const pattern of BOOLEAN_ATTRIBUTE_PATTERNS) {
      normalizedTag = normalizedTag.replace(pattern, " $1")
    }
    return normalizedTag
  })
}

function stripTrailingWhitespace(text) {
  let trimmedLineCount = 0
  const normalized = String(text || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.replace(/[ \t]+$/g, "")
      if (trimmed !== line) trimmedLineCount += 1
      return trimmed
    })
    .join("\n")
  return { text: normalized, trimmedLineCount }
}

function buildOffsetLocator(text) {
  const input = String(text || "")
  const lineStarts = [0]
  for (let index = 0; index < input.length; index += 1) {
    if (input.charCodeAt(index) === 10) lineStarts.push(index + 1)
  }

  return (offset) => {
    if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0) return ""
    let low = 0
    let high = lineStarts.length - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (lineStarts[mid] <= offset) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    const lineIndex = Math.max(0, high)
    const line = lineIndex + 1
    const column = offset - lineStarts[lineIndex] + 1
    return `${line}:${column}`
  }
}

function resolveNodeStartOffset(node) {
  if (!node || typeof node !== "object") return null
  if (typeof node.startIndex === "number" && Number.isFinite(node.startIndex) && node.startIndex >= 0) {
    return node.startIndex
  }
  if (
    node.sourceCodeLocation &&
    typeof node.sourceCodeLocation.startOffset === "number" &&
    Number.isFinite(node.sourceCodeLocation.startOffset) &&
    node.sourceCodeLocation.startOffset >= 0
  ) {
    return node.sourceCodeLocation.startOffset
  }
  return null
}

function addWarningLocation(locations, node, locateOffset, maxLocations = 3) {
  if (!Array.isArray(locations) || typeof locateOffset !== "function") return
  if (locations.length >= maxLocations) return
  const offset = resolveNodeStartOffset(node)
  if (offset === null) return
  const lineColumn = locateOffset(offset)
  if (!lineColumn) return
  if (locations.includes(lineColumn)) return
  locations.push(lineColumn)
}

function isHtmlFile(filePath) {
  return /\.html?$/i.test(filePath) && !/\.bak-\d{8}-\d{6}$/i.test(filePath)
}

function collectHtmlFiles(dirPath, results) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath, results)
      continue
    }
    if (!entry.isFile()) continue
    if (!isHtmlFile(entry.name)) continue
    results.push(fullPath)
  }
}

function resolveTargets(targetInput) {
  const absolute = path.isAbsolute(targetInput)
    ? targetInput
    : path.resolve(repoRoot, targetInput)
  if (!fs.existsSync(absolute)) fail(`Target path does not exist: ${absolute}`)

  const stat = fs.statSync(absolute)
  if (stat.isFile()) {
    if (!isHtmlFile(absolute)) fail(`Target file is not an HTML file: ${absolute}`)
    return [absolute]
  }
  if (!stat.isDirectory()) fail(`Target is neither file nor directory: ${absolute}`)

  const results = []
  collectHtmlFiles(absolute, results)
  return results.sort((a, b) => a.localeCompare(b))
}

function isWhitespaceTextNode(node) {
  return node && node.type === "text" && !String(node.data || "").trim()
}

function hasAnyAttributes(node) {
  if (!node || !node.attribs) return false
  return Object.keys(node.attribs).length > 0
}

function getAttributeNames(node) {
  return node && node.attribs ? Object.keys(node.attribs) : []
}

function normalizeClassTokens(value) {
  return String(value || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .sort()
}

function isClassOnlyNode(node) {
  const names = getAttributeNames(node)
  return names.length === 1 && names[0] === "class"
}

function getMeaningfulContentNodes(nodes) {
  return (nodes || []).filter((node) => {
    if (!node || node.type === "comment") return false
    if (node.type === "text") return Boolean(String(node.data || "").trim())
    if (node.type !== "tag") return false
    const tag = String(node.name || "").toLowerCase()
    return tag !== "br"
  })
}

function normalizeInlinePunctuationSpacing(text) {
  return String(text || "")
    .replace(/(\S)\s+([,.;:!?])/g, "$1$2")
    .replace(/^\s+([,.;:!?])/g, "$1")
}

function renderListSegmentNode(node) {
  if (!node) return ""
  if (node.type === "text") {
    return normalizeInlinePunctuationSpacing(node.data || "")
  }
  return render(node, { decodeEntities: false })
}

function serializeListSegmentNodes(nodes) {
  return (nodes || []).map((node) => renderListSegmentNode(node)).join("")
}

function resolveContentRoot($) {
  const articleBody = $("div[itemprop='articleBody']").first()
  if (articleBody.length) return articleBody
  const itemPage = $(".item-page").first()
  if (itemPage.length) return itemPage
  return $("body").first()
}

function buildScopedRoot($, root, section) {
  if (!section) return { scope: root, wrapped: false }
  const normalizedSection = normalizeText(section)
  const heading = root
    .find(HEADING_SELECTOR)
    .filter((_, node) => normalizeText($(node).text()) === normalizedSection)
    .first()

  if (!heading.length) return null

  const start = heading.get(0)
  const startTag = String(start.name || "").toLowerCase()
  const startLevel = /^h[1-6]$/.test(startTag) ? Number(startTag.slice(1)) : 6

  const nodes = [start]
  let cursor = heading.next()
  while (cursor.length) {
    const current = cursor.get(0)
    const currentTag = String(current && current.name ? current.name : "").toLowerCase()
    if (/^h[1-6]$/.test(currentTag)) {
      const level = Number(currentTag.slice(1))
      if (level <= startLevel) break
    }
    nodes.push(current)
    cursor = cursor.next()
  }

  const wrapper = $("<div data-content-clean-scope=\"1\"></div>")
  heading.before(wrapper)
  nodes.forEach((node) => wrapper.append(node))
  return { scope: wrapper, wrapped: true }
}

function unwrapScopedRoot(scopeInfo) {
  if (!scopeInfo || !scopeInfo.wrapped) return
  const wrapper = scopeInfo.scope
  wrapper.before(wrapper.contents())
  wrapper.remove()
}

function normalizeBoldTags($, scope, boldTag, stats) {
  const fromTag = boldTag === "strong" ? "b" : "strong"
  const toTag = boldTag === "strong" ? "strong" : "b"

  scope.find(fromTag).each((_, node) => {
    if ($(node).closest("script, style, svg").length) return
    const replacement = $(`<${toTag}></${toTag}>`)
    Object.entries(node.attribs || {}).forEach(([name, value]) => replacement.attr(name, value))
    replacement.append($(node).contents())
    $(node).replaceWith(replacement)
    stats.boldTagNormalized += 1
  })
}

function flattenListItemParagraphs($, scope, stats) {
  scope.find("li").each((_, li) => {
    const directChildren = $(li).contents().toArray()
    const paragraphChildren = directChildren.filter(
      (node) => node.type === "tag" && String(node.name || "").toLowerCase() === "p"
    )
    if (!paragraphChildren.length) return

    const hasAttributedParagraph = paragraphChildren.some((node) => hasAnyAttributes(node))
    if (hasAttributedParagraph) {
      stats.skippedAttributedLiParagraphs += 1
      return
    }

    const unsafeStructure = directChildren.some((node) => {
      if (node.type !== "tag") return false
      const tag = String(node.name || "").toLowerCase()
      if (tag === "p" || tag === "br") return false
      return DISALLOWED_LI_CHILD_BLOCKS.has(tag)
    })
    if (unsafeStructure) {
      stats.skippedComplexLi += 1
      return
    }

    const meaningfulChildren = directChildren.filter(
      (node) => !isWhitespaceTextNode(node) && node.type !== "comment"
    )
    const meaningfulNonBreakChildren = meaningfulChildren.filter((node) => {
      if (node.type !== "tag") return true
      return String(node.name || "").toLowerCase() !== "br"
    })
    if (
      paragraphChildren.length === 1 &&
      meaningfulNonBreakChildren.length === 1 &&
      meaningfulNonBreakChildren[0] === paragraphChildren[0]
    ) {
      const onlyParagraph = paragraphChildren[0]
      const nextHtml = serializeListSegmentNodes($(onlyParagraph).contents().toArray()).trim()
      const currentHtml = ($(li).html() || "").trim()
      if (nextHtml && nextHtml !== currentHtml) {
        $(li).html(nextHtml)
        stats.liParagraphsFlattened += 1
      }
      return
    }

    const hasMeaningfulTrailingContentAfterParagraph = meaningfulChildren.some((node, index) => {
      const tag = node.type === "tag" ? String(node.name || "").toLowerCase() : ""
      if (tag !== "p") return false
      const trailingNodes = meaningfulChildren.slice(index + 1)
      return trailingNodes.some((trailingNode) => {
        if (trailingNode.type === "text") return Boolean(String(trailingNode.data || "").trim())
        if (trailingNode.type !== "tag") return false
        const trailingTag = String(trailingNode.name || "").toLowerCase()
        if (trailingTag === "br") return false
        return Boolean($(trailingNode).text().trim())
      })
    })

    if (!hasMeaningfulTrailingContentAfterParagraph) {
      stats.skippedNoTrailingContentAfterParagraph += 1
      return
    }

    const segments = []
    let current = []

    const pushCurrent = () => {
      if (!current.length) return
      const html = current.join("").trim()
      if (html) segments.push(html)
      current = []
    }

    directChildren.forEach((node) => {
      if (isWhitespaceTextNode(node) || node.type === "comment") return
      if (node.type === "tag") {
        const tag = String(node.name || "").toLowerCase()
        if (tag === "br") {
          pushCurrent()
          return
        }
        if (tag === "p") {
          pushCurrent()
          const inner = serializeListSegmentNodes($(node).contents().toArray()).trim()
          if (inner) segments.push(inner)
          return
        }
      }
      current.push(renderListSegmentNode(node))
    })
    pushCurrent()

    const nextHtml = segments.join("\n<br>\n")
    const currentHtml = ($(li).html() || "").trim()
    if (nextHtml === currentHtml) return
    $(li).html(nextHtml)
    stats.liParagraphsFlattened += 1
  })
}

function cleanupSpanNoise($, scope, stats, locateOffset) {
  let changed = true
  const warnedEmptyClassedSpans = new Set()
  while (changed) {
    changed = false
    const spans = scope.find("span").toArray().reverse()
    for (const span of spans) {
      const $span = $(span)
      if ($span.closest("script, style, svg").length) continue

      const contents = $span.contents().toArray()
      const meaningful = getMeaningfulContentNodes(contents).length > 0
      const hasClassAttribute = getAttributeNames(span).includes("class")
      if (!meaningful && hasClassAttribute) {
        if (!warnedEmptyClassedSpans.has(span)) {
          warnedEmptyClassedSpans.add(span)
          stats.emptyClassedSpanWarnings += 1
          addWarningLocation(stats.emptyClassedSpanWarningLocations, span, locateOffset)
        }
        continue
      }

      if (isClassOnlyNode(span) && normalizeClassTokens($span.attr("class")).length === 0) {
        $span.removeAttr("class")
      }

      const attrs = getAttributeNames(span)
      const hasAttrs = attrs.length > 0
      const classOnly = isClassOnlyNode(span)

      if (!meaningful && !hasAttrs) {
        $span.remove()
        stats.emptySpansRemoved += 1
        changed = true
        continue
      }

      if (classOnly) {
        const parent = $span.parent()
        if (parent.length && String(parent.get(0).name || "").toLowerCase() === "span" && isClassOnlyNode(parent.get(0))) {
          const ownClasses = normalizeClassTokens($span.attr("class"))
          const parentClasses = normalizeClassTokens(parent.attr("class"))
          if (
            ownClasses.length &&
            parentClasses.length &&
            ownClasses.length === parentClasses.length &&
            ownClasses.every((token, index) => token === parentClasses[index])
          ) {
            $span.replaceWith($span.contents())
            stats.classedSpansUnwrapped += 1
            changed = true
            continue
          }
        }
      }

      if (hasAttrs) continue
      $span.replaceWith($span.contents())
      stats.unclassedSpansUnwrapped += 1
      changed = true
    }
  }
}

function denoiseStandaloneBlocks($, scope, stats, locateOffset) {
  let changed = true
  const warnedEmptyClassedBlocks = new Set()
  while (changed) {
    changed = false
    const nodes = scope.find("p, div, blockquote").toArray().reverse()
    for (const node of nodes) {
      if (!node || node.type !== "tag") continue
      const tag = String(node.name || "").toLowerCase()
      if (!NONLIST_DENOISE_TAGS.has(tag)) continue
      if ($(node).closest("li, script, style, svg").length) continue

      const $node = $(node)
      const contents = $node.contents().toArray()
      const meaningful = getMeaningfulContentNodes(contents)
      const hasClassAttribute = getAttributeNames(node).includes("class")

      if (!meaningful.length && hasClassAttribute) {
        if (!warnedEmptyClassedBlocks.has(node)) {
          warnedEmptyClassedBlocks.add(node)
          stats.emptyClassedBlockWarnings += 1
          addWarningLocation(stats.emptyClassedBlockWarningLocations, node, locateOffset)
        }
        continue
      }
      if (hasAnyAttributes(node)) continue

      if (!meaningful.length) {
        $node.remove()
        stats.emptyBlocksRemoved += 1
        changed = true
        continue
      }

      if (tag === "div" || tag === "blockquote") {
        const hasTextMeaningful = meaningful.some((part) => part.type === "text")
        const tagChildren = meaningful.filter((part) => part.type === "tag")
        if (!hasTextMeaningful && tagChildren.length === 1) {
          const child = tagChildren[0]
          const childTag = String(child.name || "").toLowerCase()
          if (NONLIST_DENOISE_TAGS.has(childTag) && !hasAnyAttributes(child)) {
            $node.replaceWith($node.contents())
            stats.blockWrappersUnwrapped += 1
            changed = true
            continue
          }
        }
      }
    }
  }
}

function processFile(filePath, options) {
  const input = fs.readFileSync(filePath, "utf8")
  const $ = load(input, { decodeEntities: false, withStartIndices: true, sourceCodeLocationInfo: true })
  const locateOffset = buildOffsetLocator(input)
  const root = resolveContentRoot($)
  if (!root.length) {
    return { filePath, changed: false, skipped: true, reason: "no-content-root" }
  }

  const scopeInfo = buildScopedRoot($, root, options.section)
  if (!scopeInfo) {
    return { filePath, changed: false, skipped: true, reason: "section-not-found" }
  }

  const stats = {
    liParagraphsFlattened: 0,
    skippedComplexLi: 0,
    skippedAttributedLiParagraphs: 0,
    skippedNoTrailingContentAfterParagraph: 0,
    boldTagNormalized: 0,
    unclassedSpansUnwrapped: 0,
    emptySpansRemoved: 0,
    classedSpansUnwrapped: 0,
    emptyClassedSpanWarnings: 0,
    emptyClassedSpanWarningLocations: [],
    emptyBlocksRemoved: 0,
    emptyClassedBlockWarnings: 0,
    emptyClassedBlockWarningLocations: [],
    blockWrappersUnwrapped: 0,
    trailingWhitespaceTrimmedLines: 0,
  }

  flattenListItemParagraphs($, scopeInfo.scope, stats)
  denoiseStandaloneBlocks($, scopeInfo.scope, stats, locateOffset)
  normalizeBoldTags($, scopeInfo.scope, options.boldTag, stats)
  cleanupSpanNoise($, scopeInfo.scope, stats, locateOffset)
  unwrapScopedRoot(scopeInfo)

  const editCount =
    stats.liParagraphsFlattened +
    stats.boldTagNormalized +
    stats.unclassedSpansUnwrapped +
    stats.emptySpansRemoved +
    stats.classedSpansUnwrapped +
    stats.emptyBlocksRemoved +
    stats.blockWrappersUnwrapped
  const changed = editCount > 0
  const output =
    changed
      ? (() => {
          const normalized = normalizeBooleanAttributeStyle($.html())
          const stripped = stripTrailingWhitespace(normalized)
          stats.trailingWhitespaceTrimmedLines = stripped.trimmedLineCount
          return stripped.text
        })()
      : input

  if (changed && options.write) {
    fs.writeFileSync(filePath, output)
  }

  return {
    filePath,
    changed,
    written: changed && options.write,
    skipped: false,
    reason: "",
    stats,
  }
}

function formatWarningLocationValue(locations, totalCount) {
  if (!Array.isArray(locations) || !locations.length) return "(unavailable)"
  const extra = Math.max(0, totalCount - locations.length)
  const base = locations.join(", ")
  return extra > 0 ? `${base} (+${extra} more)` : base
}

function getStatsRows(stats) {
  const rows = [
    ["li<p>", stats.liParagraphsFlattened],
    ["li-skipped-complex", stats.skippedComplexLi],
    ["li-skipped-attrib-p", stats.skippedAttributedLiParagraphs],
    ["li-skipped-no-trailing-text", stats.skippedNoTrailingContentAfterParagraph],
    ["bold", stats.boldTagNormalized],
    ["span-unwrapped", stats.unclassedSpansUnwrapped],
    ["span-empty-removed", stats.emptySpansRemoved],
    ["span-class-unwrapped", stats.classedSpansUnwrapped],
    ["span-empty-class-warn", stats.emptyClassedSpanWarnings],
    ["block-empty-removed", stats.emptyBlocksRemoved],
    ["block-empty-class-warn", stats.emptyClassedBlockWarnings],
    ["block-wrapper-unwrapped", stats.blockWrappersUnwrapped],
    ["trailing-ws-trimmed-lines", stats.trailingWhitespaceTrimmedLines],
  ]
  if (stats.emptyClassedSpanWarnings > 0) {
    rows.push([
      "span-empty-class-at",
      formatWarningLocationValue(
        stats.emptyClassedSpanWarningLocations,
        stats.emptyClassedSpanWarnings
      ),
    ])
  }
  if (stats.emptyClassedBlockWarnings > 0) {
    rows.push([
      "block-empty-class-at",
      formatWarningLocationValue(
        stats.emptyClassedBlockWarningLocations,
        stats.emptyClassedBlockWarnings
      ),
    ])
  }
  return rows
}

function getWarningTotal(stats) {
  return stats.emptyClassedSpanWarnings + stats.emptyClassedBlockWarnings
}

function getPrimaryWarningLocation(stats) {
  return (
    stats.emptyClassedSpanWarningLocations[0] ||
    stats.emptyClassedBlockWarningLocations[0] ||
    ""
  )
}

function formatColumnRows(rows) {
  const labelWidth = rows.reduce((max, [label]) => Math.max(max, label.length), 0)
  const numericWidth = rows.reduce(
    (max, [, value]) => (typeof value === "number" ? Math.max(max, String(value).length) : max),
    0
  )

  return rows
    .map(([label, value]) => {
      const renderedValue =
        typeof value === "number" && numericWidth > 0 ? String(value).padStart(numericWidth) : String(value)
      return `  ${label.padEnd(labelWidth)}  ${renderedValue}`
    })
    .join("\n")
}

function formatStatsColumns(stats) {
  return formatColumnRows(getStatsRows(stats))
}

function createPrompter(enabled) {
  if (!enabled || !process.stdin.isTTY || !process.stdout.isTTY) return null
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (question) =>
    new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer))
    })
  return { ask, close: () => rl.close() }
}

function normalizeYesNo(value) {
  const token = String(value || "").trim().toLowerCase()
  if (!token) return null
  if (["y", "yes", "true", "1"].includes(token)) return true
  if (["n", "no", "false", "0"].includes(token)) return false
  return null
}

async function askYesNo(ask, prompt, defaultValue) {
  const suffix = defaultValue ? "Y/n" : "y/N"
  for (;;) {
    const answer = await ask(`${prompt} (${suffix}): `)
    const normalized = normalizeYesNo(answer)
    if (normalized === null) {
      if (!String(answer || "").trim()) return defaultValue
      console.log("Please answer y or n.")
      continue
    }
    return normalized
  }
}

async function askText(ask, prompt, defaultValue = "") {
  const answer = String(await ask(prompt)).trim()
  if (!answer) return defaultValue
  return answer
}

async function askChoice(ask, prompt, options, defaultValue) {
  const allowed = new Set(options)
  for (;;) {
    const answer = String(await ask(`${prompt} (${options.join("/")}, default: ${defaultValue}): `))
      .trim()
      .toLowerCase()
    if (!answer) return defaultValue
    if (allowed.has(answer)) return answer
    console.log(`Please choose one of: ${options.join(", ")}`)
  }
}

async function askSkipCategories(ask, prompt) {
  for (;;) {
    const response = await askText(ask, prompt, "")
    if (!response) return []
    const parsedCategories = splitCategoryTokens(response, { strict: true })
    if (parsedCategories.invalid.length) {
      console.log(
        `Unknown skip categories: ${parsedCategories.invalid.join(", ")}. ` +
          `Allowed: ${CANONICAL_SKIP_CATEGORIES.join(", ")}`
      )
      continue
    }
    return parsedCategories.categories
  }
}

async function runPreambleFromNoFlags(baseArgs) {
  const prompter = createPrompter(true)
  if (!prompter) {
    fail("No flags provided and no TTY available for preamble. Provide flags or run in an interactive terminal.")
  }
  const { ask, close } = prompter
  try {
    console.log("No CLI flags provided. Starting global set-flag preamble.\n")

    const useAllPages = await askYesNo(ask, "Run on all pages", baseArgs.allPages)
    baseArgs.allPages = useAllPages
    baseArgs.target = useAllPages ? "." : await askText(ask, "Target file/directory [.] ", ".")

    baseArgs.section = await askText(
      ask,
      "Section heading filter (match heading text; scope ends at next same/higher heading; blank = none): ",
      ""
    )
    baseArgs.boldTag = await askChoice(ask, "Bold tag normalization", ["strong", "b"], "strong")
    baseArgs.write = await askYesNo(ask, "Apply writes", baseArgs.write)
    baseArgs.pausePerDir = await askYesNo(ask, "Pause per directory", baseArgs.pausePerDir)
    if (baseArgs.allPages) {
      baseArgs.useDefaultSkipCategories = await askYesNo(
        ask,
        `Use default skip categories for all-pages runs (${DEFAULT_SKIP_CATEGORIES.join(",")})`,
        true
      )
    } else {
      baseArgs.useDefaultSkipCategories = false
    }
    baseArgs.skipCategories = await askSkipCategories(
      ask,
      `Additional skip categories (comma/space list: ${SKIP_CATEGORY_HELP}; blank = none): `
    )

    console.log("\nPreamble selection:")
    console.log(`  target: ${baseArgs.target}`)
    console.log(`  all-pages: ${baseArgs.allPages}`)
    console.log(`  section: ${baseArgs.section || "(none)"}`)
    console.log(`  bold-tag: ${baseArgs.boldTag}`)
    console.log(`  write: ${baseArgs.write}`)
    console.log(`  pause-per-dir: ${baseArgs.pausePerDir}\n`)
    console.log(`  default-skip-categories: ${baseArgs.useDefaultSkipCategories}`)
    console.log(`  additional-skip-categories: ${baseArgs.skipCategories.join(",") || "(none)"}\n`)
    return baseArgs
  } finally {
    close()
  }
}

async function resolveOptions(argv) {
  const parsed = parseArgs(argv)
  let args = parsed.args
  if (parsed.noFlags) {
    args = await runPreambleFromNoFlags(args)
  }
  return finalizeArgs(args)
}

async function main() {
  const options = await resolveOptions(process.argv)
  const targets = resolveTargets(options.target)
  if (!targets.length) {
    console.log("No HTML files found for target.")
    return
  }

  const prompter = createPrompter(options.pausePerDir)
  let warnedNonInteractivePause = false
  let lastDir = ""
  let stopRequested = false
  let skipNextDirectory = false
  let processedCount = 0
  let changedCount = 0
  let writtenCount = 0
  let skippedCount = 0
  let warningCount = 0
  let skippedByDirCount = 0
  let skippedByCategoryCount = 0
  const skippedDirectories = new Set()
  const sectionBypassDirectories = new Set()
  const runtimeSkipCategories = new Set(options.skipCategories)

  if (runtimeSkipCategories.size) {
    console.log(`[config] active skip categories: ${Array.from(runtimeSkipCategories).sort().join(", ")}`)
  }

  for (let index = 0; index < targets.length; index += 1) {
    const absolutePath = targets[index]
    const relativePath = normalizePath(path.relative(repoRoot, absolutePath))
    const relativeDir = normalizePath(path.relative(repoRoot, path.dirname(absolutePath))) || "."
    if (options.pausePerDir && relativeDir !== lastDir) {
      if (skipNextDirectory) {
        skippedDirectories.add(relativeDir)
        skipNextDirectory = false
        console.log(`[skip-dir-next] ${relativeDir}: skipped by previous directory command`)
      }

      if (!prompter) {
        if (!warnedNonInteractivePause) {
          console.log("[pause-per-dir] TTY not available; continuing without pauses.")
          warnedNonInteractivePause = true
        }
      } else if (!skippedDirectories.has(relativeDir)) {
        const currentCategory = deriveCategoryFromRelativeDir(relativeDir)
        const nextDir = findNextDirectory(targets, index) || "(end)"
        for (;;) {
          const skipCategoryText = runtimeSkipCategories.size
            ? Array.from(runtimeSkipCategories).sort().join(", ")
            : "(none)"
          const answer = String(
            await prompter.ask(
              `\nDirectory: ${relativeDir} (category: ${currentCategory})\n` +
                `Next directory: ${nextDir}\n` +
                `Skip categories: ${skipCategoryText}\n` +
                "Command [Enter=continue, q=quit, d=skip dir, n=skip next dir, s=skip section, c <cat...>=add skip categories]: "
            )
          )
            .trim()
            .toLowerCase()

          if (!answer) break
          if (answer === "q") {
            stopRequested = true
            break
          }
          if (answer === "d") {
            skippedDirectories.add(relativeDir)
            console.log(`[skip-dir] ${relativeDir}: directory skipped`)
            break
          }
          if (answer === "n") {
            skipNextDirectory = true
            console.log("[set] next directory will be skipped")
            continue
          }
          if (answer === "s") {
            if (!options.section) {
              console.log("[note] no section heading filter is active; nothing to bypass")
              continue
            }
            sectionBypassDirectories.add(relativeDir)
            console.log(`[set] section filter bypass enabled for directory: ${relativeDir}`)
            break
          }
          if (answer === "c" || answer.startsWith("c ")) {
            let categoryInput = answer.slice(1).trim()
            if (!categoryInput) {
              categoryInput = await prompter.ask(
                `Category to skip (${SKIP_CATEGORY_HELP}; comma/space list): `
              )
            }
            const parsedCategories = splitCategoryTokens(categoryInput, { strict: true })
            if (parsedCategories.invalid.length) {
              console.log(
                `Unknown skip categories: ${parsedCategories.invalid.join(", ")}. ` +
                  `Allowed: ${CANONICAL_SKIP_CATEGORIES.join(", ")}`
              )
              continue
            }
            if (!parsedCategories.categories.length) {
              console.log(`Please provide a category (${SKIP_CATEGORY_HELP}).`)
              continue
            }
            const added = []
            const alreadyPresent = []
            for (const category of parsedCategories.categories) {
              if (runtimeSkipCategories.has(category)) {
                alreadyPresent.push(category)
                continue
              }
              runtimeSkipCategories.add(category)
              added.push(category)
            }
            if (added.length) {
              console.log(`[set] categories added to skip list: ${added.sort().join(", ")}`)
            }
            if (alreadyPresent.length) {
              console.log(`[note] categories already in skip list: ${alreadyPresent.sort().join(", ")}`)
            }
            continue
          }

          console.log("Unknown command. Use Enter, q, d, n, s, or c <cat...>.")
        }
      }

      if (stopRequested) {
        console.log("Stopped by user.")
        break
      }

      if (skippedDirectories.has(relativeDir)) {
        lastDir = relativeDir
      } else {
        if (stopRequested) {
          break
        }
        lastDir = relativeDir
      }
    }

    const category = deriveCategoryFromRelativePath(relativePath)
    if (skippedDirectories.has(relativeDir)) {
      processedCount += 1
      skippedCount += 1
      skippedByDirCount += 1
      console.log(`[skip] ${relativePath}: directory "${relativeDir}" skipped`)
      continue
    }
    if (runtimeSkipCategories.has(category)) {
      processedCount += 1
      skippedCount += 1
      skippedByCategoryCount += 1
      console.log(`[skip] ${relativePath}: category "${category}" skipped`)
      continue
    }

    const effectiveOptions =
      options.section && sectionBypassDirectories.has(relativeDir)
        ? {
            ...options,
            section: "",
          }
        : options

    const result = processFile(absolutePath, effectiveOptions)
    processedCount += 1

    if (result.skipped) {
      skippedCount += 1
      if (result.reason === "section-not-found") {
        console.log(`[skip] ${relativePath}: section "${options.section}" not found`)
      } else {
        console.log(`[skip] ${relativePath}: ${result.reason}`)
      }
      continue
    }

    if (result.changed) {
      changedCount += 1
      if (result.written) writtenCount += 1
      warningCount += getWarningTotal(result.stats)
      const mode = result.written ? "write" : "dry-run"
      const warningLocation = getPrimaryWarningLocation(result.stats)
      const warningLocationSuffix = warningLocation ? `:${warningLocation}` : ""
      console.log(`[${mode}] ${relativePath}${warningLocationSuffix}`)
      console.log(formatStatsColumns(result.stats))
      continue
    }

    if (getWarningTotal(result.stats) > 0) {
      warningCount += getWarningTotal(result.stats)
      const warningRows = []
      if (result.stats.emptyClassedSpanWarnings > 0) {
        warningRows.push(["span-empty-class-warn", result.stats.emptyClassedSpanWarnings])
      }
      if (result.stats.emptyClassedBlockWarnings > 0) {
        warningRows.push(["block-empty-class-warn", result.stats.emptyClassedBlockWarnings])
      }
      if (result.stats.emptyClassedSpanWarnings > 0) {
        warningRows.push([
          "span-empty-class-at",
          formatWarningLocationValue(
            result.stats.emptyClassedSpanWarningLocations,
            result.stats.emptyClassedSpanWarnings
          ),
        ])
      }
      if (result.stats.emptyClassedBlockWarnings > 0) {
        warningRows.push([
          "block-empty-class-at",
          formatWarningLocationValue(
            result.stats.emptyClassedBlockWarningLocations,
            result.stats.emptyClassedBlockWarnings
          ),
        ])
      }
      warningRows.push(["note", "classed empty nodes kept"])
      const warningLocation = getPrimaryWarningLocation(result.stats)
      const warningLocationSuffix = warningLocation ? `:${warningLocation}` : ""
      console.log(`[warn] ${relativePath}${warningLocationSuffix}`)
      console.log(formatColumnRows(warningRows))
      continue
    }

    if (targets.length === 1) {
      console.log(`[ok] ${relativePath}: no changes needed`)
    }
  }

  if (prompter) prompter.close()

  const modeText = options.write ? "applied" : "would change"
  console.log(
    `\nSummary: scanned ${processedCount}/${targets.length} file(s), ` +
      `${changedCount} ${modeText}, ${writtenCount} written, ${skippedCount} skipped, ` +
      `${warningCount} warnings, ${skippedByDirCount} dir-skipped files, ${skippedByCategoryCount} category-skipped files, ` +
      `${sectionBypassDirectories.size} section-bypass directories.`
  )
}

main().catch((error) => {
  console.error(`clean-content-markup: ${error.message}`)
  process.exitCode = 1
})
