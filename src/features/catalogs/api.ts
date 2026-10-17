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
export type Organization = z.infer<typeof organizationSchema>
export type Condominium = z.infer<typeof condominiumSchema>
export type Property = z.infer<typeof propertySchema>
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
