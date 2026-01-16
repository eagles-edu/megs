import { promises as fs } from "fs"
import path from "node:path"
import process from "node:process"
import * as cheerio from "cheerio"

const DEFAULT_KEYWORDS =
  "ESL, TOESL, TOEFL, courses, english, english courses, education, english degree, degree, english education, exercises, english exercises, grammar, verb, english grammar, noun, adverb, adjective, english adverb, english noun, english adjective"
const DEFAULT_DESCRIPTION = "A comprehensive site for free English courses and exercises."

function normalizeAnswer(value) {
  if (!value) return ""
  let text = String(value).toLowerCase()
  text = text.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
  text = text.replace(/[^a-z0-9\s'-]/g, " ")
  text = text.replace(/-/g, " ")
  text = text.replace(/[\s\u00a0]+/g, " ")
  return text.trim()
}

function hashFnv1a64(value) {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  for (let i = 0; i < value.length; i += 1) {
    hash ^= BigInt(value.charCodeAt(i))
    hash = (hash * prime) & 0xffffffffffffffffn
  }
  let hex = hash.toString(16)
  while (hex.length < 16) hex = `0${hex}`
  return hex
}

function hashAnswer(value) {
  const normalized = normalizeAnswer(value)
  if (!normalized) return ""
  return `fnv1a-64:${hashFnv1a64(normalized)}`
}

function slugify(value) {
  if (!value) return ""
  const normalized = String(value).replace(/^\s*\d+\s*[.)-]?\s*/, "")
  return normalized
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

function collectUnderlinedAnswers($, $panel) {
  const answers = []
  const seen = new Set()
  const underlineSelector =
    '.in-text-decoration-underline__14j0pz, u, [style*="underline" i], [style*="text-decoration:underline" i]'
  $panel.find(underlineSelector).each((_, el) => {
    const text = normalizeAnswer($(el).text())
    if (!text || seen.has(text)) return
    seen.add(text)
    answers.push(text)
  })
  return answers
}

function normalizeUnderlines($, $panel) {
  $panel.find("u").each((_, el) => {
    const $el = $(el)
    const inner = $el.html() || $el.text()
    $el.replaceWith(`<span class="undies">${inner}</span>`)
  })

  $panel
    .find('[style*="underline" i], [style*="text-decoration:underline" i]')
    .each((_, el) => {
      const $el = $(el)
      $el.removeAttr("style")
      $el.addClass("in-text-decoration-underline__14j0pz")
    })

  $panel.find("span.in-text-decoration-underline__14j0pz").each((_, el) => {
    const $el = $(el)
    if (!normalizeAnswer($el.text())) $el.remove()
  })
}

function normalizeBreadcrumbArrows($, $article) {
  $article.find("ul.breadcrumb span.divider svg").each((_, svg) => {
    const $span = $(svg).closest("span.divider")
    if (!$span.length) return
    $span.empty().append('<img src="../images/arrow.svg" alt="" width="9" height="9">')
  })

  $article.find("ul.breadcrumb span.divider").each((_, span) => {
    const $span = $(span)
    if (($span.html() || "").trim()) return
    $span.remove()
  })
}

function buildIntroHtml($, $article) {
  if (!$article || !$article.length) return ""
  const blocks = []
  let reachedQuestions = false
  $article.contents().each((_, node) => {
    if (reachedQuestions) return
    const $node = $(node)
    if ($node.hasClass("nn_sliders")) {
      reachedQuestions = true
      return
    }
    if ($node.is("ul.pager") || $node.hasClass("pager")) return
    if ($node.is("script")) return
    const html = $.html(node)
    if (html) blocks.push(html.trim())
  })
  return blocks.join("\n\n")
}

function parseLegacyExercise(html, filePath = "") {
  const $ = cheerio.load(html)
  const title = ($("title").first().text() || "").trim()
  const heading = ($(".page-header h2").first().text() || title).trim()
  const canonical =
    $("link[rel='non-canonical']").attr("href") || path.basename(filePath || "exercise.html")
  const keywords = ($("meta[name='keywords']").attr("content") || DEFAULT_KEYWORDS).trim()
  const description = ($("meta[name='description']").attr("content") || DEFAULT_DESCRIPTION).trim()

  const $article = $("[itemprop='articleBody']").first()
  normalizeBreadcrumbArrows($, $article)
  const pagerHtml = $article.find("ul.pager.pagenav").first().prop("outerHTML") || ""
  const introHtml = buildIntroHtml($, $article)

  const questions = []
  $article.find(".nn_sliders").each((index, element) => {
    const $block = $(element)
    const toggleText = ($block.find(".nn_sliders-toggle-inner").first().text() || "").trim()
    const panel = $block.find(".accordion-inner").first().clone()
    if (!panel || !panel.length) return
    normalizeUnderlines($, panel)
    const panelHtml = panel.html() || ""
    const answers = collectUnderlinedAnswers($, panel)
    const answerHashes = answers
      .map((value) => hashAnswer(value))
      .filter((value) => Boolean(value))
    const id = String(index + 1)
    const slug = slugify(toggleText) || `question-${id}`
    questions.push({ id, slug, toggleText, panelHtml, answers, answerHashes })
  })

  const baseName = path.basename(filePath || "exercise.html", path.extname(filePath || "exercise.html"))
  const storageKey = `exercise-${baseName}`
  const exerciseName = baseName

  return {
    title,
    heading,
    canonical,
    description,
    keywords,
    introHtml,
    pagerHtml,
    questions,
    storageKey,
    exerciseName,
  }
}

async function readAndParse(filePath) {
  const content = await fs.readFile(filePath, "utf8")
  return parseLegacyExercise(content, filePath)
}

async function main(argv = process.argv) {
  const input = argv[2]
  if (!input) {
    console.error("Usage: node tools/legacy-qa-parser.mjs <input.html>")
    process.exit(1)
  }
  const parsed = await readAndParse(input)
  console.log(JSON.stringify(parsed, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { buildIntroHtml, hashAnswer, normalizeAnswer, parseLegacyExercise, readAndParse, slugify }
