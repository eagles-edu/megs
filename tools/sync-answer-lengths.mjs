#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log("Usage: node tools/sync-answer-lengths.mjs <target-path> [more paths]")
}

function uniqueLengths(values) {
  const seen = new Set()
  const list = []
  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    list.push(value)
  }
  return list
}

function computeLengthConfig(answersAccepted) {
  const combos = Array.isArray(answersAccepted) ? answersAccepted : []
  const lengthsRaw = []
  for (const combo of combos) {
    if (combo == null) continue
    const list = Array.isArray(combo) ? combo : [combo]
    lengthsRaw.push(list.length)
  }
  const lengths = uniqueLengths(lengthsRaw)
  let minLength = lengths.length ? lengths[0] : 1
  for (let i = 1; i < lengths.length; i += 1) {
    if (lengths[i] < minLength) minLength = lengths[i]
  }
  let maxLength = lengths.length ? lengths[0] : 0
  for (let i = 1; i < lengths.length; i += 1) {
    if (lengths[i] > maxLength) maxLength = lengths[i]
  }
  return {
    lengths,
    minLength: minLength || 1,
    maxLength: maxLength || 0,
  }
}

function syncAnswerKeyLengths(rawHtml, fileLabel) {
  const pattern =
    /(<script[^>]*id=["']exercise-answer-key["'][^>]*>)([\s\S]*?)(<\/script>)/i
  const match = rawHtml.match(pattern)
  if (!match) {
    fail(`exercise-answer-key script not found in ${fileLabel}`)
  }
  const jsonText = match[2].trim()
  if (!jsonText) {
    fail(`exercise-answer-key is empty in ${fileLabel}`)
  }
  let parsed
  try {
    parsed = JSON.parse(jsonText)
  } catch (error) {
    fail(`exercise-answer-key JSON invalid in ${fileLabel}: ${error.message}`)
  }
  const answerArray = parsed?.answerArrays?.answerArray
  if (!answerArray || typeof answerArray !== "object") {
    fail(`answerArrays.answerArray missing in ${fileLabel}`)
  }
  for (const key of Object.keys(answerArray)) {
    const entry = answerArray[key]
    if (!entry || typeof entry !== "object") continue
    const config = computeLengthConfig(entry.answersAccepted)
    entry.lengths = config.lengths
    entry.minLength = config.minLength
    entry.maxLength = config.maxLength
  }
  const serialized = JSON.stringify(parsed, null, 2)
  return rawHtml.replace(pattern, `$1\n${serialized}\n$3`)
}

const targets = process.argv.slice(2).filter((arg) => arg && !arg.startsWith("-"))
if (!targets.length || process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage()
  if (!targets.length) process.exit(1)
}

for (const target of targets) {
  const absolute = path.resolve(process.cwd(), target)
  if (!fs.existsSync(absolute)) {
    fail(`Target file not found: ${target}`)
  }
  const rawHtml = fs.readFileSync(absolute, "utf8")
  const updated = syncAnswerKeyLengths(rawHtml, target)
  fs.writeFileSync(absolute, updated, "utf8")
  console.log(`synced lengths for ${target}`)
}
