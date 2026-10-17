const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError('Could not reach the API. Check that the backend is running and allows this origin.', 0)
  }

  const text = await response.text()
  let body: unknown
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = text
    }
  }

  if (!response.ok) {
    const record = typeof body === 'object' && body !== null
      ? body as Record<string, unknown>
      : null
    const message = typeof record?.error === 'string'
      ? record.error
      : typeof record?.message === 'string'
        ? record.message
        : typeof body === 'string' && body.length > 0
          ? body
          : `Request failed (${response.status}).`
    throw new ApiError(message, response.status)
  }

  return body as T
}
