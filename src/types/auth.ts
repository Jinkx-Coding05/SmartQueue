export type UserRole = 'citizen' | 'admin'

export type AuthUser = {
  name: string
  email: string
  phone: string
  role: UserRole
}

export type RegistrationDraft = AuthUser & {
  password: string
}
