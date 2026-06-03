/**
 * Mailer — Gmail SMTP transport for outbound transactional email (e.g. OTP codes).
 *
 * Required env (set in backend/.env):
 *   SMTP_USER  – your Gmail address (e.g. chawkanijairi8@gmail.com)
 *   SMTP_PASS  – a Gmail "App password" (16 chars, NOT your normal Gmail password)
 *                Create one at: https://myaccount.google.com/apppasswords
 *                (requires 2-Step Verification turned on)
 * Optional env:
 *   SMTP_FROM  – display sender, default: "Personal Collection <SMTP_USER>"
 *   SMTP_HOST  – default: smtp.gmail.com
 *   SMTP_PORT  – default: 587 (STARTTLS). Use 465 for SSL.
 */
const nodemailer = require('nodemailer')

let cachedTransporter = null
let cachedKey = ''

function getTransporter() {
  const user = (process.env.SMTP_USER || '').trim()
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '')
  if (!user || !pass) return null

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim()
  const port = Number(process.env.SMTP_PORT) || 587
  const key = `${host}:${port}:${user}:${pass.length}`

  if (cachedTransporter && cachedKey === key) return cachedTransporter

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  cachedKey = key
  return cachedTransporter
}

function getFrom() {
  const user = (process.env.SMTP_USER || '').trim()
  const explicit = (process.env.SMTP_FROM || '').trim()
  if (explicit) return explicit
  return user ? `Personal Collection <${user}>` : ''
}

function isMailerReady() {
  return Boolean(getTransporter())
}

function buildOtpEmail({ to, code, expiresInMin }) {
  const subject = `Your Personal Collection verification code: ${code}`

  const text = [
    'Personal Collection — Account Recovery',
    '',
    `Your verification code is: ${code}`,
    '',
    `This code expires in ${expiresInMin} minutes.`,
    'If you did not request a password reset, you can safely ignore this email.',
  ].join('\n')

  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f7f7;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(180deg,#d10000 0%,#b00000 100%);color:#ffffff;text-align:center;padding:22px 16px;">
            <div style="font-family:'Great Vibes','Brush Script MT',cursive;font-size:30px;line-height:1;margin-bottom:4px;">Personal Collection</div>
            <div style="font-size:14px;opacity:.92;">Account Recovery</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            <h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Verify your identity</h2>
            <p style="margin:0 0 18px;font-size:14px;color:#4b5563;line-height:1.5;">
              Use the code below to reset your password. This code expires in
              <strong>${expiresInMin} minutes</strong>.
            </p>
            <div style="margin:6px 0 20px;text-align:center;">
              <div style="display:inline-block;background:#fff5f5;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:14px 22px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:10px;">${code}</div>
            </div>
            <p style="margin:0 0 6px;font-size:13px;color:#6b7280;line-height:1.5;">
              If you didn&rsquo;t request a password reset, you can safely ignore this email.
              Your account is still secure.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px 26px;border-top:1px solid #f1f1f1;font-size:12px;color:#9ca3af;text-align:center;">
            Sent to ${to}. © Personal Collection.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  return { subject, text, html }
}

async function sendOtpEmail({ to, code, expiresInMin = 10 }) {
  const transporter = getTransporter()
  if (!transporter) {
    const err = new Error('SMTP_NOT_CONFIGURED')
    err.code = 'SMTP_NOT_CONFIGURED'
    throw err
  }
  const from = getFrom()
  const { subject, text, html } = buildOtpEmail({ to, code, expiresInMin })

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  })
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }
}

module.exports = { sendOtpEmail, isMailerReady }
