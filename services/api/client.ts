/**
 * Typed transport for the RMS backend (`/api`, NestJS on Cloudflare Workers).
 *
 * Wire conventions (from the OpenAPI document): every response is an envelope
 * `{ success, data, meta? }` or `{ success: false, error: { code, status_code, message, details?, request_id } }`;
 * keys are snake_case; timestamps ISO-8601 UTC; money in integer minor units. Tenant and branch
 * scope travel as `X-Tenant-Id` / `X-Branch-Id` headers and are re-validated by the server on
 * every call — nothing here is an authority, only a request.
 */
import { config } from '@/lib/config'
import { getAccessToken, refreshSession } from '@/services/api/auth'

export interface ApiErrorBody {
  code: string
  status_code: number
  message: string
  details?: Record<string, unknown> & {
    violations?: { field: string; constraints?: string[]; messages?: string[] }[]
  }
  timestamp?: string
  request_id?: string
}

/** Error carrying the backend's stable code (e.g. `PERMISSION_DENIED`, `VERSION_CONFLICT`). */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: ApiErrorBody['details']
  readonly requestId?: string

  constructor(body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.code = body.code
    this.status = body.status_code
    this.details = body.details
    this.requestId = body.request_id
  }

  /** First human-readable validation message, if the server sent field violations. */
  get violation(): string | undefined {
    return this.details?.violations?.[0]?.messages?.[0]
  }
}

/** The request never reached a server decision (offline, DNS, timeout). Outcome is unknown. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed — the server outcome is unknown')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

export type OffsetPagination = {
  type: 'offset'
  page: number
  page_size: number
  total_items: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}
export type CursorPagination = { type: 'cursor'; page_size: number; next_cursor: string | null; has_next: boolean }
export interface Page<T> {
  data: T[]
  pagination?: OffsetPagination | CursorPagination
}

/** Tenant/branch context sent with every request. Filled by the session bootstrap and branch picker. */
export const apiScope: { tenantId: string | null; branchId: string | null } = { tenantId: null, branchId: null }

type Query = Record<string, string | number | boolean | null | undefined | string[]>

export interface RequestOptions {
  query?: Query
  body?: unknown
  /** Override the selected branch for this call; `null` omits the header entirely. */
  branchId?: string | null
  /** Skip the bearer token (public endpoints). */
  anonymous?: boolean
  signal?: AbortSignal
  headers?: Record<string, string>
}

function buildUrl(path: string, query?: Query) {
  const base = config.apiBaseUrl.replace(/\/$/, '')
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
    else qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `${url}?${s}` : url
}

async function send(method: string, path: string, opts: RequestOptions, retried = false): Promise<{ data: unknown; meta?: { pagination?: Page<unknown>['pagination'] } }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-API-Version': config.apiVersion,
    ...(opts.headers ?? {}),
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (apiScope.tenantId) headers['X-Tenant-Id'] = apiScope.tenantId
  const branch = opts.branchId === undefined ? apiScope.branchId : opts.branchId
  if (branch) headers['X-Branch-Id'] = branch
  if (!opts.anonymous) {
    const token = await getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new NetworkError(err)
  }

  if (res.status === 204) return { data: undefined }
  const text = await res.text()
  let json: { success?: boolean; data?: unknown; meta?: never; error?: ApiErrorBody } | null = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // non-JSON body (proxy / gateway page)
  }

  if (!res.ok || json?.success === false) {
    const err = json?.error ?? {
      code: res.status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR',
      status_code: res.status,
      message: res.statusText || 'Request failed',
    }
    // One silent refresh for an expired access token, then surface the error.
    if (res.status === 401 && !retried && !opts.anonymous && (err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_INVALID')) {
      if (await refreshSession()) return send(method, path, opts, true)
    }
    if (res.status === 401) onUnauthenticated?.(err)
    throw new ApiError(err)
  }
  return { data: json?.data, meta: json?.meta }
}

/** Called when the server rejects the session outright, so the shell can send the user to /login. */
let onUnauthenticated: ((err: ApiErrorBody) => void) | null = null
export function setUnauthenticatedHandler(fn: typeof onUnauthenticated) {
  onUnauthenticated = fn
}

export const api = {
  get: async <T>(path: string, opts: RequestOptions = {}) => (await send('GET', path, opts)).data as T,
  post: async <T>(path: string, body?: unknown, opts: RequestOptions = {}) => (await send('POST', path, { ...opts, body: body ?? {} })).data as T,
  put: async <T>(path: string, body?: unknown, opts: RequestOptions = {}) => (await send('PUT', path, { ...opts, body: body ?? {} })).data as T,
  patch: async <T>(path: string, body?: unknown, opts: RequestOptions = {}) => (await send('PATCH', path, { ...opts, body: body ?? {} })).data as T,
  delete: async <T = void>(path: string, opts: RequestOptions = {}) => (await send('DELETE', path, opts)).data as T,

  /** One page of a paginated list. */
  page: async <T>(path: string, opts: RequestOptions = {}): Promise<Page<T>> => {
    const r = await send('GET', path, opts)
    return { data: (r.data as T[]) ?? [], pagination: r.meta?.pagination }
  },

  /**
   * Every row of a paginated list (offset mode, 100 per page). Capped so a runaway list cannot
   * hang the UI; screens that need more should page explicitly.
   */
  listAll: async <T>(path: string, opts: RequestOptions = {}, maxPages = 20): Promise<T[]> => {
    const rows: T[] = []
    for (let page = 1; page <= maxPages; page++) {
      const r = await api.page<T>(path, { ...opts, query: { page_size: 100, ...opts.query, page } })
      rows.push(...r.data)
      const p = r.pagination
      if (!p || !p.has_next || p.type !== 'offset') break
    }
    return rows
  },
}

/** Stable client-generated id for idempotent writes (orders, payments, receipts, stock). */
export function operationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`
}

/**
 * UI copy for the backend's stable error codes. Codes not listed fall back to the server message
 * (product to review: the Phase 2 plan asks that raw server text not ship without approval).
 */
const CODE_MESSAGES: Record<string, string> = {
  VERSION_CONFLICT: 'This record was changed elsewhere. The latest version has been reloaded — review it and try again.',
  PERMISSION_DENIED: 'You do not have permission to do that.',
  FORBIDDEN: 'You do not have permission to do that.',
  TENANT_ACCESS_DENIED: 'You do not have access to this restaurant.',
  BRANCH_ACCESS_DENIED: 'You do not have access to this branch.',
  BRANCH_NOT_OPERATIONAL: 'This branch is inactive or closed, so its records cannot be changed.',
  ENTITLEMENT_REQUIRED: 'Your subscription plan does not include this feature.',
  PLAN_LIMIT_REACHED: 'You have reached a limit of your subscription plan.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already submitted with different details. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Try again shortly.',
  TOKEN_EXPIRED: 'Your session has expired. Sign in again.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  CUSTOMER_POSSIBLE_DUPLICATE: 'A customer with these contact details may already exist.',
  FINANCE_INSUFFICIENT_CASH: 'There is not enough cash in this account for that movement.',
  FINANCE_CASH_ACCOUNT_CLOSED: 'This cash account is closed.',
  PAYROLL_STATUS_INVALID: 'That action is not allowed at this payroll run’s current stage.',
  TABLE_OCCUPIED: 'That table is already occupied.',
  RESERVATION_TABLE_CONFLICT: 'That table is already booked for this time.',
  RESERVATION_CAPACITY_EXCEEDED: 'There is no capacity left for that time slot.',
  RESERVATION_OUTSIDE_HOURS: 'That time is outside reservation hours.',
  RESERVATION_IN_PAST: 'Reservations cannot be made in the past.',
  RESERVATION_PARTY_TOO_LARGE: 'The party is larger than the branch accepts for one booking.',
  RESERVATION_DISABLED: 'Reservations are turned off for this branch.',
  DEVICE_REVOKED: 'This device has been revoked.',
  LICENSE_EXPIRED: 'The device license has expired.',
}

export const isVersionConflict = (err: unknown) => err instanceof ApiError && (err.code === 'VERSION_CONFLICT' || err.status === 409)

/** Human message for toasts: known code copy, then validation detail, then the server message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return CODE_MESSAGES[err.code] ?? err.violation ?? err.message
  if (err instanceof NetworkError) return err.message
  return err instanceof Error ? err.message : 'Something went wrong'
}
