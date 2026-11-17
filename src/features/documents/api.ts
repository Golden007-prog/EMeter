import { z } from 'zod'
import { apiRequest, apiRequestWithMetadata } from '../../shared/api/client'
import type { ApiResponse } from '../../shared/api/client'
import { stringify } from 'lossless-json'
import { losslessDecimal } from '../../shared/lib/decimal'
import { extractedBillSchema } from './extractionContracts'
export type { ExtractedBill } from './extractionContracts'

export const extractionStatuses = [
  'Queued',
  'Processing',
  'NeedsReview',
  'Failed',
  'Confirmed',
] as const
export type ExtractionStatusValue = (typeof extractionStatuses)[number]
export const extractionSchema = z.object({
  id: z.uuid(),
  evidenceId: z.uuid(),
  status: z.enum(extractionStatuses),
  attempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
  result: extractedBillSchema.nullable(),
  confirmedReadingId: z.uuid().nullable(),
})
export type Extraction = z.infer<typeof extractionSchema>
const extractionListItemSchema = z.object({
  id: z.uuid(),
  evidenceId: z.uuid(),
  fileName: z.string(),
  status: z.enum(extractionStatuses),
  attempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
  confirmedReadingId: z.uuid().nullable(),
  availableAt: z.iso.datetime({ offset: true }),
})
export type ExtractionListItem = z.infer<typeof extractionListItemSchema>
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
const evidenceSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  storageKey: z.string(),
  contentType: z.string(),
  hash: z.string(),
  metadata: z.record(z.string(), z.string()),
})
export type Evidence = z.infer<typeof evidenceSchema>
const uploadResponseSchema = z.object({
  id: z.uuid(),
  extractionId: z.uuid(),
  status: z.string(),
  fileName: z.string(),
  storageKey: z.string(),
  hash: z.string(),
})
export type UploadResponse = z.infer<typeof uploadResponseSchema>

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') query.set(key, String(value))
  return query.toString()
}
export async function listExtractions(
  filters: { page: number; pageSize: number; status?: ExtractionStatusValue },
  signal?: AbortSignal,
): Promise<Page<ExtractionListItem>> {
  return pageSchema(extractionListItemSchema).parse(
    await apiRequest(`/api/extractions?${queryString(filters)}`, { signal }),
  )
}
export async function getExtraction(id: string, signal?: AbortSignal) {
  return extractionSchema.parse(
    await apiRequest(`/api/extractions/${id}`, { signal }),
  )
}
export async function retryExtraction(id: string) {
  return extractionSchema.parse(
    await apiRequest(`/api/extractions/${id}/retry`, { method: 'POST' }),
  )
}
export async function confirmExtraction(
  id: string,
  body: {
    meterId: string
    value: string
    unit: string
    measuredAt: string
    propertyId: string | null
    billingPeriodId: string | null
    source: 'Company' | 'Resident' | 'OCR'
  },
) {
  return z.object({ readingId: z.uuid() }).parse(
    await apiRequest(`/api/extractions/${id}/confirm`, {
      method: 'POST',
      body: stringify({ ...body, value: losslessDecimal(body.value) }),
    }),
  )
}
export async function uploadEvidence(
  file: File,
): Promise<ApiResponse<UploadResponse>> {
  const form = new FormData()
  form.append('file', file, file.name)
  const response = await apiRequestWithMetadata<unknown>(
    '/api/evidence/upload',
    {
      method: 'POST',
      body: form,
    },
  )
  return { ...response, data: uploadResponseSchema.parse(response.data) }
}
export async function listEvidenceForReading(
  readingId: string,
  signal?: AbortSignal,
): Promise<Evidence[]> {
  return z
    .array(evidenceSchema)
    .parse(await apiRequest(`/api/evidence/reading/${readingId}`, { signal }))
}
export async function attachEvidence(readingId: string, evidenceId: string) {
  return z
    .object({ readingId: z.uuid(), evidenceId: z.uuid(), message: z.string() })
    .parse(
      await apiRequest('/api/evidence/attach', {
        method: 'POST',
        body: JSON.stringify({ readingId, evidenceId }),
      }),
    )
}
export async function downloadEvidence(id: string) {
  const response = await apiRequestWithMetadata<Blob>(
    `/api/evidence/${id}/download`,
    {
      responseType: 'blob',
    },
  )
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1]
  const quoted = /filename="?([^";]+)"?/i.exec(disposition)?.[1]
  return {
    blob: response.data,
    fileName: encoded ? decodeURIComponent(encoded) : (quoted ?? 'evidencia'),
    contentType: response.headers.get('Content-Type') ?? response.data.type,
  }
}
