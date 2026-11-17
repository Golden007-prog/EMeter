import { z } from 'zod'
import { apiRequest } from '../../shared/api/client'

export const resourceTypes = ['water', 'electricity', 'gas'] as const
export type ResourceType = (typeof resourceTypes)[number]
export const resourceLabels: Record<ResourceType, string> = {
  water: 'Agua',
  electricity: 'Electricidad',
  gas: 'Gas',
}

const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  contactEmail: z.string().nullable(),
})
const condominiumSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  organizationId: z.uuid().nullable(),
  mainMeterId: z.uuid().nullable(),
})
const propertySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  resourceType: z.enum(resourceTypes),
  organizationId: z.uuid().nullable(),
  condominiumId: z.uuid().nullable(),
})
const meterSchema = z.object({
  id: z.uuid(),
  propertyId: z.uuid(),
  serialNumber: z.string(),
  resourceType: z.enum(resourceTypes),
  unit: z.string(),
  model: z.string(),
  installedAt: z.iso.datetime({ offset: true }),
})
export const periodStatuses = [
  'Open',
  'Collecting',
  'Validating',
  'Closed',
] as const
const billingPeriodSchema = z.object({
  id: z.uuid(),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  status: z.enum(periodStatuses),
})
export type Organization = z.infer<typeof organizationSchema>
export type Condominium = z.infer<typeof condominiumSchema>
export type Property = z.infer<typeof propertySchema>
export type Meter = z.infer<typeof meterSchema>
export type BillingPeriod = z.infer<typeof billingPeriodSchema>
export type BillingPeriodStatus = (typeof periodStatuses)[number]
export type CatalogOption = Organization | Condominium
export type CatalogKind = 'organizations' | 'condominiums'

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
function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') query.set(key, String(value))
  return query.toString()
}
export interface PropertyFilters {
  page: number
  pageSize: number
  search?: string
  organizationId?: string
  condominiumId?: string
}
export interface CatalogFilters {
  page: number
  pageSize: number
  search?: string
  organizationId?: string
  propertyId?: string
  resourceType?: ResourceType
  status?: BillingPeriodStatus
}
async function listCatalog<T>(
  kind: string,
  schema: z.ZodType<T>,
  filters: CatalogFilters,
  signal?: AbortSignal,
): Promise<Page<T>> {
  return pageSchema(schema).parse(
    await apiRequest(`/api/${kind}?${queryString({ ...filters })}`, {
      signal,
    }),
  )
}
export const listOrganizations = (
  filters: CatalogFilters,
  signal?: AbortSignal,
) => listCatalog('organizations', organizationSchema, filters, signal)
export const listCondominiums = (
  filters: CatalogFilters,
  signal?: AbortSignal,
) => listCatalog('condominiums', condominiumSchema, filters, signal)
export const listMeters = (filters: CatalogFilters, signal?: AbortSignal) =>
  listCatalog('meters', meterSchema, filters, signal)
export const listBillingPeriods = (
  filters: CatalogFilters,
  signal?: AbortSignal,
) => listCatalog('billing-periods', billingPeriodSchema, filters, signal)

async function getCatalogItem<T>(
  kind: string,
  id: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
) {
  return schema.parse(await apiRequest(`/api/${kind}/${id}`, { signal }))
}
export const getProperty = (id: string, signal?: AbortSignal) =>
  getCatalogItem('properties', id, propertySchema, signal)
export const getMeter = (id: string, signal?: AbortSignal) =>
  getCatalogItem('meters', id, meterSchema, signal)
export const getBillingPeriod = (id: string, signal?: AbortSignal) =>
  getCatalogItem('billing-periods', id, billingPeriodSchema, signal)

export async function listMetersForCondominium(
  condominiumId: string,
  signal?: AbortSignal,
) {
  const properties: Property[] = []
  let propertyPage = 1
  let hasMoreProperties = true
  while (hasMoreProperties) {
    const page = await listProperties(
      { page: propertyPage, pageSize: 200, condominiumId },
      signal,
    )
    properties.push(...page.items)
    hasMoreProperties = page.hasNextPage
    propertyPage++
  }
  const candidates: { meter: Meter; propertyName: string }[] = []
  for (const property of properties) {
    let meterPage = 1
    let hasMoreMeters = true
    while (hasMoreMeters) {
      const page = await listMeters(
        { page: meterPage, pageSize: 200, propertyId: property.id },
        signal,
      )
      candidates.push(
        ...page.items.map((meter) => ({ meter, propertyName: property.name })),
      )
      hasMoreMeters = page.hasNextPage
      meterPage++
    }
  }
  return candidates
}

async function saveCatalogItem<T>(
  path: string,
  schema: z.ZodType<T>,
  method: 'POST' | 'PUT',
  body: object,
) {
  return schema.parse(
    await apiRequest(path, { method, body: JSON.stringify(body) }),
  )
}
export const createOrganization = (body: {
  name: string
  contactEmail: string | null
}) => saveCatalogItem('/api/organizations', organizationSchema, 'POST', body)
export const updateOrganization = (
  id: string,
  body: { name: string; contactEmail: string | null },
) =>
  saveCatalogItem(`/api/organizations/${id}`, organizationSchema, 'PUT', body)
export const createCondominium = (body: {
  name: string
  address: string
  organizationId: string | null
}) => saveCatalogItem('/api/condominiums', condominiumSchema, 'POST', body)
export const updateCondominium = (
  id: string,
  body: { name: string; address: string },
) => saveCatalogItem(`/api/condominiums/${id}`, condominiumSchema, 'PUT', body)
export const updateProperty = (
  id: string,
  body: { name: string; address: string },
) => saveCatalogItem(`/api/properties/${id}`, propertySchema, 'PUT', body)
export const createMeter = (body: {
  propertyId: string
  serialNumber: string
  resourceType: ResourceType
  unit: string
  model: string
}) => saveCatalogItem('/api/meters', meterSchema, 'POST', body)
export const updateMeter = (
  id: string,
  body: { serialNumber: string; model: string },
) => saveCatalogItem(`/api/meters/${id}`, meterSchema, 'PUT', body)
export async function setCondominiumMainMeter(
  condominiumId: string,
  meterId: string,
) {
  await apiRequest<null>(
    `/api/condominiums/${condominiumId}/main-meter/${meterId}`,
    { method: 'PUT' },
  )
}
export const createBillingPeriod = (body: { start: string; end: string }) =>
  saveCatalogItem('/api/billing-periods', billingPeriodSchema, 'POST', body)
export const updateBillingPeriod = (
  id: string,
  body: { start: string; end: string },
) =>
  saveCatalogItem(
    `/api/billing-periods/${id}`,
    billingPeriodSchema,
    'PUT',
    body,
  )
export async function setBillingPeriodStatus(
  id: string,
  status: BillingPeriodStatus,
) {
  await apiRequest<null>(`/api/billing-periods/${id}/status/${status}`, {
    method: 'PUT',
  })
}

export async function listProperties(
  filters: PropertyFilters,
  signal?: AbortSignal,
): Promise<Page<Property>> {
  return pageSchema(propertySchema).parse(
    await apiRequest(`/api/properties?${queryString({ ...filters })}`, {
      signal,
    }),
  )
}
export async function listOptions(
  kind: CatalogKind,
  page: number,
  search: string,
  organizationId?: string,
  signal?: AbortSignal,
): Promise<Page<CatalogOption>> {
  const data = await apiRequest(
    `/api/${kind}?${queryString({ page, pageSize: 50, search, organizationId: kind === 'condominiums' ? organizationId : undefined })}`,
    { signal },
  )
  return kind === 'organizations'
    ? pageSchema(organizationSchema).parse(data)
    : pageSchema(condominiumSchema).parse(data)
}
export async function getOption(
  kind: CatalogKind,
  id: string,
  signal?: AbortSignal,
): Promise<CatalogOption> {
  const data = await apiRequest(`/api/${kind}/${id}`, { signal })
  return kind === 'organizations'
    ? organizationSchema.parse(data)
    : condominiumSchema.parse(data)
}
export const createPropertySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de la propiedad.')
    .max(200, 'Usa hasta 200 caracteres.'),
  address: z
    .string()
    .trim()
    .min(1, 'Escribe la dirección.')
    .max(500, 'Usa hasta 500 caracteres.'),
  resourceType: z.enum(resourceTypes, {
    error: 'Selecciona un recurso válido.',
  }),
  organizationId: z.union([z.uuid(), z.literal('')]),
  condominiumId: z.union([z.uuid(), z.literal('')]),
})
export type CreatePropertyForm = z.infer<typeof createPropertySchema>
export async function createProperty(
  form: CreatePropertyForm,
): Promise<Property> {
  return propertySchema.parse(
    await apiRequest('/api/properties', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        organizationId: form.organizationId || null,
        condominiumId: form.condominiumId || null,
      }),
    }),
  )
}
