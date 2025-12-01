#!/usr/bin/env node
/**
 * Encode a newline-delimited list of answers to fnv1a-64 hashes, or decode hashes back to
 * plaintext using a provided dictionary (also newline-delimited).
 *
 * Normalization is optional:
 * - By default, answers are hashed exactly as provided (case/punctuation preserved).
 * - Pass --normalize to lowercase and strip punctuation/extra whitespace (legacy behavior).
 *
 * Usage:
 *   node tools/fnv1a64-convert.mjs --encode --input tools/input.txt > tools/hashes.txt
 *   node tools/fnv1a64-convert.mjs --decode --dictionary tools/dict.txt --input hashes.txt
 * 
 *   node tools/fnv1a64-convert.mjs --encode --normalize --input tools/input.txt  # legacy mode
 *   # OR: cat tools/input.txt | node tools/fnv1a64-convert.mjs --encode
 */

import fs from "fs"
import path from "path"
import { normalizeAnswer } from "./legacy-qa-parser.mjs"

function prepareValue(value, normalize) {
  if (value == null) return ""
  const text = String(value)
  return normalize ? normalizeAnswer(text) : text
}

function fnv1a64(value, normalize) {
  const prepared = prepareValue(value, normalize)
  if (!prepared) return ""

  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (let i = 0; i < prepared.length; i += 1) {
    hash ^= BigInt(prepared.charCodeAt(i))
    hash = (hash * prime) & 0xffffffffffffffffn
  }
  return hash.toString(16).padStart(16, "0")
}

function readInput(inputPath) {
  if (inputPath) {
    const abs = path.resolve(inputPath)
    return fs.readFileSync(abs, "utf8")
  }

  if (process.stdin.isTTY) {
    throw new Error("No input received. Pipe data on stdin or use --input <path>.")
  }

  return fs.readFileSync(0, "utf8")
}

function normalizeHash(token) {
  if (!token) return ""
  const trimmed = String(token).trim().toLowerCase()
  if (!trimmed) return ""
  return trimmed.startsWith("fnv1a-64:") ? trimmed.slice("fnv1a-64:".length) : trimmed
}

function loadDictionary(dictPath, normalize) {
  const abs = path.resolve(dictPath)
  const content = fs.readFileSync(abs, "utf8")
  const lines = content.split(/\r?\n/)
  const map = new Map()
  for (const line of lines) {
    const prepared = prepareValue(line, normalize)
    if (!prepared) continue
    const hash = fnv1a64(prepared, false)
    if (!map.has(hash)) {
      map.set(hash, normalize ? prepared : line)
    }
  }
  if (!map.size) {
    throw new Error(`No usable entries found in dictionary: ${dictPath}`)
  }
  return map
}

function encodeLines(text, normalize) {
  const lines = text.split(/\r?\n/)
  return lines
    .map((line) => {
      const hash = fnv1a64(line, normalize)
      if (!hash) return ""
      return `fnv1a-64:${hash}`
    })
    .join("\n")
}

function decodeLines(text, dictPath, normalize) {
  if (!dictPath) {
    throw new Error("Decoding requires --dictionary <path> so hashes can be looked up.")
  }
  const dict = loadDictionary(dictPath, normalize)
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
  const args = { mode: "encode", dictionary: null, input: null, normalize: false }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--encode") {
      args.mode = "encode"
    } else if (arg === "--decode") {
      args.mode = "decode"
    } else if (arg === "--dictionary" || arg === "-d") {
      args.dictionary = argv[++i]
    } else if (arg === "--input" || arg === "-i") {
      args.input = argv[++i]
    } else if (arg === "--normalize") {
      args.normalize = true
    } else if (arg === "--help" || arg === "-h") {
      args.help = true
    }
  }
  return args
}

function printHelp() {
  console.log(`Usage:
  # Encode newline-delimited answers to fnv1a-64
  node tools/fnv1a64-convert.mjs --encode --input input.txt > output.txt

  # Decode hashes back to plaintext using a dictionary file
  node tools/fnv1a64-convert.mjs --decode --dictionary dict.txt --input hashes.txt > plain.txt

  # Preserve exact text (default) or normalize like legacy behavior
  node tools/fnv1a64-convert.mjs --encode --input input.txt           # exact (default)
  node tools/fnv1a64-convert.mjs --encode --normalize --input input.txt # normalize

  # You can also pipe data instead of using --input
  cat input.txt | node tools/fnv1a64-convert.mjs --encode
`)
}

function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  try {
    const input = readInput(args.input)
    if (!input.length) {
      throw new Error("No input received. Pipe data on stdin or use --input <path>.")
    }

    if (args.mode === "decode") {
      const output = decodeLines(input, args.dictionary, args.normalize)
      process.stdout.write(output)
    } else {
      const output = encodeLines(input, args.normalize)
      process.stdout.write(output)
    }
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

main()
