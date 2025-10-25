#!/usr/bin/env node
// tools/expand-questions.mjs
// Clone the first question block to N questions by renumbering attributes & prefixes.
// Requires: npm i cheerio
import fs from "node:fs/promises"
import process from "node:process"
import * as cheerio from "cheerio"

function usage(code = 0) {
  const msg = `
Usage:
  node tools/expand-questions.mjs <input.html> [--to 20] [--out output.html] [--in-place]

Options:
  --to <n>        Total number of questions to end up with (default: 20)
  --out <file>    Write to file (default: stdout unless --in-place is used)
  --in-place      Overwrite the input file
  --help          Show this help
`.trim();
  console.error(msg);
  process.exit(code);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}
function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  if (hasFlag("--help") || process.argv.length < 3) usage(0)

  const inFile = process.argv[2]
  const toStr = getArg("--to")
  const goal = Math.max(1, parseInt(toStr || "20", 10))
  const outFile = getArg("--out")
  const inPlace = hasFlag("--in-place")

  if (!inFile) usage(1)
  if (!/\.html?$/.test(inFile)) {
    console.error("error: input must be an .html file")
    process.exit(1)
  }
  if (inPlace && outFile) {
    console.error("error: use either --in-place or --out, not both")
    process.exit(1)
  }

  const html = await fs.readFile(inFile, "utf8")
  const $ = cheerio.load(html, { decodeEntities: false })

  // Locate the template question block (Question #1)
  const $template = $('.quest-bg[data-exercise-question="1"]').first()
  if (!$template.length) {
    console.error('error: could not find .quest-bg[data-exercise-question="1"] in input file')
    process.exit(1)
  }

  const existingIds = new Set(
    $("[data-exercise-question]")
      .map((i, el) => String($(el).attr("data-exercise-question")))
      .get()
  )

  // Helper: rewrite attribute values that include numeric fragments tied to Q#1
  function rewriteAttr(val, n) {
    if (!val) return val
    let out = val

    // sec-1-* (also matches #sec-1-*)
    out = out.replace(/(sec-)(?:\d+)(-)/g, (_m, p1, p3) => `${p1}${n}${p3}`)

    // set-nn_sliders-1 → set-nn_sliders-N
    out = out.replace(/(set-nn_sliders-)(?:\d+)/g, (_m, p1) => `${p1}${n}`)

    // nn_sliders-scrollto_1 → nn_sliders-scrollto_N
    out = out.replace(/(nn_sliders-scrollto_)(?:\d+)/g, (_m, p1) => `${p1}${n}`)

    return out
  }

  // Helper: update numeric prefixes like "1. " → "N. "
  function replaceLeadingNumber(text, n) {
    if (typeof text !== "string") return text
    return text.replace(/^\s*\d+\.\s*/, `${n}. `)
  }

  // Transform a cloned question for question number n
  function renumberQuestion($block, n) {
    $block.attr("data-exercise-question", String(n))

    // All inputs/containers for this question: data-item="N"
    $block.find("[data-item]").each((_, el) => {
      const $el = $(el)
      $el.attr("data-item", String(n))
    })

    // Fix key attributes on *every element* in the cloned block
    $block.find("*").each((_, el) => {
      const $el = $(el)
      for (const attr of ["id", "href", "aria-controls", "data-parent", "data-id"]) {
        const v = $el.attr(attr)
        if (v) $el.attr(attr, rewriteAttr(v, n))
      }
    })

    // Visible "1." → "N." in the standard title spots
    $block.find(".nn_sliders-toggle-inner").each((_, el) => {
      const $el = $(el)
      $el.text(replaceLeadingNumber($el.text(), n))
    })
    $block.find(".nn_sliders-title").each((_, el) => {
      const $el = $(el)
      $el.text(replaceLeadingNumber($el.text(), n))
    })

    // Also adjust the first text node of <p> within the block if it starts with "1. "
    $block.find("p").each((_, p) => {
      const first = $(p).contents().get(0)
      if (first && first.type === "text" && typeof first.data === "string") {
        first.data = replaceLeadingNumber(first.data, n)
      }
    })

    return $block
  }

  // Append clones up to the goal
  let appended = 0
  for (let n = 2; n <= goal; n++) {
    if (existingIds.has(String(n))) continue // already present, skip
    const $clone = $template.clone(false, false)
    renumberQuestion($clone, n)
    // Append after the last .quest-bg (keeps order)
    $(".quest-bg")
      .last()
      .after("\n" + $.html($clone))
    appended++
  }

  // Update the progress label text if present: "X of N questions completed."
  const $prog = $("[data-exercise-progress]").first()
  if ($prog.length) {
    const txt = $prog.text()
    $prog.text(txt.replace(/of\s+\d+\s+questions/i, `of ${goal} questions`))
  }

  // Serialize and normalize boolean attributes (html-validate prefers bare form)
  let output = $.html();

  function normalizeBooleanAttributes(str) {
    // Add more if your linter complains about others
    const BOOLS = [
      'hidden','required','disabled','defer','nomodule','novalidate',
      'checked','selected','autofocus','multiple','readonly',
      'formnovalidate','inert','loop','muted','playsinline','reversed'
    ];
    for (const a of BOOLS) {
      // Replace patterns: a="", a="a", a='a' → a
      const re = new RegExp(`\\s${a}\\s*=\\s*(?:"[^"]*"|'[^']*'|)`, 'gi');
      str = str.replace(re, ` ${a}`);
    }
    return str;
  }
  output = normalizeBooleanAttributes(output);

  if (inPlace) {
    await fs.writeFile(inFile, output, "utf8")
  } else if (outFile) {
    await fs.writeFile(outFile, output, "utf8")
  } else {
    process.stdout.write(output)
  }

  // Optional: status to stderr (keeps stdout clean if piping)
  console.error(`Expanded to ${goal} question(s). Newly appended: ${appended}.`)
}

main().catch((err) => {
  console.error("fatal:", err?.stack || err?.message || err);
  process.exit(1);
});
