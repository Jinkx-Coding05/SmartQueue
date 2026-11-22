import { Resend } from 'resend'
import { env } from '../config/env.ts'

export type OtpPurpose = 'email verification' | 'password reset'

export interface OtpDeliveryProvider {
  sendCode(email: string, code: string, purpose: OtpPurpose, expiresAt: Date, ttlMinutes: number): Promise<void>
  sendPasswordReset(email: string, token: string, expiresAt: Date, ttlMinutes: number): Promise<void>
}

export class OtpDeliveryError extends Error {
  constructor() {
    super('Email delivery could not be completed.')
    this.name = 'OtpDeliveryError'
  }
}

export class UnconfiguredOtpDeliveryProvider implements OtpDeliveryProvider {
  async sendCode(_email: string, _code: string, _purpose: OtpPurpose, _expiresAt: Date, _ttlMinutes: number): Promise<void> {
    throw new OtpDeliveryError()
  }

  async sendPasswordReset(_email: string, _token: string, _expiresAt: Date, _ttlMinutes: number): Promise<void> {
    throw new OtpDeliveryError()
  }
}

export class ResendOtpDeliveryProvider implements OtpDeliveryProvider {
  private readonly resend: Resend
  private readonly from: string

  constructor(apiKey = env.resendApiKey, from = env.otpFromEmail, client?: Pick<Resend, 'emails'>) {
    if (!apiKey || !from) throw new OtpDeliveryError()
    this.resend = client ? client as Resend : new Resend(apiKey)
    this.from = from
  }

  async sendCode(email: string, code: string, purpose: OtpPurpose, expiresAt: Date, ttlMinutes: number) {
    const purposeTitle = purpose === 'email verification' ? 'Verify your email address' : 'Reset your password'
    const safePurpose = escapeHtml(purpose)
    const expiry = formatExpiry(expiresAt)
    const html = emailLayout(`<h1>${purposeTitle}</h1><p>Use this one-time code to complete your SmartQueue AI ${safePurpose} request.</p><div style="margin:28px 0;padding:18px;text-align:center;background:#eef5ff;border-radius:12px;font-size:32px;letter-spacing:8px;font-weight:700;color:#173b70">${code}</div><p>This code expires in ${ttlMinutes} minutes (${expiry}). If you did not request it, you can ignore this email.</p>`)
    const text = `SmartQueue AI — ${purposeTitle}\n\nYour one-time code is: ${code}\nPurpose: ${purpose}\nIt expires in ${ttlMinutes} minutes (${expiry}). If you did not request it, ignore this email.`
    await this.submit({ from: this.from, to: [email], subject: `SmartQueue AI: ${purposeTitle}`, html, text })
  }

  async sendPasswordReset(email: string, token: string, expiresAt: Date, ttlMinutes: number) {
    const resetUrl = `${env.clientUrl.replace(/\/$/, '')}/login?resetToken=${encodeURIComponent(token)}`
    const expiry = formatExpiry(expiresAt)
    const html = emailLayout(`<h1>Reset your password</h1><p>We received a request to reset your SmartQueue AI password.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:13px 20px;background:#1769aa;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p><p>This link expires in ${ttlMinutes} minutes (${expiry}). If you did not request a reset, ignore this email.</p>`)
    const text = `SmartQueue AI password reset\n\nOpen this link to set a new password: ${resetUrl}\nThis link expires in ${ttlMinutes} minutes (${expiry}). If you did not request a reset, ignore this email.`
    await this.submit({ from: this.from, to: [email], subject: 'SmartQueue AI: Reset your password', html, text })
  }

  private async submit(message: { from: string; to: string[]; subject: string; html: string; text: string }) {
    try {
      if (!message.to.every(isValidEmail)) throw new OtpDeliveryError()
      const { data, error } = await this.resend.emails.send(message)
      if (error || !data?.id) throw new OtpDeliveryError()
    } catch {
      // Provider errors can contain request data; never propagate or log them.
      throw new OtpDeliveryError()
    }
  }
}

function isValidEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function emailLayout(content: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,sans-serif;color:#172b4d"><div style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-radius:16px"><p style="margin:0 0 24px;color:#1769aa;font-size:13px;font-weight:700;letter-spacing:1px">SMARTQUEUE AI</p>${content}<hr style="margin:28px 0;border:0;border-top:1px solid #e5eaf0"><p style="margin:0;color:#667085;font-size:12px">This is an automated message from SmartQueue AI. Please do not reply.</p></div></body></html>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

function formatExpiry(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(value)
}
