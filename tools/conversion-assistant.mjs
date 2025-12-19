#!/usr/bin/env node
/**
 * Conversion assistant for legacy exercise pages.
 *
 * Workflow (default):
 * 1) Extract answers from <span class="undies">…</span> in the target HTML and write tools/input.txt
 * 2) Run fnv1a64-convert round-trip to refresh hashes/dict/decoded (writes dev/<title>.txt when title provided)
 * 3) Review/run convert-legacy-gated diff preview (command printed; e.g., --answer-fields 1 --diff-preview, or add --answer-ui textarea)
 * 4) Inject hashes into the answer key JSON of the target HTML (answersAccepted combos)
 * 5) Encode answers in <p> tags for obfuscation (use tools/encode-p-text.mjs)
 *
 * Usage:
 *   node tools/conversion-assistant.mjs --target exercise-3-adjectives/343-using-adjectives-iii.html
 *   node tools/conversion-assistant.mjs --target exercise-3-adjectives/343-using-adjectives-iii.html --title my-title --dry-run
 *
 * Flags:
 *   --target, -f        Path to the exercise HTML (required)
 *   --title, -t         Title used for hashing/dev copy (defaults to basename of target)
 *   --answer-fields     Number of answer fields (for suggested convert-legacy-gated cmd, default 1)
 *   --answer-ui         Override answer UI for suggested convert cmd (e.g., textarea)
 *   --skip-extract      Skip answer extraction/input write
 *   --skip-hash         Skip fnv1a64 round-trip
 *   --skip-update       Skip injecting hashes into the answer key JSON
 *   --dry-run           Show actions/commands without writing files or running subcommands
 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import readline from "node:readline"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import * as cheerio from "cheerio"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")
const defaultPaths = {
  input: path.join(scriptDir, "input.txt"),
  hashes: path.join(scriptDir, "hashes.txt"),
  decoded: path.join(scriptDir, "decoded.txt"),
}

function parseArgs(argv) {
  const args = {
    target: "",
    title: "",
    answerFields: 1,
    answerUi: "",
    answerSource: "auto", // auto | undies | p
    answersMode: "all", // all | alts
    obfuscate: "span", // span | p | none
    skipExtract: false,
    skipHash: false,
    skipUpdate: false,
    dryRun: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--target" || arg === "-f") {
      args.target = argv[++i] || ""
    } else if (arg === "--title" || arg === "-t") {
      args.title = argv[++i] || ""
    } else if (arg === "--answer-fields") {
      const raw = Number(argv[++i])
      if (raw === 7) {
        args.answerFields = 1
        if (!args.answerUi) args.answerUi = "textarea"
      } else if (Number.isInteger(raw) && raw >= 1 && raw <= 6) {
        args.answerFields = raw
      }
    } else if (arg === "--answer-ui") {
      args.answerUi = argv[++i] || ""
    } else if (arg === "--answer-source") {
      args.answerSource = (argv[++i] || "").toLowerCase() || "auto"
    } else if (arg === "--answers-mode") {
      args.answersMode = (argv[++i] || "").toLowerCase() || "all"
    } else if (arg === "--obfuscate") {
      args.obfuscate = (argv[++i] || "").toLowerCase() || "span"
    } else if (arg === "--skip-extract") {
      args.skipExtract = true
    } else if (arg === "--skip-hash") {
      args.skipHash = true
    } else if (arg === "--skip-update") {
      args.skipUpdate = true
    } else if (arg === "--dry-run") {
      args.dryRun = true
    } else if (!args.target && !arg.startsWith("-")) {
      args.target = arg
    }
  }

  return args
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function logStepStart(label) {
  console.log(`\n[STEP] ${label}...`)
}

function logStepOk(label) {
  console.log(`[OK] ${label}`)
}

function promptForTarget() {
  if (!process.stdin.isTTY) return Promise.resolve("")
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question("Enter target exercise HTML path: ", (ans) => {
      rl.close()
      resolve((ans || "").trim())
    })
  })
}

function promptForAnswerSettings(currentFields, currentUi) {
  if (!process.stdin.isTTY || currentUi || currentFields !== 1) {
    return Promise.resolve({ fields: currentFields, ui: currentUi })
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(
      "Select answer fields (1-6) or 7 for textarea [default 1]: ",
      (ans) => {
        rl.close()
        const raw = (ans || "").trim()
        const num = Number(raw)
        if (Number.isInteger(num) && num >= 1 && num <= 6) {
          resolve({ fields: num, ui: "" })
          return
        }
        if (num === 7) {
          resolve({ fields: 1, ui: "textarea" })
          return
        }
        resolve({ fields: currentFields, ui: currentUi })
      }
    )
  })
}

function extractAnswers(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8")
  const answers = []
  let source = "undies"
  return { answers, html, source }
}

function collectUndies($) {
  const tokens = []
  $(".accordion-inner .undies").each((_, el) => {
    const raw = ($(el).text() || "").trim()
    if (raw) tokens.push(raw)
  })
  return tokens
}

function collectStrongList($) {
  const tokens = []
  $("strong").each((_, el) => {
    const text = ($(el).text() || "").trim()
    if (!text) return
    const parts = text.split(/[;,]/).map((part) => part.trim()).filter(Boolean)
    if (parts.length > 1) {
      tokens.push(...parts)
    } else {
      tokens.push(text)
    }
  })
  const uniq = []
  const seen = new Set()
  tokens.forEach((token) => {
    if (!token || seen.has(token)) return
    seen.add(token)
    uniq.push(token)
  })
  return uniq
}

function collectPHighlights($) {
  const tokens = []
  $("p").each((_, p) => {
    const $p = $(p)
    $p.find("b,strong,u,span").each((__, el) => {
      const text = ($(el).text() || "").trim()
      if (text) tokens.push(text)
    })
  })
  const uniq = []
  const seen = new Set()
  tokens.forEach((token) => {
    if (!token || seen.has(token)) return
    seen.add(token)
    uniq.push(token)
  })
  return uniq
}

function extractAnswersWithMode(htmlPath, sourcePref = "auto") {
  const { html } = extractAnswers(htmlPath)
  const $ = cheerio.load(html)
  let answers = []
  let source = sourcePref || "auto"

  if (source === "undies") {
    answers = collectUndies($)
  } else if (source === "p") {
    answers = collectPHighlights($)
  } else {
    // auto mode: prefer undies, then strong list
    answers = collectUndies($)
    source = "undies"
    if (!answers.length) {
      answers = collectStrongList($)
      source = "strong-list"
    }
  }

  if (!answers.length) {
    throw new Error(
      "No answers found with the selected source. Provide answers manually in tools/input.txt or adjust --answer-source/--skip-extract."
    )
  }
  return { answers, html, source }
}

function writeInput(answers, outputPath, dryRun) {
  const payload = `${answers.join("\n\n")}\n`
  if (dryRun) return
  fs.writeFileSync(outputPath, payload, "utf8")
}

function runHashRoundTrip(inputPath, title, dryRun) {
  const fnvScript = path.join(scriptDir, "fnv1a64-convert.mjs")
  const cmd = [
    "node",
    fnvScript,
    "--round-trip",
    "--input",
    inputPath,
    "--title",
    title || path.basename(inputPath, path.extname(inputPath)),
  ]
  if (dryRun) {
    return { command: cmd.join(" ") }
  }
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit" })
  if (result.status !== 0) {
    throw new Error("fnv1a64-convert round-trip failed.")
  }
  return { command: cmd.join(" ") }
}

function loadHashes(hashesPath) {
  if (!fs.existsSync(hashesPath)) {
    throw new Error(`Hashes file not found at ${hashesPath}`)
  }
  const lines = fs
    .readFileSync(hashesPath, "utf8")
    .split(/\r?\n/)

  const groups = []
  let current = []
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      if (current.length) {
        groups.push(current)
        current = []
      }
    } else {
      current.push(trimmed)
    }
  })
  if (current.length) groups.push(current)
  if (!groups.length) {
    throw new Error(`No hashes parsed from ${hashesPath}`)
  }
  return groups
}

function parseAnswerKey(html) {
  const marker = 'id="exercise-answer-key"'
  const start = html.indexOf(marker)
  if (start === -1) throw new Error("Answer key script tag not found.")

  const openTagEnd = html.indexOf(">", start)
  const closeTagStart = html.indexOf("</script>", openTagEnd)
  if (openTagEnd === -1 || closeTagStart === -1) {
    throw new Error("Unable to locate answer key script boundaries.")
  }

  const jsonText = html.slice(openTagEnd + 1, closeTagStart)
  const indentMatch = jsonText.match(/\n([ \t]+)\S/)
  const indent = indentMatch ? indentMatch[1] : ""
  const parsed = JSON.parse(jsonText)
  return { answerKey: parsed, openTagEnd, closeTagStart, indent }
}

function applyHashesToAnswerKey(answerKey, hashGroups, answersMode = "all") {
  const answerArray = answerKey?.answerArrays?.answerArray
  if (!answerArray) throw new Error("answerArrays.answerArray missing in answer key JSON.")
  const questionKeys = Object.keys(answerArray).sort()
  if (hashGroups.length < questionKeys.length) {
    throw new Error(
      `Hash groups (${hashGroups.length}) are less than question count (${questionKeys.length}).`
    )
  }
  questionKeys.forEach((key, idx) => {
    const entry = answerArray[key]
    const group = hashGroups[idx] || []
    if (!group.length) throw new Error(`No hashes available for question ${key}`)
    if (answersMode === "alts") {
      entry.answersAccepted = group.map((token) => [token])
    } else {
      entry.answersAccepted = [group]
    }
  })
  return answerKey
}

function writeAnswerKeyHtml(html, updatedKey, openTagEnd, closeTagStart, indent, dryRun, htmlPath) {
  const pretty = JSON.stringify(updatedKey, null, 2)
  const formatted = pretty
    .split("\n")
    .map((line) => (indent ? `${indent}${line}` : line))
    .join("\n")
  const nextHtml = `${html.slice(0, openTagEnd + 1)}\n${formatted}\n${html.slice(closeTagStart)}`
  if (dryRun) return nextHtml
  fs.writeFileSync(htmlPath, nextHtml, "utf8")
  return nextHtml
}

function encodeWord(value) {
  return value
    .split("")
    .map((ch) => `&#${ch.codePointAt(0)};`)
    .join("")
}

function printEncodedTable(answers) {
  if (!answers.length) return
  console.log("\nEncoded answers for <p> tag obfuscation (wrap in <b>…</b> as needed):")
  answers.forEach((ans, idx) => {
    console.log(`${String(idx + 1).padStart(2, "0")}. ${ans} -> ${encodeWord(ans)}`)
  })
}

function printSuggestedConvertCommand(targetRelative, answerFields, answerUi) {
  const base = `node js/convert-legacy-gated.mjs ${targetRelative} --answer-fields ${answerFields} --diff-preview`
  const withUi = answerUi ? `${base} --answer-ui ${answerUi}` : base
  console.log("\nSuggested convert-legacy-gated diff preview command:")
  console.log(withUi)
}

function printObfuscateCommand(targetRelative, obfuscate) {
  if (obfuscate === "none") {
    console.log("\nObfuscation skipped (obfuscate=none).")
    return
  }
  if (obfuscate === "p") {
    console.log("\nObfuscate full <p> text:")
    console.log(`node tools/encode-p-text.mjs --write ${targetRelative}`)
    return
  }
  // default span mode: rely on encoded answers table for manual span encoding.
  console.log("\nObfuscate span-only: use the encoded answers table above within spans/b tags.")
}

async function main() {
  const args = parseArgs(process.argv)

  const answerSettings = await promptForAnswerSettings(args.answerFields, args.answerUi)
  args.answerFields = answerSettings.fields
  args.answerUi = answerSettings.ui

  let targetInput = args.target
  if (!targetInput) {
    targetInput = await promptForTarget()
  }
  if (!targetInput) {
    fail("No target provided. Use --target <exercise.html> or enter a path when prompted.")
  }

  const targetPath = path.isAbsolute(targetInput)
    ? targetInput
    : path.resolve(projectRoot, targetInput)
  if (!fs.existsSync(targetPath)) {
    fail(`Target file not found: ${targetPath}`)
  }
  const title = (args.title || path.basename(targetPath, path.extname(targetPath))).trim()
  const targetRelative = path.relative(projectRoot, targetPath)

  let answers = []
  let initialHtml = ""

  if (!args.skipExtract) {
    logStepStart("Extract answers to tools/input.txt")
    const extraction = extractAnswersWithMode(targetPath, args.answerSource)
    answers = extraction.answers
    initialHtml = extraction.html
    writeInput(answers, defaultPaths.input, args.dryRun)
    logStepOk(
      `Extract answers to tools/input.txt (${answers.length} found${args.dryRun ? ", dry-run" : ""}, source: ${
        extraction.source
      })`
    )
  } else {
    console.log("Skipped answer extraction.")
  }

  if (!args.skipHash) {
    logStepStart("Hash round-trip (fnv1a64-convert)")
    const { command } = runHashRoundTrip(defaultPaths.input, title, args.dryRun)
    logStepOk(`Hash round-trip (fnv1a64-convert) ${args.dryRun ? "[not run]" : "completed"}`)
    console.log(`Command: ${command}${args.dryRun ? " [not run]" : ""}`)
  } else {
    console.log("Skipped hash generation.")
  }

  if (!args.skipUpdate) {
    logStepStart("Update answer key JSON with hashes")
    if (!initialHtml) {
      initialHtml = fs.readFileSync(targetPath, "utf8")
    }
    const hashGroups = loadHashes(defaultPaths.hashes)
    const { answerKey, openTagEnd, closeTagStart, indent } = parseAnswerKey(initialHtml)
    const updatedKey = applyHashesToAnswerKey(answerKey, hashGroups, args.answersMode)
    writeAnswerKeyHtml(initialHtml, updatedKey, openTagEnd, closeTagStart, indent, args.dryRun, targetPath)
    logStepOk(
      `${args.dryRun ? "Would update" : "Updated"} answersAccepted in ${targetRelative} using tools/hashes.txt`
    )
  } else {
    console.log("Skipped answer key update.")
  }

  if (!answers.length && fs.existsSync(defaultPaths.input)) {
    answers = fs
      .readFileSync(defaultPaths.input, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  }
  printEncodedTable(answers)
  printSuggestedConvertCommand(targetRelative, args.answerFields, args.answerUi)
  printObfuscateCommand(targetRelative, args.obfuscate)

  console.log(
    `\nCompleted pipeline: extraction ${args.skipExtract ? "skipped" : "done"}, hashing ${
      args.skipHash ? "skipped" : "done"
    }, answer-key ${args.skipUpdate ? "skipped" : "updated"}.`
  )
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
