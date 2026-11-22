import { AuthRevocationModel } from '../models/AuthRevocation.ts'
import { UserModel } from '../models/User.ts'
import type { UserRole } from '../models/sharedEnums.ts'

export type UserRecord = {
  id: string
  fullName: string
  email: string
  phoneNumber: string
  role: UserRole
  emailVerified: boolean
  accountStatus: 'active' | 'inactive' | 'suspended'
  createdAt: Date
  passwordHash?: string
  passwordChangedAt?: Date
}

export interface AuthRepository {
  findByEmailOrPhone(email: string, phone: string): Promise<boolean>
  createUser(input: { fullName: string; email: string; phoneNumber: string; passwordHash: string; passwordChangedAt: Date; role: UserRole; emailVerified: boolean; demoSeedKey?: string }): Promise<UserRecord>
  findForLogin(email: string): Promise<UserRecord | null>
  findForPasswordChange(id: string): Promise<UserRecord | null>
  setPassword(id: string, passwordHash: string, changedAt: Date): Promise<boolean>
  findById(id: string): Promise<UserRecord | null>
  findByEmail(email: string): Promise<UserRecord | null>
  saveVerificationCode(email: string, codeHash: string, expiresAt: Date): Promise<boolean>
  consumeVerificationCode(email: string, codeHash: string, now: Date): Promise<UserRecord | null>
  saveResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<boolean>
  consumeResetToken(tokenHash: string, passwordHash: string, changedAt: Date): Promise<boolean>
  revokeToken(tokenId: string, expiresAt: Date): Promise<void>
  isTokenRevoked(tokenId: string): Promise<boolean>
}

function toUserRecord(user: Awaited<ReturnType<typeof UserModel.findById>> & object): UserRecord {
  const value = user as typeof user & {
    _id: { toString(): string }
    fullName: string
    email: string
    phoneNumber: string
    role: UserRole
    emailVerified: boolean
    accountStatus: UserRecord['accountStatus']
    createdAt: Date
    passwordHash?: string
    passwordChangedAt?: Date
  }
  return {
    id: value._id.toString(),
    fullName: value.fullName,
    email: value.email,
    phoneNumber: value.phoneNumber,
    role: value.role,
    emailVerified: value.emailVerified,
    accountStatus: value.accountStatus,
    createdAt: value.createdAt,
    ...(value.passwordHash ? { passwordHash: value.passwordHash } : {}),
    ...(value.passwordChangedAt ? { passwordChangedAt: value.passwordChangedAt } : {}),
  }
}

export const mongooseAuthRepository: AuthRepository = {
  async findByEmailOrPhone(email, phone) {
    return Boolean(await UserModel.exists({ $or: [{ email }, { phoneNumber: phone }] }))
  },
  async createUser(input) {
    const user = new UserModel(input)
    await user.save()
    return toUserRecord(user)
  },
  async findForLogin(email) {
    const user = await UserModel.findOne({ email }).select('+passwordHash +passwordChangedAt').exec()
    return user ? toUserRecord(user) : null
  },
  async findForPasswordChange(id) {
    const user = await UserModel.findById(id).select('+passwordHash +passwordChangedAt').exec()
    return user ? toUserRecord(user) : null
  },
  async setPassword(id, passwordHash, changedAt) {
    const result = await UserModel.updateOne({ _id: id }, { $set: { passwordHash, passwordChangedAt: changedAt }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }).exec()
    return result.modifiedCount === 1
  },
  async findById(id) {
    const user = await UserModel.findById(id).select('+passwordChangedAt').exec()
    return user ? toUserRecord(user) : null
  },
  async findByEmail(email) {
    const user = await UserModel.findOne({ email }).exec()
    return user ? toUserRecord(user) : null
  },
  async saveVerificationCode(email, codeHash, expiresAt) {
    const result = await UserModel.updateOne({ email, emailVerified: false }, { $set: { verificationCodeHash: codeHash, verificationCodeExpiresAt: expiresAt } }).exec()
    return result.modifiedCount === 1 || result.matchedCount === 1
  },
  async consumeVerificationCode(email, codeHash, now) {
    const user = await UserModel.findOneAndUpdate(
      { email, emailVerified: false, verificationCodeHash: codeHash, verificationCodeExpiresAt: { $gt: now } },
      { $set: { emailVerified: true }, $unset: { verificationCodeHash: 1, verificationCodeExpiresAt: 1 } },
      { new: true, runValidators: true },
    ).exec()
    return user ? toUserRecord(user) : null
  },
  async saveResetToken(email, tokenHash, expiresAt) {
    const result = await UserModel.updateOne({ email }, { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }).exec()
    return result.modifiedCount === 1 || result.matchedCount === 1
  },
  async consumeResetToken(tokenHash, passwordHash, changedAt) {
    const result = await UserModel.updateOne(
      { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: changedAt } },
      { $set: { passwordHash, passwordChangedAt: changedAt }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } },
      { runValidators: true },
    ).exec()
    return result.modifiedCount === 1
  },
  async revokeToken(tokenId, expiresAt) {
    await AuthRevocationModel.updateOne({ tokenId }, { $setOnInsert: { tokenId, expiresAt } }, { upsert: true }).exec()
  },
  async isTokenRevoked(tokenId) {
    return Boolean(await AuthRevocationModel.exists({ tokenId }))
  },
}

export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000
}
