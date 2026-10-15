import { config } from '@/lib/config'
import type { Entity } from '@/types'
import type { Repository } from '@/services/repositories/mock-repository'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/** REST implementation of the repository contract. Wire this in service files when the backend exists. */
export function createHttpRepository<T extends Entity>(resource: string): Repository<T> {
  return {
    list: () => request<T[]>(`/${resource}`),
    get: (id) => request<T | undefined>(`/${resource}/${id}`),
    create: (input) => request<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(input) }),
    update: (id, patch) => request<T>(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id) => request<void>(`/${resource}/${id}`, { method: 'DELETE' }),
    replaceAll: (items) => request<void>(`/${resource}`, { method: 'PUT', body: JSON.stringify(items) }),
    reset: async () => undefined,
  }
}
