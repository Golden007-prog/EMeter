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

export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
).replace(/\/+$/, '')

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(0, {
      title: 'No se pudo conectar con el backend.',
      detail:
        'Comprueba que la API esté iniciada y que VITE_API_BASE_URL y CORS estén configurados correctamente.',
    })
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const problem =
      body && typeof body === 'object' ? (body as ProblemDetails) : {}
    throw new ApiError(response.status, { ...problem, status: response.status })
  }
  return body as T
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Ocurrió un error al procesar la solicitud.'
}
