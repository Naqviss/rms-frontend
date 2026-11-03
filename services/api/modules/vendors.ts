/**
 * Vendors — `/api/vendors` (+ `/{id}` detail, `/{id}/contacts`, `/{id}/items`), tenant-wide.
 *
 *  - The list endpoint has no contacts, so each vendor's detail is read for the contact person
 *    (primary contact) and for the inventory items it supplies (used by the inventory adapter).
 *  - Contacts cannot be edited: changing the contact person adds a new primary contact and
 *    removes the previous one.
 *  - No DELETE exists: "remove" deactivates the vendor.
 *  - Category, outstanding balance, rating and on-time rate have no backend source.
 *  - Purchase orders and vendor payments have no API, so those stay unavailable.
 */
import { api } from '@/services/api/client'
import { apiRepository, unavailableRepository, UnsupportedOperationError, versionOf } from '@/services/api/adapter'
import { colorFor, compact } from '@/services/api/mappers'
import type {
  CreateVendorContactDto,
  CreateVendorDto,
  UpdateVendorDto,
  VendorItemDto,
  VendorItemResponseDto,
  VendorResponseDto,
} from '@/services/api/generated/schemas'
import type { PurchaseOrder, Vendor, VendorPayment } from '@/types'

const tenantWide = { branchId: null } as const

const getVendor = (id: string) => api.get<VendorResponseDto>(`/vendors/${id}`, tenantWide)

/** Every vendor with contacts and supplied items. One short-lived load is shared by concurrent callers. */
let pending: { at: number; promise: Promise<VendorResponseDto[]> } | null = null
export function loadVendorDetails(): Promise<VendorResponseDto[]> {
  if (pending && Date.now() - pending.at < 5_000) return pending.promise
  const promise = (async () => {
    const rows = await api.listAll<VendorResponseDto>('/vendors', tenantWide)
    return Promise.all(rows.map((v) => getVendor(v.id).catch(() => v)))
  })()
  pending = { at: Date.now(), promise }
  promise.catch(() => (pending = null))
  return promise
}
const invalidate = () => (pending = null)

/** inventory item id → the vendor that supplies it (preferred link first). */
export async function supplierByItem(): Promise<Map<string, { vendorId: string; link: VendorItemResponseDto }>> {
  const map = new Map<string, { vendorId: string; link: VendorItemResponseDto }>()
  for (const v of await loadVendorDetails()) {
    for (const link of v.items ?? []) {
      const seen = map.get(link.inventory_item_id)
      if (!seen || (!seen.link.is_preferred && link.is_preferred)) map.set(link.inventory_item_id, { vendorId: v.id, link })
    }
  }
  return map
}

/** Mark `vendorId` as the preferred supplier of an inventory item. */
export async function linkSupplier(vendorId: string, inventoryItemId: string) {
  const body: VendorItemDto = { inventory_item_id: inventoryItemId, is_preferred: true }
  const link = await api.put<VendorItemResponseDto>(`/vendors/${vendorId}/items`, body, tenantWide)
  invalidate()
  return link
}

export async function unlinkSupplier(vendorId: string, vendorItemId: string) {
  await api.delete(`/vendors/${vendorId}/items/${vendorItemId}`, tenantWide)
  invalidate()
}

const primaryContact = (d: VendorResponseDto) => d.contacts?.find((c) => c.is_primary) ?? d.contacts?.[0]

const toUi = (d: VendorResponseDto): Vendor => ({
  id: d.id,
  name: d.name,
  category: '',
  contactPerson: primaryContact(d)?.name ?? '',
  phone: d.phone ?? '',
  email: d.email ?? '',
  address: d.address ?? '',
  outstanding: 0,
  rating: 0,
  onTimeRate: 0,
  status: d.is_active ? 'active' : 'inactive',
  color: colorFor(d.id),
})

const VENDOR_LOCAL: (keyof Vendor)[] = ['category', 'outstanding', 'rating', 'onTimeRate', 'color']

async function addPrimaryContact(vendorId: string, name: string) {
  const body: CreateVendorContactDto = { name, is_primary: true }
  await api.post(`/vendors/${vendorId}/contacts`, body, tenantWide)
}

export const vendors = apiRepository<Vendor, VendorResponseDto>({
  name: 'Vendors',
  toUi,
  list: loadVendorDetails,
  get: getVendor,
  create: async (input) => {
    const body: CreateVendorDto = {
      name: input.name,
      ...compact({ phone: input.phone || undefined, email: input.email || undefined, address: input.address || undefined }),
    }
    const created = await api.post<VendorResponseDto>('/vendors', body, tenantWide)
    invalidate()
    if (input.contactPerson.trim()) await addPrimaryContact(created.id, input.contactPerson.trim())
    if (input.status === 'inactive') {
      await api.patch(`/vendors/${created.id}`, { expected_version: created.version, is_active: false } satisfies UpdateVendorDto, tenantWide)
    }
    return getVendor(created.id)
  },
  update: async (id, patch, current) => {
    const before = current?.ui
    const changed = (k: keyof Vendor) => patch[k] !== undefined && patch[k] !== before?.[k]
    const body: UpdateVendorDto = {
      expected_version: versionOf(current),
      ...compact({
        name: changed('name') ? patch.name : undefined,
        phone: changed('phone') ? patch.phone || null : undefined,
        email: changed('email') ? patch.email || null : undefined,
        address: changed('address') ? patch.address || null : undefined,
        is_active: changed('status') ? patch.status === 'active' : undefined,
      }),
    }
    const contactChanged = changed('contactPerson')
    if (Object.keys(body).length === 1 && !contactChanged) {
      const local = VENDOR_LOCAL.filter(changed)
      if (local.length) throw new UnsupportedOperationError('Vendors', `change ${local.join(', ')}`)
      return current?.dto ?? getVendor(id)
    }
    if (Object.keys(body).length > 1) await api.patch<VendorResponseDto>(`/vendors/${id}`, body, tenantWide)
    if (contactChanged) {
      const old = current ? primaryContact(current.dto) : undefined
      const name = patch.contactPerson!.trim()
      if (name) await addPrimaryContact(id, name)
      if (old) await api.delete(`/vendors/${id}/contacts/${old.id}`, tenantWide)
    }
    invalidate()
    return getVendor(id)
  },
  remove: async (id, current) => {
    await api.patch(`/vendors/${id}`, { expected_version: versionOf(current), is_active: false } satisfies UpdateVendorDto, tenantWide)
    invalidate()
  },
})

export const purchaseOrders = unavailableRepository<PurchaseOrder>('Purchase orders')
export const vendorPayments = unavailableRepository<VendorPayment>('Vendor payments')
