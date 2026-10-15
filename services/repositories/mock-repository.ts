import { config } from '@/lib/config'
import type { Entity } from '@/types'

/**
 * Contract every data source implements. The mock repository below can be swapped for
 * `createHttpRepository` (see services/api/http-repository.ts) without touching any UI code.
 */
export interface Repository<T extends Entity> {
  list(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  create(input: Omit<T, 'id'> & { id?: string }): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  remove(id: string): Promise<void>
  replaceAll(items: T[]): Promise<void>
  reset(): Promise<void>
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

let counter = 0
function newId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`
}

export function createMockRepository<T extends Entity>(key: string, seed: T[], idPrefix = key, version = ''): Repository<T> {
  let cache: T[] | null = null
  const storageKey = `${config.storagePrefix}data:${key}${version}`

  function load(): T[] {
    if (cache) return cache
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey)
        if (raw) {
          cache = JSON.parse(raw) as T[]
          return cache
        }
      } catch {
        // corrupted storage falls back to the seed
      }
    }
    cache = structuredClone(seed)
    return cache
  }

  function persist() {
    if (typeof window === 'undefined' || !cache) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cache))
    } catch {
      // storage full or unavailable; keep in-memory state
    }
  }

  return {
    async list() {
      await wait(config.mockLatencyMs)
      return [...load()]
    },
    async get(id) {
      await wait(config.mockLatencyMs / 2)
      return load().find((i) => i.id === id)
    },
    async create(input) {
      await wait(config.mockLatencyMs)
      const item = { ...input, id: input.id ?? newId(idPrefix) } as T
      cache = [item, ...load()]
      persist()
      return item
    },
    async update(id, patch) {
      await wait(config.mockLatencyMs)
      const current = load()
      const idx = current.findIndex((i) => i.id === id)
      if (idx === -1) throw new Error(`${key}: record ${id} not found`)
      const next = { ...current[idx], ...patch, id } as T
      cache = current.map((i, n) => (n === idx ? next : i))
      persist()
      return next
    },
    async remove(id) {
      await wait(config.mockLatencyMs)
      cache = load().filter((i) => i.id !== id)
      persist()
    },
    async replaceAll(items) {
      cache = items
      persist()
    },
    async reset() {
      cache = structuredClone(seed)
      if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey)
    },
  }
}
