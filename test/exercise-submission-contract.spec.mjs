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

test("IELTS submission pages emit the SIS payload contract", () => {
  const pages = findHtmlFiles(root)
  const submissionPages = pages.filter((file) => fs.readFileSync(file, "utf8").includes("postJSON(submitUrl, payload)"))

  assert.equal(submissionPages.length, 120)

  for (const file of submissionPages) {
    const relative = path.relative(root, file)
    const source = fs.readFileSync(file, "utf8")
    const matches = [
      ...source.matchAll(/const payload = \{\n([\s\S]*?)\n[ \t]*\}\n\s*const res = await postJSON\(submitUrl, payload\)/g),
    ]

    assert.equal(matches.length, 1, `${relative}: expected one network payload block`)

    const body = matches[0][1]
    const fields = new Set([...body.matchAll(/^\s*([A-Za-z]\w*)\s*(?::|,)/gm)].map((match) => match[1]))

    assert.deepEqual([...fields].sort(), [...expectedFields].sort(), `${relative}: unexpected SIS payload fields`)
    assert.match(body, /eaglesId:\s*studentId/, `${relative}: student ID must map to eaglesId`)
    assert.doesNotMatch(body, /^\s*(?:studentId|answers)\s*,/m, `${relative}: local-only fields leaked into the SIS payload`)
  }
})
