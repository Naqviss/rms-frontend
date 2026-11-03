/**
 * Customers — `GET/POST /api/customers`, `GET/PATCH /api/customers/{id}`,
 * `GET /api/customers/{id}/orders`, `GET /api/customers/{id}/addresses`.
 *
 *  - The directory is tenant-wide (X-Branch-Id optional), so calls go without a branch header.
 *  - Lists carry no order statistics; `customerDetail()` reads the completed-order summary for
 *    one customer (used by the profile sheet).
 *  - "Blocked" is the backend's `inactive` status. There is no DELETE: remove is unsupported
 *    (block the customer instead).
 *  - Loyalty, segments by spend, favourites, auth method and city are not modelled by the API.
 */
import { api, operationId } from '@/services/api/client'
import { apiRepository, versionOf } from '@/services/api/adapter'
import { colorFor, compact, day, fromMinor } from '@/services/api/mappers'
import type {
  AddCustomerAddressDto,
  CustomerAddressResponseDto,
  CustomerDetailResponseDto,
  CustomerOrderResponseDto,
  CustomerResponseDto,
  RegisterCustomerDto,
  UpdateCustomerAddressDto,
  UpdateCustomerDto,
} from '@/services/api/generated/schemas'
import type { Customer } from '@/types'

const toUi = (d: CustomerResponseDto): Customer => ({
  id: d.id,
  name: d.display_name,
  phone: d.phone ?? '',
  email: d.email ?? '',
  registeredAt: day(d.created_at),
  accountStatus: d.status === 'active' ? 'active' : 'blocked',
  notes: d.notes ?? '',
  color: colorFor(d.id),
})

const orBlank = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined)
const orNull = (v: string | undefined) => (v === undefined ? undefined : v.trim() ? v.trim() : null)

export const customers = apiRepository<Customer, CustomerResponseDto>({
  name: 'Customers',
  toUi,
  list: () => api.listAll<CustomerResponseDto>('/customers', { branchId: null, query: { sort_by: 'name' } }),
  get: async (id) => (await api.get<CustomerDetailResponseDto>(`/customers/${id}`, { branchId: null })).customer,
  create: (input) => {
    const body: RegisterCustomerDto = {
      id: operationId(),
      display_name: input.name.trim(),
      source: 'pos',
      ...compact({ phone: orBlank(input.phone), email: orBlank(input.email), notes: orBlank(input.notes) }),
    }
    return api.post<CustomerResponseDto>('/customers', body, { branchId: null })
  },
  update: (id, patch, current) => {
    const body: UpdateCustomerDto = {
      expected_version: versionOf(current),
      ...compact({
        display_name: patch.name !== undefined ? patch.name.trim() : undefined,
        phone: orNull(patch.phone),
        email: orNull(patch.email),
        notes: orNull(patch.notes),
        status: patch.accountStatus !== undefined ? ((patch.accountStatus === 'active' ? 'active' : 'inactive') as UpdateCustomerDto['status']) : undefined,
      }),
    }
    return api.patch<CustomerResponseDto>(`/customers/${id}`, body, { branchId: null })
  },
})

/** Completed-order figures for one customer (caller's branches), for the profile sheet. */
export interface CustomerStats {
  customer: CustomerResponseDto
  totalOrders: number
  totalSpent: number
  firstOrderAt: string
  lastOrderAt: string
  recent: { orderId: string; branchId: string; number: string; total: number; completedAt: string }[]
}

export async function customerDetail(id: string): Promise<CustomerStats> {
  const [detail, recent] = await Promise.all([
    api.get<CustomerDetailResponseDto>(`/customers/${id}`, { branchId: null }),
    api.page<CustomerOrderResponseDto>(`/customers/${id}/orders`, { branchId: null, query: { page_size: 10 } }).then((p) => p.data),
  ])
  // One summary row per currency; the app is single-currency, so sum what is there.
  const rows = detail.order_summary
  const dates = rows.flatMap((r) => [r.first_order_at, r.last_order_at]).filter(Boolean).sort()
  return {
    customer: detail.customer,
    totalOrders: rows.reduce((s, r) => s + r.completed_orders, 0),
    totalSpent: fromMinor(rows.reduce((s, r) => s + r.total_spent_minor, 0)),
    firstOrderAt: dates[0] ?? '',
    lastOrderAt: dates[dates.length - 1] ?? '',
    recent: recent.map((o) => ({ orderId: o.order_id, branchId: o.branch_id, number: o.order_number, total: fromMinor(o.total_minor), completedAt: o.completed_at })),
  }
}

/** Saved addresses; the default first. Used by POS delivery orders. */
export async function customerAddresses(id: string): Promise<CustomerAddressResponseDto[]> {
  const rows = await api.listAll<CustomerAddressResponseDto>(`/customers/${id}/addresses`, { branchId: null })
  return [...rows].sort((a, b) => Number(b.is_default) - Number(a.is_default))
}

/* ------------------------------------------------------ profile writes */

/**
 * Register with a caller-held id: a retry of the same id is an idempotent replay
 * (`duplicate: true`) and counts as success. `allowDuplicate` answers a
 * CUSTOMER_POSSIBLE_DUPLICATE (same phone / e-mail as an active customer).
 */
export function registerCustomer(
  input: { name: string; phone?: string; email?: string; notes?: string; marketingConsent?: boolean },
  id: string,
  allowDuplicate = false,
) {
  const body: RegisterCustomerDto = {
    id,
    display_name: input.name.trim(),
    source: 'pos',
    ...compact({
      phone: orBlank(input.phone),
      email: orBlank(input.email),
      notes: orBlank(input.notes),
      marketing_consent: input.marketingConsent,
      allow_duplicate: allowDuplicate || undefined,
    }),
  }
  return api.post<CustomerResponseDto>('/customers', body, { branchId: null })
}

/** Consent changes are audited server-side; version-checked against the latest read. */
export function setMarketingConsent(c: CustomerResponseDto, consent: boolean) {
  const body: UpdateCustomerDto = { expected_version: c.version, marketing_consent: consent }
  return api.patch<CustomerResponseDto>(`/customers/${c.id}`, body, { branchId: null })
}

export const customerProfile = (id: string) => api.get<CustomerDetailResponseDto>(`/customers/${id}`, { branchId: null })

export interface AddressInput {
  label?: string
  line1: string
  line2?: string
  area?: string
  city?: string
  postalCode?: string
  instructions?: string
  isDefault?: boolean
}

export function addAddress(customerId: string, a: AddressInput) {
  const body: AddCustomerAddressDto = {
    line1: a.line1.trim(),
    ...compact({
      label: orBlank(a.label),
      line2: orBlank(a.line2),
      area: orBlank(a.area),
      city: orBlank(a.city),
      postal_code: orBlank(a.postalCode),
      instructions: orBlank(a.instructions),
      is_default: a.isDefault || undefined,
    }),
  }
  return api.post<CustomerAddressResponseDto>(`/customers/${customerId}/addresses`, body, { branchId: null })
}

export function updateAddress(current: CustomerAddressResponseDto, a: AddressInput) {
  const body: UpdateCustomerAddressDto = {
    expected_version: current.version,
    line1: a.line1.trim(),
    ...compact({
      label: orNull(a.label),
      line2: orNull(a.line2),
      area: orNull(a.area),
      city: orNull(a.city),
      postal_code: orNull(a.postalCode),
      instructions: orNull(a.instructions),
      is_default: a.isDefault,
    }),
  }
  return api.patch<CustomerAddressResponseDto>(`/customers/${current.customer_id}/addresses/${current.id}`, body, { branchId: null })
}

export const removeAddress = (a: CustomerAddressResponseDto) =>
  api.delete(`/customers/${a.customer_id}/addresses/${a.id}`, { branchId: null })
