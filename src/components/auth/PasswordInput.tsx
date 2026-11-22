import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { useState } from 'react'

type PasswordInputProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  autoComplete?: string
}

export function PasswordInput({ id, label, value, onChange, error, autoComplete }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap ${error ? 'input-wrap--error' : ''}`}>
        <LockKeyhole size={17} aria-hidden="true" />
        <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} />
        <button className="password-toggle" type="button" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setVisible((current) => !current)}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
