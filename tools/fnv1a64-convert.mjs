#!/usr/bin/env node
/**
 * Encode a newline-delimited list of answers to fnv1a-64 hashes, or decode hashes back to
 * plaintext using a provided dictionary (also newline-delimited).
 *
 * Normalization is optional:
 * - By default, answers are hashed exactly as provided (case/punctuation preserved).
 * - Pass --normalize to lowercase and strip punctuation/extra whitespace (legacy behavior).
 *
 * *********  PROMPTS
 * 1. exercise-1-nouns/141-forming-nouns.html
 *      read instructions paragraph, extract the correct answers, destructively place them in tools/input.txt
 *      - each answer separated by a blank line
 *
 * 2. exercise-1-nouns/151-gender.html using tools/hashes.txt
    * put the sequential hashes in tools/hashes.txt into the answer array json as:
        "answersAccepted": [" "],  FOR single answers
            OR
        FOR multiple answers
        "answersAccepted": [
            [" "],
            [" "]
        ]

  3. format each question's <p> tag exactly like

      #2:  <h2 class="nn_sliders-title">2. I forgot to renew my _____ (member) in the sailing club.</h2>
      <p>2. I forgot to renew my <b>&#109;&#101;&#109;&#98;&#101;&#114;&#115;&#104;&#105;&#112;</b> in the sailing club.</p>

  4. exercise-3-adjectives/342-using-adjectives-ii.html pull answers from question p tags and copy the individual words to tools/input.txt

  5.  copy tools/hashes.txt to the answer aray json in exercise-3-adjectives/342-using-adjectives-ii.html

 * ***********

 * Usage:

 *   node tools/fnv1a64-convert.mjs --encode --input tools/input.txt > tools/hashes.txt
 *   node tools/fnv1a64-convert.mjs --decode --dictionary tools/dict.txt --input hashes.txt
 *   node tools/fnv1a64-convert.mjs --verify --input tools/input.txt
 *   node tools/fnv1a64-convert.mjs --round-trip --input tools/input.txt --title 342-using-adjectives-ii
 *
 * # encode → decode using tools/*.txt; copies decoded.txt to dev/<title>.ext when title provided/prompted
 *
 * node tools/fnv1a64-convert.mjs --encode --normalize --input tools/input.txt  # legacy mode
 *
 * # OR:
 * cat tools/input.txt | node tools/fnv1a64-convert.mjs --encode
 */

import fs from "fs"
import path from "path"
import readline from "readline"
import { fileURLToPath } from "url"
import { normalizeAnswer } from "./legacy-qa-parser.mjs"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultPaths = {
  input: path.join(scriptDir, "input.txt"),
  hashes: path.join(scriptDir, "hashes.txt"),
  dict: path.join(scriptDir, "dict.txt"),
  decoded: path.join(scriptDir, "decoded.txt"),
}
const defaultDictPath = defaultPaths.dict

function resolveFilePath(inputPath) {
  if (!inputPath) return inputPath
  const primary = path.isAbsolute(inputPath) ? inputPath : path.resolve(inputPath)
  if (fs.existsSync(primary)) return primary
  const fallback = path.isAbsolute(inputPath) ? inputPath : path.join(scriptDir, inputPath)
  if (fs.existsSync(fallback)) return fallback
  throw new Error(`File not found: ${inputPath}`)
}

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
    const abs = resolveFilePath(inputPath)
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

function buildDictionaryFromText(text, normalize) {
  const lines = (text || "").split(/\r?\n/)
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
    throw new Error("No usable entries found in dictionary text.")
  }
  return map
}

function loadDictionary(dictPath, normalize, fallbackText) {
  if (dictPath) {
    const abs = resolveFilePath(dictPath)
    const content = fs.readFileSync(abs, "utf8")
    return buildDictionaryFromText(content, normalize)
  }
  if (fallbackText != null) {
    return buildDictionaryFromText(fallbackText, normalize)
  }
  throw new Error(
    "Decoding requires a dictionary source (provide --dictionary or use --verify to derive from input)."
  )
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

function decodeLines(text, dictPath, normalize, dictionaryText) {
  const dict = loadDictionary(dictPath, normalize, dictionaryText)
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
  const args = { mode: "encode", dictionary: null, input: null, normalize: false, title: "" }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--encode") {
      args.mode = "encode"
    } else if (arg === "--decode") {
      args.mode = "decode"
    } else if (arg === "--round-trip") {
      args.mode = "roundtrip"
    } else if (arg === "--verify") {
      args.mode = "verify"
    } else if (arg === "--dictionary" || arg === "-d") {
      args.dictionary = argv[++i]
    } else if (arg === "--input" || arg === "-i") {
      args.input = argv[++i]
    } else if (arg === "--normalize") {
      args.normalize = true
    } else if (arg === "--title" || arg === "-t") {
      args.title = argv[++i] || ""
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

  # Verify encode -> decode round-trip matches original input (dictionary optional; defaults to input text and writes tools/dict.txt)
  node tools/fnv1a64-convert.mjs --verify --input input.txt

  # One-shot round-trip using tools/*.txt (overwrites hashes.txt, dict.txt, decoded.txt)
  node tools/fnv1a64-convert.mjs --round-trip --input tools/input.txt --title 114-common-nouns  # copies decoded.txt to dev/<title>.txt

  # Preserve exact text (default) or normalize like legacy behavior
  node tools/fnv1a64-convert.mjs --encode --input input.txt           # exact (default)
  node tools/fnv1a64-convert.mjs --encode --normalize --input input.txt # normalize

  # You can also pipe data instead of using --input
  cat input.txt | node tools/fnv1a64-convert.mjs --encode
`)
}

function normalizeForCompare(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n+$/, "")
}

function findFirstDiff(aLines, bLines) {
  const max = Math.max(aLines.length, bLines.length)
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) return i
  }
  return -1
}

function verifyRoundTrip(inputPath, dictPath, normalize, inputText) {
  if (!inputPath)
    throw new Error("--verify requires --input <path> to compare against decoded output.")
  const source = inputText != null ? inputText : readInput(inputPath)
  if (!source.length)
    throw new Error("No input received. Pipe data on stdin or use --input <path>.")

  const encoded = encodeLines(source, normalize)
  const decoded = decodeLines(encoded, dictPath, normalize, source)

  const a = normalizeForCompare(source)
  const b = normalizeForCompare(decoded)
  if (a !== b) {
    const aLines = a.split("\n")
    const bLines = b.split("\n")
    const idx = findFirstDiff(aLines, bLines)
    const msg =
      idx === -1
        ? "Round-trip failed: decoded output does not match input."
        : `Round-trip failed at line ${idx + 1}: expected "${aLines[idx] || ""}", got "${bLines[idx] || ""}".`
    throw new Error(msg)
  }

  return { encoded, decoded }
}

function promptForTitle(cliTitle) {
  const prepared = (cliTitle || "").trim()
  if (prepared) return Promise.resolve(prepared)
  if (!process.stdin.isTTY) return Promise.resolve("")
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question("Enter exercise title for dev/decoded output (e.g., 114-collective-nouns): ", (ans) => {
      rl.close()
      resolve((ans || "").trim())
    })
  })
}

function runRoundTrip(inputPathArg, normalize, title) {
  const inputPath = resolveFilePath(inputPathArg || defaultPaths.input)
  const dictPath = defaultPaths.dict
  const hashesPath = defaultPaths.hashes
  const decodedPath = defaultPaths.decoded

  const inputText = readInput(inputPath)
  const encoded = encodeLines(inputText, normalize)
  fs.writeFileSync(hashesPath, encoded ? `${encoded}\n` : "\n", "utf8")
  fs.writeFileSync(dictPath, inputText, "utf8")
  const decoded = decodeLines(encoded, dictPath, normalize, inputText)
  fs.writeFileSync(decodedPath, decoded ? `${decoded}\n` : "\n", "utf8")

  const a = normalizeForCompare(inputText)
  const b = normalizeForCompare(decoded)
  if (a !== b) {
    const aLines = a.split("\n")
    const bLines = b.split("\n")
    const idx = findFirstDiff(aLines, bLines)
    const msg =
      idx === -1
        ? "Round-trip failed: decoded output does not match input."
        : `Round-trip failed at line ${idx + 1}: expected "${aLines[idx] || ""}", got "${bLines[idx] || ""}".`
    throw new Error(msg)
  }

  console.log("100% identical - successful encode-decode round trip.")

  return promptForTitle(title).then((resolvedTitle) => {
    if (!resolvedTitle) return
    const devDir = path.resolve(scriptDir, "..", "dev")
    if (!fs.existsSync(devDir)) fs.mkdirSync(devDir, { recursive: true })
    const targetPath = path.join(devDir, `${resolvedTitle}.txt`)
    fs.copyFileSync(decodedPath, targetPath)
    console.log(`Copied decoded answers to ${targetPath}`)
  })
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  try {
    if (args.mode === "roundtrip") {
      await runRoundTrip(args.input, args.normalize, args.title)
      return
    }

    const input = readInput(args.input)
    if (!input.length) {
      throw new Error("No input received. Pipe data on stdin or use --input <path>.")
    }

    if (args.mode === "verify") {
      const dictPath = args.dictionary
        ? path.isAbsolute(args.dictionary)
          ? args.dictionary
          : path.resolve(args.dictionary)
        : defaultDictPath

      if (!args.dictionary) {
        const dictText = `${normalizeForCompare(input)}\n`
        fs.writeFileSync(dictPath, dictText, "utf8")
      }

      const { encoded } = verifyRoundTrip(args.input, dictPath, args.normalize, input)
      process.stdout.write(`${encoded}\n`)
      console.error("Round-trip OK: input matches decoded output.")
    } else if (args.mode === "decode") {
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
