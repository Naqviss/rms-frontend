/**
 * Bridges backend resources onto the UI's `Repository<T>` contract so pages can stay on
 * `useResource()` while the data comes from the RMS API.
 *
 * Each adapter maps a wire DTO (snake_case, minor-unit money, `version`) to the prototype's
 * domain type and back. The last DTO seen for every id is cached so updates can send the
 * `expected_version` the backend requires for optimistic concurrency, and so mappers can fall
 * back to fields the UI type does not carry.
 */
import { apiScope } from '@/services/api/client'
import { currentBranchIds } from '@/lib/directory'
import { useAppStore } from '@/stores/app-store'
import type { Entity } from '@/types'
import type { Repository } from '@/services/repositories'

/** Raised for an operation the UI offers but the backend does not expose. */
export class UnsupportedOperationError extends Error {
  constructor(resource: string, op: string) {
    super(`${resource}: "${op}" is not available in the RMS API`)
    this.name = 'UnsupportedOperationError'
  }
}

export interface Cached<T, D> {
  dto: D
  ui: T
}

export interface ApiResourceSpec<T extends Entity, D> {
  /** Used in error messages. */
  name: string
  list: () => Promise<D[]>
  toUi: (dto: D) => T
  get?: (id: string) => Promise<D>
  create?: (input: Omit<T, 'id'> & { id?: string }) => Promise<D>
  /** `current` is the cached record (undefined if the id was never listed). */
  update?: (id: string, patch: Partial<T>, current: Cached<T, D> | undefined) => Promise<D>
  remove?: (id: string, current: Cached<T, D> | undefined) => Promise<void>
}

export interface ApiRepository<T extends Entity, D> extends Repository<T> {
  /** Last DTO seen for an id, if any. */
  cached(id: string): Cached<T, D> | undefined
}

export function apiRepository<T extends Entity, D>(spec: ApiResourceSpec<T, D>): ApiRepository<T, D> {
  const cache = new Map<string, Cached<T, D>>()
  const remember = (dto: D) => {
    const ui = spec.toUi(dto)
    cache.set(ui.id, { dto, ui })
    return ui
  }
  const unsupported = (op: string) => () => Promise.reject(new UnsupportedOperationError(spec.name, op))

  return {
    cached: (id) => cache.get(id),
    async list() {
      const rows = await spec.list()
      return rows.map(remember)
    },
    async get(id) {
      if (spec.get) return remember(await spec.get(id))
      return cache.get(id)?.ui
    },
    create: spec.create ? async (input) => remember(await spec.create!(input)) : unsupported('create'),
    update: spec.update
      ? async (id, patch) => {
          let current = cache.get(id)
          if (!current && spec.get) {
            remember(await spec.get(id))
            current = cache.get(id)
          }
          return remember(await spec.update!(id, patch, current))
        }
      : unsupported('update'),
    remove: spec.remove
      ? async (id) => {
          await spec.remove!(id, cache.get(id))
          cache.delete(id)
        }
      : unsupported('delete'),
    // Bulk replace is a mock-only convenience (local reordering); the API has no equivalent.
    replaceAll: unsupported('replace all'),
    reset: async () => cache.clear(),
  }
}

/** `version` from the cached DTO, for `expected_version` on PATCH/transition bodies. */
export function versionOf(current: Cached<unknown, { version?: number }> | undefined): number {
  return current?.dto.version ?? 0
}

/** Branches currently selected in the top bar (all accessible branches when none are picked). */
export function scopeBranchIds(): string[] {
  const picked = (useAppStore.getState().branchIds ?? []).filter((id) => currentBranchIds.includes(id))
  return picked.length ? picked : [...currentBranchIds]
}

/** Branch new records are filed under when several are in view. */
export function primaryBranchId(): string | null {
  return scopeBranchIds()[0] ?? apiScope.branchId
}

/**
 * Run a branch-scoped list (endpoints that require exactly one `X-Branch-Id`) for every branch
 * in scope and concatenate. Branches the caller may not read are skipped, not fatal.
 */
export async function acrossBranches<D>(fetchOne: (branchId: string) => Promise<D[]>): Promise<D[]> {
  const ids = scopeBranchIds()
  const settled = await Promise.allSettled(ids.map(fetchOne))
  const ok = settled.filter((s): s is PromiseFulfilledResult<D[]> => s.status === 'fulfilled')
  if (!ok.length && settled.length) throw (settled[0] as PromiseRejectedResult).reason
  return ok.flatMap((s) => s.value)
}

/** SWR key suffix: lists refetch when tenant or branch selection changes. */
export function scopeKey(): string {
  return `${apiScope.tenantId ?? ''}|${scopeBranchIds().join(',')}`
}

/**
 * Placeholder for a UI resource the backend has no API for. Lists are empty and writes fail with
 * a clear message, so live mode never shows seeded demo data as if it were real.
 */
export function unavailableRepository<T extends Entity>(name: string): Repository<T> {
  const fail = () => Promise.reject(new UnsupportedOperationError(name, 'this feature'))
  return {
    list: async () => [],
    get: async () => undefined,
    create: fail,
    update: fail,
    remove: fail,
    replaceAll: fail,
    reset: async () => undefined,
  }
}
