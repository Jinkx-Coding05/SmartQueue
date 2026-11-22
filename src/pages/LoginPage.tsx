import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthInput } from '../components/auth/AuthInput'
import { PasswordInput } from '../components/auth/PasswordInput'
import { BrandLogo } from '../components/common/BrandLogo'
import { useAuth } from '../context/useAuth'
import { login, requestPasswordReset, resetPassword } from '../services/api/authApi'

export function LoginPage() {
  const navigate = useNavigate(); const { signIn } = useAuth()
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false)
  const [recovery, setRecovery] = useState(false); const [resetToken, setResetToken] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('')
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true)
    try { const session = await login({ email: identifier.trim(), password }); signIn(session, rememberMe); navigate(session.user.role === 'admin' ? '/admin/dashboard' : '/citizen/dashboard', { replace: true }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign in failed.') } finally { setLoading(false) }
  }
  const handleResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true)
    try { const result = await requestPasswordReset(identifier.trim()); setMessage(result.message); if (result.debugResetToken) { setResetToken(result.debugResetToken); setMessage('Development reset token provided below. No email was sent because a delivery provider is not configured.') } }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not request password reset.') } finally { setLoading(false) }
  }
  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage(''); if (newPassword.length < 8 || newPassword !== confirmPassword) { setError('Use at least 8 characters and make both passwords match.'); return }
    setLoading(true); try { const result = await resetPassword({ token: resetToken, password: newPassword, confirmPassword }); setMessage(result.message); setRecovery(false); setResetToken(''); setNewPassword(''); setConfirmPassword('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reset password.') } finally { setLoading(false) }
  }
  const submit = recovery ? (resetToken ? handleReset : handleResetRequest) : handleSubmit
  return <main className="auth-page"><div className="auth-shell"><div className="auth-brand"><BrandLogo /></div><Link className="back-link" to="/"><ArrowLeft size={16} /> Back to home</Link><section className="auth-card" aria-labelledby="login-heading">
    <div className="auth-heading"><span className="auth-icon"><ShieldCheck size={21} /></span><p className="eyebrow">WELCOME BACK</p><h1 id="login-heading">Sign in to SmartQueue AI</h1><p>Access your appointments, tokens and queue updates.</p></div>
    <div className="demo-callout"><ShieldCheck size={17} /><span><strong>Secure account sign in</strong><small>Use the email and password associated with your verified account.</small></span></div>
    <form className="auth-form" onSubmit={submit} noValidate><AuthInput label="Email address" id="login-identifier" icon={<Mail size={17} aria-hidden="true" />} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="you@example.com" autoComplete="username" required />
      {!recovery && <PasswordInput id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />}
      {recovery && resetToken && <><label className="auth-field"><span>Development reset token</span><input value={resetToken} onChange={(event) => setResetToken(event.target.value)} required /></label><PasswordInput id="reset-password" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" /><PasswordInput id="reset-confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" /></>}
      {!recovery && <div className="auth-options"><label className="checkbox-label"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Remember me on this device</label><button className="inline-action" type="button" onClick={() => { setRecovery(true); setMessage('Enter your email to request a reset. If delivery is not configured, the API will not claim an email was sent.') }}>Forgot password?</button></div>}
      <button className="button button--primary auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : recovery ? resetToken ? 'Reset password' : 'Request reset' : 'Sign In'}</button>
      {recovery && <button className="inline-action" type="button" onClick={() => { setRecovery(false); setResetToken(''); setError(''); setMessage('') }}>Return to sign in</button>}
      {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-message" role="status">{message}</p>}
    </form><p className="auth-switch">New to SmartQueue AI? <Link to="/register">Create an account</Link></p>
  </section></div></main>
}
