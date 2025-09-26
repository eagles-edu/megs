;+144 - 0

import { readdir, mkdir, writeFile } from "node:fs/promises"
import { createWriteStream } from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "reports",
  "docs",
  "modules",
  "media",
  "scripts",
  "templates",
  "tmp",
  ".git",
])

const rootDir = process.cwd()

async function collectHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name.startsWith(".git")) {
      continue
    }

    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue
      }

      const nested = await collectHtmlFiles(fullPath)
      files.push(...nested)
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".html") || entry.name.endsWith(".htm")) {
        files.push(fullPath)
      }
    }
  }

  return files
}

async function ensureEmptyLog(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, "")
}

async function main() {
  const args = process.argv.slice(2)
  const htmlArgs = []
  let logFile

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--log") {
      index += 1
      logFile = args[index]
      continue
    }

    htmlArgs.push(arg)
  }

  const files = (await collectHtmlFiles(rootDir)).sort()

  if (files.length === 0) {
    console.log("No HTML files found; skipping html-validate.")

    if (logFile) {
      await ensureEmptyLog(logFile)
    }

    return
  }

  await new Promise((resolve, reject) => {
    const child = spawn("html-validate", [...htmlArgs, ...files], {
      stdio: ["inherit", "pipe", "inherit"],
    })

    let logStream

    if (logFile) {
      logStream = createWriteStream(logFile, { encoding: "utf8" })
    }

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk)

      if (logStream) {
        logStream.write(chunk)
      }
    })

    child.stdout.on("close", () => {
      if (logStream) {
        logStream.end()
      }
    })

    child.on("error", (error) => {
      if (logStream) {
        logStream.destroy()
      }

      reject(error)
    })

    child.on("exit", (code, signal) => {
      if (logStream) {
        logStream.end()
      }

      if (signal) {
        reject(new Error(`html-validate terminated due to signal ${signal}`))
        return
      }

      if (code === 0) {
        resolve()
      } else {
        const error = new Error(`html-validate exited with code ${code}`)
        error.exitCode = code
        reject(error)
      }
    })
  })
}

main().catch((error) => {
  if (error && typeof error.exitCode === "number") {
    process.exit(error.exitCode)
  }

  console.error(error)
  process.exitCode = 1
})
