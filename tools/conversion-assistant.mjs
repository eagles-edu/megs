#!/usr/bin/env node
/**
 * Conversion assistant master script based on docs/asscon.md.
 *
 * Purpose:
 * - Coordinate the fixed conversion workflow by printing prompts and running existing scripts.
 *
 * Workflow (in order):
 * 1) Print Prompt1 (answer extraction instructions for tools/input.txt).
 * 2) Run fnv1a64 round-trip to generate hashes and dev dictionary.
 * 3) Run convert-legacy-gated with the chosen answer-field settings (diff preview on by default).
 * 4) Print Prompt4 and inject tools/hashes.txt into the answer key JSON.
 * 5) Run sync-answer-lengths to align lengths/min/max with answersAccepted.
 * 6) Run encode-p-text obfuscation unless obfuscation=none.
 * 7) Run normalize-exinstruct unless normalize-exinstruct=skip.
 *
 * Usage examples:
 * - node tools/conversion-assistant.mjs --target exercise-4-adverbs/411-using-adverbs-part-1.html
 * - node tools/conversion-assistant.mjs --target exercise-4-adverbs/411-using-adverbs-part-1.html --title 411-using-adverbs-part-1 --answer-fields 2 --answer-source undies --answers-mode alts --obfuscation highlighted
 *
 * Flags and inputs:
 * - Flags override prompts; missing values are collected interactively.
 * - Prompts pause between steps; press Enter to continue or Q to quit.
 * - --answer-fields 7 implies textarea (fields=1, --answer-ui textarea).
 * - Use --no-diff-preview to run convert-legacy-gated without diff preview.
 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import readline from "node:readline"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, "..")

const DEFAULTS = {
  answerFields: 1,
  answerUi: "",
  answerSource: "undies",
  answersMode: "all",
  ignoreExample: "none",
  obfuscation: "form-highlighted",
  diffPreview: true,
  normalizeExinstruct: "skip",
}

const VALID_ANSWER_SOURCES = ["undies", "p", "auto", "sentence"]
const VALID_ANSWERS_MODES = ["all", "alts"]
const VALID_IGNORE_EXAMPLE = ["auto", "prefix", "first", "none"]
const VALID_OBFUSCATION = ["form", "form-highlighted", "highlighted", "all", "none"]
const VALID_NORMALIZE_EXINSTRUCT = ["write", "dry-run", "skip"]

const ANSWER_SOURCE_TEXT = {
  undies:
    'by extracting p-tag answers from between `<span class="undies">`, `<b>`, and `<strong>` tags in the target HTML',
  p: "by reading exercise p-tag instructions, reading each question, manually determining each correct answer",
  auto:
    'by extracting p-tag answers from between `<span class="undies">`, `<b>`, and `<strong>` tags in the target HTML question blocks; else, if tags aren\'t present, via **p** by reading exercise p-tag instructions, reading each question, determining each correct answer',
  sentence:
    "by extracting the full sentence text verbatim from each form-based question block (p-tag), sans HTML (include all non-blank words, not just the underlined answers); warn that linting/IDE wrapping and source text can introduce spacing/punctuation artifacts, and offer optional USA spelling/grammar/vernacular/usage-only normalization (including fixing \", -> ,\") with explicit approval",
}

const ANSWERS_MODE_TEXT = {
  all:
    'ALL: one combo per QB (question block); if a QB contains ALT blocks, keep one combo per ALT block; all hashes in each combo required: `"answersAccepted": [["hash1","hash2",...]]`\n\n',
  alts:
    'ALTS: one combo per ALT block (blank-line separated inside a QB); each combo may contain multiple hashes; only one combo required: `"answersAccepted": [["hash1","hash2"],["hash1","hash3"],...]`\n\n',
}

const INPUT_FORMAT_TEXT =
  "Format tools/input.txt using Answer Line (AL) / ALTernate answers (ALT) / Question Block (QB): AL separated by \\n, ALT separated by \\n\\n, QB separated by \\n\\n\\n. Include all ALT combos when multiple answers are possible. Each ALT block in a QB must have the same number of lines (one per blank)."

const US_WORD_RULES = [
  {
    from: "colour",
    to: "color",
    suffixes: ["", "s", "ed", "ing", "ful", "fully", "fulness", "less", "lessly", "lessness"],
  },
  {
    from: "favourit",
    to: "favorit",
    suffixes: ["e", "es", "ed", "ing", "ism", "isms"],
  },
  {
    from: "centre",
    to: "center",
    suffixes: ["", "s", { fromSuffix: "d", toSuffix: "ed" }, { fromSuffix: "ing", toSuffix: "ing", dropFromE: true }],
  },
  {
    from: "metre",
    to: "meter",
    suffixes: ["", "s", { fromSuffix: "d", toSuffix: "ed" }, { fromSuffix: "ing", toSuffix: "ing", dropFromE: true }],
  },
  { from: "kilometre", to: "kilometer", suffixes: ["", "s"] },
  {
    from: "litre",
    to: "liter",
    suffixes: ["", "s", { fromSuffix: "d", toSuffix: "ed" }, { fromSuffix: "ing", toSuffix: "ing", dropFromE: true }],
  },
  { from: "theatre", to: "theater", suffixes: ["", "s"] },
  {
    from: "organis",
    to: "organiz",
    suffixes: [
      "e",
      "es",
      "ed",
      "ing",
      "er",
      "ers",
      "ation",
      "ations",
      "ational",
      "ationally",
      "able",
      "ably",
      "ability",
    ],
  },
  {
    from: "realis",
    to: "realiz",
    suffixes: [
      "e",
      "es",
      "ed",
      "ing",
      "er",
      "ers",
      "ation",
      "ations",
      "ational",
      "ationally",
      "able",
      "ably",
      "ability",
    ],
  },
  {
    from: "analys",
    to: "analyz",
    suffixes: ["e", "es", "ed", "ing", "er", "ers", "able", "ably", "ability"],
  },
  { from: "defenc", to: "defens", suffixes: ["e", "es", "eless", "elessly", "elessness"] },
  { from: "offenc", to: "offens", suffixes: ["e", "es", "eless", "elessly", "elessness"] },
  { from: "licenc", to: "licens", suffixes: ["e", "es", "ed", "ing", "er", "ers"] },
  { from: "travell", to: "travel", suffixes: ["ed", "ing", "er", "ers"] },
  { from: "cancell", to: "cancel", suffixes: ["ed", "ing"] },
  { from: "jewell", to: "jewel", suffixes: ["ed", "ing", "er", "ers"] },
  {
    from: "neighbour",
    to: "neighbor",
    suffixes: ["", "s", "ed", "ing", "hood", "hoods", "ly", "liness", "linesses"],
  },
  { from: "grey", to: "gray", suffixes: ["", "s", "ed", "ing", "er", "est", "ish", "ness"] },
]

const US_WORD_EXACT = [
  { from: "jewellery", to: "jewelry" },
  { from: "programme", to: "program" },
  { from: "programmes", to: "programs" },
  { from: "learnt", to: "learned" },
  { from: "towards", to: "toward" },
  { from: "amongst", to: "among" },
  { from: "whilst", to: "while" },
  { from: "cheque", to: "check" },
  { from: "cheques", to: "checks" },
  { from: "lift", to: "elevator" },
  { from: "pram", to: "stroller" },
]

const US_WORD_REPLACEMENTS = buildUsWordReplacements(US_WORD_RULES, US_WORD_EXACT)

const PAUSE_PROMPT =
  "PAUSE, DISPLAY PROMPT, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS."
const PAUSE_COMMAND =
  "PAUSE, DISPLAY COMMAND, PRESS ENTER TO EXECUTE, verify completion, & continue, OR Q TO EXIT AND FIX PARAMETERS."

const RUN_SETTINGS = {
  args: null,
  targetDisplay: "",
  provided: null,
  prompted: null,
}

let runSettingsPrinted = false

function formatSettingLine(label, value, source) {
  const suffix = source ? ` (${source})` : ""
  return `- ${label}: ${value}${suffix}`
}

function resolveSettingSource(settings, key) {
  const provided = settings?.provided || {}
  const prompted = settings?.prompted || {}
  if (provided[key]) return "cli"
  if (prompted[key]) return "prompt"
  return "default"
}

function resolveAnswerUiSource(settings) {
  const args = settings?.args || {}
  const provided = settings?.provided || {}
  const prompted = settings?.prompted || {}
  if (provided.answerUi) return "cli"
  if (args.answerUi && (provided.answerFields || prompted.answerFields)) return "derived"
  if (prompted.answerUi) return "prompt"
  return "default"
}

function formatRunSettings(settings) {
  if (!settings || !settings.args) return null
  const args = settings.args
  const target = settings.targetDisplay || args.target || "(none)"
  const answerUi = args.answerUi || "(none)"
  const lines = [
    "",
    "Conversion settings used:",
    formatSettingLine("target", target, resolveSettingSource(settings, "target")),
    formatSettingLine("title", args.title || "(none)", resolveSettingSource(settings, "title")),
    formatSettingLine(
      "answer-fields",
      args.answerFields,
      resolveSettingSource(settings, "answerFields")
    ),
    formatSettingLine("answer-ui", answerUi, resolveAnswerUiSource(settings)),
    formatSettingLine(
      "answer-source",
      args.answerSource,
      resolveSettingSource(settings, "answerSource")
    ),
    formatSettingLine(
      "answers-mode",
      args.answersMode,
      resolveSettingSource(settings, "answersMode")
    ),
    formatSettingLine(
      "ignore-example",
      args.ignoreExample,
      resolveSettingSource(settings, "ignoreExample")
    ),
    formatSettingLine(
      "obfuscation",
      args.obfuscation,
      resolveSettingSource(settings, "obfuscation")
    ),
    formatSettingLine(
      "diff-preview",
      args.diffPreview,
      resolveSettingSource(settings, "diffPreview")
    ),
    formatSettingLine(
      "normalize-exinstruct",
      args.normalizeExinstruct,
      resolveSettingSource(settings, "normalizeExinstruct")
    ),
  ]
  return lines.join("\n")
}

function printRunSettings(settings) {
  if (runSettingsPrinted) return
  const output = formatRunSettings(settings)
  if (!output) return
  runSettingsPrinted = true
  console.log(output)
}

process.on("exit", () => {
  printRunSettings(RUN_SETTINGS)
})

function fail(message) {
  console.error(message)
  process.exit(1)
}

function printUsage() {
  console.log(`Usage:
  node tools/conversion-assistant.mjs --target <target-path> [options]

Options:
  --target, -f            Target HTML path (relative preferred)
  --title, -t             Title/ID (defaults to filename slug)
  --answer-fields <1-7>   1-6 for inputs, 7 for textarea (sets --answer-ui textarea)
  --answer-ui <value>     Force answer UI (e.g., textarea)
  --answer-source <val>   undies | p | auto | sentence (default undies)
  --answers-mode <val>    all | alts (default all)
  --ignore-example [val]  auto | prefix | first | none (default none when flag is unset; standalone defaults to prefix)
  --obfuscation <val>     form | form-highlighted | highlighted | all | none (default form-highlighted)
  --normalize-exinstruct [mode]  write | dry-run | skip (default skip)
  --no-normalize-exinstruct      skip normalize-exinstruct
  --diff-preview [bool]   true | false (default true)
  --no-diff-preview       disable diff preview
  --help                  show help
`)
}

function parseBoolean(input) {
  const value = String(input || "").trim().toLowerCase()
  if (["true", "t", "yes", "y", "1"].includes(value)) return true
  if (["false", "f", "no", "n", "0"].includes(value)) return false
  return null
}

function applyAnswerFields(raw, args, provided) {
  const num = Number(raw)
  if (num === 7) {
    args.answerFields = 1
    if (!args.answerUi) {
      args.answerUi = "textarea"
      provided.answerUi = true
    }
    return
  }
  if (Number.isInteger(num) && num >= 1 && num <= 6) {
    args.answerFields = num
    return
  }
  fail("Invalid --answer-fields value. Use 1-6 or 7 for textarea.")
}

function parseArgs(argv) {
  const args = {
    target: "",
    title: "",
    ...DEFAULTS,
  }
  const provided = {
    target: false,
    title: false,
    answerFields: false,
    answerUi: false,
    answerSource: false,
    answersMode: false,
    ignoreExample: false,
    obfuscation: false,
    normalizeExinstruct: false,
    diffPreview: false,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else if (arg === "--target" || arg === "-f") {
      args.target = argv[++i] || ""
      provided.target = true
    } else if (arg === "--title" || arg === "-t") {
      args.title = argv[++i] || ""
      provided.title = true
    } else if (arg === "--answer-fields") {
      applyAnswerFields(argv[++i], args, provided)
      provided.answerFields = true
    } else if (arg === "--answer-ui") {
      args.answerUi = (argv[++i] || "").trim()
      provided.answerUi = true
    } else if (arg === "--answer-source") {
      args.answerSource = (argv[++i] || "").trim().toLowerCase()
      provided.answerSource = true
    } else if (arg === "--answers-mode") {
      args.answersMode = (argv[++i] || "").trim().toLowerCase()
      provided.answersMode = true
    } else if (arg === "--ignore-example") {
      const candidate = argv[i + 1]
      if (candidate && !candidate.startsWith("-")) {
        args.ignoreExample = candidate.trim().toLowerCase()
        i += 1
      } else {
        args.ignoreExample = "prefix"
      }
      provided.ignoreExample = true
    } else if (arg === "--obfuscation") {
      args.obfuscation = (argv[++i] || "").trim().toLowerCase()
      provided.obfuscation = true
    } else if (arg === "--normalize-exinstruct") {
      const candidate = argv[i + 1]
      if (candidate && !candidate.startsWith("-")) {
        args.normalizeExinstruct = candidate.trim().toLowerCase()
        i += 1
      } else {
        args.normalizeExinstruct = "write"
      }
      provided.normalizeExinstruct = true
    } else if (arg === "--no-normalize-exinstruct") {
      args.normalizeExinstruct = "skip"
      provided.normalizeExinstruct = true
    } else if (arg === "--diff-preview") {
      const candidate = argv[i + 1]
      if (candidate && !candidate.startsWith("-")) {
        const parsed = parseBoolean(candidate)
        if (parsed === null) {
          fail("Invalid --diff-preview value. Use true or false.")
        }
        args.diffPreview = parsed
        i += 1
      } else {
        args.diffPreview = true
      }
      provided.diffPreview = true
    } else if (arg === "--no-diff-preview") {
      args.diffPreview = false
      provided.diffPreview = true
    } else if (!provided.target && !arg.startsWith("-")) {
      args.target = arg
      provided.target = true
    } else {
      fail(`Unknown argument: ${arg}`)
    }
  }

  return { args, provided }
}

function createPrompter() {
  if (!process.stdin.isTTY) return null
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
    input = (await ask("Enter <target-path> relative path: ")).trim()
    if (!input) {
      console.log("Target path is required.")
    }
  }
  return input
}

async function promptAnswerFields(ask) {
  let resolved = null
  while (!resolved) {
    const input = (await ask("Select # of answer fields (1-6) or 7 for textarea [default 1]: "))
      .trim()
    if (!input) {
      resolved = { fields: DEFAULTS.answerFields, ui: DEFAULTS.answerUi }
      continue
    }
    const num = Number(input)
    if (Number.isInteger(num) && num >= 1 && num <= 6) {
      resolved = { fields: num, ui: "" }
      continue
    }
    if (num === 7) {
      resolved = { fields: 1, ui: "textarea" }
      continue
    }
    console.log("Enter 1-6 to set --answer-fields, or 7 for --answer-ui textarea.")
  }
  return resolved
}

async function promptTitle(ask, defaultTitle) {
  const input = (await ask(`title/ID [default ${defaultTitle}]: `)).trim()
  return input || defaultTitle
}

async function promptChoice(ask, question, allowed, defaultValue) {
  const choiceLabel = allowed.join("|")
  let resolved = ""
  while (!resolved) {
    const input = (await ask(`${question} (${choiceLabel}) [default ${defaultValue}]: `))
      .trim()
      .toLowerCase()
    if (!input) {
      resolved = defaultValue
      continue
    }
    if (allowed.includes(input)) {
      resolved = input
      continue
    }
    console.log(`Invalid input. Use: ${allowed.join(", ")}.`)
  }
  return resolved
}

async function promptDiffPreview(ask, defaultValue) {
  let resolved = null
  while (resolved === null) {
    const input = (await ask(`diff preview true or false [default ${defaultValue}]: `))
      .trim()
      .toLowerCase()
    if (!input) {
      resolved = defaultValue
      continue
    }
    const parsed = parseBoolean(input)
    if (parsed !== null) {
      resolved = parsed
      continue
    }
    console.log("Enter true or false.")
  }
  return resolved
}

function normalizeChoice(value, allowed, label) {
  const normalized = (value || "").trim().toLowerCase()
  if (!allowed.includes(normalized)) {
    fail(`Invalid ${label}. Use: ${allowed.join(", ")}.`)
  }
  return normalized
}

function buildUsWordReplacements(rules, exact) {
  const map = new Map()
  const add = (from, to, force = false) => {
    if (!from || !to) return
    const key = from.toLowerCase()
    if (map.has(key) && !force) return
    map.set(key, { from, to })
  }

  rules.forEach((rule) => {
    const suffixes = Array.isArray(rule.suffixes) && rule.suffixes.length ? rule.suffixes : [""]
    const fromDrop = new Set(rule.fromDropESuffixes || [])
    const toDrop = new Set(rule.toDropESuffixes || [])
    suffixes.forEach((suffix) => {
      const entry =
        typeof suffix === "string"
          ? { fromSuffix: suffix, toSuffix: suffix }
          : {
              fromSuffix: suffix.fromSuffix,
              toSuffix: suffix.toSuffix,
              dropFromE: suffix.dropFromE,
              dropToE: suffix.dropToE,
            }
      const fromSuffix = entry.fromSuffix ?? ""
      const toSuffix = entry.toSuffix ?? fromSuffix
      const dropFromE =
        typeof entry.dropFromE === "boolean" ? entry.dropFromE : fromDrop.has(fromSuffix)
      const dropToE =
        typeof entry.dropToE === "boolean" ? entry.dropToE : toDrop.has(toSuffix)
      const fromBase =
        dropFromE && rule.from.endsWith("e") ? rule.from.slice(0, -1) : rule.from
      const toBase = dropToE && rule.to.endsWith("e") ? rule.to.slice(0, -1) : rule.to
      add(fromBase + fromSuffix, toBase + toSuffix)
    })
  })

  exact.forEach((entry) => add(entry.from, entry.to, true))
  return Array.from(map.values())
}

function scanExampleBlocks(html) {
  const matches = []
  const regex =
    /<(?:span|h2)[^>]*class="[^"]*nn_sliders-(?:toggle-inner|title)[^"]*"[^>]*>([^<]*)/gi
  let match = null
  while ((match = regex.exec(html))) {
    const text = match[1].replace(/\s+/g, " ").trim()
    if (/^Example[.:]/i.test(text)) {
      matches.push(text)
    }
  }
  return matches
}

async function resolveIgnoreExampleAuto(targetAbsolute, ask, prompted) {
  const html = fs.readFileSync(targetAbsolute, "utf8")
  const matches = scanExampleBlocks(html)
  if (!matches.length) {
    console.log(
      "[conversion-assistant] No Example-prefixed question blocks found; using ignore-example=none."
    )
    return "none"
  }

  console.log(
    `[conversion-assistant] Found ${matches.length} Example-prefixed question block(s).`
  )
  matches.slice(0, 3).forEach((text, index) => {
    console.log(`  Example ${index + 1}: ${text}`)
  })
  if (matches.length > 3) {
    console.log(`  ...and ${matches.length - 3} more.`)
  }

  if (!ask) {
    console.log("[conversion-assistant] No TTY available; defaulting ignore-example=prefix.")
    return "prefix"
  }

  if (prompted) {
    prompted.ignoreExample = true
  }
  return await promptChoice(
    ask,
    "Example handling for detected blocks --ignore-example",
    ["prefix", "first", "none"],
    "prefix"
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function applyMatchCase(source, replacement) {
  if (!source) return replacement
  const upper = source.toUpperCase()
  const lower = source.toLowerCase()
  if (source === upper) return replacement.toUpperCase()
  if (source[0] === source[0].toUpperCase() && source.slice(1) === lower.slice(1)) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }
  return replacement
}

function applyUsWordReplacements(text) {
  let out = text
  for (const entry of US_WORD_REPLACEMENTS) {
    const regex = new RegExp(`\\b${escapeRegExp(entry.from)}\\b`, "gi")
    out = out.replace(regex, (match) => applyMatchCase(match, entry.to))
  }
  return out
}

function findUsSpellingCandidates(raw) {
  const matches = []
  const lines = (raw || "").split(/\r?\n/)
  lines.forEach((line, index) => {
    if (!line.trim()) return
    const hits = []
    for (const entry of US_WORD_REPLACEMENTS) {
      const regex = new RegExp(`\\b${escapeRegExp(entry.from)}\\b`, "i")
      if (regex.test(line)) hits.push(entry.from)
    }
    if (hits.length) {
      matches.push({ line: index + 1, hits, text: line })
    }
  })
  return matches
}

function findSentenceArtifacts(raw) {
  const issues = []
  const lines = (raw || "").split(/\r?\n/)
  lines.forEach((line, index) => {
    if (!line.trim()) return
    const flags = []
    if (/\s{2,}/.test(line)) flags.push("multi-space")
    if (/\s+[,.!?;:]/.test(line)) flags.push("space-before-punct")
    if (/"\s*[,.](?!")/.test(line)) flags.push("quote-punct-order")
    if (/\.\.(?!\.)/.test(line)) flags.push("double-period")
    if (/\s+['\u2019]/.test(line) || /['\u2019]\s+/.test(line)) {
      flags.push("space-around-apostrophe")
    }
    if (flags.length) {
      issues.push({ line: index + 1, flags, text: line })
    }
  })
  return issues
}

function findShortSentenceLines(raw) {
  const shortLines = []
  const lines = (raw || "").split(/\r?\n/)
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const words = trimmed.split(/\s+/)
    if (words.length <= 2) {
      shortLines.push({ line: index + 1, text: line })
    }
  })
  const totalLines = lines.filter((line) => line.trim()).length
  return { totalLines, shortLines }
}

function normalizeSentenceLine(line) {
  let out = line.replace(/\s+/g, " ")
  out = out.replace(/\s+([,.;:?!])/g, "$1")
  out = out.replace(/"\s*([,.])(?!")/g, '$1"')
  out = out.replace(/\.\.(?!\.)/g, ".")
  out = out.replace(/\s+(['\u2019])/g, "$1")
  out = out.replace(/(['\u2019])\s+/g, "$1")
  out = applyUsWordReplacements(out)
  return out.trim()
}

function normalizeSentenceInput(raw) {
  const lines = (raw || "").split(/\r?\n/)
  const normalized = lines.map((line) => (line.trim() ? normalizeSentenceLine(line) : ""))
  let output = normalized.join("\n")
  if (!output.endsWith("\n")) output += "\n"
  return output
}

async function reviewSentenceInput(inputPath, ask) {
  if (!fs.existsSync(inputPath)) {
    fail(`tools/input.txt not found at ${inputPath}.`)
  }
  const raw = fs.readFileSync(inputPath, "utf8")
  const issues = findSentenceArtifacts(raw)
  const spellingIssues = findUsSpellingCandidates(raw)
  const { totalLines, shortLines } = findShortSentenceLines(raw)
  const shortRatio = totalLines ? shortLines.length / totalLines : 0
  let warned = false

  if (shortRatio >= 0.4 && shortLines.length) {
    warned = true
    console.log(
      `[conversion-assistant] ${shortLines.length}/${totalLines} lines are 1-2 words; verify sentence extraction.`
    )
    shortLines.slice(0, 5).forEach((entry) => {
      console.log(`  L${entry.line}: ${entry.text}`)
    })
    if (shortLines.length > 5) {
      console.log(`  ...and ${shortLines.length - 5} more.`)
    }
  }

  if (!issues.length && !spellingIssues.length) {
    if (!warned) {
      console.log("[conversion-assistant] No sentence artifacts detected in tools/input.txt.")
    }
    return
  }

  if (issues.length) {
    console.log("[conversion-assistant] Sentence-mode artifacts detected in tools/input.txt:")
    issues.slice(0, 5).forEach((issue) => {
      console.log(`  L${issue.line}: ${issue.flags.join(", ")} :: ${issue.text}`)
    })
    if (issues.length > 5) {
      console.log(`  ...and ${issues.length - 5} more.`)
    }
  }

  if (spellingIssues.length) {
    console.log("[conversion-assistant] Sentence-mode US spelling/usage candidates detected:")
    spellingIssues.slice(0, 5).forEach((issue) => {
      console.log(`  L${issue.line}: ${issue.hits.join(", ")} :: ${issue.text}`)
    })
    if (spellingIssues.length > 5) {
      console.log(`  ...and ${spellingIssues.length - 5} more.`)
    }
  }

  if (!ask) {
    console.log("[conversion-assistant] No TTY available; skipping normalization.")
    return
  }

  const response = (await ask(
    "Normalize sentence answers to USA spelling/grammar/vernacular/usage (includes spacing/punctuation fixes and \", -> ,\")? [y/N]: "
  ))
    .trim()
    .toLowerCase()
  if (!["y", "yes"].includes(response)) {
    console.log("[conversion-assistant] Keeping verbatim sentence text.")
    return
  }

  const normalized = normalizeSentenceInput(raw)
  if (normalized === raw) {
    console.log("[conversion-assistant] Sentence normalization found no changes.")
    return
  }
  fs.writeFileSync(inputPath, normalized, "utf8")
  console.log("[conversion-assistant] Normalized sentence text in tools/input.txt.")
}

function parseAnswerInput(text) {
  const lines = (text || "").split(/\r?\n/)
  const questions = []
  let currentQuestion = []
  let currentAlt = []
  let blankStreak = 0

  function pushAlt() {
    if (currentAlt.length) {
      currentQuestion.push(currentAlt)
      currentAlt = []
    }
  }

  function pushQuestion() {
    pushAlt()
    if (currentQuestion.length) {
      questions.push(currentQuestion)
      currentQuestion = []
    }
  }

  for (const line of lines) {
    if (line.trim() === "") {
      blankStreak += 1
      if (blankStreak === 1) {
        pushAlt()
      } else if (blankStreak === 2) {
        pushQuestion()
      }
      continue
    }
    blankStreak = 0
    currentAlt.push(line)
  }

  pushQuestion()
  return questions
}

function formatAnswerInput(questions) {
  if (!questions.length) return "\n"
  const blocks = questions.map((alts) => alts.map((lines) => lines.join("\n")).join("\n\n"))
  return `${blocks.join("\n\n\n")}\n`
}

function sortAnswerKeys(keys) {
  return keys.slice().sort((a, b) => {
    const aNum = parseInt(String(a).replace(/\D/g, ""), 10)
    const bNum = parseInt(String(b).replace(/\D/g, ""), 10)
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) return aNum - bNum
    return String(a).localeCompare(String(b))
  })
}

function parseHashCombos(rawHashes) {
  const questions = parseAnswerInput(rawHashes)
  return questions.map((alts, index) => {
    const combos = alts
      .map((lines) => lines.map((line) => line.trim()).filter(Boolean))
      .filter((combo) => combo.length)
    if (!combos.length) {
      fail(`tools/hashes.txt has no hashes for question ${index + 1}.`)
    }
    return combos
  })
}

function injectHashesIntoAnswerKey(targetPath, hashesPath, answersMode) {
  if (!fs.existsSync(hashesPath)) {
    fail(`tools/hashes.txt not found at ${hashesPath}. Run fnv1a64 round-trip first.`)
  }
  const rawHashes = fs.readFileSync(hashesPath, "utf8")
  if (!rawHashes.trim()) {
    fail("tools/hashes.txt is empty. Run fnv1a64 round-trip first.")
  }
  const mode = answersMode === "alts" ? "alts" : "all"
  const combosByQuestion = parseHashCombos(rawHashes)
  const rawHtml = fs.readFileSync(targetPath, "utf8")
  const pattern =
    /(<script[^>]*id=["']exercise-answer-key["'][^>]*>)([\s\S]*?)(<\/script>)/i
  const match = rawHtml.match(pattern)
  if (!match) {
    fail(`exercise-answer-key script not found in ${path.relative(repoRoot, targetPath)}`)
  }
  let parsed
  try {
    parsed = JSON.parse(match[2].trim())
  } catch (error) {
    fail(`exercise-answer-key JSON invalid in ${path.relative(repoRoot, targetPath)}: ${error.message}`)
  }
  const answerArray = parsed?.answerArrays?.answerArray
  if (!answerArray || typeof answerArray !== "object") {
    fail(`answerArrays.answerArray missing in ${path.relative(repoRoot, targetPath)}`)
  }
  const keys = sortAnswerKeys(Object.keys(answerArray))
  if (keys.length !== combosByQuestion.length) {
    fail(
      `answersAccepted mismatch: ${keys.length} questions in answer key vs ${combosByQuestion.length} in tools/hashes.txt (${mode} mode).`
    )
  }
  keys.forEach((key, index) => {
    const entry = answerArray[key]
    if (!entry || typeof entry !== "object") {
      fail(`answerArrays.answerArray.${key} is missing or invalid.`)
    }
    entry.answersAccepted = combosByQuestion[index].map((combo) => combo.slice())
  })
  const serialized = JSON.stringify(parsed, null, 2)
  const updated = rawHtml.replace(pattern, `$1\n${serialized}\n$3`)
  fs.writeFileSync(targetPath, updated, "utf8")
  console.log(
    `[conversion-assistant] Injected answersAccepted from ${path.relative(
      repoRoot,
      hashesPath
    )} into ${path.relative(repoRoot, targetPath)} (${mode} mode).`
  )
}

function cartesianProduct(lists) {
  return lists.reduce((acc, list) => {
    const next = []
    for (const prefix of acc) {
      for (const item of list) {
        next.push([...prefix, item])
      }
    }
    return next
  }, [[]])
}

function normalizeAnswerCombos(inputPath) {
  if (!fs.existsSync(inputPath)) {
    fail(`tools/input.txt not found at ${inputPath}.`)
  }
  const raw = fs.readFileSync(inputPath, "utf8")
  if (!raw.trim()) {
    fail("tools/input.txt is empty. Fill it before continuing.")
  }

  const questions = parseAnswerInput(raw)
  let changed = false
  const issues = []
  const maxCombos = 2048

  const normalized = questions.map((alts, index) => {
    const filtered = alts.filter((lines) => lines.length)
    if (!filtered.length) return []
    const lengths = filtered.map((lines) => lines.length)
    const unique = new Set(lengths)
    if (unique.size <= 1) return filtered

    const combos = cartesianProduct(filtered)
    if (combos.length > maxCombos) {
      issues.push({ index: index + 1, lengths, combos: combos.length })
      return filtered
    }
    changed = true
    return combos
  })

  normalized.forEach((alts, index) => {
    if (!alts.length) return
    const lengths = alts.map((lines) => lines.length)
    const unique = new Set(lengths)
    if (unique.size > 1) {
      issues.push({ index: index + 1, lengths })
    }
  })

  if (issues.length) {
    const detail = issues
      .map((issue) => {
        const combos = issue.combos ? ` combos=${issue.combos}` : ""
        return `Q${issue.index} [${issue.lengths.join(", ")}]${combos}`
      })
      .join("; ")
    fail(
      "tools/input.txt has ALT blocks with unequal line counts. " +
        "Expand alternatives so each ALT combo has the same number of lines. " +
        `Issues: ${detail}`
    )
  }

  if (changed) {
    fs.writeFileSync(inputPath, formatAnswerInput(normalized), "utf8")
    console.log(
      `[conversion-assistant] Expanded ALT combos in ${path.relative(repoRoot, inputPath)}.`
    )
  }
}

function resolveTarget(targetInput) {
  if (!targetInput) fail("No target provided. Use --target <path> or enter a path.")
  const absolute = path.isAbsolute(targetInput)
    ? targetInput
    : path.resolve(repoRoot, targetInput)
  if (!fs.existsSync(absolute)) {
    fail(`Target file not found: ${absolute}`)
  }
  return { absolute, display: targetInput }
}

function wrapWithBackticks(value) {
  return "`" + value + "`"
}

function buildPrompt1(target, answerSource) {
  const sourceText = ANSWER_SOURCE_TEXT[answerSource]
  const copyText =
    answerSource === "sentence" ? "copy full sentences" : "copy words / phrases / sentences"
  return (
    '"' +
    wrapWithBackticks(target) +
    " pull answers from question p-tags, " +
    sourceText +
    ", then " +
    copyText +
    " (no question numbers like 1. | 2. ) to `tools/input.txt` (overwrite). Format 'answer1/answer2...' p-tag answers as same question's alts. " +
    INPUT_FORMAT_TEXT +
    "\n\n" +
    '"' +
    "Save my Tokens! [agents.md temp override] - Whenever you are writing edits to local repo files, do not create a unified diff, print the edits, or run other non-requested, token burning machinations, etc.; rather, perform this command, verify completion, and end it."
  )
}

function buildPrompt4(target, answersMode) {
  const modeText = ANSWERS_MODE_TEXT[answersMode]
  return (
    "inject `tools/hashes.txt` into the answer array JSON in " +
    target +
    " following user input for answersAccepted shaping: " +
    modeText + " Save my Tokens! [agents.md temp override] - Whenever you are writing edits to local repo files, do not create a unified diff, print the edits, or run other non-requested, token burning, machinations, etc.; rather, perform this command, verify completion, and end it."
  )
}

function buildCmd2(title) {
  return [
    "node",
    "tools/fnv1a64-convert.mjs",
    "--round-trip",
    "--input",
    "tools/input.txt",
    "--title",
    title,
  ]
}

function buildCmd3(target, answerFields, answerUi, diffPreview, ignoreExample) {
  const cmd = [
    "node",
    "js/convert-legacy-gated.mjs",
    target,
    "--answer-fields",
    String(answerFields),
  ]
  if (answerUi) {
    cmd.push("--answer-ui", answerUi)
  }
  if (diffPreview) {
    cmd.push("--diff-preview")
  }
  if (ignoreExample && ignoreExample !== "auto") {
    cmd.push("--ignore-example", ignoreExample)
  }
  return cmd
}

function buildCmd4(target) {
  return ["node", "tools/sync-answer-lengths.mjs", target]
}

function buildCmd5(target, obfuscation) {
  if (obfuscation === "none") return null
  const scopeMap = {
    all: "all",
    highlighted: "highlighted",
    form: "form",
    "form-highlighted": "form-highlighted",
  }
  const scope = scopeMap[obfuscation] || "all"
  return ["node", "tools/encode-p-text.mjs", "--write", "--scope", scope, target]
}

function buildCmd6(target, normalizeMode) {
  if (normalizeMode === "skip") return null
  const cmd = ["node", "tools/normalize-exinstruct.mjs", "--target", target]
  if (normalizeMode === "write") {
    cmd.push("--write")
  } else if (normalizeMode === "dry-run") {
    cmd.push("--dry-run")
  }
  return cmd
}

function commandToString(cmd) {
  return cmd.join(" ")
}

async function pauseOrQuit(ask, label) {
  console.log(label)
  if (!ask) return true
  const input = (await ask("Press Enter to continue (Q to quit): ")).trim().toLowerCase()
  return input !== "q"
}

function runCommand(cmd, label) {
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: "inherit", cwd: repoRoot })
  if (result.error) {
    fail(`${label} failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    fail(`${label} failed with exit code ${result.status}.`)
  }
}

async function main() {
  const { args, provided } = parseArgs(process.argv)
  const prompted = {
    target: false,
    title: false,
    answerFields: false,
    answerUi: false,
    answerSource: false,
    answersMode: false,
    ignoreExample: false,
    obfuscation: false,
    normalizeExinstruct: false,
    diffPreview: false,
  }
  RUN_SETTINGS.args = args
  RUN_SETTINGS.provided = provided
  RUN_SETTINGS.prompted = prompted
  const prompter = createPrompter()
  const ask = prompter ? prompter.ask : null

  if (!args.target && !ask) {
    fail("No target provided and no TTY available. Use --target <path>.")
  }

  if (!provided.target) {
    if (ask) prompted.target = true
    args.target = await promptTarget(ask)
  }

  const { absolute: targetAbsolute, display: targetDisplay } = resolveTarget(args.target)
  RUN_SETTINGS.targetDisplay = targetDisplay
  const defaultTitle = path.basename(targetAbsolute, path.extname(targetAbsolute))

  if (!provided.title) {
    if (ask) prompted.title = true
    args.title = ask ? await promptTitle(ask, defaultTitle) : defaultTitle
  }
  if (!args.title) args.title = defaultTitle

  if (!provided.answerSource) {
    if (ask) prompted.answerSource = true
    args.answerSource = ask
      ? await promptChoice(
          ask,
          "p-tag answers bolded or underlined --answer-source",
          VALID_ANSWER_SOURCES,
          DEFAULTS.answerSource
        )
      : DEFAULTS.answerSource
  }
  if (!provided.answersMode) {
    if (ask) prompted.answersMode = true
    args.answersMode = ask
      ? await promptChoice(
          ask,
          "multiple provided answers --answers-mode",
          VALID_ANSWERS_MODES,
          DEFAULTS.answersMode
        )
      : DEFAULTS.answersMode
  }
  if (!provided.ignoreExample) {
    if (ask) prompted.ignoreExample = true
    args.ignoreExample = ask
      ? await promptChoice(
          ask,
          "Example handling --ignore-example",
          VALID_IGNORE_EXAMPLE,
          DEFAULTS.ignoreExample
        )
      : DEFAULTS.ignoreExample
  }
  if (!provided.obfuscation) {
    if (ask) prompted.obfuscation = true
    args.obfuscation = ask
      ? await promptChoice(ask, "obfuscation scope", VALID_OBFUSCATION, DEFAULTS.obfuscation)
      : DEFAULTS.obfuscation
  }
  if (!provided.normalizeExinstruct) {
    if (ask) prompted.normalizeExinstruct = true
    args.normalizeExinstruct = ask
      ? await promptChoice(
          ask,
          "normalize exinstruct",
          VALID_NORMALIZE_EXINSTRUCT,
          DEFAULTS.normalizeExinstruct
        )
      : DEFAULTS.normalizeExinstruct
  }
  if (!provided.diffPreview) {
    if (ask) prompted.diffPreview = true
    args.diffPreview = ask ? await promptDiffPreview(ask, DEFAULTS.diffPreview) : DEFAULTS.diffPreview
  }

  args.answerSource = normalizeChoice(args.answerSource, VALID_ANSWER_SOURCES, "answer-source")
  args.answersMode = normalizeChoice(args.answersMode, VALID_ANSWERS_MODES, "answers-mode")
  args.ignoreExample = normalizeChoice(args.ignoreExample, VALID_IGNORE_EXAMPLE, "ignore-example")
  args.obfuscation = normalizeChoice(args.obfuscation, VALID_OBFUSCATION, "obfuscation")
  args.normalizeExinstruct = normalizeChoice(
    args.normalizeExinstruct,
    VALID_NORMALIZE_EXINSTRUCT,
    "normalize-exinstruct"
  )

  if (args.ignoreExample === "auto") {
    args.ignoreExample = await resolveIgnoreExampleAuto(targetAbsolute, ask, prompted)
  }

  const prompt1 = buildPrompt1(targetDisplay, args.answerSource)
  const cmd2 = buildCmd2(args.title)
  const prompt4 = buildPrompt4(targetDisplay, args.answersMode)
  const cmd4 = buildCmd4(targetDisplay)
  const cmd5 = buildCmd5(targetDisplay, args.obfuscation)
  const cmd6 = buildCmd6(targetDisplay, args.normalizeExinstruct)

  console.log("\n1. Print Prompt1:")
  console.log(prompt1)
  if (!(await pauseOrQuit(ask, PAUSE_PROMPT))) {
    prompter?.close()
    process.exit(0)
  }

  if (args.answerSource === "sentence") {
    await reviewSentenceInput(path.join(repoRoot, "tools/input.txt"), ask)
  }

  console.log("\n1b. Normalize tools/input.txt:")
  normalizeAnswerCombos(path.join(repoRoot, "tools/input.txt"))

  if (!provided.answerFields && !provided.answerUi) {
    if (ask) {
      prompted.answerFields = true
      const { fields, ui } = await promptAnswerFields(ask)
      args.answerFields = fields
      if (ui) args.answerUi = ui
    } else {
      args.answerFields = DEFAULTS.answerFields
      args.answerUi = DEFAULTS.answerUi
    }
  }

  const cmd3 = buildCmd3(
    targetDisplay,
    args.answerFields,
    args.answerUi,
    args.diffPreview,
    args.ignoreExample
  )

  console.log("\n2. Execute CMD2:")
  console.log(commandToString(cmd2))
  if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
    prompter?.close()
    process.exit(0)
  }
  runCommand(cmd2, "CMD2")

  console.log("\n3. Execute CMD3:")
  console.log(commandToString(cmd3))
  if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
    prompter?.close()
    process.exit(0)
  }
  runCommand(cmd3, "CMD3")

  console.log("\n4. Print Prompt4:")
  console.log(prompt4)
  if (!(await pauseOrQuit(ask, PAUSE_PROMPT))) {
    prompter?.close()
    process.exit(0)
  }
  injectHashesIntoAnswerKey(targetAbsolute, path.join(repoRoot, "tools/hashes.txt"), args.answersMode)

  console.log("\n5. Execute CMD4:")
  console.log(commandToString(cmd4))
  if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
    prompter?.close()
    process.exit(0)
  }
  runCommand(cmd4, "CMD4")

  if (cmd5) {
    console.log("\n6. Execute CMD5:")
    console.log(commandToString(cmd5))
    if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
      prompter?.close()
      process.exit(0)
    }
    runCommand(cmd5, "CMD5")
  } else {
    console.log("\n6. Execute CMD5:")
    console.log("Obfuscation skipped (scope=none).")
  }

  if (cmd6) {
    console.log("\n7. Execute CMD6:")
    console.log(commandToString(cmd6))
    if (!(await pauseOrQuit(ask, PAUSE_COMMAND))) {
      prompter?.close()
      process.exit(0)
    }
    runCommand(cmd6, "CMD6")
  } else {
    console.log("\n7. Execute CMD6:")
    console.log("Normalize exinstruct skipped (mode=skip).")
  }

  prompter?.close()
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
