import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..")
const excludedDirectories = new Set([".git", "docs", "node_modules", "reports", "tmp", "tools"])
const expectedFields = new Set([
  "completedAt",
  "correctCount",
  "eaglesId",
  "email",
  "incorrectCount",
  "pageTitle",
  "pendingCount",
  "recipients",
  "scorePercent",
  "sourceAttemptId",
  "sourceSystem",
  "startedAt",
  "totalQuestions",
])

function findHtmlFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || excludedDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...findHtmlFiles(absolute))
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(absolute)
  }
  return files
}

test("IELTS exercise pages use the shared SIS test-mirror sender", () => {
  const pages = findHtmlFiles(root)
  const submissionPages = pages.filter((file) => fs.readFileSync(file, "utf8").includes("postJSON(submitUrl, payload)"))
  const helper = fs.readFileSync(path.join(root, "web-asset/js/exercise-gate.js"), "utf8")
  const helperTemplate = fs.readFileSync(path.join(root, "templates/exercise-gate-template.html"), "utf8")

  assert.equal(submissionPages.length, 120)
  assert.match(helper, /form\.getAttribute\("data-exercise-submit-owner"\) === "shared"/)
  assert.match(helper, /event\.stopImmediatePropagation\(\)/)
  assert.match(helper, /function createExerciseAttemptId\(\)/)
  assert.match(helper, /window\.sessionStorage\.setItem\(attemptStorageKey/)
  assert.match(helper, /attemptState\.completed = true/)

  const payloadStart = helper.indexOf("function collectPayload()")
  const payloadEnd = helper.indexOf("\n    function sendSubmission", payloadStart)
  assert.notEqual(payloadStart, -1)
  assert.notEqual(payloadEnd, -1)
  const payloadBody = helper.slice(payloadStart, payloadEnd)
  const returnedPayloadStart = payloadBody.indexOf("return {")
  assert.notEqual(returnedPayloadStart, -1)
  const returnedPayload = payloadBody.slice(returnedPayloadStart)
  const payloadFields = new Set([...returnedPayload.matchAll(/^\s*([A-Za-z]\w*):/gm)].map((match) => match[1]))
  assert.deepEqual([...payloadFields].sort(), [...expectedFields].sort())
  assert.match(returnedPayload, /sourceSystem:\s*"ielts"/)
  assert.match(returnedPayload, /sourceAttemptId:\s*attempt\.sourceAttemptId/)
  assert.match(returnedPayload, /startedAt:\s*attempt\.startedAt/)

  assert.match(helperTemplate, /data-exercise-submit-owner="shared"/)
  assert.match(helperTemplate, /https:\/\/test\.eagles\.edu\.vn\/api\/exercise-submission/)

  for (const file of submissionPages) {
    const relative = path.relative(root, file)
    const source = fs.readFileSync(file, "utf8")
    const formTags = [...source.matchAll(/<form\b[^>]*>/g)].map((match) => match[0]).filter((tag) => /\bdata-exercise-form(?:=|\s|>)/.test(tag))

    assert.equal(formTags.length, 1, `${relative}: expected one exercise form`)
    assert.match(formTags[0], /data-exercise-submit-owner="shared"/, `${relative}: shared sender must own delivery`)
    const gateScripts = [...source.matchAll(/<script\b[^>]*src=["']([^"']*exercise-gate\.js)["'][^>]*>/g)]
    assert.equal(gateScripts.length, 1, `${relative}: expected one shared exercise gate script`)
    assert.equal(
      path.resolve(path.dirname(file), gateScripts[0][1]),
      path.join(root, "web-asset/js/exercise-gate.js"),
      `${relative}: exercise gate script path must resolve to the shared sender`
    )
    assert.match(source, /https:\/\/test\.eagles\.edu\.vn\/api\/exercise-submission/, `${relative}: test SIS endpoint missing`)
    assert.doesNotMatch(source, /https:\/\/ielts\.eagles\.edu\.vn\/api\/exercise-submission/, `${relative}: production SIS endpoint remains`)
    assert.doesNotMatch(source, /http:\/\/127\.0\.0\.1:8787\/api\/exercise-submission/, `${relative}: local SIS endpoint remains`)

    const scoreStart = source.indexOf("function summarizeScores")
    const scoreEnd = source.indexOf("function updateProgress", scoreStart)
    assert.notEqual(scoreStart, -1, `${relative}: score helper missing`)
    assert.match(
      source.slice(scoreStart, scoreEnd),
      /const blocks = \$\$\("\[data-exercise-question\]", theForm\)/,
      `${relative}: score helper must count every question block`
    )
  }
})
