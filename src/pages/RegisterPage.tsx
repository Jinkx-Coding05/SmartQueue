import { ArrowLeft, Mail, Phone, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthInput } from '../components/auth/AuthInput'
import { PasswordInput } from '../components/auth/PasswordInput'
import { BrandLogo } from '../components/common/BrandLogo'
import { register } from '../services/api/authApi'

type RegistrationErrors = Partial<Record<'name' | 'email' | 'phone' | 'password' | 'confirmPassword' | 'terms', string>>

export function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  const validate = (): RegistrationErrors => {
    const nextErrors: RegistrationErrors = {}
    if (name.trim().length < 2) nextErrors.name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = 'Enter a valid email address.'
    if (!/^[+\d][\d\s()-]{7,}$/.test(phone)) nextErrors.phone = 'Enter a valid phone number.'
    if (password.length < 8) nextErrors.password = 'Use at least 8 characters.'
    if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.'
    if (!termsAccepted) nextErrors.terms = 'Accept the terms to continue.'
    return nextErrors
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setLoading(true); setApiError('')
    try { const result = await register({ fullName: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, confirmPassword }); sessionStorage.setItem('smartqueue.pendingEmail', result.user.email); navigate('/verify-otp', { state: { debugVerificationCode: result.debugVerificationCode, deliveryConfigured: result.deliveryConfigured } }) }
    catch (cause) { setApiError(cause instanceof Error ? cause.message : 'Registration failed.') } finally { setLoading(false) }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell auth-shell--wide">
        <div className="auth-brand"><BrandLogo /></div>
        <Link className="back-link" to="/"><ArrowLeft size={16} /> Back to home</Link>
        <section className="auth-card" aria-labelledby="register-heading">
          <div className="auth-heading"><span className="auth-icon"><UserRound size={21} /></span><p className="eyebrow">GET STARTED</p><h1 id="register-heading">Create your account</h1><p>Join SmartQueue AI and spend less time waiting.</p></div>
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <AuthInput label="Full name" id="register-name" icon={<UserRound size={17} aria-hidden="true" />} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" autoComplete="name" error={errors.name} required />
            <div className="auth-form-grid"><AuthInput label="Email address" id="register-email" icon={<Mail size={17} aria-hidden="true" />} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" error={errors.email} required /><AuthInput label="Phone number" id="register-phone" icon={<Phone size={17} aria-hidden="true" />} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 90000 00000" autoComplete="tel" error={errors.phone} required /></div>
            <div className="auth-form-grid"><PasswordInput id="register-password" label="Password" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" /><PasswordInput id="register-confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} autoComplete="new-password" /></div>
            <div className="demo-callout"><UserRound size={17} /><span><strong>Citizen account</strong><small>Admin accounts are securely provisioned and cannot be created through public registration.</small></span></div>
            <label className="checkbox-label checkbox-label--terms"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /> I agree to the <button className="inline-action" type="button" onClick={() => window.alert('Terms and conditions are not configured for this application.')}>terms and conditions</button></label>
            {errors.terms && <p className="field-error" role="alert">{errors.terms}</p>}
            {apiError && <p className="form-error" role="alert">{apiError}</p>}
            <button className="button button--primary auth-submit" type="submit" disabled={loading}>{loading ? 'Preparing verification…' : 'Continue to OTP verification'}</button>
          </form>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </section>
      </div>
    </main>
  )
}
