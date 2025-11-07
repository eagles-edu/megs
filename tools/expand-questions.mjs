#!/usr/bin/env node
// tools/expand-questions.mjs
// Parsing + rewrite pipeline for interactive exercise forms.
// 1. Parse the HTML, log the <body> pipeline stages, and locate legacy accordion blocks.
// 2. Clone the canonical form scaffold from exercise-1-nouns/111-common-nouns.html
//    (captured via the "exercise-form exercise-gate" prototype) so that storage keys,
//    intro fieldset, progress label, and feedback placeholders match production markup.
// 3. Transform each legacy question into a data-exercise-question block, validating the
//    anchors, response row, and injecting per-question progress markup before stitching
//    all questions back into the cloned form.
// 4. Emit closing tags in reverse order (question, accordion, form, body) while keeping
//    non-form elements untouched, then update the progress label + data attributes using
//    the resolved question count.
//
// Usage:
// node /home/eagles/dockerz/megs/tools/expand-questions.mjs /home/eagles/dockerz/megs/exercise-1-nouns/112-proper-nouns-copy.html
// Verification: node tools/expand-questions.mjs <sample.html> --dry-run --no-interactive
// Rollback: git checkout -- tools/expand-questions.mjs
// Requires: npm i cheerio

import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { fileURLToPath } from "node:url"
import * as cheerio from "cheerio"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROTOTYPE_RELATIVE_PATH = "../exercise-1-nouns/111-common-nouns.html"
const PROTOTYPE_PATH = path.resolve(SCRIPT_DIR, PROTOTYPE_RELATIVE_PATH)
const PIPELINE_PREFIX = "[expand-questions]"

function logPipeline(stage, details = "") {
  if (!stage) return
  const suffix = details ? `: ${details}` : ""
  console.error(`${PIPELINE_PREFIX} ${stage}${suffix}`)
}

function summarizeBody($) {
  const $body = $("body").first()
  if (!$body.length) {
    logPipeline("parse", "no <body> element found; operating on root node")
    return $.root()
  }
  const children = $body.children().length
  logPipeline("parse", `<body> located with ${children} direct child node(s)`)
  return $body
}

function usage(code = 0) {
  const msg = `
Usage:
  node tools/expand-questions.mjs <input.html> [options]

Options:
  --to <n>            Target number of questions (default: keep existing)
  --fields <list>     Comma separated data-field names (1-4 items)
  --out <file>        Write transformed HTML to file
  --in-place          Overwrite the input file (implies auto-backup unless disabled)
  --backup            Force backup even if not overwriting
  --no-backup         Disable automatic backup
  --dry-run           Compute changes but do not write output
  --interactive       Force interactive prompts even if not attached to a TTY
  --no-interactive    Run without prompts (for scripts/CI)
  --help              Show this help message
`.trim()
  console.error(msg)
  process.exit(code)
}

function parseCLI(argv) {
  const out = {
    input: null,
    goal: null,
    goalProvided: false,
    fields: null,
    fieldsProvided: false,
    outFile: null,
    outProvided: false,
    inPlace: false,
    inPlaceProvided: false,
    dryRun: false,
    dryRunProvided: false,
    interactive: process.stdin.isTTY && process.stdout.isTTY,
    interactiveProvided: null,
    forceBackup: null,
    forceBackupProvided: false,
    help: false,
  }

  const positional = []
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i]
    if (token === "--help" || token === "-h") {
      out.help = true
    } else if (token === "--to") {
      if (i + 1 >= argv.length) usage(1)
      out.goal = parseInt(argv[++i], 10)
      out.goalProvided = true
    } else if (token.startsWith("--to=")) {
      out.goal = parseInt(token.split("=")[1], 10)
      out.goalProvided = true
    } else if (token === "--fields") {
      if (i + 1 >= argv.length) usage(1)
      out.fields = argv[++i].split(",")
      out.fieldsProvided = true
    } else if (token.startsWith("--fields=")) {
      out.fields = token.split("=")[1].split(",")
      out.fieldsProvided = true
    } else if (token === "--out") {
      if (i + 1 >= argv.length) usage(1)
      out.outFile = argv[++i]
      out.outProvided = true
    } else if (token.startsWith("--out=")) {
      out.outFile = token.split("=")[1]
      out.outProvided = true
    } else if (token === "--in-place") {
      out.inPlace = true
      out.inPlaceProvided = true
    } else if (token === "--dry-run") {
      out.dryRun = true
      out.dryRunProvided = true
    } else if (token === "--interactive") {
      out.interactive = true
      out.interactiveProvided = "--interactive"
    } else if (token === "--no-interactive") {
      out.interactive = false
      out.interactiveProvided = "--no-interactive"
    } else if (token === "--backup") {
      out.forceBackup = true
      out.forceBackupProvided = true
    } else if (token === "--no-backup") {
      out.forceBackup = false
      out.forceBackupProvided = true
    } else if (token.startsWith("--")) {
      console.error(`Unknown option: ${token}`)
      usage(1)
    } else {
      positional.push(token)
    }
  }

  if (positional.length) out.input = positional[0]
  return out
}

function sanitizeFields(fields, fallback) {
  if (!Array.isArray(fields)) return fallback
  const cleaned = fields
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => item.toLowerCase())
  const unique = []
  const seen = new Set()
  for (const name of cleaned) {
    if (!seen.has(name)) {
      seen.add(name)
      unique.push(name)
    }
    if (unique.length === 4) break
  }
  if (unique.length === 0) return fallback
  return unique
}

function shellQuote(value) {
  const str = String(value ?? "")
  if (!str.length) return "''"
  if (/^[A-Za-z0-9_\-./:]+$/.test(str)) return str
  return `'${str.replace(/'/g, "'\\''")}'`
}

function buildProcessInvocation(argv = process.argv) {
  const [nodePath, scriptPath, ...rest] = argv
  const nodeName = path.basename(nodePath || "node")
  const scriptDisplay = scriptPath
    ? path.relative(process.cwd(), scriptPath) || path.basename(scriptPath)
    : "tools/expand-questions.mjs"
  const parts = [nodeName, scriptDisplay, ...rest]
  return parts.map(shellQuote).join(" ")
}

function buildReplayCommand(opts, goal, fields) {
  const scriptDisplay = process.argv[1]
    ? path.relative(process.cwd(), process.argv[1]) || path.basename(process.argv[1])
    : "tools/expand-questions.mjs"
  const parts = ["node", scriptDisplay]
  if (opts.input) parts.push(opts.input)
  const normalizedGoal = Number.isInteger(goal) ? goal : opts.goal
  if (normalizedGoal && normalizedGoal >= 1) {
    parts.push("--to", String(normalizedGoal))
  }
  const normalizedFields = Array.isArray(fields) && fields.length ? fields : opts.fields
  if (normalizedFields && normalizedFields.length) {
    parts.push("--fields", normalizedFields.join(","))
  }
  if (opts.outFile) {
    parts.push("--out", opts.outFile)
  }
  if (opts.inPlace) {
    parts.push("--in-place")
  }
  if (opts.dryRun) {
    parts.push("--dry-run")
  }
  if (opts.forceBackup === true) {
    parts.push("--backup")
  } else if (opts.forceBackup === false) {
    parts.push("--no-backup")
  }
  // default to a scripted replay without prompts
  if (opts.interactiveProvided === "--interactive") {
    parts.push("--interactive")
  } else {
    parts.push("--no-interactive")
  }
  return parts.map(shellQuote).join(" ")
}

const FALLBACK_FIELD_DEFS = [
  { field: "response", label: "Response" },
  { field: "notes", label: "Notes" },
  { field: "confidence", label: "Confidence" },
  { field: "extension", label: "Extended response" },
]

let prototypeCache = null

async function loadPrototypeAssets() {
  if (prototypeCache) return prototypeCache
  let protoHtml
  try {
    protoHtml = await fs.readFile(PROTOTYPE_PATH, "utf8")
  } catch (err) {
    throw new Error(
      `unable to read prototype template at ${PROTOTYPE_PATH}: ${err?.message || err}`
    )
  }
  const $proto = cheerio.load(protoHtml, { decodeEntities: false })
  const $form = $proto("form[data-exercise-form]").first()
  if (!$form.length) {
    throw new Error(`prototype missing <form data-exercise-form> at ${PROTOTYPE_PATH}`)
  }
  const $formClone = $form.clone(false, false)
  $formClone.find(".quest-bg[data-exercise-question]").remove()
  const formHtml = $proto.html($formClone)
  const $row = $proto('.quest-bg[data-exercise-question="1"] .exercise-response-row').first()
  const responseRowHtml = $row.length ? $proto.html($row) : null
  const $config = $proto("#exercise-config[data-exercise-config]").first()
  const configHtml = $config.length ? $proto.html($config) : null
  const $auto = $proto("script").filter((_, el) => {
    const txt = $proto(el).text()
    return /cfg\.submitUrl/.test(txt) && /thuvien\.eagles\.edu\.vn/.test(txt)
  })
  const autoScriptHtml = $auto.length ? $proto.html($auto.first()) : null
  prototypeCache = { formHtml, responseRowHtml, configHtml, autoScriptHtml }
  const shellChildren = $formClone.children().length
  const introFieldsets = $formClone.find("fieldset").length
  logPipeline(
    "prototype",
    `form shell children=${shellChildren}, fieldsets=${introFieldsets}, response-row-template=${Boolean(
      responseRowHtml
    )}`
  )
  return prototypeCache
}

function instantiateFragment($, fragment) {
  if (!fragment) return null
  const loader = cheerio.load(fragment, { decodeEntities: false })
  const first = loader.root().children().first()
  if (!first.length) return null
  const markup = loader.html(first)
  if (!markup) return null
  const $el = $(markup)
  return $el.length ? $el : null
}

function slugify(text) {
  if (!text) return ""
  return String(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140)
}

function inferLegacySlug($accordion, n) {
  const $toggle = $accordion.find(".nn_sliders-toggle").first()
  if ($toggle.length) {
    const dataId = String($toggle.attr("data-id") || "")
    const match = dataId.match(/^(?:sec|q)(?:-?\d+)?-(.+)$/i)
    if (match && match[1]) return match[1]
    const href = String($toggle.attr("href") || "")
    const hrefMatch = href.match(/#(?:sec-)?\d+-(.+)$/i)
    if (hrefMatch && hrefMatch[1]) return hrefMatch[1]
    const textSlug = slugify($toggle.text())
    if (textSlug) return textSlug
  }
  return `question-${n}`
}

function upgradeLegacyAnchors($accordion, $) {
  $accordion.find(".nn_sliders-scroll").each((_, el) => {
    const node = el
    const tag = (node.tagName || node.name || "").toLowerCase()
    if (tag === "a") {
      const $current = $(el)
      const $replacement = $("<span></span>")
      const attrs = node.attribs || {}
      for (const [name, value] of Object.entries(attrs)) {
        $replacement.attr(name, value)
      }
      $replacement.html($current.html() || "")
      $current.replaceWith($replacement)
    }
  })
}

function normalizeLegacyAccordion($accordion, n, fileBasename, slug, $) {
  const targetId = `sec-${n}-${slug}`
  const setId = `set-nn_sliders-${n}`
  $accordion.attr("id", setId)
  const $anchors = $accordion.find(".nn_sliders-scroll")
  if ($anchors.length) {
    $anchors.each((idx, el) => {
      const $anchor = $(el)
      if (idx === 0) {
        $anchor.attr("id", `nn_sliders-scrollto_${n}`)
      } else {
        const suffix = idx === 1 ? "" : `-${idx}`
        $anchor.attr("id", `nn_sliders-scrollto_${n}-${slug}${suffix}`)
      }
    })
  }
  const $group = $accordion.find(".accordion-group").first()
  if (!$group.length) return
  const $toggle = $group.find(".nn_sliders-toggle").first()
  if ($toggle.length) {
    $toggle.attr("data-id", targetId)
    $toggle.attr("data-parent", `#${setId}`)
    $toggle.attr("aria-controls", targetId)
    $toggle.attr("aria-expanded", "false")
    const hrefTarget = fileBasename ? `${fileBasename}#${targetId}` : `#${targetId}`
    $toggle.attr("href", hrefTarget)
    if (!$toggle.attr("aria-label")) {
      $toggle.attr("aria-label", "Answer")
    }
  }
  const $body = $group.find(".accordion-body").first()
  if ($body.length) {
    $body.attr("id", targetId)
    $body.attr("aria-hidden", "true")
    $body.removeClass("in show")
    if (!$body.hasClass("collapse")) {
      $body.addClass("collapse")
    }
  }
}

function createFallbackResponseRow($, n) {
  const $row = $('<div class="exercise-response-row"></div>')
  $row.attr("data-item", String(n))
  for (const { field, label } of FALLBACK_FIELD_DEFS) {
    const $label = $('<label class="exercise-response-field"></label>')
    const $hidden = $('<span class="visually-hidden"></span>')
    $hidden.text(`${label} for item ${n}`)
    const $input = $('<input class="exercise-response-input" type="text" placeholder="Answer">')
    $input.attr("data-item", String(n))
    $input.attr("data-field", field)
    $label.append($hidden)
    $label.append($input)
    $row.append($label)
  }
  return $row
}

function createResponseRowFromTemplate($, templateHtml, n) {
  const $row = instantiateFragment($, templateHtml)
  if ($row && $row.length) {
    $row.attr("data-item", String(n))
    $row.find("[data-item]").each((_, el) => {
      $(el).attr("data-item", String(n))
    })
    updateHiddenLabelText($row, n, $)
    return $row
  }
  return createFallbackResponseRow($, n)
}

function ensureResponseRow($accordion, n, $, templateHtml) {
  let $row = $accordion.find(".exercise-response-row").first()
  if (!$row.length) {
    $row = createResponseRowFromTemplate($, templateHtml, n)
    const $group = $accordion.find(".accordion-group").first()
    if ($group.length) {
      $group.append("\n")
      $group.append($row)
    } else {
      $accordion.append("\n")
      $accordion.append($row)
    }
  } else {
    $row.attr("data-item", String(n))
    $row.find("[data-item]").each((_, el) => {
      $(el).attr("data-item", String(n))
    })
    updateHiddenLabelText($row, n, $)
  }
  return $row
}

function ensureQuestionProgress($quest, n, total, $) {
  let $progress = $quest.find("[data-exercise-question-progress]").first()
  if (!$progress.length) {
    $progress = $(
      '<p class="exercise-question__progress" data-exercise-question-progress="" aria-hidden="true"></p>'
    )
    const $accordion = $quest.find(".nn_sliders").first()
    if ($accordion.length) {
      $accordion.before("\n")
      $accordion.before($progress)
    } else {
      $quest.prepend("\n")
      $quest.prepend($progress)
    }
  }
  $progress.attr("data-item", String(n))
  $progress.attr("data-total", String(total))
  $progress.text(`Question ${n} of ${total}`)
  return $progress
}

function buildQuestFromLegacy($legacy, n, fileBasename, $, assets) {
  const $clone = $legacy.clone(false, false)
  upgradeLegacyAnchors($clone, $)
  const slug = inferLegacySlug($clone, n)
  normalizeLegacyAccordion($clone, n, fileBasename, slug, $)
  const $toggle = $clone.find(".nn_sliders-toggle").first()
  if (!$toggle.length) {
    throw new Error(`question ${n}: missing .nn_sliders-toggle anchor in legacy markup`)
  }
  const $panel = $clone.find(".accordion-body").first()
  if (!$panel.length) {
    throw new Error(`question ${n}: missing .accordion-body panel in legacy markup`)
  }
  ensureResponseRow($clone, n, $, assets.responseRowHtml)
  const $quest = $('<div class="quest-bg"></div>')
  $quest.attr("data-exercise-question", String(n))
  $quest.append("\n")
  $quest.append($clone)
  const anchorCount = $clone.find(".nn_sliders-scroll").length
  const inputCount = $clone.find(".exercise-response-input").length
  logPipeline(
    "question",
    `#${n} anchors=${anchorCount}, response-inputs=${inputCount}, slug=${slug || "n/a"}`
  )
  return $quest
}

function hasAutoSubmitScript($) {
  let found = false
  $("script").each((_, el) => {
    const txt = $(el).text()
    if (/cfg\.submitUrl/.test(txt) && /api\/exercise-submission/.test(txt)) {
      found = true
      return false
    }
    return undefined
  })
  return found
}

async function ensureInteractiveScaffold(html, inputPath) {
  const $ = cheerio.load(html, { decodeEntities: false })
  const $bodyRoot = summarizeBody($)
  logPipeline("scan", "checking for existing interactive scaffold")
  if ($bodyRoot.find(".quest-bg[data-exercise-question]").length) {
    logPipeline("scan", "interactive blocks already present; skipping scaffold build")
    return {
      html,
      converted: false,
      addedConfig: false,
      addedAutoScript: false,
      addedQuestions: 0,
    }
  }
  const legacyAccordions = $bodyRoot
    .find(".nn_sliders.accordion.panel-group")
    .filter((_, el) => $(el).parents(".quest-bg").length === 0)
    .toArray()
  logPipeline("scan", `legacy accordions located=${legacyAccordions.length}`)
  if (!legacyAccordions.length) {
    logPipeline("scan", "no legacy accordions detected; nothing to convert")
    return {
      html,
      converted: false,
      addedConfig: false,
      addedAutoScript: false,
      addedQuestions: 0,
    }
  }

  const assets = await loadPrototypeAssets()
  let $form = instantiateFragment($, assets.formHtml)
  if ($form && $form.length && !$form.is("form[data-exercise-form]")) {
    const candidate = $form.find("form[data-exercise-form]").first()
    if (candidate.length) {
      $form = candidate
    }
  }
  if (!$form || !$form.length) {
    throw new Error(`Unable to build interactive form shell from ${PROTOTYPE_PATH}`)
  }

  const fileBasename = inputPath ? path.basename(inputPath) : ""
  const fileStem = inputPath ? path.basename(inputPath, path.extname(inputPath)) : "exercise"
  if (fileStem) {
    $form.attr("data-storage-key", `exercise-${fileStem}`)
  }

  const questBlocks = legacyAccordions.map((node, idx) =>
    buildQuestFromLegacy($(node), idx + 1, fileBasename, $, assets)
  )
  const totalQuestions = questBlocks.length
  questBlocks.forEach(($quest, index) => {
    ensureQuestionProgress($quest, index + 1, totalQuestions, $)
  })

  const $progressLabel = $form.find("[data-exercise-progress]").first()
  if ($progressLabel.length) {
    $progressLabel.text(`0 of ${totalQuestions} questions completed.`)
  }
  $form.attr("data-exercise-question-count", String(totalQuestions))

  const $placeholder = $('<div data-expand-questions-placeholder=""></div>')
  const $firstLegacy = legacyAccordions.length ? $(legacyAccordions[0]) : null
  if ($firstLegacy && $firstLegacy.length) {
    $firstLegacy.before($placeholder)
  } else {
    const $article = $bodyRoot.find('[itemprop="articleBody"]').first()
    if ($article.length) $article.append($placeholder)
    else $bodyRoot.append($placeholder)
  }

  legacyAccordions.forEach((node) => $(node).remove())
  $placeholder.replaceWith($form)

  const $submitRow = $form.find(".exercise-submit-row").first()
  questBlocks.forEach(($quest) => {
    if ($submitRow.length) {
      $submitRow.before("\n")
      $submitRow.before($quest)
    } else {
      $form.append("\n")
      $form.append($quest)
    }
  })

  let addedConfig = false
  if (!$("#exercise-config[data-exercise-config]").length && assets.configHtml) {
    const $config = instantiateFragment($, assets.configHtml)
    if ($config && $config.length) {
      $form.after("\n")
      $form.after($config)
      addedConfig = true
    }
  }

  let addedAutoScript = false
  if (!hasAutoSubmitScript($) && assets.autoScriptHtml) {
    const $auto = instantiateFragment($, assets.autoScriptHtml)
    if ($auto && $auto.length) {
      const $target = addedConfig ? $("#exercise-config[data-exercise-config]").first() : $form
      $target.after("\n")
      $target.after($auto)
      addedAutoScript = true
    }
  }

  logPipeline(
    "scaffold",
    `converted legacy accordions into ${totalQuestions} interactive question(s)`
  )

  return {
    html: $.html(),
    converted: true,
    addedConfig,
    addedAutoScript,
    addedQuestions: questBlocks.length,
  }
}

function logInvocationSummary(opts, goal, fields) {
  console.error("Command invocation:")
  console.error(`  ${buildProcessInvocation()}`)
  const replay = buildReplayCommand(opts, goal, fields)
  console.error("Replay with flags (no prompts):")
  console.error(`  ${replay}`)
  if (opts.dryRun) {
    console.error("Tip: drop --dry-run to write the updates.")
  }
  console.error("")
}

function formatList(list) {
  if (!Array.isArray(list) || !list.length) return "(none)"
  return list.join(", ")
}

function gatherDefaultFields($template, $) {
  const seen = new Set()
  const fields = []
  $template.find("[data-field]").each((_, el) => {
    const name = String($(el).attr("data-field") || "")
      .trim()
      .toLowerCase()
    if (name && !seen.has(name)) {
      seen.add(name)
      if (fields.length < 4) fields.push(name)
    }
  })
  return fields
}

function createFieldTemplates($, $template) {
  const map = new Map()
  $template.find(".exercise-response-row label").each((_, labelEl) => {
    const $label = $(labelEl)
    const field = String($label.find("[data-field]").first().attr("data-field") || "")
      .trim()
      .toLowerCase()
    if (!field) return
    if (!map.has(field)) map.set(field, $.html($label))
  })
  return map
}

function rewriteAttr(val, n) {
  if (!val) return val
  let out = val
  out = out.replace(/(sec-)(?:\d+)(-)/g, (_m, p1, p3) => `${p1}${n}${p3}`)
  out = out.replace(/(set-nn_sliders-)(?:\d+)/g, (_m, p1) => `${p1}${n}`)
  out = out.replace(/(nn_sliders-scrollto_)(?:\d+)/g, (_m, p1) => `${p1}${n}`)
  return out
}

function replaceLeadingNumber(text, n) {
  if (typeof text !== "string") return text
  return text.replace(/^\s*\d+\.\s*/, `${n}. `)
}

function updateHiddenLabelText($label, n, $) {
  $label.find(".visually-hidden").each((_, span) => {
    const $span = $(span)
    const original = String($span.text() || "")
    const next = original.replace(/(item\s*)(\d+)/i, (_m, p1) => `${p1}${n}`)
    $span.text(next)
  })
}

function renumberQuestion($block, n, $) {
  $block.attr("data-exercise-question", String(n))
  $block.find("[data-item]").each((_, el) => {
    const $el = $(el)
    $el.attr("data-item", String(n))
  })
  $block.find("*").each((_, el) => {
    const $el = $(el)
    for (const attr of ["id", "href", "aria-controls", "data-parent", "data-id"]) {
      const v = $el.attr(attr)
      if (v) $el.attr(attr, rewriteAttr(v, n))
    }
  })
  $block.find(".nn_sliders-toggle-inner").each((_, el) => {
    const $el = $(el)
    $el.text(replaceLeadingNumber($el.text(), n))
  })
  $block.find(".nn_sliders-title").each((_, el) => {
    const $el = $(el)
    $el.text(replaceLeadingNumber($el.text(), n))
  })
  $block.find("p").each((_, p) => {
    const first = $(p).contents().get(0)
    if (first && first.type === "text" && typeof first.data === "string") {
      first.data = replaceLeadingNumber(first.data, n)
    }
  })
}

function applyFieldConfig($block, n, allowedFields, fieldTemplates, stats, $) {
  if (!allowedFields || !allowedFields.length) {
    return { fields: [], changed: false }
  }
  const $row = $block.find(".exercise-response-row").first()
  if (!$row.length) {
    return { fields: [], changed: false }
  }
  const previous = []
  $row.find("[data-field]").each((_, el) => {
    previous.push(
      String($(el).attr("data-field") || "")
        .trim()
        .toLowerCase()
    )
  })
  $row.empty()
  const applied = []
  for (const field of allowedFields) {
    const tpl = fieldTemplates.get(field)
    if (!tpl) {
      stats.missingFields.add(field)
      continue
    }
    const $label = $(tpl)
    $label.find("[data-item]").each((_, el) => {
      $(el).attr("data-item", String(n))
    })
    $label.find("[data-field]").each((_, el) => {
      $(el).attr("data-field", field)
    })
    updateHiddenLabelText($label, n, $)
    $row.append("\n")
    $row.append($label)
    stats.usedFields.add(field)
    applied.push(field)
  }
  const changed =
    previous.length !== applied.length || previous.some((value, idx) => value !== applied[idx])
  return { fields: applied, changed }
}

function normalizeBooleanAttributes(str) {
  const BOOLS = [
    "hidden",
    "required",
    "disabled",
    "defer",
    "nomodule",
    "novalidate",
    "checked",
    "selected",
    "autofocus",
    "multiple",
    "readonly",
    "formnovalidate",
    "inert",
    "loop",
    "muted",
    "playsinline",
    "reversed",
  ]
  let out = str
  for (const a of BOOLS) {
    const re = new RegExp(`\\s${a}\\s*=\\s*(?:"[^"]*"|'[^']*'|)`, "gi")
    out = out.replace(re, ` ${a}`)
  }
  return out
}

function processHtml(html, options) {
  const { goal, allowedFields } = options
  const $ = cheerio.load(html, { decodeEntities: false })
  const $template = $('.quest-bg[data-exercise-question="1"]').first()
  if (!$template.length) {
    throw new Error(
      'error: no interactive question blocks (.quest-bg[data-exercise-question="1"]) found in input file'
    )
  }

  const desiredTotal = Math.max(1, parseInt(goal, 10) || 1)
  const existingTotal = $(".quest-bg[data-exercise-question]").length
  logPipeline("process", `existing questions=${existingTotal}, desired=${desiredTotal}`)
  const fieldTemplates = createFieldTemplates($, $template)
  const stats = { usedFields: new Set(), missingFields: new Set() }
  const details = {
    removedNumbers: [],
    renumberedPairs: [],
    appended: [],
    existingResponseUpdates: [],
    updatedResponseRows: 0,
  }

  const allBlocks = $(".quest-bg[data-exercise-question]").toArray()
  let removed = 0
  while (allBlocks.length > desiredTotal) {
    const el = allBlocks.pop()
    if (el) {
      const $el = $(el)
      const original = parseInt($el.attr("data-exercise-question"), 10)
      if (Number.isFinite(original)) {
        details.removedNumbers.push(original)
      }
      $el.remove()
      removed++
    }
  }

  const currentBlocks = $(".quest-bg[data-exercise-question]").toArray()
  currentBlocks.forEach((el, idx) => {
    const $block = $(el)
    const n = idx + 1
    const original = parseInt($block.attr("data-exercise-question"), 10)
    if (Number.isFinite(original) && original !== n) {
      details.renumberedPairs.push({ from: original, to: n })
    }
    renumberQuestion($block, n, $)
    ensureQuestionProgress($block, n, desiredTotal, $)
    const { fields: appliedFields, changed } = applyFieldConfig(
      $block,
      n,
      allowedFields,
      fieldTemplates,
      stats,
      $
    )
    if (changed) {
      details.updatedResponseRows += 1
      details.existingResponseUpdates.push({ number: n, fields: appliedFields })
    }
  })

  let appended = 0
  let lastBlock = $(".quest-bg").last()
  const parent = lastBlock.length ? lastBlock.parent() : $template.parent()
  for (let n = currentBlocks.length + 1; n <= desiredTotal; n++) {
    const $clone = $template.clone(false, false)
    renumberQuestion($clone, n, $)
    // eslint-disable-next-line no-unused-vars
    const { fields: appliedFields, changed } = applyFieldConfig(
      $clone,
      n,
      allowedFields,
      fieldTemplates,
      stats,
      $
    )
    ensureQuestionProgress($clone, n, desiredTotal, $)
    details.updatedResponseRows += 1
    details.appended.push({ number: n, fields: appliedFields })
    if (lastBlock.length) {
      lastBlock.after("\n")
      lastBlock.after($clone)
      lastBlock = $clone
    } else {
      parent.append("\n")
      parent.append($clone)
      lastBlock = $clone
    }
    appended++
  }

  const $prog = $("[data-exercise-progress]").first()
  if ($prog.length) {
    $prog.text(`0 of ${desiredTotal} questions completed.`)
  }
  const $form = $("[data-exercise-form]").first()
  if ($form.length) {
    $form.attr("data-exercise-question-count", String(desiredTotal))
  }

  let output = $.html()
  output = normalizeBooleanAttributes(output)
  return {
    output,
    appended,
    removed,
    total: desiredTotal,
    usedFields: Array.from(stats.usedFields),
    missingFields: Array.from(stats.missingFields),
    details,
  }
}

function gatherAssets(html) {
  const $ = cheerio.load(html, { decodeEntities: false })
  const styles = []
  $('link[rel="stylesheet"], link[rel="preload"][as="style"]').each((_, el) => {
    const href = String($(el).attr("href") || "").trim()
    if (href) styles.push({ href, snippet: $.html(el).trim() })
  })
  const scripts = []
  $("script[src]").each((_, el) => {
    const src = String($(el).attr("src") || "").trim()
    if (src) scripts.push({ src, snippet: $.html(el).trim() })
  })
  return { styles, scripts }
}

async function ensureBackup(filePath, targetDir) {
  const dir = path.isAbsolute(targetDir) ? targetDir : path.join(path.dirname(filePath), targetDir)
  await fs.mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const base = path.basename(filePath)
  const dest = path.join(dir, `${base}.${stamp}.bak`)
  await fs.copyFile(filePath, dest)
  return dest
}

function logApplySummary(result, mode = "run") {
  const prefix = mode === "dry-run" ? "[dry-run] " : ""
  console.error(
    `${prefix}Total questions: ${result.total} (appended ${result.appended}, removed ${result.removed})`
  )
  console.error(`${prefix}Answer fields: ${formatList(result.usedFields)}`)
  if (result.missingFields.length) {
    console.error(
      `${prefix}Warning: missing template for fields ${formatList(result.missingFields)} (skipped).`
    )
  }
  const details = result.details || {}
  if (details.removedNumbers?.length) {
    const removedList = [...details.removedNumbers].sort((a, b) => a - b)
    console.error(`${prefix}Removed questions: ${removedList.join(", ")}`)
  }
  if (details.renumberedPairs?.length) {
    const renumbered = [...details.renumberedPairs].sort((a, b) => a.to - b.to)
    renumbered.forEach((item) => {
      console.error(`${prefix}Renumbered question ${item.from} -> ${item.to}`)
    })
  }
  if (details.appended?.length) {
    const appendedNumbers = details.appended.map((item) => item.number).sort((a, b) => a - b)
    console.error(`${prefix}Appended questions: ${appendedNumbers.join(", ")}`)
    details.appended.forEach((item) => {
      console.error(`${prefix}  ↳ #${item.number} fields: ${formatList(item.fields)}`)
    })
  }
  if (details.existingResponseUpdates?.length) {
    const numbers = details.existingResponseUpdates.map((item) => item.number).sort((a, b) => a - b)
    const preview =
      numbers.length > 10 ? `${numbers.slice(0, 10).join(", ")}, …` : numbers.join(", ")
    console.error(
      `${prefix}Rebuilt response rows for ${numbers.length} existing question(s): ${preview}`
    )
    const previewDetails = details.existingResponseUpdates.slice(0, 5)
    previewDetails.forEach((item) => {
      console.error(`${prefix}  ↳ #${item.number} fields: ${formatList(item.fields)}`)
    })
    if (details.existingResponseUpdates.length > 5) {
      console.error(
        `${prefix}  ↳ …${details.existingResponseUpdates.length - 5} more updated question(s)`
      )
    }
  }
  if (details.updatedResponseRows) {
    console.error(`${prefix}Response rows updated: ${details.updatedResponseRows}`)
  }
}

async function promptForGoal(rl, currentGoal) {
  let resolved = currentGoal
  let awaitingResponse = true
  while (awaitingResponse) {
    const answer = (await rl.question(`Target number of questions [${currentGoal}] > `)).trim()
    if (!answer || answer.toLowerCase() === "skip") {
      awaitingResponse = false
      continue
    }
    if (answer.toLowerCase() === "exit") {
      console.error("Exiting by request.")
      process.exit(0)
    }
    const num = parseInt(answer, 10)
    if (Number.isInteger(num) && num >= 1) {
      resolved = num
      awaitingResponse = false
      continue
    }
    console.error("Enter a positive integer (or type skip to keep current value).")
  }
  return resolved
}

async function promptForFields(rl, defaults) {
  const prompt = `Answer fields (1-4, comma separated) [${defaults.join(", ")}] > `
  let awaitingResponse = true
  let resolved = defaults
  while (awaitingResponse) {
    const answer = (await rl.question(prompt)).trim()
    if (!answer || answer.toLowerCase() === "skip") {
      awaitingResponse = false
      continue
    }
    if (answer.toLowerCase() === "exit") {
      console.error("Exiting by request.")
      process.exit(0)
    }
    const fields = answer
      .split(/[,\\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    if (fields.length < 1 || fields.length > 4) {
      console.error("Provide between 1 and 4 field names.")
      continue
    }
    resolved = fields
    awaitingResponse = false
  }
  return resolved
}

async function runStep(rl, title, action, { allowDryRun = true } = {}) {
  if (!rl) {
    return action("run")
  }
  let awaitingChoice = true
  while (awaitingChoice) {
    const choices = allowDryRun ? "[r]un, [d]ry-run, [s]kip, [e]xit" : "[r]un, [s]kip, [e]xit"
    const answer = (await rl.question(`${title} (${choices}) > `)).trim().toLowerCase()
    if (answer === "r" || answer === "run") {
      return action("run")
    }
    if (allowDryRun && (answer === "d" || answer === "dry-run" || answer === "dry")) {
      await action("dry-run")
      continue
    }
    if (answer === "s" || answer === "skip") {
      console.error(`${title}: skipped.`)
      return null
    }
    if (answer === "e" || answer === "exit" || answer === "q" || answer === "quit") {
      console.error("Exiting by request.")
      process.exit(0)
    }
    console.error("Please choose run, dry-run, skip, or exit.")
  }
  return null
}

export { ensureInteractiveScaffold, processHtml }

async function main() {
  const opts = parseCLI(process.argv)
  if (opts.help || !opts.input) usage(opts.help ? 0 : 1)
  if (!/\.html?$/.test(opts.input)) {
    console.error("error: input must be an .html file")
    process.exit(1)
  }
  if (opts.inPlace && opts.outFile) {
    console.error("error: use either --in-place or --out, not both")
    process.exit(1)
  }

  let html
  try {
    html = await fs.readFile(opts.input, "utf8")
  } catch (err) {
    if (err && err.code === "ENOENT") {
      const resolved = path.resolve(opts.input)
      console.error(`error: input not found -> ${opts.input}`)
      console.error(`       resolved path   -> ${resolved}`)
      try {
        const dir = path.dirname(resolved)
        const listing = await fs.readdir(dir)
        const sample = listing
          .filter((name) => name.toLowerCase().endsWith(".html"))
          .slice(0, 10)
          .join(", ")
        if (sample) {
          console.error(`       available *.html in ${dir}: ${sample}`)
        }
      } catch {
        /* directory missing or unreadable; ignore */
      }
      console.error(
        "hint: use an existing lesson/exercise file such as exercise-1-nouns/111-common-nouns.html"
      )
    } else {
      console.error(`error: unable to read ${opts.input}: ${err?.message || err}`)
    }
    process.exit(1)
  }
  let scaffoldInfo = null
  try {
    scaffoldInfo = await ensureInteractiveScaffold(html, opts.input)
  } catch (err) {
    console.error(`error: unable to upgrade legacy markup in ${opts.input}: ${err?.message || err}`)
    process.exit(1)
  }
  if (scaffoldInfo) {
    if (scaffoldInfo.converted) {
      html = scaffoldInfo.html
      console.error(
        `Upgraded legacy accordion markup → ${scaffoldInfo.addedQuestions} interactive question(s).`
      )
      if (scaffoldInfo.addedConfig) {
        console.error("Added missing exercise-config block from prototype.")
      }
      if (scaffoldInfo.addedAutoScript) {
        console.error("Added submitUrl auto-switch helper script from prototype.")
      }
    } else if (typeof scaffoldInfo.html === "string" && scaffoldInfo.html !== html) {
      html = scaffoldInfo.html
    }
  }
  const $initial = cheerio.load(html, { decodeEntities: false })
  const $template = $initial('.quest-bg[data-exercise-question="1"]').first()
  if (!$template.length) {
    console.error(
      'error: no interactive question blocks (.quest-bg[data-exercise-question="1"]) found.'
    )
    console.error(
      "hint: copy the interactive markup from exercise-1-nouns/111-common-nouns.html or run the tool on a page that already includes it."
    )
    process.exit(1)
  }

  const defaultFields = gatherDefaultFields($template, $initial)
  const currentCount = $initial("[data-exercise-question]").length || 0
  let goal = opts.goal ?? (currentCount || 1)
  goal = Math.max(1, goal)
  let allowedFields = sanitizeFields(opts.fields, defaultFields)

  const interactive = opts.interactive ? createInterface({ input, output }) : null
  if (interactive) {
    console.error(`Loaded ${opts.input}`)
    console.error(`Existing questions: ${currentCount}`)
    console.error(`Default fields: ${formatList(defaultFields)}`)
    console.error("")
  }

  try {
    if (interactive && !opts.goalProvided) {
      goal = await promptForGoal(interactive, goal)
    }
    if (interactive && !opts.fields) {
      allowedFields = await promptForFields(interactive, allowedFields)
    }
  } catch (err) {
    await interactive?.close()
    throw err
  }

  if (interactive) {
    console.error(`Using goal: ${goal}`)
    console.error(`Using fields: ${formatList(allowedFields)}`)
  }

  logInvocationSummary(opts, goal, allowedFields)

  const assets = gatherAssets(html)
  const rl = interactive
  if (rl) {
    await runStep(rl, "Review external CSS/JS", async (mode) => {
      const prefix = mode === "dry-run" ? "[dry-run] " : ""
      if (!assets.styles.length && !assets.scripts.length) {
        console.error(`${prefix}No external CSS/JS references detected.`)
        return
      }
      if (assets.styles.length) {
        console.error(`${prefix}Styles:`)
        assets.styles.forEach((s) => console.error(`  ${s.href}`))
      }
      if (assets.scripts.length) {
        console.error(`${prefix}Scripts:`)
        assets.scripts.forEach((s) => console.error(`  ${s.src}`))
      }
    })
  }

  let backupPath = null
  const wantsOutputToFile = opts.inPlace || Boolean(opts.outFile)
  if (!opts.dryRun && wantsOutputToFile) {
    const backupDir = ".exercise-backups"
    const runBackup =
      opts.forceBackup === true || (opts.forceBackup === null && Boolean(opts.inPlace))
    if (runBackup && !rl) {
      backupPath = await ensureBackup(opts.input, backupDir)
      console.error(`Backup created at ${backupPath}`)
    } else if (runBackup) {
      await runStep(rl, "Create backup copy", async (mode) => {
        if (mode === "dry-run") {
          const plan = path.join(
            path.dirname(opts.input),
            backupDir,
            `${path.basename(opts.input)}.<timestamp>.bak`
          )
          console.error(`[dry-run] Would create backup at ${plan}`)
          return
        }
        backupPath = await ensureBackup(opts.input, backupDir)
        console.error(`Backup created at ${backupPath}`)
      })
    } else if (opts.forceBackup === false) {
      console.error("Backup disabled via --no-backup.")
    }
  }

  let result = null
  await runStep(rl, "Apply question updates", async (mode) => {
    const res = processHtml(html, { goal, allowedFields })
    logApplySummary(res, mode)
    if (mode === "run") {
      result = res
    }
  })

  if (!result) {
    console.error("No changes were applied. Exiting.")
    await rl?.close()
    return
  }

  if (opts.dryRun) {
    console.error("Global dry-run enabled; skipping write.")
    await rl?.close()
    return
  }

  const dest = opts.inPlace ? opts.input : opts.outFile
  if (!dest) {
    await runStep(rl, "Write output (stdout)", async (mode) => {
      if (mode === "dry-run") {
        console.error("[dry-run] Would print HTML to stdout.")
        return
      }
      if (mode === "run") {
        process.stdout.write(result.output)
      }
    })
    await rl?.close()
    return
  }

  await runStep(rl, `Write output (${dest})`, async (mode) => {
    if (mode === "dry-run") {
      console.error(`[dry-run] Would write to ${dest}`)
      return
    }
    await fs.writeFile(dest, result.output, "utf8")
    console.error(`Wrote updated file to ${dest}`)
  })

  await rl?.close()
}

const runAsCli =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (runAsCli) {
  main().catch((err) => {
    console.error("fatal:", err?.stack || err?.message || err)
    process.exit(1)
  })
}
