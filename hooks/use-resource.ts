'use client'

import useSWR from 'swr'
import { useCallback } from 'react'
import type { Entity } from '@/types'
import type { Repository } from '@/services/repositories'
import { useAppStore } from '@/stores/app-store'
import { useSession } from '@/services/api/session'
import { toast } from 'sonner'
import { errorMessage, isVersionConflict, markReported } from '@/services/api/client'

/**
 * Show the server's reason for a failed write (403, version conflict, validation…) and rethrow,
 * so the caller's success toast and dialog-close never run on failure.
 */
async function reported<R>(run: () => Promise<R>, reload?: () => unknown): Promise<R> {
  try {
    return await run()
  } catch (err) {
    toast.error(errorMessage(err))
    markReported(err)
    // Someone else changed the record: reload the server copy rather than overwrite it.
    if (isVersionConflict(err)) void reload?.()
    throw err
  }
}

/**
 * SWR-backed CRUD hook over any repository. Mutations update the cache optimistically.
 * The key carries the tenant and branch selection, so switching branches refetches; nothing is
 * fetched until the session has resolved the tenant.
 */
export function useResource<T extends Entity>(key: string, repo: Repository<T>) {
  const branchIds = useAppStore((s) => s.branchIds)
  const tenantId = useSession((s) => s.tenant?.id)
  const swrKey = tenantId ? `resource:${key}:${tenantId}:${branchIds.join(',')}` : null
  const { data, error, isLoading, mutate } = useSWR<T[]>(swrKey, () => repo.list(), {
    revalidateOnFocus: false,
  })

  const create = useCallback(
    async (input: Omit<T, 'id'> & { id?: string }) => {
      const created = await reported(() => repo.create(input))
      await mutate((prev) => [created, ...(prev ?? [])], { revalidate: false })
      return created
    },
    [repo, mutate],
  )

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      const next = await reported(() => repo.update(id, patch), () => mutate())
      await mutate((prev) => (prev ?? []).map((i) => (i.id === id ? next : i)), { revalidate: false })
      return next
    },
    [repo, mutate],
  )

  const remove = useCallback(
    async (id: string) => {
      await reported(() => repo.remove(id), () => mutate())
      await mutate((prev) => (prev ?? []).filter((i) => i.id !== id), { revalidate: false })
    },
    [repo, mutate],
  )

  const removeMany = useCallback(
    async (ids: string[]) => {
      await reported(() => Promise.all(ids.map((id) => repo.remove(id))), () => mutate())
      await mutate((prev) => (prev ?? []).filter((i) => !ids.includes(i.id)), { revalidate: false })
    },
    [repo, mutate],
  )

  const replaceAll = useCallback(
    async (items: T[]) => {
      await reported(() => repo.replaceAll(items))
      await mutate(items, { revalidate: false })
    },
    [repo, mutate],
  )

  return { data, error, isLoading, create, update, remove, removeMany, replaceAll, mutate }
}
