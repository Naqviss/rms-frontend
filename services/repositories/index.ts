import { config } from '@/lib/config'
import type { Entity } from '@/types'
import { createHttpRepository } from '@/services/api/http-repository'
import { createMockRepository, type Repository } from '@/services/repositories/mock-repository'

export type { Repository }

/** Single switch point: flip NEXT_PUBLIC_USE_MOCKS=false to talk to a real REST API. */
export function createRepository<T extends Entity>(resource: string, seed: T[], version = ''): Repository<T> {
  return config.useMocks ? createMockRepository<T>(resource, seed, resource, version) : createHttpRepository<T>(resource)
}
