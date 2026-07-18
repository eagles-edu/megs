#!/usr/bin/env node
/* eslint no-console:0 */
/* prettier-ignore-start */


import fs from "node:fs"
import path from "node:path"
import process from "node:process"

// ── config/paths ────────────────────────────────────────────────────────────────
const workspace = process.cwd()
const rel = (p) => path.relative(workspace, p)
const reportDir = path.resolve("reports")
const logFile = "htmlvalidate-active.log" // overwritten each run
const logPath = path.join(reportDir, logFile)

fs.mkdirSync(reportDir, { recursive: true })

// ── helpers ────────────────────────────────────────────────────────────────────
const sevLabel = (s) => (s === 2 || s === "error" ? "error" : "warning")

const lineTerm = (fileRel, line, col, sev, msg, rule) =>
  `${fileRel}:${line}:${col} [${sev}] ${msg}${rule ? ` (${rule})` : ""}`

const lineFile = (fileAbs, line, col, sev, msg, rule) =>
  `vscode://file/${fileAbs}:${line}:${col} [${sev}] ${msg}${rule ? ` (${rule})` : ""}`

// ── read stdin (html-validate --formatter json) ────────────────────────────────
let json = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => (json += chunk))

process.stdin.on("end", () => {
  let exit = 0
  const outFile = []

  try {
    const data = JSON.parse(json)
    const files = data.files || []

    for (const f of files) {
      const abs = path.resolve(f.source || f.filePath || f.filename || "")
      const relPath = rel(abs)

      for (const m of f.messages || []) {
        const line = m.line ?? 1
        const col = m.column ?? 1
        const sev = sevLabel(m.severity)
        const rule = m.ruleId || m.rule || ""
        const msg = m.message || ""

        // 1) terminal/Problems-friendly (relative path)
        console.log(lineTerm(relPath, line, col, sev, msg, rule))
        // 2) saved log with vscode:// links (absolute path)
        outFile.push(lineFile(abs, line, col, sev, msg, rule))

        if (sev === "error") exit = 1
      }
    }
  } catch (e) {
    console.error("Failed to parse html-validate JSON:", e.message)
    exit = 1
  }

  fs.writeFileSync(logPath, outFile.join("\n") + "\n")
  console.error(`Saved clickable log → ${rel(logPath)}`)
  process.exit(exit)
})

/* prettier-ignore-end */