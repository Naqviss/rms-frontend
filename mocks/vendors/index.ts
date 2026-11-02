import type { PurchaseOrder, Vendor, VendorPayment } from '@/types'
import { config } from '@/lib/config'
import { createRng, int, isoDaysAgo, pick } from '@/lib/utils/seed'
import { inventoryItems } from '@/mocks/inventory'

export const vendors: Vendor[] = [
  { id: 'v1', name: 'Karachi Grain House', category: 'Grocery & Staples', contactPerson: 'Saeed Memon', phone: '+92 321 1234501', email: 'sales@karachigrain.pk', address: 'Jodia Bazaar, Karachi', outstanding: 284500, rating: 4.4, onTimeRate: 93, status: 'active', color: 'oklch(0.6 0.14 85)' },
  { id: 'v2', name: 'Fresh Dairy Distributors', category: 'Dairy & Eggs', contactPerson: 'Rabia Anwar', phone: '+92 333 1234502', email: 'orders@freshdairy.pk', address: 'SITE Area, Karachi', outstanding: 0, rating: 4.8, onTimeRate: 99, status: 'active', color: 'oklch(0.6 0.12 230)' },
  { id: 'v3', name: 'Metro Beverage Distributors', category: 'Beverages', contactPerson: 'Arif Chaudhry', phone: '+92 315 1234503', email: 'distro@metrobev.pk', address: 'Korangi Industrial Area, Karachi', outstanding: 96000, rating: 4.5, onTimeRate: 97, status: 'active', color: 'oklch(0.55 0.18 300)' },
  { id: 'v4', name: 'Sweet Treats Wholesale', category: 'Snacks & Sweets', contactPerson: 'Naveed Iqbal', phone: '+92 302 1234504', email: 'wholesale@sweettreats.pk', address: 'Bolton Market, Karachi', outstanding: 41200, rating: 4.2, onTimeRate: 90, status: 'active', color: 'oklch(0.6 0.18 10)' },
  { id: 'v5', name: 'Golden Crust Bakers', category: 'Bakery & Breakfast', contactPerson: 'Shabana Kausar', phone: '+92 306 1234505', email: 'supply@goldencrust.pk', address: 'Nazimabad, Karachi', outstanding: 27600, rating: 4.4, onTimeRate: 95, status: 'active', color: 'oklch(0.65 0.14 60)' },
  { id: 'v6', name: 'Sabzi Mandi Fresh', category: 'Fruits & Vegetables', contactPerson: 'Ghulam Rasool', phone: '+92 345 1234506', email: 'fresh@sabzimandi.pk', address: 'New Sabzi Mandi, Super Highway, Karachi', outstanding: 38400, rating: 4.0, onTimeRate: 86, status: 'active', color: 'oklch(0.6 0.16 150)' },
  { id: 'v7', name: 'CarePlus Distributors', category: 'Personal Care', contactPerson: 'Danish Ali', phone: '+92 301 1234507', email: 'orders@careplus.pk', address: 'Shershah, Karachi', outstanding: 118000, rating: 4.6, onTimeRate: 96, status: 'active', color: 'oklch(0.6 0.12 190)' },
  { id: 'v8', name: 'CleanHome Traders', category: 'Household & Cleaning', contactPerson: 'Zubair Hashmi', phone: '+92 322 1234508', email: 'sales@cleanhome.pk', address: 'Saddar, Karachi', outstanding: 54200, rating: 4.1, onTimeRate: 89, status: 'active', color: 'oklch(0.55 0.15 255)' },
  { id: 'v9', name: 'PackRight Supplies', category: 'Bags & store supplies', contactPerson: 'Mansoor Khan', phone: '+92 331 1234509', email: 'sales@packright.pk', address: 'North Karachi Industrial Area', outstanding: 12500, rating: 4.3, onTimeRate: 92, status: 'active', color: 'oklch(0.5 0.08 250)' },
  { id: 'v10', name: 'CoolTech Refrigeration', category: 'Chiller maintenance', contactPerson: 'Haji Abdul Majeed', phone: '+92 300 1234510', email: 'service@cooltech.pk', address: 'Landhi, Karachi', outstanding: 22500, rating: 3.7, onTimeRate: 80, status: 'inactive', color: 'oklch(0.5 0.05 265)' },
]

const statuses = ['received', 'received', 'received', 'sent', 'draft', 'cancelled'] as const

export const purchaseOrders: PurchaseOrder[] = (() => {
  const rng = createRng(909)
  return Array.from({ length: 16 }, (_, i) => {
    const vendor = pick(rng, vendors.filter((v) => v.status === 'active'))
    const pool = inventoryItems.filter((it) => it.vendorId === vendor.id && it.branchId === 'b1')
    const picked = pool.slice(0, Math.max(1, Math.min(3, pool.length)))
    const items = picked.map((it) => ({
      itemId: it.id,
      name: it.name,
      quantity: Math.round(it.minStock * (1 + rng())),
      unit: it.unit,
      unitCost: it.costPerUnit,
    }))
    return {
      id: `po-${1040 + i}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      items,
      total: items.reduce((s, it) => s + it.quantity * it.unitCost, 0),
      status: pick(rng, statuses),
      createdAt: isoDaysAgo(config.referenceDate, i * 2 + int(rng, 0, 1), 10),
      branchId: pick(rng, ['b1', 'b2', 'b3']),
    }
  })
})()

export const vendorPayments: VendorPayment[] = (() => {
  const rng = createRng(31)
  return Array.from({ length: 14 }, (_, i) => ({
    id: `vp-${i + 1}`,
    vendorId: pick(rng, vendors).id,
    amount: int(rng, 20, 180) * 1000,
    date: isoDaysAgo(config.referenceDate, i * 3 + 1, 15),
    method: pick(rng, ['cash', 'card', 'online'] as const),
    reference: `PAY-${5000 + i}`,
  }))
})()
