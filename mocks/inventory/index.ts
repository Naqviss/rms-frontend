import type { InventoryItem, StockMovement } from '@/types'
import { config } from '@/lib/config'
import { createRng, int, isoDaysAgo, pick } from '@/lib/utils/seed'

type BaseItem = [name: string, category: string, unit: string, cost: number, min: number, kind: InventoryItem['kind'], vendorId: string, perishable: boolean, image: string]

const base: BaseItem[] = [
  ['Chicken breast', 'Meat', 'kg', 620, 20, 'ingredient', 'v1', true, '/food/burgers.png'],
  ['Beef mince', 'Meat', 'kg', 1450, 15, 'ingredient', 'v1', true, '/food/burgers.png'],
  ['Mutton', 'Meat', 'kg', 2600, 10, 'ingredient', 'v1', true, '/food/desi.png'],
  ['Basmati rice', 'Dry goods', 'kg', 380, 40, 'ingredient', 'v2', false, '/food/desi.png'],
  ['Wheat flour (maida)', 'Dry goods', 'kg', 140, 50, 'raw-material', 'v2', false, '/food/pizza.png'],
  ['Cooking oil', 'Oils', 'L', 520, 30, 'raw-material', 'v2', false, '/food/desi.png'],
  ['Mozzarella cheese', 'Dairy', 'kg', 1650, 12, 'ingredient', 'v3', true, '/food/pizza.png'],
  ['Cheddar slices', 'Dairy', 'kg', 1400, 8, 'ingredient', 'v3', true, '/food/burgers.png'],
  ['Fresh milk', 'Dairy', 'L', 210, 40, 'ingredient', 'v3', true, '/food/beverages.png'],
  ['Yogurt (dahi)', 'Dairy', 'kg', 260, 20, 'ingredient', 'v3', true, '/food/beverages.png'],
  ['Tomatoes', 'Vegetables', 'kg', 120, 25, 'ingredient', 'v4', true, '/food/pizza.png'],
  ['Onions', 'Vegetables', 'kg', 90, 40, 'ingredient', 'v4', false, '/food/desi.png'],
  ['Lettuce', 'Vegetables', 'kg', 220, 10, 'ingredient', 'v4', true, '/food/sandwiches.png'],
  ['Capsicum', 'Vegetables', 'kg', 280, 8, 'ingredient', 'v4', true, '/food/pizza.png'],
  ['Burger buns', 'Bakery', 'pcs', 38, 150, 'raw-material', 'v5', true, '/food/burgers.png'],
  ['Sandwich bread', 'Bakery', 'loaf', 160, 30, 'raw-material', 'v5', true, '/food/sandwiches.png'],
  ['Eggs', 'Dairy', 'dozen', 360, 20, 'ingredient', 'v6', true, '/food/sandwiches.png'],
  ['Tea leaves', 'Beverages', 'kg', 1450, 6, 'ingredient', 'v7', false, '/food/beverages.png'],
  ['Sugar', 'Dry goods', 'kg', 170, 30, 'raw-material', 'v2', false, '/food/desserts.png'],
  ['Soft drink cans', 'Beverages', 'case', 1900, 12, 'ingredient', 'v7', false, '/food/beverages.png'],
  ['Takeaway boxes (L)', 'Packaging', 'pcs', 28, 300, 'packaging', 'v8', false, '/food/burgers.png'],
  ['Pizza boxes (13")', 'Packaging', 'pcs', 55, 150, 'packaging', 'v8', false, '/food/pizza.png'],
  ['Paper cups (12oz)', 'Packaging', 'pcs', 9, 500, 'packaging', 'v8', false, '/food/beverages.png'],
  ['Chocolate (cooking)', 'Dessert', 'kg', 1250, 5, 'ingredient', 'v6', false, '/food/desserts.png'],
  ['Red chili powder', 'Spices', 'kg', 780, 8, 'ingredient', 'v9', false, '/food/desi.png'],
  ['Garam masala', 'Spices', 'kg', 1650, 5, 'ingredient', 'v9', false, '/food/desi.png'],
]

const branchIds = ['b1', 'b2', 'b3']

export const inventoryItems: InventoryItem[] = branchIds.flatMap((branchId, bi) => {
  const rng = createRng(1000 + bi * 77)
  return base.map(([name, category, unit, costPerUnit, minStock, kind, vendorId, perishable, image], i) => {
    const state = rng()
    const quantity =
      state < 0.14 ? 0 : state < 0.32 ? Math.round(minStock * (0.3 + rng() * 0.6)) : Math.round(minStock * (1.4 + rng() * 3.2))
    const expiry = perishable && state > 0.5 && state < 0.62 ? isoDaysAgo(config.referenceDate, -int(rng, 1, 4)) : perishable ? isoDaysAgo(config.referenceDate, -int(rng, 6, 20)) : null
    return {
      id: `inv-${i + 1}-${branchId}`,
      name,
      sku: `INV-${String(i + 1).padStart(3, '0')}`,
      category,
      quantity,
      unit,
      minStock,
      costPerUnit,
      branchId,
      vendorId,
      expiryDate: expiry ? expiry.slice(0, 10) : null,
      kind,
      image,
    }
  })
})

const movementTypes = ['purchase', 'consumption', 'consumption', 'wastage', 'adjustment', 'transfer'] as const
const staff = ['Faisal Ahmed', 'Nadia Hussain', 'Bilal Sheikh', 'Kashif Ali']
const notes: Record<(typeof movementTypes)[number], string[]> = {
  purchase: ['Weekly vendor delivery', 'Emergency top-up', 'Bulk order received'],
  consumption: ['Daily kitchen usage', 'Prep for dinner service', 'Lunch rush usage'],
  wastage: ['Spoiled in storage', 'Dropped during prep', 'Expired stock removed'],
  adjustment: ['Stock count correction', 'Audit adjustment'],
  transfer: ['Transfer to Gulshan branch', 'Transfer from Clifton branch'],
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
