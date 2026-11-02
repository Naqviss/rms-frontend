import type { InventoryItem, Product } from '@/types'

/** `stock`: average price paid for the product across stores' stock. `catalog`: the cost price typed on the product. */
export type CostSource = 'stock' | 'catalog'

export interface UnitCost {
  cost: number
  source: CostSource
}

/** Cost of one unit of every product: what was paid for it on the shelf where it is stocked, otherwise its catalogue cost price. */
export function unitCostMap(products: Product[], inventory: InventoryItem[]) {
  const paid = new Map<string, { total: number; count: number }>()
  for (const item of inventory) {
    if (!item.productId) continue
    const entry = paid.get(item.productId) ?? { total: 0, count: 0 }
    entry.total += item.costPerUnit
    entry.count++
    paid.set(item.productId, entry)
  }
  return new Map<string, UnitCost>(
    products.map((p) => {
      const stock = paid.get(p.id)
      return [p.id, stock ? { cost: stock.total / stock.count, source: 'stock' } : { cost: p.costPrice, source: 'catalog' }]
    }),
  )
}
