#!/usr/bin/env node
/**
 * Bulk finder/cleaner for lesson/list/writing content markup noise.
 *
 * Directives enforced in scope:
 * - Remove unclassed/unattributed <span> wrappers.
 * - Remove empty span noise (classless and class-only spans).
 * - Denoise standalone non-list wrapper blocks (<p>, <div>, <blockquote>).
 * - Flatten classless <p> directly inside <li> into inline content separated by <br>.
 * - Normalize bold tags to one style (<strong> by default).
 *
 * Defaults to dry-run. Use --write to apply.
 *
 * Examples:
 *   node tools/clean-content-markup.mjs --target writing/3-subject-complement.html
 *   node tools/clean-content-markup.mjs --target writing/3-subject-complement.html --section "Indirect object" --write
 *   node tools/clean-content-markup.mjs --target writing --write
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

function fail(message) {
  console.error(`clean-content-markup: ${message}`)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage:
  node tools/clean-content-markup.mjs --target <file-or-dir> [options]

Options:
  --target, -f <path>    File or directory to process (required)
  --all-pages            Scan all repo HTML pages with content roots
  --no-all-pages         Disable all-pages default
  --pause-per-dir        Pause before processing each directory (TTY only)
  --no-pause-per-dir     Disable pause-per-directory
  (no flags)             Interactive preamble to set global flags
  --section <heading>    Limit to one heading section per file (exact text match)
  --bold-tag <strong|b>  Choose normalized bold tag (default: strong)
  --write, --apply       Write changes in place (default: enabled)
  --dry-run              Disable writes
  -h, --help             Show help
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
  return args
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase()
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/")
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
          const inner = ($(node).html() || "").trim()
          if (inner) segments.push(inner)
          return
        }
      }
      current.push(render(node, { decodeEntities: false }))
    })
    pushCurrent()

    const nextHtml = segments.join("\n<br>\n")
    const currentHtml = ($(li).html() || "").trim()
    if (nextHtml === currentHtml) return
    $(li).html(nextHtml)
    stats.liParagraphsFlattened += 1
  })
}

function cleanupSpanNoise($, scope, stats) {
  let changed = true
  while (changed) {
    changed = false
    const spans = scope.find("span").toArray().reverse()
    for (const span of spans) {
      const $span = $(span)
      if ($span.closest("script, style, svg").length) continue

      if (isClassOnlyNode(span) && normalizeClassTokens($span.attr("class")).length === 0) {
        $span.removeAttr("class")
      }

      const attrs = getAttributeNames(span)
      const hasAttrs = attrs.length > 0
      const classOnly = isClassOnlyNode(span)
      const contents = $span.contents().toArray()
      const meaningful = getMeaningfulContentNodes(contents).length > 0

      if (!meaningful && !hasAttrs) {
        $span.remove()
        stats.emptySpansRemoved += 1
        changed = true
        continue
      }

      if (!meaningful && classOnly) {
        $span.remove()
        stats.emptyClassedSpansRemoved += 1
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

function denoiseStandaloneBlocks($, scope, stats) {
  let changed = true
  while (changed) {
    changed = false
    const nodes = scope.find("p, div, blockquote").toArray().reverse()
    for (const node of nodes) {
      if (!node || node.type !== "tag") continue
      const tag = String(node.name || "").toLowerCase()
      if (!NONLIST_DENOISE_TAGS.has(tag)) continue
      if ($(node).closest("li, script, style, svg").length) continue
      if (hasAnyAttributes(node)) continue

      const $node = $(node)
      const contents = $node.contents().toArray()
      const meaningful = getMeaningfulContentNodes(contents)

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
  const $ = load(input, { decodeEntities: false })
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
    emptyClassedSpansRemoved: 0,
    emptyBlocksRemoved: 0,
    blockWrappersUnwrapped: 0,
  }

  flattenListItemParagraphs($, scopeInfo.scope, stats)
  denoiseStandaloneBlocks($, scopeInfo.scope, stats)
  normalizeBoldTags($, scopeInfo.scope, options.boldTag, stats)
  cleanupSpanNoise($, scopeInfo.scope, stats)
  unwrapScopedRoot(scopeInfo)

  const editCount =
    stats.liParagraphsFlattened +
    stats.boldTagNormalized +
    stats.unclassedSpansUnwrapped +
    stats.emptySpansRemoved +
    stats.classedSpansUnwrapped +
    stats.emptyClassedSpansRemoved +
    stats.emptyBlocksRemoved +
    stats.blockWrappersUnwrapped
  const changed = editCount > 0
  const output = changed ? $.html() : input

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

function formatStats(stats) {
  return [
    `li<p>:${stats.liParagraphsFlattened}`,
    `li-skipped-complex:${stats.skippedComplexLi}`,
    `li-skipped-attrib-p:${stats.skippedAttributedLiParagraphs}`,
    `li-skipped-no-trailing-text:${stats.skippedNoTrailingContentAfterParagraph}`,
    `bold:${stats.boldTagNormalized}`,
    `span-unwrapped:${stats.unclassedSpansUnwrapped}`,
    `span-empty-removed:${stats.emptySpansRemoved}`,
    `span-class-unwrapped:${stats.classedSpansUnwrapped}`,
    `span-empty-class-removed:${stats.emptyClassedSpansRemoved}`,
    `block-empty-removed:${stats.emptyBlocksRemoved}`,
    `block-wrapper-unwrapped:${stats.blockWrappersUnwrapped}`,
  ].join(", ")
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

    baseArgs.section = await askText(ask, "Section heading filter (blank = none): ", "")
    baseArgs.boldTag = await askChoice(ask, "Bold tag normalization", ["strong", "b"], "strong")
    baseArgs.write = await askYesNo(ask, "Apply writes", baseArgs.write)
    baseArgs.pausePerDir = await askYesNo(ask, "Pause per directory", baseArgs.pausePerDir)

    console.log("\nPreamble selection:")
    console.log(`  target: ${baseArgs.target}`)
    console.log(`  all-pages: ${baseArgs.allPages}`)
    console.log(`  section: ${baseArgs.section || "(none)"}`)
    console.log(`  bold-tag: ${baseArgs.boldTag}`)
    console.log(`  write: ${baseArgs.write}`)
    console.log(`  pause-per-dir: ${baseArgs.pausePerDir}\n`)
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
  let processedCount = 0
  let changedCount = 0
  let writtenCount = 0
  let skippedCount = 0

  for (const absolutePath of targets) {
    const relativeDir = normalizePath(path.relative(repoRoot, path.dirname(absolutePath))) || "."
    if (options.pausePerDir && relativeDir !== lastDir) {
      if (!prompter) {
        if (!warnedNonInteractivePause) {
          console.log("[pause-per-dir] TTY not available; continuing without pauses.")
          warnedNonInteractivePause = true
        }
      } else {
        const answer = String(
          await prompter.ask(`\nDirectory: ${relativeDir}\nPress Enter to continue (Q to quit): `)
        )
          .trim()
          .toLowerCase()
        if (answer === "q") {
          console.log("Stopped by user.")
          break
        }
      }
      lastDir = relativeDir
    }

    const result = processFile(absolutePath, options)
    processedCount += 1
    const relativePath = normalizePath(path.relative(repoRoot, absolutePath))

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
      const mode = result.written ? "write" : "dry-run"
      console.log(`[${mode}] ${relativePath}: ${formatStats(result.stats)}`)
      continue
    }

    if (targets.length === 1) {
      console.log(`[ok] ${relativePath}: no changes needed`)
    }
  }

  if (prompter) prompter.close()

  const modeText = options.write ? "applied" : "would change"
  console.log(
    `\nSummary: scanned ${processedCount}/${targets.length} file(s), ${changedCount} ${modeText}, ${writtenCount} written, ${skippedCount} skipped.`
  )
}

main().catch((error) => {
  console.error(`clean-content-markup: ${error.message}`)
  process.exitCode = 1
})
