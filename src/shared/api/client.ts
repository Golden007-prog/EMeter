import { isSafeNumber, LosslessNumber, parse } from 'lossless-json'

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  traceId?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `La solicitud falló (${status}).`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

export interface ApiResponse<T> {
  data: T
  status: number
  location: string | null
  headers: Headers
}

export interface ApiRequestOptions extends RequestInit {
  responseType?: 'json' | 'blob' | 'text'
}

export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
).replace(/\/+$/, '')

export async function apiRequestWithMetadata<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const { responseType = 'json', ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  if (!headers.has('Accept'))
    headers.set('Accept', 'application/json, application/problem+json')
  if (typeof requestOptions.body === 'string' && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...requestOptions,
      headers,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(0, {
      title: 'No se pudo conectar con el backend.',
      detail:
        'Comprueba que la API esté iniciada y que VITE_API_BASE_URL y CORS estén configurados correctamente.',
    })
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const problem =
      body && typeof body === 'object' ? (body as ProblemDetails) : {}
    throw new ApiError(response.status, { ...problem, status: response.status })
  }

  let data: unknown
  if (response.status === 204) data = null
  else if (responseType === 'blob') data = await response.blob()
  else if (responseType === 'text') data = await response.text()
  else {
    const body = await response.text()
    try {
      data =
        body.length > 0
          ? parse(body, null, {
              parseNumber: (value) =>
                isSafeNumber(value) ? Number(value) : new LosslessNumber(value),
            })
          : null
    } catch {
      throw new ApiError(response.status, {
        title: 'La respuesta del backend no es JSON válido.',
        status: response.status,
      })
    }
  }

  return {
    data: data as T,
    status: response.status,
    location: response.headers.get('Location'),
    headers: response.headers,
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return (await apiRequestWithMetadata<T>(path, options)).data
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error al procesar la solicitud.'
}
