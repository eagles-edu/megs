import "dotenv/config"
import nodemailer from "nodemailer"

async function main() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com"
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = String(process.env.SMTP_SECURE ?? "").toLowerCase() !== "false" || port === 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user
  const to = (process.env.EXERCISE_MAILER_RECIPIENTS || user)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)

  if (!user || !pass) throw new Error("Missing SMTP_USER/SMTP_PASS")

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: true,
    debug: true,
    connectionTimeout: 30_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
    tls: { servername: host },
  })

  const subject = `SMTP SEND TEST — ${new Date().toISOString()}`
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text: `This is a one-off test email from smtp-send-test.mjs\nFrom: ${from}\nTo: ${to.join(", ")}`,
  })

  console.log("✉️  Message sent:", info.messageId, "→", to)
}

main().catch((err) => {
  console.error("❌ Send failed:", err?.message || err)
  process.exit(1)
})
