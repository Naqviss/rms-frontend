import type { Entity } from '@/types'

/** Contract every data source implements; live adapters are built with services/api/adapter.ts. */
export interface Repository<T extends Entity> {
  list(): Promise<T[]>
  get(id: string): Promise<T | undefined>
  create(input: Omit<T, 'id'> & { id?: string }): Promise<T>
  update(id: string, patch: Partial<T>): Promise<T>
  remove(id: string): Promise<void>
  replaceAll(items: T[]): Promise<void>
  reset(): Promise<void>
}
