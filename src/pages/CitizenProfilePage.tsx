import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, Camera, CheckCircle2, IdCard, LockKeyhole, MapPin, Pencil, Save, ShieldCheck, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PasswordInput } from '../components/auth/PasswordInput'
import { DashboardLayout } from '../components/dashboard/DashboardLayout'
import { getCitizenProfile as getProfileApi, updateCitizenProfile } from '../services/api/citizenApi'
import { useAuth } from '../context/useAuth'
import { changePassword } from '../services/api/authApi'
import { useNavigate } from 'react-router-dom'
import type { CitizenProfileApi } from '../types/citizenApi'
import '../styles/citizen-profile.css'

type CitizenProfile = { name: string; email: string; phone: string; dateOfBirth: string; gender: string; address: string; city: string; state: string; pinCode: string; avatar: string; id?: string; createdAt?: string; accountStatus?: string }
type ProfileErrors = Partial<Record<keyof CitizenProfile, string>>
const emptyProfile: CitizenProfile = { name: '', email: '', phone: '', dateOfBirth: '', gender: '', address: '', city: '', state: '', pinCode: '', avatar: '' }
function mapProfile(p: CitizenProfileApi): CitizenProfile { return { ...emptyProfile, id: p.id, name: p.fullName, email: p.email, phone: p.phoneNumber, dateOfBirth: p.dateOfBirth?.slice(0, 10) ?? '', gender: p.gender ?? '', address: p.address?.address ?? '', city: p.address?.city ?? '', state: p.address?.state ?? '', pinCode: p.address?.pinCode ?? '', avatar: p.profileImage ?? '', createdAt: p.createdAt, accountStatus: p.accountStatus } }

export function CitizenProfilePage() {
  const { token, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CitizenProfile>(emptyProfile)
  const [draft, setDraft] = useState<CitizenProfile>(profile)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('Loading your profile…')
  useEffect(() => { if (!token) return; let active = true; getProfileApi(token).then((p) => { if (active) { const next = mapProfile(p); setProfile(next); setDraft(next); setNotice('Profile loaded from your account.') } }).catch((e: unknown) => { if (active) setNotice(e instanceof Error ? e.message : 'Profile could not be loaded.') }); return () => { active = false } }, [token])
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  const beginEditing = () => { setDraft({ ...profile }); setErrors({}); setEditing(true) }
  const cancelEditing = () => { setDraft({ ...profile }); setErrors({}); setEditing(false); setNotice('Edits discarded. Your saved profile was restored.') }
  const validateProfile = () => {
    const next: ProfileErrors = {}
    if (draft.name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^[+\d][\d\s()-]{7,}$/.test(draft.phone.trim())) next.phone = 'Enter a valid phone number.'
    if (!draft.dateOfBirth) next.dateOfBirth = 'Select your date of birth.'
    else if (new Date(`${draft.dateOfBirth}T00:00:00`) > new Date()) next.dateOfBirth = 'Date of birth cannot be in the future.'
    if (draft.address.trim().length < 5) next.address = 'Enter your street address.'
    if (draft.city.trim().length < 2) next.city = 'Enter your city.'
    if (draft.state.trim().length < 2) next.state = 'Enter your state.'
    if (!/^\d{6}$/.test(draft.pinCode.trim())) next.pinCode = 'Enter a valid 6-digit PIN code.'
    return next
  }
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateProfile()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { setNotice('Please correct the highlighted fields before saving.'); return }
    if (!token) { setNotice('Your session expired. Sign in again.'); return }
    try { const updated = await updateCitizenProfile(token, { fullName: draft.name.trim(), phoneNumber: draft.phone.trim(), dateOfBirth: draft.dateOfBirth, gender: draft.gender, address: { address: draft.address.trim(), city: draft.city.trim(), state: draft.state.trim(), pinCode: draft.pinCode.trim() } }); const next = mapProfile(updated); setProfile(next); setDraft(next); setEditing(false); setNotice('Profile changes saved to your account. Profile photos remain a local preview until file storage is configured.') } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Profile could not be saved.') }
  }
  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setNotice('Choose an image file to update your profile photo.'); return }
    if (file.size > 2 * 1024 * 1024) { setNotice('Choose an image smaller than 2 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { setDraft((current) => ({ ...current, avatar: String(reader.result) })); setNotice('Photo preview updated. Save your profile to keep this image.') }
    reader.onerror = () => setNotice('This image could not be previewed. Try another file.')
    reader.readAsDataURL(file)
  }
  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setPasswordError(''); setPasswordNotice('')
    if (!passwords.current) { setPasswordError('Enter your current password to validate this form.'); return }
    if (passwords.next.length < 10 || !/[a-z]/.test(passwords.next) || !/[A-Z]/.test(passwords.next) || !/\d/.test(passwords.next) || !/[^A-Za-z0-9]/.test(passwords.next)) { setPasswordError('Use at least 10 characters with lowercase, uppercase, a number and a symbol.'); return }
    if (passwords.next !== passwords.confirm) { setPasswordError('New password and confirmation do not match.'); return }
    if (passwords.next === passwords.current) { setPasswordError('Choose a new password different from your current one.'); return }
    try { await changePassword({ currentPassword: passwords.current, newPassword: passwords.next, confirmPassword: passwords.confirm }); setPasswords({ current: '', next: '', confirm: '' }); setPasswordNotice('Password changed. All active sessions were revoked; sign in again.'); await signOut(); navigate('/login', { replace: true }) } catch (cause) { setPasswordError(cause instanceof Error ? cause.message : 'Password could not be changed.') }
  }

  const shownProfile = editing ? draft : profile
  const initials = profile.name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return <DashboardLayout><main className="citizen-profile-page">
    <Link className="profile-back-link" to="/citizen/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link>
    <section className="profile-page-heading"><div><p className="dashboard-kicker">YOUR ACCOUNT</p><h1>My profile</h1><p>Keep your personal details current for a smoother visit.</p></div>{!editing && <button className="button button--primary profile-edit-button" type="button" onClick={beginEditing}><Pencil size={16} /> Edit profile</button>}</section>
    <div className="profile-feedback" role="status"><CheckCircle2 size={17} /><span>{notice}</span></div>

    <section className="profile-overview-card" aria-label="Profile overview"><div className="profile-overview-identity"><div className="profile-avatar">{profile.avatar ? <img src={profile.avatar} alt={`${profile.name} profile`} /> : initials}</div><div><p className="profile-overview-label">CITIZEN ACCOUNT</p><h2>{profile.name}</h2><p>{profile.email}</p><p>{profile.phone}</p></div></div><span className="profile-active-badge"><span /> Active account</span></section>

    <form className="profile-form" onSubmit={saveProfile} noValidate>
      <section className="profile-panel"><div className="profile-panel-heading"><span><UserRound size={18} /></span><div><h2>Personal information</h2><p>Your name and contact details</p></div></div>
        <div className="profile-photo-control"><div className="profile-avatar profile-avatar--small">{shownProfile.avatar ? <img src={shownProfile.avatar} alt="Profile photo preview" /> : initials}</div><div><strong>Profile photo</strong><small>JPG, PNG or GIF. Maximum size 2 MB.</small>{editing && <label className="profile-photo-button"><Camera size={15} /> Choose photo<input type="file" accept="image/*" onChange={handlePhoto} /></label>}</div></div>
        <div className="profile-fields-grid"><ProfileField label="Full name" field="name" value={shownProfile.name} editing={editing} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} error={errors.name} autoComplete="name" /><ProfileField label="Email address (managed by account security)" field="email" type="email" value={shownProfile.email} editing={false} onChange={() => undefined} autoComplete="email" /><ProfileField label="Phone number" field="phone" type="tel" value={shownProfile.phone} editing={editing} onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} error={errors.phone} autoComplete="tel" /><ProfileField label="Date of birth" field="dateOfBirth" type="date" value={shownProfile.dateOfBirth} editing={editing} onChange={(value) => setDraft((current) => ({ ...current, dateOfBirth: value }))} error={errors.dateOfBirth} /><label className="profile-field"><span>Gender <small>(optional)</small></span>{editing ? <select value={shownProfile.gender} onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value }))}><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select> : <output>{shownProfile.gender || 'Not provided'}</output>}</label></div>
      </section>

      <section className="profile-panel"><div className="profile-panel-heading"><span><MapPin size={18} /></span><div><h2>Address information</h2><p>Where we can reach you for service updates</p></div></div><div className="profile-fields-grid"><ProfileField label="Street address" field="address" value={shownProfile.address} editing={editing} onChange={(value) => setDraft((current) => ({ ...current, address: value }))} error={errors.address} autoComplete="street-address" /><ProfileField label="City" field="city" value={shownProfile.city} editing={editing} onChange={(value) => setDraft((current) => ({ ...current, city: value }))} error={errors.city} autoComplete="address-level2" /><ProfileField label="State" field="state" value={shownProfile.state} editing={editing} onChange={(value) => setDraft((current) => ({ ...current, state: value }))} error={errors.state} autoComplete="address-level1" /><ProfileField label="PIN code" field="pinCode" value={shownProfile.pinCode} editing={editing} onChange={(value) => setDraft((current) => ({ ...current, pinCode: value }))} error={errors.pinCode} autoComplete="postal-code" /></div></section>

      {editing && <div className="profile-form-actions"><button className="button button--primary" type="submit"><Save size={16} /> Save changes</button><button className="profile-cancel-button" type="button" onClick={cancelEditing}><X size={16} /> Cancel</button></div>}
    </form>

    <section className="profile-panel profile-account-panel"><div className="profile-panel-heading"><span><IdCard size={18} /></span><div><h2>Account information</h2><p>Details associated with your SmartQueue account</p></div></div><div className="profile-account-grid"><AccountDetail label="Citizen ID" value={profile.id ?? '—'} /><AccountDetail label="Registration date" value={profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '—'} /><div><span>Account status</span><strong className="profile-account-status">{profile.accountStatus ?? 'Unknown'}</strong></div></div></section>

    <section className="profile-panel"><div className="profile-panel-heading"><span><ShieldCheck size={18} /></span><div><h2>Security</h2><p>Change your password</p></div></div><div className="profile-security-note"><LockKeyhole size={17} /><span>Your current password is verified before the change. All active sessions are revoked afterward.</span></div><form className="profile-password-form" onSubmit={handlePasswordSubmit} noValidate><div className="profile-password-grid"><PasswordInput id="citizen-current-password" label="Current password" value={passwords.current} onChange={(current) => setPasswords((values) => ({ ...values, current }))} autoComplete="current-password" /><PasswordInput id="citizen-new-password" label="New password" value={passwords.next} onChange={(next) => setPasswords((values) => ({ ...values, next }))} autoComplete="new-password" /><PasswordInput id="citizen-confirm-password" label="Confirm new password" value={passwords.confirm} onChange={(confirm) => setPasswords((values) => ({ ...values, confirm }))} autoComplete="new-password" /></div>{passwordError && <p className="profile-form-error" role="alert">{passwordError}</p>}{passwordNotice && <p className="profile-form-success" role="status">{passwordNotice}</p>}<button className="button button--secondary" type="submit">Change password</button></form></section>
  </main></DashboardLayout>
}

function ProfileField({ label, field, value, editing, onChange, error, type = 'text', autoComplete }: { label: string; field: keyof CitizenProfile; value: string; editing: boolean; onChange: (value: string) => void; error?: string; type?: string; autoComplete?: string }) {
  const id = `citizen-profile-${field}`
  return <label className={`profile-field ${error ? 'profile-field--error' : ''}`} htmlFor={id}><span>{label}</span>{editing ? <input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} /> : <output id={id}>{value || 'Not provided'}</output>}{error && <small id={`${id}-error`} role="alert">{error}</small>}</label>
}
function AccountDetail({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div> }
