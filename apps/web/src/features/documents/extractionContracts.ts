import { z } from 'zod'
import { exactDecimalSchema } from '../../shared/lib/decimal.ts'

const fieldProposalSchema = z.object({
  value: z.string(),
  rawValue: z.string(),
  dataType: z.string(),
  source: z.string(),
  page: z.number().int().positive().nullable(),
  unit: z.string().nullable(),
  confidence: exactDecimalSchema.nullable(),
})
const extractedDocumentSchema = z.object({
  type: z.string(),
  provider: z.string().nullable(),
  pageCount: z.number().int().positive(),
  documentNumber: z.string().nullable(),
})
const extractedReadingSchema = z.object({
  meterNumber: z.string().nullable(),
  ownership: z.string().nullable(),
  currentValue: z.string().nullable(),
  previousValue: z.string().nullable(),
  consumption: z.string().nullable(),
  unit: z.string().nullable(),
  constant: z.string().nullable(),
  period: z.string().nullable(),
  page: z.number().int().positive().nullable(),
})
const extractedChargeSchema = z.object({
  description: z.string(),
  amount: z.string(),
  currency: z.string(),
  category: z.string().nullable(),
  page: z.number().int().positive().nullable(),
})
const extractedArtifactSchema = z.object({
  type: z.string(),
  format: z.string().nullable(),
  value: z.string().nullable(),
  title: z.string().nullable(),
  page: z.number().int().positive(),
  status: z.string(),
})
const extractionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().nullable(),
})

export const extractedBillSchema = z.object({
  text: z.string(),
  fields: z.record(z.string(), z.string()),
  confidence: exactDecimalSchema.nullable(),
  engine: z.string(),
  schemaVersion: z.number().int().positive().optional().default(1),
  document: extractedDocumentSchema.nullish().default(null),
  proposals: z
    .record(z.string(), z.array(fieldProposalSchema))
    .optional()
    .default({}),
  metadata: z.record(z.string(), z.string()).optional().default({}),
  readings: z.array(extractedReadingSchema).optional().default([]),
  charges: z.array(extractedChargeSchema).optional().default([]),
  artifacts: z.array(extractedArtifactSchema).optional().default([]),
  warnings: z.array(extractionWarningSchema).optional().default([]),
})

export type ExtractedBill = z.infer<typeof extractedBillSchema>
