import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { parseLegacyExercise } from "./legacy-qa-parser.mjs"

const TEMPLATE_PATH = path.resolve("templates/exercise-gate-template.html")
const DEFAULT_CONFIG = {
  recipients: [
    { utf8: "6b696d7468616e68406561676c6573766e2e6f6c696e65" },
    { utf8: "61646d696e406561676c6573766e2e6f6c696e65" },
    { utf8: "7468616e682e6561676c6573636c756240676d61696c2e636f6d" },
  ],
  submitUrl: "",
}

export function padQuestionNumber(value) {
  const num = parseInt(value, 10)
  if (Number.isNaN(num)) return String(value)
  return num.toString().padStart(2, "0")
}

export function indentBlock(text, spaces = 0) {
  const pad = " ".repeat(spaces)
  return text
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n")
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildResponseRow(questionId, answerCount) {
  const fields = ["answer_01", "answer_02", "answer_03", "answer_04", "answer_05", "answer_06"]
  const fieldCount = Math.min(Math.max(answerCount || 1, 1), fields.length)
  const labels = ["Answer 1", "Answer 2", "Answer 3", "Answer 4", "Answer 5", "Answer 6"]
  const inputs = []
  for (let i = 0; i < fieldCount; i += 1) {
    inputs.push(`
        <label class="exercise-response-field">
          <span class="visually-hidden">${labels[i] || labels[0]}</span>
          <input class="exercise-response-input" type="text" placeholder="Answer" data-item="${questionId}" data-field="${fields[i]}">
        </label>`)
  }
  return `
      <div class="exercise-response-row" data-item="${questionId}">
${inputs.join("\n")}
      </div>`
}

export function buildQuestionHtml(question, canonical) {
  const groupId = `set-nn_sliders-${question.id}`
  const panelId = `sec-${question.id}-${question.slug}`
  const toggleAnchorId = `nn_sliders-scrollto_${question.id}-${question.slug}`
  const scrollAnchorId = `nn_sliders-scrollto_${question.id}`
  const answerCount = question.answers.length || question.answerHashes.length
  return `
    <div class="quest-bg" data-exercise-question="${question.id}">
      <div class="nn_sliders accordion panel-group" id="${groupId}">
        <span id="${scrollAnchorId}" class="anchor nn_sliders-scroll"></span>
        <div class="accordion-group panel nn_sliders-group">
          <span id="${toggleAnchorId}" class="anchor nn_sliders-scroll"></span>
          <div class="accordion-heading panel-heading">
            <a href="${canonical}#${panelId}" aria-controls="${panelId}" data-id="${panelId}" aria-label="Answer" class="accordion-toggle nn_sliders-toggle" data-toggle="collapse" data-parent="#${groupId}" aria-expanded="false">
              <span class="nn_sliders-toggle-inner">${escapeHtml(question.toggleText)}</span>
            </a>
          </div>
          <div class="accordion-body nn_sliders-body collapse" id="${panelId}" aria-hidden="true">
            <div class="accordion-inner panel-body">
${indentBlock(question.panelHtml || "", 14)}
            </div>
          </div>
${indentBlock(buildResponseRow(question.id, answerCount), 10)}
        </div>
      </div>
    </div>`
}

export function buildAnswerKey(parsed) {
  const answerArray = {}
  parsed.questions.forEach((question) => {
    const key = `question${padQuestionNumber(question.id)}`
    const entry = { id: String(question.id) }
    if (question.answerHashes.length) {
      entry.answersAccepted = [question.answerHashes]
    } else {
      entry.manualCheckOk = true
    }
    answerArray[key] = entry
  })

  return {
    title: parsed.exerciseName,
    version: "0.3.0",
    publishDate: new Date().toISOString(),
    description: parsed.description,
    options: {
      requireCorrectBeforeReveal: true,
      defaultHashAlgorithm: "fnv1a-64",
    },
    answerArrays: {
      exerciseName: parsed.exerciseName,
      totalQuestions: parsed.questions.length,
      answerArray,
    },
  }
}

export async function generateLesson(inputPath, templatePath = TEMPLATE_PATH, outputPath) {
  const template = await fs.readFile(templatePath, "utf8")
  const parsed = await parseLegacyExercise(await fs.readFile(inputPath, "utf8"), inputPath)
  const answerKey = buildAnswerKey(parsed)
  const configJson = indentBlock(JSON.stringify(DEFAULT_CONFIG, null, 2), 16)
  const answerKeyJson = indentBlock(JSON.stringify(answerKey, null, 2), 16)
  const questionBlocks = parsed.questions
    .map((question) => indentBlock(buildQuestionHtml(question, parsed.canonical), 16))
    .join("\n")
  const assetPrefix =
    path.relative(
      path.dirname(outputPath || inputPath),
      path.resolve(path.dirname(outputPath || inputPath), "..")
    ) || ".."

  // Parsed placeholders come from legacy markup scraped by parseLegacyExercise:
  // - introHtml: HTML before the first question
  // - pagerHtml: the first <ul class="pager pagenav"> block
  // - questions: each .nn_sliders accordion with its toggle/panel HTML
  const replacements = {
    PAGE_TITLE: parsed.title || parsed.heading,
    ARTICLE_HEADING: parsed.heading || parsed.title,
    DESCRIPTION: parsed.description,
    KEYWORDS: parsed.keywords,
    CANONICAL: parsed.canonical,
    STORAGE_KEY: parsed.storageKey,
    TOTAL_QUESTIONS: String(parsed.questions.length),
    INTRO_HTML: parsed.introHtml || "",
    QUESTION_BLOCKS: questionBlocks,
    ANSWER_KEY_JSON: answerKeyJson,
    CONFIG_JSON: configJson,
    PAGER_HTML: parsed.pagerHtml || "",
    ASSET_PREFIX: assetPrefix || "..",
  }

  let output = template
  Object.entries(replacements).forEach(([key, value]) => {
    const token = `{{${key}}}`
    output = output.split(token).join(value)
  })

  if (outputPath) {
    await fs.writeFile(outputPath, output, "utf8")
    return outputPath
  }

  await fs.writeFile(inputPath, output, "utf8")
  return inputPath
}

async function main(argv = process.argv) {
  const input = argv[2]
  const outFlagIndex = argv.indexOf("--out")
  const outputPath = outFlagIndex > -1 ? argv[outFlagIndex + 1] : null
  if (!input) {
    console.error(
      "Usage: node tools/legacy-exercise-generator.mjs <input.html> [--out <output.html>]"
    )
    process.exit(1)
  }
  const destination = outputPath || input
  await generateLesson(input, TEMPLATE_PATH, destination)
  console.log(`Generated: ${destination}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
