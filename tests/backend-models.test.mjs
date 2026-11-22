import assert from 'node:assert/strict'
import { test } from 'node:test'
import mongoose from 'mongoose'
import {
  AppointmentModel,
  CounterModel,
  DepartmentModel,
  DocumentModel,
  NotificationModel,
  TokenModel,
  UserModel,
} from '../server/src/models/index.ts'

const citizenId = new mongoose.Types.ObjectId()
const departmentId = new mongoose.Types.ObjectId()
const counterId = new mongoose.Types.ObjectId()

test('all database models accept complete valid documents and apply defaults', async () => {
  const user = new UserModel({ fullName: 'Demo Citizen', email: 'CITIZEN@DEMO.EXAMPLE', phoneNumber: '+91 90000 00001', passwordHash: '$argon2id$demo-password-hash' })
  const department = new DepartmentModel({ name: 'General Medicine', workingHours: [{ day: 'monday', opensAt: '09:00', closesAt: '17:00' }] })
  const counter = new CounterModel({ name: 'General Medicine Desk', counterNumber: 'COUNTER-01', department: departmentId })
  const token = new TokenModel({ tokenNumber: 'A-024', citizen: citizenId, department: departmentId, counter: counterId })
  const appointment = new AppointmentModel({ appointmentId: 'APT-A024', citizen: citizenId, department: departmentId, appointmentDate: new Date('2026-12-01T00:00:00Z'), appointmentTime: '09:30' })
  const document = new DocumentModel({ citizen: citizenId, documentType: 'Government ID', fileMetadata: { originalName: 'identity.pdf', mimeType: 'application/pdf', sizeBytes: 1024, storageProvider: 'future-external-storage', storageKey: 'citizens/demo/identity.pdf' } })
  const notification = new NotificationModel({ user: citizenId, title: 'Appointment update', message: 'Your appointment is confirmed.', type: 'appointment' })

  await Promise.all([user, department, counter, token, appointment, document, notification].map((document) => document.validate()))

  assert.equal(user.email, 'citizen@demo.example')
  assert.equal(user.role, 'citizen')
  assert.equal(counter.status, 'inactive')
  assert.equal(token.status, 'waiting')
  assert.equal(token.priority, 'normal')
  assert.equal(notification.isRead, false)
  assert.equal(UserModel.schema.path('passwordHash').options.select, false)
})

test('required fields, enums, and external file metadata are validated', async () => {
  await assertInvalid(new UserModel({ email: 'invalid' }), 'fullName')
  await assertInvalid(new UserModel({ fullName: 'Valid Name', email: 'valid@example.test', phoneNumber: '123', passwordHash: 'hash-long-enough-for-validation', role: 'superuser' }), 'role')
  await assertInvalid(new CounterModel({ name: 'Desk', counterNumber: 'COUNTER-X', department: departmentId, status: 'paused' }), 'status')
  await assertInvalid(new TokenModel({ tokenNumber: 'BAD-1', citizen: citizenId, department: departmentId, status: 'called' }), 'status')
  await assertInvalid(new AppointmentModel({ appointmentId: 'APT-BAD', citizen: citizenId, department: departmentId, appointmentDate: new Date(), appointmentTime: '9:30', status: 'upcoming' }), 'status')
  await assertInvalid(new DocumentModel({ citizen: citizenId, documentType: 'ID', fileMetadata: { originalName: 'id.pdf', mimeType: 'application/pdf', sizeBytes: 0, storageProvider: 'external', storageKey: 'key' } }), 'fileMetadata.sizeBytes')
  const metadataOnlyDocument = new DocumentModel({ citizen: citizenId, documentType: 'ID', fileMetadata: { originalName: 'id.pdf', mimeType: 'application/pdf', sizeBytes: 12 } })
  await metadataOnlyDocument.validate()
  assert.equal(metadataOnlyDocument.storageStatus, 'metadata-only')
  await assertInvalid(new NotificationModel({ user: citizenId, title: 'Notice', message: 'Message', type: 'unknown' }), 'type')
})

test('frequently searched and unique fields have schema indexes', () => {
  const hasIndex = (model, field) => model.schema.indexes().some(([keys, options]) => keys[field] === 1 && options.unique === true)
  assert.equal(hasIndex(UserModel, 'email'), true)
  assert.equal(hasIndex(UserModel, 'phoneNumber'), true)
  assert.equal(hasIndex(CounterModel, 'counterNumber'), true)
  assert.equal(hasIndex(TokenModel, 'tokenNumber'), true)
  assert.equal(hasIndex(AppointmentModel, 'appointmentId'), true)
  assert.ok(TokenModel.schema.indexes().some(([keys]) => keys.department === 1 && keys.status === 1))
  assert.ok(NotificationModel.schema.indexes().some(([keys]) => keys.user === 1 && keys.isRead === 1))
})

async function assertInvalid(document, path) {
  await assert.rejects(document.validate(), (error) => {
    assert.ok(error.errors[path], `expected validation error for ${path}`)
    return true
  })
}
