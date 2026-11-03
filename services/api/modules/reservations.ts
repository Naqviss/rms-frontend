/**
 * Reservations — `GET/POST /api/reservations`, `GET/PATCH /api/reservations/{id}`,
 * `POST /api/reservations/{id}/transitions`, `GET/PUT /api/reservations/settings/{branchId}`.
 * Table picker: `GET /api/dining-tables`, `GET /api/dining-areas` (both need exactly one X-Branch-Id).
 * Time zones: `GET /api/branches` (BranchResponseDto.timezone) over the tenant's `default_timezone`.
 *
 *  - Every write is version-checked: PATCH and transitions send the `version` of the record they
 *    were computed from as `expected_version`; settings send it once a first save exists.
 *  - Booking is idempotent through a client `id` (a repeat returns the same booking), so the
 *    caller keeps one id per draft and a user-initiated resubmit after a lost response is safe.
 *  - Start times are branch-local slots ("inside the service hours"), so the UI converts the
 *    picked wall-clock time in the branch time zone to UTC before sending.
 */
import { api, ApiError, errorMessage } from '@/services/api/client'
import { acrossBranches } from '@/services/api/adapter'
import { compact } from '@/services/api/mappers'
import type {
  BranchResponseDto,
  CreateReservationDto,
  CustomerResponseDto,
  DiningAreaResponseDto,
  DiningTableResponseDto,
  ReservationResponseDto,
  ReservationSettingsResponseDto,
  SaveReservationSettingsDto,
  TransitionReservationDto,
  UpdateReservationDto,
} from '@/services/api/generated/schemas'

export type Reservation = ReservationResponseDto
export type ReservationStatus = ReservationResponseDto['status']
export type ReservationSource = ReservationResponseDto['source']
export type ReservationSettings = ReservationSettingsResponseDto
export type ServiceWindow = ReservationSettingsResponseDto['opening_hours'][number]

export const RESERVATION_STATUSES: ReservationStatus[] = ['requested', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show', 'rejected']
export const RESERVATION_SOURCES: ReservationSource[] = ['phone', 'walk_in', 'online', 'pos', 'other']

/* ------------------------------------------------------------ lifecycle */

/**
 * Transitions offered from each status. The contract only publishes the target enum and answers
 * `RESERVATION_INVALID_TRANSITION` for illegal moves, so this map is the UI's best reading of the
 * lifecycle; the server remains the authority.
 */
export const NEXT_STATUSES: Record<ReservationStatus, ReservationStatus[]> = {
  requested: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['seated', 'no_show', 'cancelled'],
  seated: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
  rejected: [],
}

/** `table_id` is accepted only when confirming or seating (refused with any other target). */
export const acceptsTable = (to: ReservationStatus) => to === 'confirmed' || to === 'seated'
/** `reason_code` is required for `rejected`. */
export const requiresReason = (to: ReservationStatus) => to === 'rejected'
/** PATCH only changes requested or confirmed reservations. */
export const isEditable = (r: Pick<Reservation, 'status'>) => r.status === 'requested' || r.status === 'confirmed'

/* ------------------------------------------------------------- requests */

export interface ReservationFilters {
  status?: ReservationStatus
  /** ISO date-time: starting at or after. */
  from?: string
  /** ISO date-time: starting at or before. */
  to?: string
  customer_id?: string
  table_id?: string
  /** Guest name or phone contains. */
  q?: string
}

/** Reservations of one branch, earliest first. */
export const listReservations = (branchId: string, f: ReservationFilters = {}) =>
  api.listAll<Reservation>('/reservations', {
    branchId,
    query: { branch_id: branchId, sort_order: 'asc', ...compact({ ...f }) },
  })

/**
 * Reservations of every branch in the top-bar scope. `filtersFor` runs per branch so a day range
 * can be computed in each branch's own time zone. Branches the caller cannot read are skipped.
 */
export const listReservationsAcross = (filtersFor: (branchId: string) => ReservationFilters) =>
  acrossBranches((branchId) => listReservations(branchId, filtersFor(branchId)))

export const getReservation = (id: string, branchId?: string | null) =>
  api.get<Reservation>(`/reservations/${id}`, branchId === undefined ? {} : { branchId })

/** `body.id` should be a client id kept for the life of the draft (idempotent booking). */
export const createReservation = (body: CreateReservationDto) =>
  api.post<Reservation>('/reservations', body, { branchId: body.branch_id })

export type ReservationPatch = Omit<UpdateReservationDto, 'expected_version'>

export function updateReservation(current: Pick<Reservation, 'id' | 'branch_id' | 'version'>, patch: ReservationPatch) {
  const body: UpdateReservationDto = { ...patch, expected_version: current.version }
  return api.patch<Reservation>(`/reservations/${current.id}`, body, { branchId: current.branch_id })
}

export interface TransitionInput {
  tableId?: string
  reasonCode?: string
  /** Seated only: the dine-in order opened for the party. */
  orderId?: string
}

export function transitionReservation(
  current: Pick<Reservation, 'id' | 'branch_id' | 'version'>,
  to: ReservationStatus,
  input: TransitionInput = {},
) {
  if (input.tableId && !acceptsTable(to)) throw new Error('A table can only be chosen when confirming or seating.')
  if (requiresReason(to) && !input.reasonCode?.trim()) throw new Error('A reason is required to reject a reservation.')
  const body: TransitionReservationDto = {
    to_status: to,
    expected_version: current.version,
    ...(input.tableId && acceptsTable(to) ? { table_id: input.tableId } : {}),
    ...(input.reasonCode?.trim() ? { reason_code: input.reasonCode.trim() } : {}),
    ...(input.orderId && to === 'seated' ? { order_id: input.orderId } : {}),
  }
  return api.post<Reservation>(`/reservations/${current.id}/transitions`, body, { branchId: current.branch_id })
}

export const getReservationSettings = (branchId: string) =>
  api.get<ReservationSettings>(`/reservations/settings/${branchId}`, { branchId })

export const saveReservationSettings = (branchId: string, body: SaveReservationSettingsDto) =>
  api.put<ReservationSettings>(`/reservations/settings/${branchId}`, body, { branchId })

/** Tables of one branch (X-Branch-Id required). */
export const listDiningTables = (branchId: string) => api.listAll<DiningTableResponseDto>('/dining-tables', { branchId })
/** Dining areas of one branch (X-Branch-Id required). */
export const listDiningAreas = (branchId: string) => api.listAll<DiningAreaResponseDto>('/dining-areas', { branchId })

/** Branch profiles, for their time zones. Tenant-wide. */
export const listBranchProfiles = () => api.listAll<BranchResponseDto>('/branches', { branchId: null })

/** First page of the customer directory matching a name / phone / e-mail. Tenant-wide. */
export async function searchCustomers(q: string): Promise<CustomerResponseDto[]> {
  const r = await api.page<CustomerResponseDto>('/customers', { branchId: null, query: { q: q.trim(), page_size: 10, status: 'active' } })
  return r.data
}

/* --------------------------------------------------------------- errors */

/**
 * Reservation codes the shared client has no copy for yet. Everything else goes through
 * `errorMessage()` (known codes, then the first validation message, then the server text).
 */
const RESERVATION_MESSAGES: Record<string, string> = {
  RESERVATION_SLOT_INVALID: 'Start times must fall on the branch’s booking slots.',
  RESERVATION_NOT_EDITABLE: 'Only requested or confirmed reservations can be changed.',
  RESERVATION_INVALID_TRANSITION: 'That status change is not allowed from the reservation’s current status.',
  RESERVATION_REASON_REQUIRED: 'A reason is required for this change.',
  RESERVATION_FIELD_NOT_ALLOWED: 'One of the fields is not allowed for this status change.',
  RESERVATION_TABLE_INVALID: 'That table does not belong to this branch.',
  RESERVATION_AREA_INVALID: 'That dining area does not belong to this branch.',
  RESERVATION_ORDER_INVALID: 'That order cannot be linked to this reservation.',
  RESERVATION_HOURS_INVALID: 'The opening hours are not valid. Check every window’s start and end time.',
  RESERVATION_NOT_FOUND: 'This reservation no longer exists.',
  CUSTOMER_NOT_FOUND: 'That customer could not be found.',
  CUSTOMER_INACTIVE: 'That customer is blocked.',
}

export function reservationError(err: unknown): string {
  if (err instanceof ApiError && RESERVATION_MESSAGES[err.code]) return RESERVATION_MESSAGES[err.code]
  return errorMessage(err)
}

/** Strictly an optimistic-concurrency failure (`isVersionConflict` also matches every 409). */
export const isStaleVersion = (err: unknown) => err instanceof ApiError && err.code === 'VERSION_CONFLICT'
/** Any 409: the record moved on (version, status, table or capacity); worth refetching. */
export const isConflict = (err: unknown) => err instanceof ApiError && err.status === 409

export const isPermissionError = (err: unknown) =>
  err instanceof ApiError &&
  (err.status === 403 || ['PERMISSION_DENIED', 'FORBIDDEN', 'BRANCH_ACCESS_DENIED', 'TENANT_ACCESS_DENIED'].includes(err.code)) &&
  err.code !== 'BRANCH_NOT_OPERATIONAL' &&
  err.code !== 'ENTITLEMENT_REQUIRED'

/* ------------------------------------------------------------ time zones */

export type ZoneSource = 'branch' | 'tenant' | 'local'
export interface Zone {
  tz: string
  source: ZoneSource
}

export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Branch zone, else tenant default, else the browser's. */
export function resolveZone(branchTz: string | null | undefined, tenantTz: string | null | undefined): Zone {
  if (isValidTimeZone(branchTz)) return { tz: branchTz, source: 'branch' }
  if (isValidTimeZone(tenantTz)) return { tz: tenantTz, source: 'tenant' }
  return { tz: localTimeZone(), source: 'local' }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()
function partsIn(ms: number, tz: string) {
  let f = partsFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(tz, f)
  }
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second }
}

/** Offset of `tz` from UTC at instant `ms`, in milliseconds. */
function offsetAt(ms: number, tz: string) {
  const p = partsIn(ms, tz)
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Wall-clock `YYYY-MM-DD` + `HH:mm` in `tz` → UTC ISO string. */
export function zonedToUtc(date: string, time: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  let ms = wall - offsetAt(wall, tz)
  // Second pass settles instants next to a DST change.
  const again = wall - offsetAt(ms, tz)
  if (again !== ms) ms = again
  return new Date(ms).toISOString()
}

/** UTC ISO → wall-clock `{ date: YYYY-MM-DD, time: HH:mm }` in `tz`. */
export function utcToZoned(iso: string, tz: string): { date: string; time: string } {
  const p = partsIn(new Date(iso).getTime(), tz)
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` }
}

export const todayIn = (tz: string) => utcToZoned(new Date().toISOString(), tz).date

export function addDays(date: string, n: number) {
  const [y, mo, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, mo - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** `from`/`to` query bounds covering one calendar day in `tz` (both inclusive). */
export function dayBounds(date: string, tz: string): { from: string; to: string } {
  const from = zonedToUtc(date, '00:00', tz)
  const next = zonedToUtc(addDays(date, 1), '00:00', tz)
  return { from, to: new Date(new Date(next).getTime() - 1000).toISOString() }
}

/** `HH:mm` of an instant in `tz`, e.g. for table cells. */
export function formatClock(iso: string, tz: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

export function formatDateTimeIn(iso: string, tz: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

/** Short zone name at an instant, e.g. `GMT+5` or `CET`. */
export function zoneAbbr(tz: string, at = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at)
  return p.find((x) => x.type === 'timeZoneName')?.value ?? tz
}

export const minutesBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
