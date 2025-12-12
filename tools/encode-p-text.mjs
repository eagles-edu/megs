#!/usr/bin/env node
// Encode text nodes inside <p> elements to decimal HTML entities while preserving HTML tags.
// Usage:
// Dry run to stdout: node tools/encode-p-text.mjs exercise-2-verbs/211-transitive-and-intransitive-verbs.html
// Apply in place:
// node tools/encode-p-text.mjs --write exercise-2-verbs/211-transitive-and-intransitive-verbs.html
// Optional quick check: node tools/encode-p-text.mjs /tmp/sample.html | head
// Rollback: rm tools/encode-p-t
// node tools/encode-p-text.mjs [--write|--apply] <file...>
// Default is dry-run to stdout; use --write/--apply to rewrite files in place.

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { load } from "cheerio"
import { render } from "dom-serializer"

const USAGE = `
Encode only <p> tag text to decimal HTML entities (tags remain untouched).

Usage:
  node tools/encode-p-text.mjs [--write|--apply] <file...>

Options:
  --write, --apply   Overwrite the provided files in place
  --help             Show this message
`.trim()

const argv = process.argv.slice(2)
const wantsHelp = argv.includes("--help") || argv.includes("-h")
const writeMode = argv.some((arg) => arg === "--write" || arg === "--apply")
const files = argv.filter((arg) => !arg.startsWith("--"))

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

function encodeParagraphs($) {
  let encodedCount = 0
  $("p").each((_, el) => {
    if (encodeTextNodes(el)) encodedCount += 1
  })
  return encodedCount
}

function processFile(filePath) {
  const inputPath = path.resolve(process.cwd(), filePath)
  const html = fs.readFileSync(inputPath, "utf8")

  const $ = load(html, { decodeEntities: false })
  const encodedParagraphs = encodeParagraphs($)
  const output = render($.root()[0], { encodeEntities: false })

  if (writeMode) {
    fs.writeFileSync(inputPath, output)
    console.error(
      `[encode-p-text] ${encodedParagraphs} <p> element(s) encoded in ${filePath}`
    )
  } else {
    process.stdout.write(output)
  }
}

for (const filePath of files) {
  processFile(filePath)
}
