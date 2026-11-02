import type { InventoryItem, StockMovement } from '@/types'
import { config } from '@/lib/config'
import { createRng, int, isoDaysAgo, pick } from '@/lib/utils/seed'
import { categories, products } from '@/mocks/catalog'

/** Supplier for each catalogue category; store supplies come from v9. */
const vendorByCategory: Record<string, string> = { c1: 'v1', c2: 'v2', c3: 'v3', c4: 'v4', c5: 'v5', c6: 'v6', c7: 'v7', c8: 'v8' }
const perishable = new Set(['c2', 'c5', 'c6'])

interface StockSeed {
  productId: string | null
  name: string
  sku: string
  category: string
  unit: string
  cost: number
  min: number
  kind: InventoryItem['kind']
  vendorId: string
  perishable: boolean
  image: string
}

const productStock: StockSeed[] = products.map((p, i) => ({
  productId: p.id,
  name: p.name,
  sku: p.sku,
  category: categories.find((c) => c.id === p.categoryId)?.name ?? 'Other',
  unit: p.soldBy === 'weight' ? 'kg' : p.packSize === 'per dozen' ? 'dozen' : 'pcs',
  cost: p.costPrice,
  // Fast movers (cheap staples, milk, bread) need a deeper shelf than slow lines like diapers.
  min: p.soldBy === 'weight' ? 25 : p.basePrice < 300 ? 36 + (i % 3) * 12 : p.basePrice < 1000 ? 18 : 8,
  kind: p.soldBy === 'weight' ? 'loose' : 'retail',
  vendorId: vendorByCategory[p.categoryId] ?? 'v1',
  perishable: perishable.has(p.categoryId),
  image: p.image,
}))

const supplies: StockSeed[] = [
  ['Shopping bags (small)', 'SUP-001', 'pcs', 3, 500],
  ['Shopping bags (large)', 'SUP-002', 'pcs', 6, 300],
  ['Receipt paper rolls (80mm)', 'SUP-003', 'roll', 180, 20],
  ['Shelf price labels', 'SUP-004', 'sheet', 45, 30],
].map(([name, sku, unit, cost, min]) => ({
  productId: null,
  name: String(name),
  sku: String(sku),
  category: 'Store supplies',
  unit: String(unit),
  cost: Number(cost),
  min: Number(min),
  kind: 'supplies' as const,
  vendorId: 'v9',
  perishable: false,
  image: '/mart/supplies.svg',
}))

const base = [...productStock, ...supplies]
const branchIds = ['b1', 'b2', 'b3']

export const inventoryItems: InventoryItem[] = branchIds.flatMap((branchId, bi) => {
  const rng = createRng(1000 + bi * 77)
  return base.map((b) => {
    const state = rng()
    const quantity =
      state < 0.1 ? 0 : state < 0.28 ? Math.round(b.min * (0.3 + rng() * 0.6)) : Math.round(b.min * (1.4 + rng() * 3.2))
    const expiry = b.perishable && state > 0.5 && state < 0.62 ? isoDaysAgo(config.referenceDate, -int(rng, 1, 4)) : b.perishable ? isoDaysAgo(config.referenceDate, -int(rng, 6, 20)) : null
    return {
      id: `inv-${b.sku}-${branchId}`,
      name: b.name,
      sku: b.sku,
      category: b.category,
      quantity,
      unit: b.unit,
      minStock: b.min,
      costPerUnit: b.cost,
      branchId,
      vendorId: b.vendorId,
      expiryDate: expiry ? expiry.slice(0, 10) : null,
      kind: b.kind,
      productId: b.productId,
      image: b.image,
    }
  })
})

const movementTypes = ['purchase', 'sale', 'sale', 'wastage', 'adjustment', 'transfer'] as const
const staff = ['Faisal Ahmed', 'Nadia Hussain', 'Bilal Sheikh', 'Kashif Ali']
const notes: Record<(typeof movementTypes)[number], string[]> = {
  purchase: ['Weekly vendor delivery', 'Emergency top-up', 'Bulk order received'],
  sale: ['Counter sales', 'Evening rush sales', 'Delivery orders packed'],
  wastage: ['Expired stock removed', 'Damaged in handling', 'Leaking packs written off'],
  adjustment: ['Shelf count correction', 'Monthly stock audit'],
  transfer: ['Transfer to Gulshan store', 'Transfer from Clifton store'],
}

export const stockMovements: StockMovement[] = (() => {
  const rng = createRng(4242)
  return Array.from({ length: 48 }, (_, i) => {
    const item = pick(rng, inventoryItems)
    const type = pick(rng, movementTypes)
    const qty = Math.max(1, Math.round(item.minStock * (0.2 + rng() * 0.8)))
    return {
      id: `mv-${i + 1}`,
      itemId: item.id,
      itemName: item.name,
      type,
      quantity: type === 'purchase' ? qty : -qty,
      unit: item.unit,
      branchId: item.branchId,
      date: isoDaysAgo(config.referenceDate, Math.floor(i / 4), int(rng, 8, 21), int(rng, 0, 59)),
      note: pick(rng, notes[type]),
      by: pick(rng, staff),
    }
  }).sort((a, b) => b.date.localeCompare(a.date))
})()

export function stockStatus(item: InventoryItem): 'in-stock' | 'low' | 'out' | 'expiring' {
  if (item.quantity <= 0) return 'out'
  if (item.expiryDate) {
    const days = (new Date(item.expiryDate).getTime() - new Date(config.referenceDate).getTime()) / 86400000
    if (days <= 4) return 'expiring'
  }
  if (item.quantity <= item.minStock) return 'low'
  return 'in-stock'
}
