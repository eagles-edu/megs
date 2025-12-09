#!/usr/bin/env node
/**
 * Obfuscate/deobfuscate plaintext answers using base64 (reversible).
 * Mirrors the workflow of fnv1a64-convert.mjs but uses a reversible codec.
 *
 * Gate behavior summary (hash-first, obfuscation fallback):
 * - Primary: answers are stored as hashes in answer keys (`answersAccepted`). The gate hashes user
 *   input and compares to those hashes. This is one-way; plaintext is not recoverable.
 * - Fallback: when hashes are absent, a question may provide `answersObfuscated` (base64-encoded
 *   plaintext). The gate/devtools decode the base64 and compare plaintext. This is reversible and
 *   less secure; keep it dev/internal-only and avoid shipping readable answers.
 * - Autofill: devtools prefers hashes (paired with dev/<title>.ext or inline dev dict). If hashes
 *   are missing but `answersObfuscated` exists, it decodes the base64 to fill inputs.
 *
 * This script helps generate obfuscated (base64) representations for `answersObfuscated` or for
 * dev-only workflows. Use hashing for production answers; use obfuscation only when hashes are
 * unavailable and you accept the weaker protection.
 *
 * Usage:
 *   node tools/obfuscate-answers.mjs --encode --input tools/input.txt > tools/obfuscated.txt
 *   node tools/obfuscate-answers.mjs --decode --input tools/obfuscated.txt > tools/decoded-obfuscated.txt
 *   node tools/obfuscate-answers.mjs --round-trip --input tools/input.txt [--title 114-collective-nouns]
 *
 * Notes:
 * - Blank lines are preserved to keep question grouping intact.
 * - Base64 is reversible; do not ship obfuscated output where plaintext must remain hidden from users.
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const defaultPaths = {
  input: path.join(scriptDir, "input.txt"),
  obfuscated: path.join(scriptDir, "obfuscated.txt"),
  decoded: path.join(scriptDir, "decoded-obfuscated.txt"),
}

function resolveFilePath(inputPath) {
  if (!inputPath) return inputPath
  const primary = path.isAbsolute(inputPath) ? inputPath : path.resolve(inputPath)
  if (fs.existsSync(primary)) return primary
  const fallback = path.isAbsolute(inputPath) ? inputPath : path.join(scriptDir, inputPath)
  if (fs.existsSync(fallback)) return fallback
  throw new Error(`File not found: ${inputPath}`)
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

function encodeLine(line) {
  if (!line) return ""
  return Buffer.from(line, "utf8").toString("base64")
}

function decodeLine(line) {
  if (!line) return ""
  try {
    return Buffer.from(line.trim(), "base64").toString("utf8")
  } catch {
    throw new Error(`Unable to decode base64 line: ${line}`)
  }
}

function encodeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return ""
      return encodeLine(line)
    })
    .join("\n")
}

function decodeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return ""
      return decodeLine(line)
    })
    .join("\n")
}

function parseArgs(argv) {
  const args = { mode: "encode", input: null, output: null, title: "" }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--encode") {
      args.mode = "encode"
    } else if (arg === "--decode") {
      args.mode = "decode"
    } else if (arg === "--round-trip") {
      args.mode = "roundtrip"
    } else if (arg === "--input" || arg === "-i") {
      args.input = argv[++i]
    } else if (arg === "--output" || arg === "-o") {
      args.output = argv[++i]
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
  # Encode plaintext -> base64
  node tools/obfuscate-answers.mjs --encode --input tools/input.txt > tools/obfuscated.txt

  # Decode base64 -> plaintext
  node tools/obfuscate-answers.mjs --decode --input tools/obfuscated.txt > tools/decoded-obfuscated.txt

  # Round-trip (encode then decode) to verify integrity; writes obfuscated.txt and decoded-obfuscated.txt
  # If you pass --title <name>, also writes dev/<name>.ext with the obfuscated output
  node tools/obfuscate-answers.mjs --round-trip --input tools/input.txt [--title 114-collective-nouns]
`)
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n").replace(/\n+$/, "")
}

function ensureDevCopy(title, content) {
  const trimmed = (title || "").trim()
  if (!trimmed || !content) return
  const devDir = path.resolve(scriptDir, "..", "dev")
  if (!fs.existsSync(devDir)) fs.mkdirSync(devDir, { recursive: true })
  const outPath = path.join(devDir, `${trimmed}.ext`)
  const normalized = content.endsWith("\n") ? content : `${content}\n`
  fs.writeFileSync(outPath, normalized, "utf8")
  console.log(`Copied obfuscated output to ${outPath}`)
}

function runRoundTrip(inputPathArg, title) {
  const inputPath = resolveFilePath(inputPathArg || defaultPaths.input)
  const obfuscatedPath = defaultPaths.obfuscated
  const decodedPath = defaultPaths.decoded
  const source = readInput(inputPath)
  if (!source.length) throw new Error("No input received. Pipe data on stdin or use --input <path>.")

  const encoded = encodeLines(source)
  const decoded = decodeLines(encoded)

  fs.writeFileSync(obfuscatedPath, encoded ? `${encoded}\n` : "\n", "utf8")
  fs.writeFileSync(decodedPath, decoded ? `${decoded}\n` : "\n", "utf8")

  const a = normalizeText(source)
  const b = normalizeText(decoded)
  if (a !== b) {
    throw new Error("Round-trip failed: decoded output does not match input.")
  }
  console.log("Round-trip OK; wrote obfuscated.txt and decoded-obfuscated.txt")
  ensureDevCopy(title, encoded)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }
  try {
    if (args.mode === "roundtrip") {
      runRoundTrip(args.input, args.title)
      return
    }
    const inputText = readInput(args.input)
    if (!inputText.length) {
      throw new Error("No input received. Pipe data on stdin or use --input <path>.")
    }
    if (args.mode === "decode") {
      const output = decodeLines(inputText)
      process.stdout.write(output.endsWith("\n") ? output : `${output}\n`)
    } else {
      const output = encodeLines(inputText)
      process.stdout.write(output.endsWith("\n") ? output : `${output}\n`)
      if (args.title) ensureDevCopy(args.title, output)
    }
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }
}

main()
