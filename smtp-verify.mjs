import "dotenv/config"
import nodemailer from "nodemailer"

function must(name, v) {
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

async function main() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com"
  const port = Number(process.env.SMTP_PORT || 465)
  const secure = String(process.env.SMTP_SECURE ?? "").toLowerCase() !== "false" || port === 465
  const user = must("SMTP_USER", process.env.SMTP_USER)
  const pass = must("SMTP_PASS", process.env.SMTP_PASS)

  console.log("Verifying SMTP transport with:", {
    host,
    port,
    secure,
    user,
    passLen: String(pass).length,
  })

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

  try {
    const ok = await transporter.verify()
    console.log("✅ SMTP verify:", ok)
    process.exit(0)
  } catch (err) {
    console.error("❌ SMTP verify failed:", err?.message || err)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("❌ Fatal:", e?.message || e)
  process.exit(1)
})
