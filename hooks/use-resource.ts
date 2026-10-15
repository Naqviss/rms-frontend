'use client'

import useSWR from 'swr'
import { useCallback } from 'react'
import type { Entity } from '@/types'
import type { Repository } from '@/services/repositories'

/** SWR-backed CRUD hook over any repository. Mutations update the cache optimistically. */
export function useResource<T extends Entity>(key: string, repo: Repository<T>) {
  const { data, error, isLoading, mutate } = useSWR<T[]>(`resource:${key}`, () => repo.list(), {
    revalidateOnFocus: false,
  })

  const create = useCallback(
    async (input: Omit<T, 'id'> & { id?: string }) => {
      const created = await repo.create(input)
      await mutate((prev) => [created, ...(prev ?? [])], { revalidate: false })
      return created
    },
    [repo, mutate],
  )

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      const next = await repo.update(id, patch)
      await mutate((prev) => (prev ?? []).map((i) => (i.id === id ? next : i)), { revalidate: false })
      return next
    },
    [repo, mutate],
  )

  const remove = useCallback(
    async (id: string) => {
      await repo.remove(id)
      await mutate((prev) => (prev ?? []).filter((i) => i.id !== id), { revalidate: false })
    },
    [repo, mutate],
  )

  const removeMany = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map((id) => repo.remove(id)))
      await mutate((prev) => (prev ?? []).filter((i) => !ids.includes(i.id)), { revalidate: false })
    },
    [repo, mutate],
  )

  const replaceAll = useCallback(
    async (items: T[]) => {
      await repo.replaceAll(items)
      await mutate(items, { revalidate: false })
    },
    [repo, mutate],
  )

  return { data, error, isLoading, create, update, remove, removeMany, replaceAll, mutate }
}
