// server/exercise-mailer.mjs
import "dotenv/config"
import http from "node:http"
import { URL } from "node:url"
import nodemailer from "nodemailer"

/* =========================
   Configuration & Defaults
   ========================= */

const DEFAULT_PORT = Number(process.env.EXERCISE_MAILER_PORT || 8787)
const DEFAULT_PATH = process.env.EXERCISE_MAILER_PATH || "/api/exercise-submission"
const DEFAULT_HOST = process.env.EXERCISE_MAILER_HOST || "0.0.0.0"

// Multiple origins supported: comma separated string, exact match with scheme+host[:port]
const ORIGIN_LIST = (
  process.env.EXERCISE_MAILER_ORIGIN ||
  process.env.EXERCISE_MAILER_ORIGINS ||
  "*"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

// Toggle verbose logs
const MAILER_DEBUG =
  String(process.env.MAILER_DEBUG || "")
    .trim()
    .toLowerCase() === "true"

// Default recipients (comma-separated email list)
const DEFAULT_RECIPIENTS = (process.env.EXERCISE_MAILER_RECIPIENTS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean)

/* =========================
   Runtime Status (healthz)
   ========================= */

const STATUS = {
  startedAt: new Date().toISOString(),
  lastVerifyOk: null,
  lastVerifyAt: null,
  lastSendOk: null,
  lastSendAt: null,
  lastError: null,
}

/* =========================
   Helpers
   ========================= */

function resolveBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return fallback
    if (["true", "1", "yes"].includes(normalized)) return true
    if (["false", "0", "no"].includes(normalized)) return false
  }
  return fallback
}

function coerceArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return [value].filter(Boolean)
}

function formatAnswers(answers) {
  if (!Array.isArray(answers) || !answers.length) return "(no answers recorded)"
  const rows = answers.map((entry) => {
    const id = entry && entry.id ? String(entry.id) : "?"
    const values = Array.isArray(entry?.answers) ? entry.answers : []
    const formattedValues = values
      .map((value, index) => `  ${index + 1}. ${value || "(blank)"}`)
      .join("\n")
    return `Question ${id}:\n${formattedValues || "  (no responses)"}`
  })
  return rows.join("\n\n")
}

function isEmailLike(value) {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

function createEmail({ email, pageTitle, completedAt, recipients, answers }) {
  const to = coerceArray(recipients)
  const cc = isEmailLike(email) ? [email.trim()] : []
  const subject = `Exercise submission${pageTitle ? ` — ${pageTitle}` : ""}`
  const submittedAt = completedAt || new Date().toISOString()

  const textBody = [
    `A learner just completed ${pageTitle || "an exercise"}.`,
    "",
    `Submitted at: ${submittedAt}`,
    email ? `Learner email: ${email}` : "Learner email: (not provided)",
    "",
    formatAnswers(answers),
  ].join("\n")

  const htmlAnswers = Array.isArray(answers)
    ? answers
        .map((entry) => {
          const id = entry && entry.id ? String(entry.id) : "?"
          const values = Array.isArray(entry?.answers) ? entry.answers : []
          const items = values
            .map(
              (value, index) =>
                `<li><strong>${index + 1}.</strong> ${value || "<em>(blank)</em>"}</li>`
            )
            .join("")
          return `<section><h3>Question ${id}</h3><ol>${items || "<li><em>(no responses)</em></li>"}</ol></section>`
        })
        .join("")
    : "<p><em>No answers recorded.</em></p>"

  const htmlBody = `
    <div>
      <p>A learner just completed <strong>${pageTitle || "an exercise"}</strong>.</p>
      <ul>
        <li><strong>Submitted at:</strong> ${submittedAt}</li>
        <li><strong>Learner email:</strong> ${email || "(not provided)"}</li>
      </ul>
      ${htmlAnswers}
    </div>
  `

  return {
    to,
    cc,
    subject,
    text: textBody,
    html: htmlBody,
  }
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let raw = ""
    request.on("data", (chunk) => {
      raw += chunk
      if (raw.length > 1e6) {
        request.destroy()
        reject(new Error("Payload too large"))
      }
    })
    request.on("end", () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {}
        resolve(parsed)
      } catch (error) {
        reject(error)
      }
    })
    request.on("error", reject)
  })
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid payload")
  const email = typeof payload.email === "string" ? payload.email.trim() : ""
  const answers = Array.isArray(payload.answers) ? payload.answers : []
  if (!answers.length) throw new Error("Missing answers")
  return {
    email,
    pageTitle: typeof payload.pageTitle === "string" ? payload.pageTitle.trim() : "",
    completedAt:
      typeof payload.completedAt === "string" ? payload.completedAt : new Date().toISOString(),
    recipients: Array.isArray(payload.recipients) ? payload.recipients : [],
    answers,
  }
}

/* =========================
   CORS
   ========================= */

function allowCors(request, response) {
  const reqOrigin = String(request.headers.origin || "").trim()
  let allowOrigin = "null"

  if (ORIGIN_LIST.includes("*")) {
    allowOrigin = "*"
  } else if (reqOrigin && ORIGIN_LIST.includes(reqOrigin)) {
    allowOrigin = reqOrigin // echo back allowed origin
  }

  response.setHeader("Vary", "Origin")
  response.setHeader("Access-Control-Allow-Origin", allowOrigin)
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.setHeader("Access-Control-Allow-Headers", "Content-Type")
  // If you ever use cookies/credentials, uncomment and DO NOT use "*"
  // response.setHeader("Access-Control-Allow-Credentials", "true");
}

/* =========================
    SMTP Transport
   ========================= */

function createTransport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com"
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = resolveBoolean(process.env.SMTP_SECURE, port === 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  // Fail fast: creds must exist for Gmail/App Password flow
  if (!user || !pass) {
    console.error("❌ Missing SMTP credentials. Set SMTP_USER and SMTP_PASS in environment.")
    process.exit(1)
  }

  if (MAILER_DEBUG) {
    console.log("SMTP config:", {
      host,
      port,
      secure,
      user,
      passLen: pass ? pass.length : 0,
    })
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: MAILER_DEBUG,
    debug: MAILER_DEBUG,
  })

  // Verify once at startup (non-fatal if it fails; server can still start)
  transporter
    .verify()
    .then(() => {
      STATUS.lastVerifyOk = true
      STATUS.lastVerifyAt = new Date().toISOString()
      if (MAILER_DEBUG) console.log("✅ SMTP ready: verification OK")
    })
    .catch((err) => {
      STATUS.lastVerifyOk = false
      STATUS.lastVerifyAt = new Date().toISOString()
      STATUS.lastError = String(err?.message || err)
      console.error("❌ SMTP verify failed:", STATUS.lastError)
    })

  return transporter
}

/* =========================
   Request Handler
   ========================= */

async function handleRequest(request, response, transporter) {
  const { method } = request
  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`)

  // Health endpoint (no CORS needed, but harmless if included)
  if (method === "GET" && url.pathname === "/healthz") {
    const body = {
      status: "ok",
      startedAt: STATUS.startedAt,
      uptimeSeconds: Math.floor((Date.now() - Date.parse(STATUS.startedAt)) / 1000),
      lastVerifyOk: STATUS.lastVerifyOk,
      lastVerifyAt: STATUS.lastVerifyAt,
      lastSendOk: STATUS.lastSendOk,
      lastSendAt: STATUS.lastSendAt,
      lastError: STATUS.lastError,
      node: process.version,
      endpoint: DEFAULT_PATH,
    }
    response.writeHead(200, { "Content-Type": "application/json" })
    response.end(JSON.stringify(body))
    return
  }

  // Preflight
  if (method === "OPTIONS") {
    if (url.pathname === DEFAULT_PATH) {
      allowCors(request, response)
      response.writeHead(204)
      response.end()
      return
    }
  }

  // Only POST on the API path
  if (method !== "POST" || url.pathname !== DEFAULT_PATH) {
    allowCors(request, response)
    response.writeHead(404, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ error: "Not Found" }))
    return
  }

  try {
    const payload = await parseBody(request)
    const validated = validatePayload(payload)
    const emailData = createEmail(validated)

    if (!emailData.to.length && !DEFAULT_RECIPIENTS.length) {
      throw new Error("No recipients configured")
    }
    const to = emailData.to.length ? emailData.to : DEFAULT_RECIPIENTS
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@eaglesvn.online"

    if (MAILER_DEBUG) {
      console.log("Sending message →", { from, to, subject: emailData.subject })
    }

    await transporter.sendMail({
      from,
      to,
      cc: emailData.cc.length ? emailData.cc : undefined,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      replyTo: validated.email || undefined,
    })

    STATUS.lastSendOk = true
    STATUS.lastSendAt = new Date().toISOString()
    if (MAILER_DEBUG) console.log("✉️  Mail sent:", { to, subject: emailData.subject })

    // CORS + 204 success
    allowCors(request, response)
    response.writeHead(204)
    response.end()
  } catch (error) {
    STATUS.lastSendOk = false
    STATUS.lastSendAt = new Date().toISOString()
    STATUS.lastError = String(error?.message || error)
    const status = error.message === "Missing answers" ? 400 : 500
    if (MAILER_DEBUG) console.error("❌ Send failed:", STATUS.lastError)

    // CORS + JSON error
    allowCors(request, response)
    response.writeHead(status, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ error: error.message || "Submission failed" }))
  }
}

/* =========================
    Server Bootstrap
   ========================= */

export function startExerciseMailer(options = {}) {
  const transporter = options.transporter || createTransport()
  const port = Number(options.port || DEFAULT_PORT)
  const host = String(options.host || DEFAULT_HOST)

  const server = http.createServer((request, response) => {
    handleRequest(request, response, transporter).catch((error) => {
      // Ensure CORS even on unexpected errors
      allowCors(request, response)
      response.writeHead(500, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ error: error.message || "Submission failed" }))
    })
  })

  server.listen(port, host, () => {
    const extra = MAILER_DEBUG ? " (MAILER_DEBUG=true)" : ""
    console.log(
      `exercise-mailer listening on ${host}:${port} at ${DEFAULT_PATH} (health: /healthz)${extra}`
    )
  })

  return server
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startExerciseMailer()
}
