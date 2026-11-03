'use client'

/**
 * Reservations over the RMS API. SWR keys carry the tenant (useSession) and the top-bar branch
 * selection (useAppStore) like hooks/use-resource.ts, so switching either refetches.
 *
 * Writes never retry on their own: each helper sends once, revalidates the affected lists on
 * success, and on a 409 (stale version, status moved on, table/capacity conflict) revalidates
 * too before rethrowing, so the caller can show the reason while keeping what the user typed.
 */
import useSWR, { useSWRConfig } from 'swr'
import { useCallback, useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useSession } from '@/services/api/session'
import {
  createReservation,
  dayBounds,
  getReservation,
  getReservationSettings,
  isConflict,
  listBranchProfiles,
  listDiningAreas,
  listDiningTables,
  listReservationsAcross,
  resolveZone,
  saveReservationSettings,
  searchCustomers,
  transitionReservation,
  updateReservation,
  type Reservation,
  type ReservationPatch,
  type ReservationSettings,
  type ReservationStatus,
  type TransitionInput,
  type Zone,
} from '@/services/api/modules/reservations'
import type {
  CreateReservationDto,
  CustomerResponseDto,
  DiningAreaResponseDto,
  DiningTableResponseDto,
  SaveReservationSettingsDto,
} from '@/services/api/generated/schemas'

const PREFIX = 'rsv'
/** Errors are shown inline by the page; skip the global toast. */
const quiet = { revalidateOnFocus: false, onError: () => undefined }

function useKey(name: string, ...parts: (string | number | null | undefined)[]) {
  const branchIds = useAppStore((s) => s.branchIds)
  const tenantId = useSession((s) => s.tenant?.id)
  if (!tenantId || parts.some((p) => p === null || p === undefined)) return null
  return `${PREFIX}:${name}:${tenantId}:${branchIds.join(',')}:${parts.join(':')}`
}

/** Revalidate every cached key of one kind (`list`, `detail`, `settings`…). */
function useRevalidate() {
  const { mutate } = useSWRConfig()
  return useCallback(
    (...names: string[]) =>
      mutate((key) => typeof key === 'string' && names.some((n) => key.startsWith(`${PREFIX}:${n}:`)), undefined, { revalidate: true }),
    [mutate],
  )
}

/* ------------------------------------------------------------ time zones */

/**
 * Time zone of each branch: the branch's own, else the tenant default, else the browser's.
 * Branch profiles are fetched once per tenant; while they load (or if they fail) the tenant
 * default applies.
 */
export function useBranchZones() {
  const tenantId = useSession((s) => s.tenant?.id)
  const tenantTz = useSession((s) => s.tenant?.default_timezone)
  const { data, isLoading } = useSWR(tenantId ? `${PREFIX}:branches:${tenantId}` : null, listBranchProfiles, quiet)
  const zoneFor = useCallback(
    (branchId: string): Zone => resolveZone(data?.find((b) => b.id === branchId)?.timezone, tenantTz),
    [data, tenantTz],
  )
  return { zoneFor, isLoading: !!tenantId && isLoading }
}

/* ----------------------------------------------------------------- lists */

/**
 * Reservations starting on `date` (a calendar day in each branch's own time zone) for every
 * branch in scope. Status is filtered client-side so the tabs can show counts.
 */
export function useReservations(date: string, zoneFor: (branchId: string) => Zone, zonesReady: boolean) {
  const key = useKey('list', zonesReady ? date : null)
  const { data, error, isLoading, isValidating, mutate } = useSWR<Reservation[]>(
    key,
    () => listReservationsAcross((branchId) => dayBounds(date, zoneFor(branchId).tz)),
    { ...quiet, keepPreviousData: true },
  )
  const sorted = useMemo(() => data?.slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [data])
  return { data: sorted, error, isLoading: isLoading || !zonesReady, isValidating, mutate }
}

export function useReservation(id: string | null | undefined, branchId?: string) {
  const key = useKey('detail', id)
  return useSWR<Reservation>(key, () => getReservation(id!, branchId), quiet)
}

export function useReservationSettings(branchId: string | null | undefined) {
  const key = useKey('settings', branchId)
  return useSWR<ReservationSettings>(key, () => getReservationSettings(branchId!), quiet)
}

export function useDiningTables(branchId: string | null | undefined) {
  const key = useKey('tables', branchId)
  return useSWR<DiningTableResponseDto[]>(key, () => listDiningTables(branchId!), { revalidateOnFocus: false })
}

export function useDiningAreas(branchId: string | null | undefined) {
  const key = useKey('areas', branchId)
  return useSWR<DiningAreaResponseDto[]>(key, () => listDiningAreas(branchId!), { revalidateOnFocus: false })
}

/** Customer directory search for the booking form (two characters minimum). */
export function useCustomerSearch(q: string) {
  const term = q.trim()
  const key = useKey('customers', term.length >= 2 ? term : null)
  return useSWR<CustomerResponseDto[]>(key, () => searchCustomers(term), { ...quiet, keepPreviousData: true, dedupingInterval: 1000 })
}

/* ------------------------------------------------------------- mutations */

export function useReservationActions() {
  const revalidate = useRevalidate()

  /** Send once; revalidate on success or on a conflict, then rethrow failures for the caller. */
  const run = useCallback(
    async <R>(send: () => Promise<R>, names: string[]): Promise<R> => {
      try {
        const out = await send()
        void revalidate(...names)
        return out
      } catch (err) {
        if (isConflict(err)) await revalidate(...names)
        throw err
      }
    },
    [revalidate],
  )

  const create = useCallback((body: CreateReservationDto) => run(() => createReservation(body), ['list']), [run])

  const update = useCallback(
    (current: Reservation, patch: ReservationPatch) => run(() => updateReservation(current, patch), ['list', 'detail']),
    [run],
  )

  const transition = useCallback(
    (current: Reservation, to: ReservationStatus, input?: TransitionInput) =>
      run(() => transitionReservation(current, to, input), ['list', 'detail', 'tables']),
    [run],
  )

  const saveSettings = useCallback(
    (branchId: string, body: SaveReservationSettingsDto) => run(() => saveReservationSettings(branchId, body), ['settings']),
    [run],
  )

  return { create, update, transition, saveSettings, revalidate }
}
