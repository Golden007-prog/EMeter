import { z } from 'zod'
import { apiRequest } from '../../shared/api/client'
import { exactDecimalSchema as decimal } from '../../shared/lib/decimal'
import { alertSchema } from '../readings/api'
import type { ReadingSource } from '../readings/api'

const readingReference = z.object({
  readingId: z.uuid(),
  propertyId: z.uuid().nullable(),
  meterId: z.uuid(),
  billingPeriodId: z.uuid().nullable(),
})
const pendingSchema = readingReference.extend({
  measuredAt: z.iso.datetime({ offset: true }),
})
const abnormalSchema = readingReference.extend({ alerts: z.array(alertSchema) })
const missingSchema = z.object({
  meterId: z.uuid(),
  propertyId: z.uuid(),
  billingPeriodId: z.uuid(),
  unit: z.string(),
  serialNumber: z.string(),
})
const summarySchema = z.object({
  billingPeriodId: z.uuid(),
  readingCount: z.number(),
  pendingReadingCount: z.number(),
  abnormalReadingCount: z.number(),
  mismatchCount: z.number(),
  residentTotal: decimal.nullable(),
  companyTotal: decimal.nullable(),
  mismatchPercentage: decimal.nullable(),
  uncalculableReadingCount: z.number().default(0),
  totalsByUnit: z
    .array(
      z.object({
        unit: z.string(),
        resident: decimal.nullable(),
        company: decimal.nullable(),
      }),
    )
    .nullish(),
  totalsBySource: z
    .array(
      z.object({
        source: z.string(),
        unit: z.string(),
        consumption: decimal.nullable(),
        uncalculableReadingCount: z.number(),
      }),
    )
    .nullish(),
})
const reconciliationSchema = z.object({
  condominiumId: z.uuid(),
  billingPeriodId: z.uuid(),
  mainConsumption: decimal.nullable(),
  subMeterConsumption: decimal,
  difference: decimal.nullable(),
  differencePercentage: decimal.nullable(),
  explanation: z.string(),
  source: z.string(),
  unit: z.string().nullable(),
  isComplete: z.boolean(),
  suspects: z.array(
    z.object({
      propertyId: z.uuid(),
      propertyName: z.string(),
      consumption: decimal.nullable(),
      reasons: z.array(z.string()),
    }),
  ),
})
function filters(period?: string, property?: string) {
  const params = new URLSearchParams()
  if (period) params.set('billingPeriodId', period)
  if (property) params.set('propertyId', property)
  return params.toString()
}
export async function getPendingReadings(
  period?: string,
  property?: string,
  signal?: AbortSignal,
) {
  return z
    .array(pendingSchema)
    .parse(
      await apiRequest(
        `/api/reports/pending-readings?${filters(period, property)}`,
        { signal },
      ),
    )
}
export async function getMissingReadings(
  period: string,
  property?: string,
  signal?: AbortSignal,
) {
  return z
    .array(missingSchema)
    .parse(
      await apiRequest(
        `/api/reports/missing-readings/${period}?${filters(undefined, property)}`,
        { signal },
      ),
    )
}
export async function getAbnormalReadings(
  period?: string,
  signal?: AbortSignal,
) {
  return z.array(abnormalSchema).parse(
    await apiRequest(`/api/reports/abnormal-readings?${filters(period)}`, {
      signal,
    }),
  )
}
export async function getMonthlySummary(period: string, signal?: AbortSignal) {
  return summarySchema.parse(
    await apiRequest(`/api/reports/monthly-summary/${period}`, { signal }),
  )
}
export async function getReconciliation(
  condominium: string,
  period: string,
  source: ReadingSource,
  signal?: AbortSignal,
) {
  return reconciliationSchema.parse(
    await apiRequest(
      `/api/reports/condominiums/${condominium}/reconciliation/${period}?source=${source}`,
      { signal },
    ),
  )
}
export type MonthlySummary = z.infer<typeof summarySchema>
