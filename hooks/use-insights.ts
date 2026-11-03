'use client'

/**
 * Live-mode reads for back-office screens that are not CRUD lists: server-side report models
 * (`/api/insights/*`), the expense summary, cash registers, shifts, attendance and payroll runs.
 *
 * Nothing is fetched until the session has resolved the tenant. Keys carry the tenant and the
 * top-bar branch selection, like `useResource`, so switching either refetches. A hook given a
 * `null` window stays idle. `data === undefined` means "not loaded / not available" (pending,
 * failed or forbidden); an empty `rows` array means the server reported nothing — screens render
 * those two cases differently.
 *
 * Branch scope: every branch selected → one consolidated call (no `branch_id`, no `X-Branch-Id`);
 * one branch → `branch_id`; a subset → reports with per-branch rows are fetched consolidated and
 * filtered, the others are fetched per branch and their rows concatenated. Amounts stay as the
 * server reports them (per currency, minor units); `sumMinor` only adds rows of one currency.
 */
import useSWR from 'swr'
import { useCallback } from 'react'
import { useScope } from '@/hooks/use-scope'
import { useSession } from '@/services/api/session'
import { api, operationId } from '@/services/api/client'
import { fromMinor } from '@/services/api/mappers'
import type {
  AuditLogResponseDto,
  AddPayrollLineDto,
  AdjustCashDto,
  AssignShiftDto,
  CashAdjustmentResponseDto,
  CreateExpenseCategoryDto,
  CreateShiftDto,
  EndShiftAssignmentDto,
  RecordCashMovementDto,
  UpdateExpenseCategoryDto,
  AttendanceReportResponseDto,
  AttendanceResponseDto,
  BranchComparisonResponseDto,
  CancelPayrollRunDto,
  CashAccountResponseDto,
  CashMovementResponseDto,
  CorrectAttendanceDto,
  CreatePayrollRunDto,
  DashboardResponseDto,
  DiscountsReportResponseDto,
  ExpectedVersionDto,
  ExpenseCategoryResponseDto,
  ExpenseSummaryResponseDto,
  ExpensesReportResponseDto,
  InventoryReportResponseDto,
  OrdersReportResponseDto,
  PaymentsReportResponseDto,
  PayPayrollRunDto,
  PayrollCalculationResponseDto,
  PayrollReportResponseDto,
  PayrollRunDetailResponseDto,
  PayrollRunResponseDto,
  RecordAttendanceDto,
  SalesReportResponseDto,
  ShiftAssignmentResponseDto,
  ShiftResponseDto,
  TaxReportResponseDto,
} from '@/services/api/generated/schemas'
import type { DatePreset } from '@/stores/app-store'

/* ───────────────────────── dates ───────────────────────── */

export const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Today in the browser's calendar (the server reports use the branch time zone; same day in practice). */
export const todayIso = () => localIso(new Date())

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localIso(d)
}

export interface DateWindow {
  from: string
  to: string
}

/** Real calendar window for a top-bar preset ("month" = first of this month to today). */
export function presetWindow(preset: DatePreset, today = todayIso()): DateWindow {
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  return { from: addDays(today, -(preset === '7d' ? 6 : 29)), to: today }
}

export function daysOf(w: DateWindow): string[] {
  const out: string[] = []
  for (let d = w.from; d <= w.to && out.length < 366; d = addDays(d, 1)) out.push(d)
  return out
}

/** The window of the same length immediately before `w`, for "vs previous period" deltas. */
export function previousWindow(w: DateWindow): DateWindow {
  const len = daysOf(w).length
  return { from: addDays(w.from, -len), to: addDays(w.from, -1) }
}

export const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

/* ───────────────────────── scope + keys ───────────────────────── */

interface Scope {
  all: boolean
  ids: string[]
}

function useLive(...parts: (string | number | null | undefined)[]) {
  const tenantId = useSession((s) => s.tenant?.id)
  const currency = useSession((s) => s.tenant?.default_currency)
  const { branchIds, allBranches } = useScope()
  const scope: Scope = { all: allBranches, ids: branchIds }
  const key = tenantId ? ['back-office', tenantId, branchIds.join(','), ...parts.map((p) => p ?? '')].join('|') : null
  return { key, scope, currency }
}

const swrOptions = { revalidateOnFocus: false } as const

/** Concatenate the array sections of per-branch responses (low-stock summaries are summed). */
function mergeParts<T extends object>(parts: T[]): T {
  if (parts.length <= 1) return parts[0]
  const out: Record<string, unknown> = { ...(parts[0] as Record<string, unknown>) }
  for (const key of Object.keys(out)) {
    if (key === 'window') continue
    const vals = parts.map((p) => (p as Record<string, unknown>)[key]).filter((v) => v != null)
    if (!vals.length) continue
    if (Array.isArray(vals[0])) out[key] = vals.flatMap((v) => v as unknown[])
    else if (typeof vals[0] === 'object' && 'total' in (vals[0] as object) && 'items' in (vals[0] as object)) {
      const ls = vals as { total: number; items: unknown[] }[]
      out[key] = { total: ls.reduce((s, v) => s + v.total, 0), items: ls.flatMap((v) => v.items) }
    }
  }
  return out as T
}

/** Keep only rows of the selected branches in every array section that carries `branch_id`. */
function filterBranches<T extends object>(res: T, ids: string[]): T {
  const out: Record<string, unknown> = { ...(res as Record<string, unknown>) }
  for (const [key, v] of Object.entries(out)) {
    if (!Array.isArray(v)) continue
    out[key] = v.filter((r) => !r || typeof r !== 'object' || !('branch_id' in r) || ids.includes((r as { branch_id: string }).branch_id))
  }
  const ls = out.low_stock as { total: number; items: { branch_id: string }[] } | undefined
  if (ls && Array.isArray(ls.items)) {
    // The low-stock total covers every branch; with a subset only the listed items can be scoped.
    const items = ls.items.filter((i) => ids.includes(i.branch_id))
    out.low_stock = { total: items.length, items }
  }
  return out as T
}

async function scoped<T extends object>(scope: Scope, fetchOne: (branchId?: string) => Promise<T>, branchRows: boolean): Promise<T> {
  if (scope.all) return fetchOne()
  if (scope.ids.length === 1) return fetchOne(scope.ids[0])
  if (branchRows) return filterBranches(await fetchOne(), scope.ids)
  return mergeParts(await Promise.all(scope.ids.map((b) => fetchOne(b))))
}

/* ───────────────────────── money helpers ───────────────────────── */

/**
 * Sum a minor-unit field over report rows of one currency, in major units (rupees).
 * Without a known tenant currency every row is added.
 */
export function sumMinor<R extends { currency: string }>(rows: R[] | null | undefined, pick: (r: R) => number | null | undefined, currency?: string) {
  return fromMinor((rows ?? []).filter((r) => !currency || r.currency === currency).reduce((s, r) => s + (pick(r) ?? 0), 0))
}

/** Sum counts by a key (e.g. order statuses, attendance statuses). */
export function countBy<R>(rows: R[] | null | undefined, key: (r: R) => string, value: (r: R) => number) {
  const m = new Map<string, number>()
  for (const r of rows ?? []) m.set(key(r), (m.get(key(r)) ?? 0) + value(r))
  return m
}

/* ───────────────────────── insights ───────────────────────── */

interface ReportMap {
  sales: SalesReportResponseDto
  orders: OrdersReportResponseDto
  discounts: DiscountsReportResponseDto
  tax: TaxReportResponseDto
  payments: PaymentsReportResponseDto
  expenses: ExpensesReportResponseDto
  inventory: InventoryReportResponseDto
  attendance: AttendanceReportResponseDto
  payroll: PayrollReportResponseDto
  branches: BranchComparisonResponseDto
}
export type ReportName = keyof ReportMap

/** Reports whose rows carry `branch_id`, so a branch subset can be cut from one consolidated call. */
const BRANCH_ROWS: Record<ReportName, boolean> = {
  sales: true,
  orders: true,
  payments: true,
  expenses: true,
  attendance: true,
  branches: true,
  inventory: false,
  discounts: false,
  tax: false,
  payroll: false,
}

function fetchReport<K extends ReportName>(name: K, w: DateWindow, scope: Scope): Promise<ReportMap[K]> {
  return scoped(
    scope,
    (branch_id) => api.get<ReportMap[K]>(`/insights/reports/${name}`, { branchId: null, query: { from: w.from, to: w.to, branch_id } }),
    BRANCH_ROWS[name],
  )
}

/** `GET /api/insights/reports/{name}?from&to[&branch_id]` for the selected branches. */
export function useInsightsReport<K extends ReportName>(name: K, w: DateWindow | null) {
  const { key, scope, currency } = useLive('report', name, w?.from, w?.to)
  const res = useSWR(w ? key : null, () => fetchReport(name, w!, scope), swrOptions)
  return { ...res, currency }
}

/**
 * `GET /api/insights/dashboard?date` — one day's sales, order statuses, expenses, payments, low
 * stock and attendance. Sections the caller lacks permission for are null.
 */
export function useInsightsDashboard(date: string) {
  const { key, scope, currency } = useLive('dashboard', date)
  const res = useSWR(
    key,
    () => scoped(scope, (branch_id) => api.get<DashboardResponseDto>('/insights/dashboard', { branchId: null, query: { date, branch_id } }), false),
    swrOptions,
  )
  return { ...res, currency }
}

export interface DailySales {
  date: string
  label: string
  sales: SalesReportResponseDto['rows']
}

/**
 * Daily sales for a window: the sales report has no per-day buckets, so it is read once per day
 * (`from = to = day`). Up to 31 calls for a month; cached per tenant/branch/day window.
 */
export function useDailySales(w: DateWindow | null) {
  const { key, scope, currency } = useLive('daily-sales', w?.from, w?.to)
  const res = useSWR(
    w ? key : null,
    () =>
      Promise.all(
        daysOf(w!).map(async (date): Promise<DailySales> => ({ date, label: dayLabel(date), sales: (await fetchReport('sales', { from: date, to: date }, scope)).rows })),
      ),
    swrOptions,
  )
  return { ...res, currency }
}

/* ───────────────────────── finance ───────────────────────── */

/** `GET /api/finance/expenses/summary` — expense totals per day/week/month (void excluded). */
export function useExpenseSummary(period: 'day' | 'week' | 'month', w: DateWindow | null, categoryId?: string) {
  const { key, scope, currency } = useLive('expense-summary', period, w?.from, w?.to, categoryId)
  const res = useSWR(
    w ? key : null,
    () =>
      scoped(
        scope,
        (branch_id) =>
          api.get<ExpenseSummaryResponseDto>('/finance/expenses/summary', { branchId: null, query: { period, from: w!.from, to: w!.to, branch_id, category_id: categoryId } }),
        false,
      ),
    swrOptions,
  )
  return { ...res, currency }
}

/** Expense totals per bucket start date (one currency), in major units. */
export function expenseBuckets(summary: ExpenseSummaryResponseDto | undefined, currency?: string) {
  const m = new Map<string, number>()
  for (const b of summary?.buckets ?? []) {
    if (currency && b.currency !== currency) continue
    m.set(b.period_start.slice(0, 10), (m.get(b.period_start.slice(0, 10)) ?? 0) + fromMinor(b.total_minor))
  }
  return m
}

/** `GET /api/finance/expense-categories` (tenant-wide). */
export function useExpenseCategories() {
  const { key } = useLive('expense-categories')
  return useSWR(key, () => api.listAll<ExpenseCategoryResponseDto>('/finance/expense-categories', { branchId: null }), swrOptions)
}

/** `GET /api/finance/cash-accounts` — registers of the selected branches. */
export function useCashAccounts() {
  const { key, scope } = useLive('cash-accounts')
  return useSWR(
    key,
    async () => (await api.listAll<CashAccountResponseDto>('/finance/cash-accounts', { branchId: null })).filter((a) => scope.all || scope.ids.includes(a.branch_id)),
    swrOptions,
  )
}

/** `GET /api/finance/cash-accounts/{id}/movements` (newest first) for several registers. */
export function useCashMovements(accountIds: string[] | undefined, maxPages = 5) {
  const ids = accountIds ?? []
  const { key } = useLive('cash-movements', ids.join(','), maxPages)
  return useSWR(
    accountIds ? key : null,
    async () => {
      const lists = await Promise.all(ids.map((id) => api.listAll<CashMovementResponseDto>(`/finance/cash-accounts/${id}/movements`, { branchId: null }, maxPages)))
      return Object.fromEntries(ids.map((id, i) => [id, lists[i]])) as Record<string, CashMovementResponseDto[]>
    },
    swrOptions,
  )
}

/* ───────────────────────── staff ───────────────────────── */

/** `GET /api/staff/shifts` of the selected branches. */
export function useShifts() {
  const { key, scope } = useLive('shifts')
  return useSWR(
    key,
    async () => (await api.listAll<ShiftResponseDto>('/staff/shifts', { branchId: null })).filter((s) => scope.all || scope.ids.includes(s.branch_id)),
    swrOptions,
  )
}

/** `GET /api/staff/shift-assignments?active_on=` of the selected branches. */
export function useShiftAssignments(activeOn?: string) {
  const { key, scope } = useLive('shift-assignments', activeOn)
  return useSWR(
    key,
    async () =>
      (await api.listAll<ShiftAssignmentResponseDto>('/staff/shift-assignments', { branchId: null, query: { active_on: activeOn } })).filter(
        (a) => scope.all || scope.ids.includes(a.branch_id),
      ),
    swrOptions,
  )
}

/**
 * `GET /api/staff/attendance?from&to` of the selected branches, plus recording
 * (`POST /api/staff/attendance`) and correcting (`PATCH /api/staff/attendance/{id}`) a day.
 */
export function useAttendance(w: DateWindow | null) {
  const { key, scope } = useLive('attendance', w?.from, w?.to)
  const res = useSWR(
    w ? key : null,
    async () => {
      const rows = await api.listAll<AttendanceResponseDto>('/staff/attendance', {
        branchId: null,
        query: { from: w!.from, to: w!.to, branch_id: !scope.all && scope.ids.length === 1 ? scope.ids[0] : undefined },
      })
      return scope.all ? rows : rows.filter((r) => scope.ids.includes(r.branch_id))
    },
    swrOptions,
  )
  const { mutate } = res

  const record = useCallback(
    async (input: Omit<RecordAttendanceDto, 'id'>) => {
      const created = await api.post<AttendanceResponseDto>('/staff/attendance', { id: operationId(), ...input } satisfies RecordAttendanceDto, { branchId: null })
      await mutate((prev) => [created, ...(prev ?? []).filter((r) => r.id !== created.id)], { revalidate: false })
      return created
    },
    [mutate],
  )

  const correct = useCallback(
    async (current: AttendanceResponseDto, patch: Omit<CorrectAttendanceDto, 'expected_version'>) => {
      const body: CorrectAttendanceDto = { expected_version: current.version, ...patch }
      const next = await api.patch<AttendanceResponseDto>(`/staff/attendance/${current.id}`, body, { branchId: null })
      await mutate((prev) => (prev ?? []).map((r) => (r.id === next.id ? next : r)), { revalidate: false })
      return next
    },
    [mutate],
  )

  return { ...res, record, correct }
}

/** `GET /api/staff/payroll-runs` (latest period first) of the selected branches plus tenant-wide runs. */
export function usePayrollRuns() {
  const { key, scope } = useLive('payroll-runs')
  return useSWR(
    key,
    async () => {
      const rows = await api.listAll<PayrollRunResponseDto>('/staff/payroll-runs', { branchId: null })
      // A run with no branch covers every branch, so it is in scope whatever is selected.
      return rows.filter((r) => scope.all || !r.branch_id || scope.ids.includes(r.branch_id))
    },
    swrOptions,
  )
}

/** `GET /api/staff/payroll-runs/{id}` with entries and lines, and the run's lifecycle actions. */
export function usePayrollRun(runId: string | null | undefined) {
  const { key } = useLive('payroll-run', runId)
  const res = useSWR(runId ? key : null, () => api.get<PayrollRunDetailResponseDto>(`/staff/payroll-runs/${runId}`, { branchId: null }), swrOptions)
  const { mutate } = res

  const apply = useCallback(
    async (run: Promise<PayrollRunDetailResponseDto | PayrollCalculationResponseDto>) => {
      const next = await run
      await mutate({ run: next.run, entries: next.entries }, { revalidate: false })
      return next
    },
    [mutate],
  )

  const version = (d: PayrollRunDetailResponseDto) => ({ expected_version: d.run.version }) satisfies ExpectedVersionDto
  const base = (d: PayrollRunDetailResponseDto) => `/staff/payroll-runs/${d.run.id}`

  return {
    ...res,
    calculate: (d: PayrollRunDetailResponseDto) => apply(api.post<PayrollCalculationResponseDto>(`${base(d)}/calculate`, version(d), { branchId: null })),
    approve: (d: PayrollRunDetailResponseDto) => apply(api.post<PayrollRunDetailResponseDto>(`${base(d)}/approve`, version(d), { branchId: null })),
    pay: (d: PayrollRunDetailResponseDto, body: Omit<PayPayrollRunDto, 'expected_version'>) =>
      apply(api.post<PayrollRunDetailResponseDto>(`${base(d)}/pay`, { ...version(d), ...body } satisfies PayPayrollRunDto, { branchId: null })),
    cancel: async (d: PayrollRunDetailResponseDto, reason: string) => {
      const run = await api.post<PayrollRunResponseDto>(`${base(d)}/cancel`, { ...version(d), reason } satisfies CancelPayrollRunDto, { branchId: null })
      await mutate({ ...d, run }, { revalidate: false })
      return run
    },
    addLine: (d: PayrollRunDetailResponseDto, entryId: string, line: AddPayrollLineDto) =>
      apply(api.post<PayrollRunDetailResponseDto>(`${base(d)}/entries/${entryId}/lines`, line, { branchId: null })),
    removeLine: async (d: PayrollRunDetailResponseDto, entryId: string, lineId: string) => {
      await api.delete(`${base(d)}/entries/${entryId}/lines/${lineId}`, { branchId: null })
      await mutate()
    },
  }
}

/** `POST /api/staff/payroll-runs` — open a run for a period (one branch, or all when omitted). */
export const createPayrollRun = (body: CreatePayrollRunDto) => api.post<PayrollRunResponseDto>('/staff/payroll-runs', body, { branchId: null })

/* ───────────────────────── writes (direct; errors propagate to the caller) ───────────────────────── */

/** `POST /api/finance/expense-categories` */
export const createExpenseCategory = (body: CreateExpenseCategoryDto) =>
  api.post<ExpenseCategoryResponseDto>('/finance/expense-categories', body, { branchId: null })

/** `PATCH /api/finance/expense-categories/{id}` — rename or (de)activate. */
export const updateExpenseCategory = (current: ExpenseCategoryResponseDto, patch: Omit<UpdateExpenseCategoryDto, 'expected_version'>) =>
  api.patch<ExpenseCategoryResponseDto>(`/finance/expense-categories/${current.id}`, { expected_version: current.version, ...patch } satisfies UpdateExpenseCategoryDto, {
    branchId: null,
  })

/** `POST /api/finance/cash-accounts/{id}/movements` — manual cash in/out (idempotent per operation id). */
export const recordCashMovement = (accountId: string, body: Omit<RecordCashMovementDto, 'operation_id'>) =>
  api.post<CashMovementResponseDto>(`/finance/cash-accounts/${accountId}/movements`, { operation_id: operationId(), ...body } satisfies RecordCashMovementDto, {
    branchId: null,
  })

/** `POST /api/finance/cash-accounts/{id}/adjustments` — set the balance to the counted cash (audited). */
export const adjustCash = (accountId: string, body: Omit<AdjustCashDto, 'operation_id'>) =>
  api.post<CashAdjustmentResponseDto>(`/finance/cash-accounts/${accountId}/adjustments`, { operation_id: operationId(), ...body } satisfies AdjustCashDto, {
    branchId: null,
  })

/** `POST /api/staff/shifts` */
export const createShift = (body: CreateShiftDto) => api.post<ShiftResponseDto>('/staff/shifts', body, { branchId: null })

/** `POST /api/staff/shifts/{id}/assignments` */
export const assignShift = (shiftId: string, body: AssignShiftDto) =>
  api.post<ShiftAssignmentResponseDto>(`/staff/shifts/${shiftId}/assignments`, body, { branchId: null })

/** `POST /api/staff/shift-assignments/{id}/end` */
export const endShiftAssignment = (current: ShiftAssignmentResponseDto, effectiveTo: string) =>
  api.post<ShiftAssignmentResponseDto>(
    `/staff/shift-assignments/${current.id}/end`,
    { expected_version: current.version, effective_to: effectiveTo } satisfies EndShiftAssignmentDto,
    { branchId: null },
  )

export interface AuditEntry {
  id: string
  actor: string
  action: string
  resource: string
  at: string
}

/** `GET /api/audit-logs` (newest first) — the latest critical mutations, for activity feeds. */
export function useAuditLog(limit = 6) {
  const { key } = useLive('audit-logs', limit)
  return useSWR(
    key,
    async (): Promise<AuditEntry[]> => {
      const page = await api.page<AuditLogResponseDto>('/audit-logs', { branchId: null, query: { page_size: limit } })
      return page.data.map((a) => ({ id: a.id, actor: a.actor_type, action: a.action, resource: a.resource_type, at: a.occurred_at }))
    },
    swrOptions,
  )
}
