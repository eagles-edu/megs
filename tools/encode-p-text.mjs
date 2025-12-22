#!/usr/bin/env node
// Encode text nodes inside <p> elements to decimal HTML entities while preserving HTML tags.
// Usage:
// Dry run to stdout: node tools/encode-p-text.mjs exercise-2-verbs/211-transitive-and-intransitive-verbs.html
// Apply in place:
// node tools/encode-p-text.mjs --write exercise-2-verbs/211-transitive-and-intransitive-verbs.html
// Optional quick check: node tools/encode-p-text.mjs /tmp/sample.html | head
// Rollback: rm tools/encode-p-t
// node tools/encode-p-text.mjs [--write|--apply] [--scope <all|highlighted>] <file...>
// Default is dry-run to stdout; use --write/--apply to rewrite files in place.

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { load } from "cheerio"
import { render } from "dom-serializer"

const USAGE = `
Encode only <p> tag text to decimal HTML entities (tags remain untouched).

Usage:
  node tools/encode-p-text.mjs [--write|--apply] [--scope <all|highlighted>] <file...>

Options:
  --write, --apply   Overwrite the provided files in place
  --scope            all (default) encodes all <p> text; highlighted encodes only <span>, <b>, <strong> text
  --help             Show this message
`.trim()

const argv = process.argv.slice(2)
const wantsHelp = argv.includes("--help") || argv.includes("-h")
const writeMode = argv.some((arg) => arg === "--write" || arg === "--apply")
const scopeArg = argv.find((arg) => arg.startsWith("--scope="))
const scopeIndex = argv.findIndex((arg) => arg === "--scope")
let scope = "all"

if (scopeArg) {
  scope = scopeArg.split("=", 2)[1]
} else if (scopeIndex !== -1) {
  scope = argv[scopeIndex + 1] || ""
}

if (scope && scope !== "all" && scope !== "highlighted") {
  console.error(`[encode-p-text] invalid --scope "${scope}" (use all or highlighted)`)
  process.exit(1)
}

const files = argv.filter((arg, idx) => {
  if (arg === "--scope") return false
  if (scopeIndex !== -1 && idx === scopeIndex + 1) return false
  if (arg.startsWith("--scope=")) return false
  return !arg.startsWith("--")
})

if (wantsHelp || files.length === 0) {
  console.error(USAGE)
  process.exit(wantsHelp ? 0 : 1)
}

const ENCODED_RUN = /^(&#\d+;|\s)+$/

function encodeText(text) {
  if (!text) return text
  if (!text.trim()) return text
  if (ENCODED_RUN.test(text)) return text
  return Array.from(text, (char) => `&#${char.codePointAt(0)};`).join("")
}

function encodeTextNodes(node) {
  let touched = false
  const children = node.children || []
  for (const child of children) {
    if (child.type === "text") {
      const next = encodeText(child.data || "")
      if (next !== child.data) {
        child.data = next
        touched = true
      }
    } else if (child.children && child.children.length) {
      if (encodeTextNodes(child)) touched = true
    }
  }
  return touched
}

function encodeParagraphs($, scopeMode) {
  let encodedCount = 0
  $("p").each((_, el) => {
    let touched = false
    if (scopeMode === "highlighted") {
      $(el)
        .find("span, b, strong")
        .each((__, highlight) => {
          if (encodeTextNodes(highlight)) touched = true
        })
    } else {
      touched = encodeTextNodes(el)
    }
    if (touched) encodedCount += 1
  })
  return encodedCount
}

function processFile(filePath) {
  const inputPath = path.resolve(process.cwd(), filePath)
  const html = fs.readFileSync(inputPath, "utf8")

  const $ = load(html, { decodeEntities: false })
  const encodedParagraphs = encodeParagraphs($, scope)
  const output = render($.root()[0], { encodeEntities: false })

  if (writeMode) {
    fs.writeFileSync(inputPath, output)
    console.error(
      `[encode-p-text] ${encodedParagraphs} <p> element(s) encoded in ${filePath} (scope: ${scope})`
    )
  } else {
    process.stdout.write(output)
  }
}

for (const filePath of files) {
  processFile(filePath)
}
