import { z } from 'zod'
import { stringify } from 'lossless-json'
import { apiRequest } from '../../shared/api/client'
import { exactDecimalSchema, losslessDecimal } from '../../shared/lib/decimal'
import type { ExactDecimal } from '../../shared/lib/decimal'

export const readingSources = ['Manual', 'Resident', 'Company', 'OCR'] as const
export type ReadingSource = (typeof readingSources)[number]
export const readingStatuses = [
  'Pending',
  'Confirmed',
  'Rejected',
  'Voided',
] as const
export type ReadingReviewStatus = (typeof readingStatuses)[number]

export const alertSchema = z.object({
  type: z.union([z.string(), z.number()]),
  severity: z.union([z.string(), z.number()]),
  message: z.string(),
  meterId: z.uuid().nullish(),
  propertyId: z.uuid().nullish(),
  readingId: z.uuid().nullish(),
})
export const readingSchema = z.object({
  id: z.uuid(),
  meterId: z.uuid(),
  propertyId: z.uuid().nullable(),
  billingPeriodId: z.uuid().nullable(),
  previousReadingId: z.uuid().nullable(),
  value: exactDecimalSchema,
  unit: z.string(),
  measuredAt: z.iso.datetime({ offset: true }),
  source: z.enum(readingSources),
  status: z.string(),
  evidenceIds: z.array(z.uuid()),
  alerts: z.array(alertSchema),
  reviewStatus: z.enum(readingStatuses),
  version: z.number().int().min(1),
})
export type Reading = z.infer<typeof readingSchema> & { value: ExactDecimal }
const historySchema = z.object({
  id: z.uuid(),
  readingId: z.uuid(),
  changedAt: z.iso.datetime({ offset: true }),
  action: z.string(),
  reason: z.string(),
  beforeJson: z.string().nullable(),
  afterJson: z.string(),
})
export type ReadingRevision = z.infer<typeof historySchema>
export interface Page<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalCount: number
  hasNextPage: boolean
}
const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    pageNumber: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalCount: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
  })

async function list(path: string, signal?: AbortSignal) {
  return z
    .array(readingSchema)
    .parse(await apiRequest(path, { signal })) as Reading[]
}
export const listReadingsByMeter = (id: string, signal?: AbortSignal) =>
  list(`/api/readings/meter/${id}`, signal)
export const listReadingsByProperty = (id: string, signal?: AbortSignal) =>
  list(`/api/readings/property/${id}`, signal)
export const listReadingsByPeriod = (id: string, signal?: AbortSignal) =>
  list(`/api/readings/billing-period/${id}`, signal)
export async function getReading(id: string, signal?: AbortSignal) {
  return readingSchema.parse(
    await apiRequest(`/api/readings/${id}`, { signal }),
  ) as Reading
}
export async function getReadingHistory(
  id: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Page<ReadingRevision>> {
  return pageSchema(historySchema).parse(
    await apiRequest(
      `/api/readings/${id}/history?page=${page}&pageSize=${pageSize}`,
      { signal },
    ),
  )
}

export interface CreateReadingInput {
  meterId: string
  propertyId?: string | null
  billingPeriodId?: string | null
  previousReadingId?: string | null
  value: string
  unit: string
  measuredAt: string
  source: ReadingSource
  requestId: string
}
export async function createReading(input: CreateReadingInput) {
  const body = stringify({
    ...input,
    value: losslessDecimal(input.value),
    propertyId: input.propertyId ?? null,
    billingPeriodId: input.billingPeriodId ?? null,
    previousReadingId: input.previousReadingId ?? null,
  })
  const result = z
    .object({ id: z.uuid(), value: exactDecimalSchema, status: z.string() })
    .parse(await apiRequest('/api/readings', { method: 'POST', body }))
  return getReading(result.id)
}
export async function updateReading(
  id: string,
  input: {
    value: string
    measuredAt: string
    expectedVersion: number
    reason: string
    billingPeriodId: string | null
  },
) {
  const body = stringify({ ...input, value: losslessDecimal(input.value) })
  return readingSchema.parse(
    await apiRequest(`/api/readings/${id}`, { method: 'PUT', body }),
  ) as Reading
}
export async function reviewReading(
  id: string,
  input: {
    decision: 'Confirmed' | 'Rejected'
    expectedVersion: number
    reason: string
  },
) {
  return readingSchema.parse(
    await apiRequest(`/api/readings/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  ) as Reading
}
export async function voidReading(
  id: string,
  input: { expectedVersion: number; reason: string },
) {
  return readingSchema.parse(
    await apiRequest(`/api/readings/${id}/void`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  ) as Reading
}

export function decimalToMinorUnits(value: ExactDecimal): bigint {
  const [whole, fraction = ''] = value.toString().split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
export function formatMinorUnits(value: bigint): string {
  const absolute = value < 0n ? -value : value
  return `${value < 0n ? '-' : ''}${absolute / 100n},${String(absolute % 100n).padStart(2, '0')}`
}
