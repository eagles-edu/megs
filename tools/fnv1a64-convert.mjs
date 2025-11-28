#!/usr/bin/env node
/**
 * Encode a newline-delimited list of answers to fnv1a-64 hashes, or decode hashes back to
 * plaintext using a provided dictionary (also newline-delimited).
 *
 * Usage:
 *   node tools/fnv1a64-convert.mjs --encode < input.txt
 *   node tools/fnv1a64-convert.mjs --decode --dictionary dict.txt < hashes.txt
 */

import fs from "fs"
import path from "path"
function normalizeAnswer(value) {
  return (value || "").trim().toLowerCase()
}

function fnv1a64(value) {
  const FNV_PRIME = 0x100000001b3n
  const OFFSET_BASIS = 0xcbf29ce484222325n
  const MASK = 0xffffffffffffffffn

  let hash = OFFSET_BASIS
  const bytes = Buffer.from(value, "utf8")
  for (const byte of bytes) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & MASK
  }
  return hash.toString(16).padStart(16, "0")
}

function readStdin() {
  return fs.readFileSync(0, "utf8")
}

function normalizeHash(token) {
  if (!token) return ""
  const trimmed = token.trim()
  if (!trimmed) return ""
  return trimmed.startsWith("fnv1a-64:") ? trimmed.slice("fnv1a-64:".length) : trimmed
}

function loadDictionary(dictPath) {
  const abs = path.resolve(dictPath)
  const content = fs.readFileSync(abs, "utf8")
  const lines = content.split(/\r?\n/)
  const map = new Map()
  for (const line of lines) {
    const word = normalizeAnswer(line)
    if (!word) continue
    const hash = fnv1a64(word)
    if (!map.has(hash)) {
      map.set(hash, word)
    }
  }
  return map
}

function encodeLines(text) {
  const lines = text.split(/\r?\n/)
  return lines
    .map((line) => {
      const normalized = normalizeAnswer(line)
      if (!normalized) return ""
      return `fnv1a-64:${fnv1a64(normalized)}`
    })
    .join("\n")
}

function decodeLines(text, dictPath) {
  if (!dictPath) {
    throw new Error("Decoding requires --dictionary <path> so hashes can be looked up.")
  }
  const dict = loadDictionary(dictPath)
  const lines = text.split(/\r?\n/)
  return lines
    .map((line) => {
      const hash = normalizeHash(line)
      if (!hash) return ""
      const word = dict.get(hash)
      return word || line.trim()
    })
    .join("\n")
}

function parseArgs(argv) {
  const args = { mode: "encode", dictionary: null }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--encode") {
      args.mode = "encode"
    } else if (arg === "--decode") {
      args.mode = "decode"
    } else if (arg === "--dictionary" || arg === "-d") {
      args.dictionary = argv[++i]
    } else if (arg === "--help" || arg === "-h") {
      args.help = true
    }
  }
  return args
}

function printHelp() {
  console.log(`Usage:
  # Encode newline-delimited answers to fnv1a-64
  node tools/fnv1a64-convert.mjs --encode < input.txt > output.txt

  # Decode hashes back to plaintext using a dictionary file
  node tools/fnv1a64-convert.mjs --decode --dictionary dict.txt < hashes.txt > plain.txt
`)
}

function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  const input = readStdin()
  if (!input.length) {
    console.error("No input received on stdin.")
    process.exit(1)
  }

  try {
    if (args.mode === "decode") {
      const output = decodeLines(input, args.dictionary)
      process.stdout.write(output)
    } else {
      const output = encodeLines(input)
      process.stdout.write(output)
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

main()
