/**
 * Employees — `GET/POST /api/staff/employees`, `GET/PATCH /api/staff/employees/{id}`.
 *
 * Pay fields come from the employee's current compensation row
 * (`GET/POST /api/staff/employees/{id}/compensations`, confidential: blank without payroll access),
 * the shift from today's shift assignment (`GET /api/staff/shift-assignments?active_on=` +
 * `GET /api/staff/shifts`). Changing pay adds a new compensation row effective today.
 *
 * Role is derived from the free-text designation. The API has no DELETE: "remove" terminates the employee (leaving date today)
 * and terminated employees are not listed.
 */
import { api } from '@/services/api/client'
import { apiRepository, scopeBranchIds, UnsupportedOperationError, versionOf } from '@/services/api/adapter'
import { colorFor, compact, fromMinor, toMinor } from '@/services/api/mappers'
import type {
  CompensationResponseDto,
  CreateCompensationDto,
  CreateEmployeeDto,
  EmployeeResponseDto,
  ShiftAssignmentResponseDto,
  ShiftResponseDto,
  UpdateEmployeeDto,
} from '@/services/api/generated/schemas'
import type { Employee, EmployeeRole } from '@/types'

interface EmployeeRow {
  version: number
  employee: EmployeeResponseDto
  compensation: CompensationResponseDto | null
  shift: ShiftResponseDto | null
}

/** Local calendar date (YYYY-MM-DD). */
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Keyword → role, checked in order against the designation ("Head chef" → chef). */
const ROLE_KEYWORDS: [string, EmployeeRole][] = [
  ['admin', 'admin'],
  ['manager', 'manager'],
  ['account', 'accountant'],
  ['cashier', 'cashier'],
  ['kitchen', 'kitchen-staff'],
  ['chef', 'chef'],
  ['cook', 'chef'],
  ['rider', 'rider'],
  ['driver', 'rider'],
  ['waiter', 'waiter'],
  ['server', 'waiter'],
]

const roleFrom = (designation: string | null | undefined): EmployeeRole => {
  const d = (designation ?? '').toLowerCase()
  return ROLE_KEYWORDS.find(([k]) => d.includes(k))?.[1] ?? 'waiter'
}

const designationOf = (role: EmployeeRole) => {
  const s = role.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const shiftBucket = (s: ShiftResponseDto | null): Employee['shift'] => {
  if (!s) return 'morning'
  const name = s.name.toLowerCase()
  if (name.includes('night')) return 'night'
  if (name.includes('evening')) return 'evening'
  if (name.includes('morning')) return 'morning'
  const hour = Number(s.start_time.slice(0, 2))
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 20 ? 'evening' : 'night'
}

/** Pay as the UI models it. Weekly salaries are shown as their monthly equivalent (52/12 weeks). */
const payOf = (c: CompensationResponseDto | null): Pick<Employee, 'payType' | 'payRate'> => {
  if (!c) return { payType: 'monthly', payRate: 0 }
  const rate = fromMinor(c.rate_minor)
  if (c.salary_basis === 'daily') return { payType: 'daily', payRate: rate }
  if (c.salary_basis === 'weekly') return { payType: 'monthly', payRate: Math.round((rate * 52) / 12) }
  return { payType: 'monthly', payRate: rate }
}

const toUi = ({ employee: e, compensation, shift }: EmployeeRow): Employee => {
  const scope = scopeBranchIds()
  return {
    id: e.id,
    code: e.code,
    name: e.full_name,
    role: roleFrom(e.designation),
    // An employee can work at several branches; the UI shows one — prefer one in the current scope.
    branchId: e.branch_ids.find((b) => scope.includes(b)) ?? e.branch_ids[0] ?? '',
    phone: e.phone ?? '',
    email: e.email ?? '',
    joinedAt: e.joining_date,
    ...payOf(compensation),
    status: e.status === 'active' ? 'active' : 'inactive',
    shift: shiftBucket(shift),
    color: colorFor(e.id),
  }
}

/** The compensation in effect today (rows come latest effective date first). */
const currentCompensation = (rows: CompensationResponseDto[]) => {
  const d = today()
  return rows.find((c) => c.effective_from <= d && (!c.effective_to || c.effective_to >= d)) ?? rows[0] ?? null
}

const fetchCompensation = async (employeeId: string) => {
  try {
    const r = await api.page<CompensationResponseDto>(`/staff/employees/${employeeId}/compensations`, { branchId: null, query: { page_size: 20 } })
    return currentCompensation(r.data)
  } catch {
    // Compensation is confidential (payroll permission); without it pay shows as 0.
    return null
  }
}

async function loadShifts(employeeId?: string) {
  try {
    const [shifts, assignments] = await Promise.all([
      api.listAll<ShiftResponseDto>('/staff/shifts', { branchId: null }),
      api.listAll<ShiftAssignmentResponseDto>('/staff/shift-assignments', { branchId: null, query: { active_on: today(), employee_id: employeeId } }),
    ])
    const byId = new Map(shifts.map((s) => [s.id, s]))
    return new Map(assignments.map((a) => [a.employee_id, byId.get(a.shift_id) ?? null]))
  } catch {
    return new Map<string, ShiftResponseDto | null>()
  }
}

const row = (employee: EmployeeResponseDto, compensation: CompensationResponseDto | null, shift: ShiftResponseDto | null): EmployeeRow => ({
  version: employee.version,
  employee,
  compensation,
  shift,
})

function validate(input: Partial<Employee>, current?: Employee) {
  const changed = <K extends keyof Employee>(k: K) => input[k] !== undefined && input[k] !== current?.[k]
  if (input.status === 'on-leave' && changed('status')) throw new UnsupportedOperationError('Employees', 'on-leave status (use attendance leave instead)')
  if (input.payType === 'hourly' && changed('payType')) throw new UnsupportedOperationError('Employees', 'hourly pay')
  if (current && changed('shift')) throw new UnsupportedOperationError('Employees', 'changing the shift here (assign shifts in the staff schedule)')
}

const addCompensation = (employeeId: string, payType: Employee['payType'], payRate: number) => {
  const basis = payType === 'daily' ? 'daily' : 'monthly'
  const body: CreateCompensationDto = { salary_basis: basis, rate_minor: toMinor(payRate), pay_schedule: basis, effective_from: today() }
  return api.post<CompensationResponseDto>(`/staff/employees/${employeeId}/compensations`, body, { branchId: null })
}

export const employees = apiRepository<Employee, EmployeeRow>({
  name: 'Employees',
  toUi,
  list: async () => {
    const [rows, shifts] = await Promise.all([api.listAll<EmployeeResponseDto>('/staff/employees', { branchId: null }), loadShifts()])
    const visible = rows.filter((e) => e.status !== 'terminated')
    const comps = await Promise.all(visible.map((e) => fetchCompensation(e.id)))
    return visible.map((e, i) => row(e, comps[i], shifts.get(e.id) ?? null))
  },
  get: async (id) => {
    const [e, comp, shifts] = await Promise.all([api.get<EmployeeResponseDto>(`/staff/employees/${id}`, { branchId: null }), fetchCompensation(id), loadShifts(id)])
    return row(e, comp, shifts.get(id) ?? null)
  },
  create: async (input) => {
    validate(input)
    const body: CreateEmployeeDto = {
      code: input.code,
      full_name: input.name,
      designation: designationOf(input.role),
      branch_ids: [input.branchId],
      status: input.status === 'active' ? 'active' : 'inactive',
      joining_date: input.joinedAt || today(),
      ...compact({ phone: input.phone || undefined, email: input.email || undefined }),
    }
    const created = await api.post<EmployeeResponseDto>('/staff/employees', body, { branchId: null })
    const comp = input.payRate > 0 ? await addCompensation(created.id, input.payType, input.payRate) : null
    return row(created, comp, null)
  },
  update: async (id, patch, current) => {
    const ui = current?.ui
    validate(patch, ui)
    const changed = <K extends keyof Employee>(k: K) => patch[k] !== undefined && patch[k] !== ui?.[k]
    const prev = current?.dto
    const fields = compact({
      full_name: changed('name') ? patch.name : undefined,
      phone: changed('phone') ? patch.phone || null : undefined,
      email: changed('email') ? patch.email || null : undefined,
      designation: changed('role') ? designationOf(patch.role!) : undefined,
      // Replace the branch the UI shows, keep any other assignments.
      branch_ids: changed('branchId') ? [patch.branchId!, ...(prev?.employee.branch_ids ?? []).filter((b) => b !== ui?.branchId && b !== patch.branchId)] : undefined,
      status: changed('status') ? (patch.status === 'active' ? ('active' as const) : ('inactive' as const)) : undefined,
      joining_date: changed('joinedAt') ? patch.joinedAt : undefined,
      code: changed('code') ? patch.code : undefined,
    })
    let employee = prev?.employee ?? (await api.get<EmployeeResponseDto>(`/staff/employees/${id}`, { branchId: null }))
    if (Object.keys(fields).length) {
      const body: UpdateEmployeeDto = { expected_version: versionOf(current), ...fields }
      employee = await api.patch<EmployeeResponseDto>(`/staff/employees/${id}`, body, { branchId: null })
    }
    let comp = prev?.compensation ?? null
    if (changed('payType') || changed('payRate')) comp = await addCompensation(id, patch.payType ?? ui?.payType ?? 'monthly', patch.payRate ?? ui?.payRate ?? 0)
    return row(employee, comp, prev?.shift ?? null)
  },
  remove: async (id, current) => {
    const body: UpdateEmployeeDto = { expected_version: versionOf(current), status: 'terminated', leaving_date: today() }
    await api.patch(`/staff/employees/${id}`, body, { branchId: null })
  },
})
