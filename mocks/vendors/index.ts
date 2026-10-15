import type { PurchaseOrder, Vendor, VendorPayment } from '@/types'
import { config } from '@/lib/config'
import { createRng, int, isoDaysAgo, pick } from '@/lib/utils/seed'
import { inventoryItems } from '@/mocks/inventory'

export const vendors: Vendor[] = [
  { id: 'v1', name: 'Al-Madina Meat Traders', category: 'Meat & Poultry', contactPerson: 'Haji Abdul Majeed', phone: '+92 300 1234501', email: 'orders@almadinameat.pk', address: 'Meat Market, Lyari, Karachi', outstanding: 184500, rating: 4.6, onTimeRate: 96, status: 'active', color: 'oklch(0.55 0.2 25)' },
  { id: 'v2', name: 'Karachi Grain House', category: 'Dry Goods & Oils', contactPerson: 'Saeed Memon', phone: '+92 321 1234502', email: 'sales@karachigrain.pk', address: 'Jodia Bazaar, Karachi', outstanding: 92000, rating: 4.3, onTimeRate: 91, status: 'active', color: 'oklch(0.6 0.14 85)' },
  { id: 'v3', name: 'Nestle Dairy Direct', category: 'Dairy', contactPerson: 'Rabia Anwar', phone: '+92 333 1234503', email: 'horeca@dairydirect.pk', address: 'SITE Area, Karachi', outstanding: 0, rating: 4.8, onTimeRate: 99, status: 'active', color: 'oklch(0.6 0.12 230)' },
  { id: 'v4', name: 'Sabzi Mandi Fresh', category: 'Vegetables', contactPerson: 'Ghulam Rasool', phone: '+92 345 1234504', email: 'fresh@sabzimandi.pk', address: 'New Sabzi Mandi, Karachi', outstanding: 38400, rating: 4.1, onTimeRate: 88, status: 'active', color: 'oklch(0.6 0.16 150)' },
  { id: 'v5', name: 'Golden Crust Bakers', category: 'Bakery', contactPerson: 'Naveed Iqbal', phone: '+92 302 1234505', email: 'wholesale@goldencrust.pk', address: 'Nazimabad, Karachi', outstanding: 27600, rating: 4.4, onTimeRate: 94, status: 'active', color: 'oklch(0.65 0.14 60)' },
  { id: 'v6', name: 'Farm Fresh Eggs & Co', category: 'Eggs & Dessert', contactPerson: 'Shabana Kausar', phone: '+92 306 1234506', email: 'info@farmfresheggs.pk', address: 'Malir, Karachi', outstanding: 12000, rating: 3.9, onTimeRate: 84, status: 'active', color: 'oklch(0.7 0.1 95)' },
  { id: 'v7', name: 'Lipton Beverage Distributors', category: 'Beverages', contactPerson: 'Arif Chaudhry', phone: '+92 315 1234507', email: 'distro@liptonbev.pk', address: 'Korangi Industrial, Karachi', outstanding: 66000, rating: 4.5, onTimeRate: 97, status: 'active', color: 'oklch(0.55 0.18 300)' },
  { id: 'v8', name: 'PackRight Supplies', category: 'Packaging', contactPerson: 'Danish Ali', phone: '+92 301 1234508', email: 'sales@packright.pk', address: 'North Karachi Industrial', outstanding: 54200, rating: 4.0, onTimeRate: 90, status: 'active', color: 'oklch(0.5 0.1 250)' },
  { id: 'v9', name: 'National Masala Mart', category: 'Spices', contactPerson: 'Zubair Hashmi', phone: '+92 322 1234509', email: 'orders@nationalmasala.pk', address: 'Empress Market, Karachi', outstanding: 0, rating: 4.7, onTimeRate: 98, status: 'active', color: 'oklch(0.55 0.2 40)' },
  { id: 'v10', name: 'Gas & Cylinder Services', category: 'Utilities', contactPerson: 'Mansoor Khan', phone: '+92 331 1234510', email: 'support@gascylinder.pk', address: 'Landhi, Karachi', outstanding: 22500, rating: 3.7, onTimeRate: 80, status: 'inactive', color: 'oklch(0.5 0.05 265)' },
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
