import type { InputHTMLAttributes, ReactNode } from 'react'

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  icon: ReactNode
  error?: string
}

export function AuthInput({ label, icon, error, id, ...inputProps }: AuthInputProps) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap ${error ? 'input-wrap--error' : ''}`}>
        {icon}
        <input id={id} {...inputProps} />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
