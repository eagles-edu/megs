#!/usr/bin/env node
/**
 * Normalize legacy exercise instructions into the preferred `.exinstruct` format.
 *
 * Behavior:
 * - Targets `exercise-*` HTML files only (file or directory).
 * - Skips files that already contain `.exinstruct`.
 * - Collects the `<p>` instruction block(s) immediately before `.exercise-form`
 *   or `.nn_sliders`, then rebuilds them into `.exinstruct`.
 * - Detects a word bank inside `<strong>`/`<b>` text or an inline comma-separated
 *   list of vocabulary (>= 3 items); converts commas/semicolons and `&nbsp;`
 *   to a ` &nbsp;` (space+nbsp) separated list inside
 *   `<div class="blockdiv"><blockquote class="blockwrap">…</blockquote></div>`.
 * - Replaces any sentence that matches at least 3 of: check*, click*, answer*,
 *   question* with "Click the question to check your answer."
 * - If no positive match is found, lists partial matches (1-2 keywords) and
 *   prompts to replace one, skip, or quit (TTY only).
 * - When no word bank is found, merges multiple `<p>` instructions into a
 *   single `<p>` inside `.exinstruct`.
 *
 * Usage:
 *   node tools/normalize-exinstruct.mjs --target <file-or-dir> [options]
 *
 * Flags:
 *   --target, -f   File or directory. If a directory, scans
 *                 `exercise-*` directories for `*.html`.
 *   --write, --apply  Write changes in place (default: dry-run).
 *   --dry-run      Force dry-run (no writes).
 *   --no-prompt    Skip interactive prompts/pauses.
 *   --help         Show help.
 *
 * Examples:
 *   node tools/normalize-exinstruct.mjs --target exercise-6-prepositions/615-prepositions-basic-iii.html --dry-run
 *   node tools/normalize-exinstruct.mjs --target exercise-6-prepositions --write
 *   node tools/normalize-exinstruct.mjs --target . --no-prompt --dry-run
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

const DEFAULTS = {
  write: false,
}

const INLINE_LIST_MIN_ITEMS = 3
const STRONG_LIST_MIN_ITEMS = 2
const POSITIVE_MATCH_THRESHOLD = 3
const WORD_BANK_PLACEHOLDER = "___EXINSTRUCT_WORD_BANK___"
const REPLACEMENT_TEXT = "Click the question to check your answer."
const KEYWORD_PATTERNS = [
  /\bcheck\w*\b/i,
  /\bclick\w*\b/i,
  /\banswer\w*\b/i,
  /\bquestion\w*\b/i,
]
const AUTO_SENTENCE_NORMALIZATIONS = [
  {
    sentence: "Click the sentences to see the answers.",
    replacement: "Click the sentence to check your answers.",
  },
]
const PAUSE_PROMPT =
  "\n\nPAUSE, DISPLAY SUMMARY, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS."

function fail(message) {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage:
  node tools/normalize-exinstruct.mjs --target <path> [options]

Options:
  --target, -f    File or directory (directory scans exercise-*/**/*.html)
  --write, --apply  Write changes in place (default dry-run)
  --dry-run       Force dry-run (no writes)
  --no-prompt     Skip interactive prompts/pauses
  --help          Show help
`)
}

function createPrompter(enabled) {
  if (!enabled || !process.stdin.isTTY) return null
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (question) =>
    new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer))
    })
  return { ask, close: () => rl.close() }
}

async function promptTarget(ask) {
  let input = ""
  while (!input) {
    input = (await ask("Enter <target-path> (file or directory): ")).trim()
    if (!input) {
      console.log("Target path is required.")
    }
  }
  return input
}

async function promptWrite(ask) {
  const input = (await ask("Write changes? (y/N): ")).trim().toLowerCase()
  return input === "y" || input === "yes"
}

async function pauseOrQuit(ask, label) {
  console.log(label)
  if (!ask) return true
  const input = (await ask("Press Enter to continue (Q to quit): ")).trim().toLowerCase()
  return input !== "q"
}

async function promptPartialChoice(ask, max) {
  for (;;) {
    const input = (await ask(`Replace which partial sentence? (1-${max}, S=skip, Q=quit): `))
      .trim()
      .toLowerCase()
    if (!input || input === "s" || input === "skip") return { action: "skip" }
    if (input === "q" || input === "quit") return { action: "quit" }
    const index = Number(input)
    if (Number.isInteger(index) && index >= 1 && index <= max) {
      return { action: "replace", index: index - 1 }
    }
    console.log(`Invalid input. Enter 1-${max}, S, or Q.`)
  }
}

function parseArgs(argv) {
  const args = {
    target: "",
    write: DEFAULTS.write,
    prompt: true,
  }
  const provided = {
    target: false,
    write: false,
    dryRun: false,
    prompt: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else if (arg === "--target" || arg === "-f") {
      args.target = argv[++i] || ""
      provided.target = true
    } else if (arg === "--write" || arg === "--apply") {
      args.write = true
      provided.write = true
    } else if (arg === "--dry-run") {
      args.write = false
      provided.dryRun = true
    } else if (arg === "--no-prompt") {
      args.prompt = false
      provided.prompt = true
    } else if (!provided.target && !arg.startsWith("-")) {
      args.target = arg
      provided.target = true
    } else {
      fail(`Unknown argument: ${arg}`)
    }
  }

  return { args, provided }
}

function isHtmlFile(filePath) {
  return /\.html?$/i.test(filePath)
}

function collectHtmlFiles(dirPath, results) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath, results)
      continue
    }
    if (entry.isFile() && isHtmlFile(entry.name)) {
      results.push(fullPath)
    }
  }
}

function resolveTargets(targetInput) {
  if (!targetInput) fail("No target provided. Use --target <path> or enter a path.")
  const absolute = path.isAbsolute(targetInput)
    ? targetInput
    : path.resolve(repoRoot, targetInput)
  if (!fs.existsSync(absolute)) {
    fail(`Target not found: ${absolute}`)
  }
  const stats = fs.statSync(absolute)
  if (stats.isFile()) {
    if (!isHtmlFile(absolute)) {
      fail(`Target file is not .html/.htm: ${absolute}`)
    }
    return [absolute]
  }
  if (!stats.isDirectory()) {
    fail(`Target is not a file or directory: ${absolute}`)
  }

  const results = []
  const base = path.basename(absolute)
  if (base.startsWith("exercise-")) {
    collectHtmlFiles(absolute, results)
  } else {
    const entries = fs.readdirSync(absolute, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("exercise-")) continue
      collectHtmlFiles(path.join(absolute, entry.name), results)
    }
  }
  if (!results.length) {
    fail(`No exercise HTML files found under: ${absolute}`)
  }
  results.sort()
  return results
}

function collectInstructionParas($, anchor) {
  const paras = []
  let node = anchor.prev()
  while (node && node.length) {
    const name = node[0] && node[0].name
    if (name === "br") {
      node = node.prev()
      continue
    }
    if (name === "p") {
      paras.push(node[0])
      node = node.prev()
      continue
    }
    break
  }
  return paras.reverse()
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function extractText(html) {
  const probe = load(`<div>${html}</div>`, { decodeEntities: false })
  return normalizeWhitespace(probe("div").text())
}

function splitSentences(text) {
  const matches = String(text || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g)
  if (!matches) return []
  return matches.map((sentence) => sentence.trim()).filter(Boolean)
}

function countKeywordMatches(sentence) {
  let count = 0
  for (const pattern of KEYWORD_PATTERNS) {
    if (pattern.test(sentence)) count += 1
  }
  return count
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function replaceSentenceInHtml(html, sentence, replacement) {
  if (!sentence) return { html, replaced: false }
  const patternSource = escapeRegExp(sentence).replace(/\s+/g, "\\s+")
  const pattern = new RegExp(patternSource, "i")
  if (!pattern.test(html)) return { html, replaced: false }
  return { html: html.replace(pattern, replacement), replaced: true }
}

function applyAutoSentenceReplacements(html, state) {
  if (!AUTO_SENTENCE_NORMALIZATIONS.length) return html
  let updated = html
  for (const { sentence, replacement } of AUTO_SENTENCE_NORMALIZATIONS) {
    const result = replaceSentenceInHtml(updated, sentence, replacement)
    if (!result.replaced) continue
    updated = result.html
    if (state && typeof state.positiveCount === "number") {
      state.positiveCount += 1
    }
  }
  return updated
}

function addPartialCandidate(state, sentence, score) {
  const key = sentence.toLowerCase()
  if (state.partialSet.has(key)) return
  state.partialSet.add(key)
  state.partials.push({ sentence, score })
}

function replaceCheckSentence(html, state) {
  const autoUpdated = applyAutoSentenceReplacements(html, state)
  const text = extractText(autoUpdated)
  if (!text) return autoUpdated
  const sentences = splitSentences(text)
  if (!sentences.length) return autoUpdated
  let updated = autoUpdated
  for (const sentence of sentences) {
    const score = countKeywordMatches(sentence)
    if (score >= POSITIVE_MATCH_THRESHOLD) {
      const result = replaceSentenceInHtml(updated, sentence, REPLACEMENT_TEXT)
      if (result.replaced) {
        updated = result.html
        state.positiveCount += 1
        continue
      }
    }
    if (score > 0 && score < POSITIVE_MATCH_THRESHOLD) {
      addPartialCandidate(state, sentence, score)
    }
  }
  return updated
}

async function resolvePartialReplacement(output, state, ask) {
  if (state.positiveCount > 0 || state.partials.length === 0) return output
  if (!ask) {
    console.log(
      `[normalize-exinstruct] partial matches in ${state.fileLabel}: ${state.partials.length} (run without --no-prompt to review)`
    )
    return output
  }
  console.log(`\nPartial matches in ${state.fileLabel}:`)
  state.partials.forEach((item, index) => {
    console.log(`  [${index + 1}] (${item.score}/4) ${item.sentence}`)
  })
  const choice = await promptPartialChoice(ask, state.partials.length)
  if (choice.action === "quit") {
    process.exit(0)
  }
  if (choice.action === "replace") {
    const target = state.partials[choice.index]
    const result = replaceSentenceInHtml(output, target.sentence, REPLACEMENT_TEXT)
    if (!result.replaced) {
      console.log("[normalize-exinstruct] Unable to replace selected sentence; leaving unchanged.")
      return output
    }
    return result.html
  }
  return output
}

function normalizeToken(token) {
  return String(token || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "")
}

function extractListTokens(text, html) {
  const raw = String(text || "")
  const trimmed = raw.trim()
  if (!trimmed) return []
  const hasDelimiter = /[,;]/.test(trimmed)
  const hasNbsp = (html || "").includes("&nbsp;") || /\u00a0/.test(raw)
  if (!hasDelimiter && !hasNbsp) return []
  const parts = hasDelimiter ? raw.split(/[,;]+/) : raw.split(/\u00a0+/)
  return parts.map(normalizeToken).filter(Boolean)
}

function findInlineListInText(text, minItems) {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null
  if (!/[,;]/.test(normalized)) return null
  const firstSepIndex = normalized.search(/[,;]/)
  if (firstSepIndex < 0) return null
  let startIndex = 0
  const colonIndex = normalized.lastIndexOf(":", firstSepIndex)
  if (colonIndex >= 0) {
    startIndex = colonIndex + 1
  } else {
    const stopIndex = Math.max(
      normalized.lastIndexOf(".", firstSepIndex),
      normalized.lastIndexOf("?", firstSepIndex),
      normalized.lastIndexOf("!", firstSepIndex)
    )
    if (stopIndex >= 0) startIndex = stopIndex + 1
  }
  const trimmedStart = normalized.slice(startIndex).replace(/^\s+/, "")
  const listStartIndex = normalized.length - trimmedStart.length
  let separatorCount = 0
  let endIndex = normalized.length
  for (let i = listStartIndex; i < normalized.length; i += 1) {
    const char = normalized[i]
    if (char === "," || char === ";") separatorCount += 1
    if ((char === "." || char === "?" || char === "!") && separatorCount >= minItems - 1) {
      endIndex = i
      break
    }
  }
  const listText = normalized.slice(listStartIndex, endIndex).trim()
  const tokens = listText.split(/[,;]+/).map(normalizeToken).filter(Boolean)
  if (tokens.length < minItems) return null
  return {
    tokens,
    listText,
    startIndex: listStartIndex,
    endIndex,
  }
}

function isWordBankCandidate(text, html, minItems) {
  const tokens = extractListTokens(text, html)
  return tokens.length >= minItems
}

function normalizeWordBankText(text, html, minItems) {
  const tokens = extractListTokens(text, html)
  if (tokens.length < minItems) return ""
  return tokens.join(" &nbsp;")
}

function findWordBank($, paras) {
  for (const pEl of paras) {
    const candidates = $(pEl).find("strong, b").toArray()
    for (const candidate of candidates) {
      const text = $(candidate).text()
      const html = $(candidate).html() || ""
      if (!isWordBankCandidate(text, html, STRONG_LIST_MIN_ITEMS)) continue
      const list = normalizeWordBankText(text, html, STRONG_LIST_MIN_ITEMS)
      if (!list) continue
      return {
        pEl,
        html: $.html(candidate),
        list,
        kind: "strong",
      }
    }
  }
  return findInlineWordBank($, paras)
}

function findInlineWordBank($, paras) {
  for (const pEl of paras) {
    const html = $(pEl).html() || ""
    const lines = html.split(/<br\s*\/?>/gi)
    for (const line of lines) {
      const raw = line || ""
      if (!raw.trim()) continue
      if (/<[a-z][\s\S]*?>/i.test(raw)) continue
      const lineText = extractText(raw)
      const listInfo = findInlineListInText(lineText, INLINE_LIST_MIN_ITEMS)
      if (!listInfo) continue
      return {
        pEl,
        kind: "inline",
        list: listInfo.tokens.join(" &nbsp;"),
        lineText,
      }
    }
  }
  return null
}

function isPunctuationOnly(value) {
  return /^[\s.,;:]+$/.test(value)
}

function normalizeSegmentHtml(html, replaceState) {
  const trimmed = (html || "").trim()
  if (!trimmed) return ""
  return replaceCheckSentence(trimmed, replaceState)
}

function splitInlineLine(raw, wordBank) {
  if (!raw || /<[a-z][\s\S]*?>/i.test(raw)) return null
  const lineText = extractText(raw)
  if (!lineText) return null
  if (wordBank.lineText && lineText !== wordBank.lineText) return null
  const listInfo = findInlineListInText(lineText, INLINE_LIST_MIN_ITEMS)
  if (!listInfo) return null
  const before = lineText.slice(0, listInfo.startIndex)
  const after = lineText.slice(listInfo.endIndex)
  return { before, after }
}

function splitParagraphIntoItems($, pEl, wordBank) {
  let html = $(pEl).html() || ""
  const inlineTarget = wordBank && wordBank.kind === "inline" && pEl === wordBank.pEl
  const wordBankHtml =
    wordBank && wordBank.kind === "strong" && pEl === wordBank.pEl ? wordBank.html : null
  let hasPlaceholder = false
  if (wordBankHtml && html.includes(wordBankHtml)) {
    html = html.replace(wordBankHtml, WORD_BANK_PLACEHOLDER)
    hasPlaceholder = true
  }
  const lines = html.split(/<br\s*\/?>/gi)
  const items = []
  let inlineHandled = false
  for (const line of lines) {
    const raw = line || ""
    if (!raw.trim()) continue
    if (inlineTarget && !inlineHandled) {
      const inlineParts = splitInlineLine(raw, wordBank)
      if (inlineParts) {
        const before = inlineParts.before || ""
        const after = inlineParts.after || ""
        if (before.trim() && !isPunctuationOnly(before)) {
          items.push({ type: "segment", html: before })
        }
        items.push({ type: "word-bank" })
        if (after.trim() && !isPunctuationOnly(after)) {
          items.push({ type: "segment", html: after })
        }
        inlineHandled = true
        continue
      }
    }
    if (wordBankHtml && raw.includes(WORD_BANK_PLACEHOLDER)) {
      const parts = raw.split(WORD_BANK_PLACEHOLDER)
      const before = parts[0] || ""
      const after = parts[1] || ""
      if (before.trim() && !isPunctuationOnly(before)) {
        items.push({ type: "segment", html: before })
      }
      items.push({ type: "word-bank" })
      if (after.trim() && !isPunctuationOnly(after)) {
        items.push({ type: "segment", html: after })
      }
      continue
    }
    if (!isPunctuationOnly(raw)) {
      items.push({ type: "segment", html: raw })
    }
  }
  if (wordBankHtml && !hasPlaceholder) {
    items.push({ type: "word-bank" })
  }
  return items
}

function buildWordBankNode($, listText) {
  const blockdiv = $('<div class="blockdiv"></div>')
  blockdiv.append("<!-- prettier-ignore -->\n") // CHANGE: comment must be its own node right before the element
  const blockquote = $('<blockquote class="blockwrap"></blockquote>')
  blockquote.html(listText)
  blockdiv.append(blockquote)
  return blockdiv
}

function mergeSegments(items, replaceState) {
  const parts = items
    .filter((item) => item.type === "segment")
    .map((item) => normalizeSegmentHtml(item.html, replaceState))
    .filter(Boolean)
  if (!parts.length) return ""
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

function buildExinstruct($, paras, wordBank, replaceState) {
  const items = []
  for (const pEl of paras) {
    items.push(...splitParagraphIntoItems($, pEl, wordBank))
  }

  const hasWordBankItems = items.some((item) => item.type === "word-bank")
  if (wordBank && hasWordBankItems) {
    const container = $('<div class="exinstruct"></div>')
    for (const item of items) {
      if (item.type === "segment") {
        const normalized = normalizeSegmentHtml(item.html, replaceState)
        if (!normalized) continue
        const p = $("<p></p>")
        p.html(normalized)
        container.append(p)
        continue
      }
      if (item.type === "word-bank") {
        container.append(buildWordBankNode($, wordBank.list))
      }
    }
    return container
  }

  const merged = mergeSegments(items, replaceState)
  if (!merged) return null
  const container = $('<div class="exinstruct"></div>')
  const p = $("<p></p>")
  p.html(merged)
  container.append(p)
  return container
}

async function normalizeFile(filePath, writeMode, ask) {
  const rawHtml = fs.readFileSync(filePath, "utf8")
  const $ = load(rawHtml, { decodeEntities: false })
  const replaceState = {
    positiveCount: 0,
    partials: [],
    partialSet: new Set(),
    fileLabel: filePath,
  }

  if ($(".exinstruct").length) {
    return { status: "skipped", reason: "existing-exinstruct" }
  }

  const anchor = $(".exercise-form, .nn_sliders").first()
  if (!anchor.length) {
    return { status: "skipped", reason: "no-anchor" }
  }

  const paras = collectInstructionParas($, anchor)
  if (!paras.length) {
    return { status: "skipped", reason: "no-instructions" }
  }

  const wordBank = findWordBank($, paras)
  const exinstruct = buildExinstruct($, paras, wordBank, replaceState)
  if (!exinstruct) {
    return { status: "skipped", reason: "no-content" }
  }

  $(paras[0]).before(exinstruct)
  for (const pEl of paras) {
    $(pEl).remove()
  }

  let output = render($.root()[0], { encodeEntities: false })
  if (replaceState.positiveCount === 0 && replaceState.partials.length > 0) {
    output = await resolvePartialReplacement(output, replaceState, ask)
  }
  const changed = output !== rawHtml
  if (writeMode && changed) {
    fs.writeFileSync(filePath, output, "utf8")
  }
  return { status: changed ? (writeMode ? "updated" : "would-update") : "unchanged" }
}

async function main() {
  const { args, provided } = parseArgs(process.argv)
  const prompter = createPrompter(args.prompt)
  const ask = prompter ? prompter.ask : null

  if (!args.target && !ask) {
    fail("No target provided and no TTY available. Use --target <path>.")
  }

  if (!provided.target) {
    args.target = await promptTarget(ask)
  }
  if (!provided.write && !provided.dryRun) {
    args.write = ask ? await promptWrite(ask) : DEFAULTS.write
  }

  const targets = resolveTargets(args.target)
  console.log("\nNormalize exinstruct instructions:")
  console.log(`Target: ${args.target}`)
  console.log(`Files: ${targets.length}`)
  console.log(`Mode: ${args.write ? "write" : "dry-run"}`)
  console.log("Skip when .exinstruct exists: yes")

  if (!(await pauseOrQuit(ask, PAUSE_PROMPT))) {
    if (prompter) prompter.close()
    process.exit(0)
  }

  const summary = {
    updated: 0,
    wouldUpdate: 0,
    unchanged: 0,
    skippedExisting: 0,
    skippedAnchor: 0,
    skippedInstructions: 0,
    skippedContent: 0,
  }

  for (const filePath of targets) {
    const result = await normalizeFile(filePath, args.write, ask)
    if (result.status === "updated") summary.updated += 1
    else if (result.status === "would-update") summary.wouldUpdate += 1
    else if (result.status === "unchanged") summary.unchanged += 1
    else if (result.reason === "existing-exinstruct") summary.skippedExisting += 1
    else if (result.reason === "no-anchor") summary.skippedAnchor += 1
    else if (result.reason === "no-instructions") summary.skippedInstructions += 1
    else if (result.reason === "no-content") summary.skippedContent += 1
  }

  console.log("\nDone.")
  console.log(
    `Updated: ${summary.updated} | Would update: ${summary.wouldUpdate} | Unchanged: ${summary.unchanged}`
  )
  console.log(
    `Skipped (.exinstruct): ${summary.skippedExisting} | Skipped (no anchor): ${summary.skippedAnchor}`
  )
  console.log(
    `Skipped (no instructions): ${summary.skippedInstructions} | Skipped (no content): ${summary.skippedContent}`
  )
  if (prompter) prompter.close()
}

main().catch((error) => {
  const message = error && error.message ? error.message : error
  console.error(message)
  process.exit(1)
})
