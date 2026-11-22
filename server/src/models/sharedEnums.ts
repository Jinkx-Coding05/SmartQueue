export const USER_ROLES = ['citizen', 'admin'] as const
export const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'] as const
export const COUNTER_STATUSES = ['active', 'available', 'busy', 'inactive', 'maintenance'] as const
export const TOKEN_PRIORITIES = ['normal', 'priority', 'emergency'] as const
export const TOKEN_STATUSES = ['waiting', 'serving', 'completed', 'skipped', 'cancelled'] as const
export const APPOINTMENT_STATUSES = ['pending', 'approved', 'rescheduled', 'completed', 'cancelled'] as const
export const DOCUMENT_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const
export const NOTIFICATION_TYPES = ['appointment', 'queue', 'document', 'system'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]
export type CounterStatus = (typeof COUNTER_STATUSES)[number]
export type TokenPriority = (typeof TOKEN_PRIORITIES)[number]
export type TokenStatus = (typeof TOKEN_STATUSES)[number]
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]
export type DocumentVerificationStatus = (typeof DOCUMENT_VERIFICATION_STATUSES)[number]
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
