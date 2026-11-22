import mongoose, { type InferSchemaType } from 'mongoose'
import { DOCUMENT_VERIFICATION_STATUSES } from './sharedEnums.ts'

const { model, models, Schema } = mongoose

const fileMetadataSchema = new Schema({
  originalName: { type: String, required: true, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true, trim: true, maxlength: 120 },
  sizeBytes: { type: Number, required: true, min: 1 },
  storageProvider: { type: String, trim: true, maxlength: 40 },
  storageKey: { type: String, trim: true, maxlength: 1024 },
}, { _id: false })

export const documentSchema = new Schema({
  citizen: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  documentType: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  fileMetadata: { type: fileMetadataSchema, required: true },
  verificationStatus: { type: String, enum: DOCUMENT_VERIFICATION_STATUSES, required: true, default: 'pending' },
  storageStatus: { type: String, enum: ['metadata-only', 'stored'], required: true, default: 'metadata-only' },
  uploadDate: { type: Date, required: true, default: Date.now },
}, { timestamps: true, versionKey: false })

documentSchema.index({ citizen: 1, uploadDate: -1 })
documentSchema.index({ verificationStatus: 1, uploadDate: -1 })

export type CitizenDocument = InferSchemaType<typeof documentSchema>
export const DocumentModel = models.Document ?? model('Document', documentSchema)
