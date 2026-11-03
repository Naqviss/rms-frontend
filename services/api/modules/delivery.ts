/**
 * Delivery — `GET/POST /api/delivery/tasks`, `POST /api/delivery/tasks/{id}/assign`,
 * `POST /api/delivery/tasks/{id}/transitions`; riders from `GET /api/staff/employees`.
 *
 *  - The delivery API assigns a task to `driver_employee_id` ("an employee of the branch"), so a
 *    rider is an active/inactive staff employee whose designation reads as a rider/driver.
 *  - Rider status is derived: inactive → off-duty, holding an assigned / picked-up / on-the-way
 *    task → on-delivery, otherwise available. The API has no rider availability flag to write,
 *    and no vehicle field (neutral default `bike`).
 *  - Tasks also feed `Order.delivery` (see orders.ts), so their mapping lives here.
 */
import { api } from '@/services/api/client'
import { apiRepository, scopeBranchIds } from '@/services/api/adapter'
import { compact, fromMinor, toMinor } from '@/services/api/mappers'
import type {
  AssignDeliveryDriverDto,
  CreateDeliveryTaskDto,
  CreateDeliveryZoneDto,
  DeliveryAddressDto,
  DeliverySettingsResponseDto,
  DeliverySummaryResponseDto,
  DeliveryZoneResponseDto,
  SaveDeliverySettingsDto,
  UpdateDeliveryZoneDto,
  DeliveryTaskResponseDto,
  EmployeeResponseDto,
  TransitionDeliveryDto,
} from '@/services/api/generated/schemas'
import type { DeliveryInfo, DeliveryStatus, Rider } from '@/types'

type TaskStatus = DeliveryTaskResponseDto['status']

/* ---------------------------------------------------------------- tasks */

export const taskStatusToUi: Record<TaskStatus, DeliveryStatus> = {
  pending: 'unassigned',
  ready_for_dispatch: 'unassigned',
  assigned: 'assigned',
  picked_up: 'picked-up',
  out_for_delivery: 'picked-up',
  delivered: 'delivered',
  failed: 'failed',
  cancelled: 'failed',
}

/** Tasks a driver is currently holding. */
const ACTIVE: TaskStatus[] = ['assigned', 'picked_up', 'out_for_delivery']

export const addressLine = (a: DeliveryAddressDto | undefined) => (a ? [a.line1, a.line2].filter(Boolean).join(', ') : '')

const minutesBetween = (from: string, to: string | null | undefined) => {
  if (!to) return undefined
  const m = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
  return m > 0 ? m : undefined
}

/** Task → the order card's delivery block. Phone and distance are not on the task. */
export function toDeliveryInfo(t: DeliveryTaskResponseDto): DeliveryInfo {
  return {
    address: addressLine(t.address),
    area: t.address?.area ?? t.address?.postal_code ?? '',
    phone: '',
    fee: fromMinor(t.fee_minor),
    distanceKm: 0,
    etaMinutes: t.estimated_minutes ?? 0,
    status: taskStatusToUi[t.status],
    riderId: t.driver_employee_id ?? null,
    riderName: t.driver_name ?? null,
    durationMinutes: t.status === 'delivered' ? minutesBetween(t.created_at, t.delivered_at) : undefined,
  }
}

/** Every delivery task of one branch (optionally one status). */
export const listDeliveryTasks = (branchId: string, status?: TaskStatus) =>
  api.listAll<DeliveryTaskResponseDto>('/delivery/tasks', { branchId, query: { branch_id: branchId, status } })

export const createDeliveryTask = (branchId: string, body: CreateDeliveryTaskDto) =>
  api.post<DeliveryTaskResponseDto>('/delivery/tasks', body, { branchId })

export function assignDriver(task: DeliveryTaskResponseDto, employeeId: string) {
  const body: AssignDeliveryDriverDto = { expected_version: task.version, driver_employee_id: employeeId }
  return api.post<DeliveryTaskResponseDto>(`/delivery/tasks/${task.id}/assign`, body, { branchId: task.branch_id })
}

export function transitionTask(task: DeliveryTaskResponseDto, to: TaskStatus, reason?: string) {
  const body: TransitionDeliveryDto = {
    to_status: to,
    expected_version: task.version,
    ...(to === 'failed' || to === 'cancelled' ? { reason_code: reason ?? 'staff_marked_failed' } : {}),
  }
  return api.post<DeliveryTaskResponseDto>(`/delivery/tasks/${task.id}/transitions`, body, { branchId: task.branch_id })
}

/**
 * Move a task to the board's next stage. "On the way" covers both picked_up and
 * out_for_delivery, so it steps through both.
 */
export async function advanceTask(task: DeliveryTaskResponseDto, to: DeliveryStatus): Promise<DeliveryTaskResponseDto> {
  if (taskStatusToUi[task.status] === to) return task
  switch (to) {
    case 'picked-up': {
      const picked = task.status === 'picked_up' ? task : await transitionTask(task, 'picked_up')
      return transitionTask(picked, 'out_for_delivery')
    }
    case 'delivered':
      return transitionTask(task, 'delivered')
    case 'failed':
      return transitionTask(task, 'failed')
    default:
      // 'assigned' goes through assignDriver; 'unassigned' (un-assigning) has no API.
      throw new Error(`A delivery cannot be moved back to "${to}" through the RMS API`)
  }
}

/* --------------------------------------------------------------- riders */

const RIDER = /rider|driver|delivery|courier|dispatch/i

type RiderRow = EmployeeResponseDto & { _branchId: string; _busy: boolean }

async function listRiders(): Promise<Array<RiderRow>> {
  const branches = scopeBranchIds()
  const perBranch = await Promise.allSettled(
    branches.map(async (b) => {
      const [staff, ...active] = await Promise.all([
        api.listAll<EmployeeResponseDto>('/staff/employees', { branchId: b, query: { branch_id: b } }),
        // Busy drivers: tasks currently held. Missing delivery permission → nobody shows busy.
        ...ACTIVE.map((s) => listDeliveryTasks(b, s).catch(() => [] as DeliveryTaskResponseDto[])),
      ])
      const busy = new Set(active.flat().map((t) => t.driver_employee_id).filter((x): x is string => !!x))
      return staff
        .filter((e) => e.status !== 'terminated' && RIDER.test(e.designation ?? ''))
        .map((e) => ({ ...e, _branchId: b, _busy: busy.has(e.id) }))
    }),
  )
  const ok = perBranch.filter((s): s is PromiseFulfilledResult<Array<RiderRow>> => s.status === 'fulfilled')
  if (!ok.length && perBranch.length) throw (perBranch[0] as PromiseRejectedResult).reason
  // An employee assigned to several branches in view is listed once, under the first.
  const seen = new Map<string, RiderRow>()
  for (const e of ok.flatMap((s) => s.value)) {
    const prev = seen.get(e.id)
    if (!prev) seen.set(e.id, e)
    else if (e._busy) prev._busy = true
  }
  return [...seen.values()]
}

export const riders = apiRepository<Rider, RiderRow>({
  name: 'Riders',
  list: listRiders,
  toUi: (e) => ({
    id: e.id,
    name: e.full_name,
    phone: e.phone ?? '',
    vehicle: 'bike',
    branchId: e._branchId,
    status: e.status !== 'active' ? 'off-duty' : e._busy ? 'on-delivery' : 'available',
  }),
  // Riders are staff employees (managed on the Employees page); availability is derived from
  // delivery tasks and cannot be set directly, so create/update/remove stay unsupported.
})

/* ------------------------------------------------- branch configuration */

export const deliverySettings = (branchId: string) =>
  api.get<DeliverySettingsResponseDto>(`/delivery/settings/${branchId}`, { branchId })

/** Version-checked once saved (`version` is null until the first save). */
export function saveDeliverySettings(current: DeliverySettingsResponseDto, next: Omit<SaveDeliverySettingsDto, 'expected_version'>) {
  const body: SaveDeliverySettingsDto = { expected_version: current.version ?? null, ...next }
  return api.put<DeliverySettingsResponseDto>(`/delivery/settings/${current.branch_id}`, body, { branchId: current.branch_id })
}

export const deliveryZones = (branchId: string) =>
  api.listAll<DeliveryZoneResponseDto>('/delivery/zones', { branchId, query: { branch_id: branchId } })

export interface ZoneInput {
  code: string
  name: string
  areas: string[]
  /** Rupees. */
  fee: number
  minOrder: number | null
  freeAbove: number | null
  estimatedMinutes: number | null
}

const minorOrNull = (v: number | null) => (v == null || v <= 0 ? null : toMinor(v))

export function createZone(branchId: string, currency: string, z: ZoneInput) {
  const body: CreateDeliveryZoneDto = {
    branch_id: branchId,
    code: z.code.trim(),
    name: z.name.trim(),
    areas: z.areas,
    fee_minor: toMinor(z.fee),
    currency,
    ...compact({
      min_order_minor: minorOrNull(z.minOrder) ?? undefined,
      free_delivery_threshold_minor: minorOrNull(z.freeAbove) ?? undefined,
      estimated_minutes: z.estimatedMinutes && z.estimatedMinutes > 0 ? z.estimatedMinutes : undefined,
    }),
  }
  return api.post<DeliveryZoneResponseDto>('/delivery/zones', body, { branchId })
}

export function updateZone(current: DeliveryZoneResponseDto, z: Partial<ZoneInput> & { active?: boolean }) {
  const body: UpdateDeliveryZoneDto = {
    expected_version: current.version,
    ...compact({
      name: z.name?.trim(),
      areas: z.areas,
      fee_minor: z.fee !== undefined ? toMinor(z.fee) : undefined,
      min_order_minor: z.minOrder !== undefined ? minorOrNull(z.minOrder) : undefined,
      free_delivery_threshold_minor: z.freeAbove !== undefined ? minorOrNull(z.freeAbove) : undefined,
      estimated_minutes: z.estimatedMinutes !== undefined ? (z.estimatedMinutes && z.estimatedMinutes > 0 ? z.estimatedMinutes : null) : undefined,
      is_active: z.active,
    }),
  }
  return api.patch<DeliveryZoneResponseDto>(`/delivery/zones/${current.id}`, body, { branchId: current.branch_id })
}

/** Per zone and status: task count, fee revenue of delivered tasks, average minutes to deliver. */
export const deliverySummary = (branchId: string, from?: string, to?: string) =>
  api.get<DeliverySummaryResponseDto>('/delivery/summary', { branchId, query: { from, to } })

export const getDeliveryTask = (task: Pick<DeliveryTaskResponseDto, 'id' | 'branch_id'>) =>
  api.get<DeliveryTaskResponseDto>(`/delivery/tasks/${task.id}`, { branchId: task.branch_id })
