import type { InventoryItem, Product, Recipe, RecipeIngredient } from '@/types'

/** Smaller units a recipe can use for each stock unit, with how many of them make one stock unit. */
const subUnits: Record<string, { unit: string; per: number }[]> = {
  kg: [{ unit: 'g', per: 1000 }],
  L: [{ unit: 'ml', per: 1000 }],
  dozen: [{ unit: 'pcs', per: 12 }],
  loaf: [{ unit: 'slice', per: 12 }],
  case: [{ unit: 'can', per: 24 }],
}

/** Units offered for a stock unit, smallest first because recipes measure single servings. */
export function unitsFor(stockUnit: string) {
  return [...(subUnits[stockUnit] ?? []).map((s) => s.unit), stockUnit]
}

/** Price of one `unit` given the price of one `stockUnit`. Unknown pairs fall back to the stock price. */
export function pricePerUnit(stockUnit: string, stockPrice: number, unit: string) {
  if (unit === stockUnit) return stockPrice
  const sub = subUnits[stockUnit]?.find((s) => s.unit === unit)
  return sub ? stockPrice / sub.per : stockPrice
}

export interface CatalogItem {
  sku: string
  name: string
  category: string
  unit: string
  /** Average cost per stock unit across branches. */
  costPerUnit: number
  kind: InventoryItem['kind']
}

/** Inventory is stocked per branch; recipes refer to an ingredient once, by SKU, at its average price. */
export function ingredientCatalog(items: InventoryItem[]): CatalogItem[] {
  const bySku = new Map<string, { item: InventoryItem; total: number; count: number }>()
  for (const item of items) {
    const entry = bySku.get(item.sku) ?? { item, total: 0, count: 0 }
    entry.total += item.costPerUnit
    entry.count++
    bySku.set(item.sku, entry)
  }
  return [...bySku.values()]
    .map(({ item, total, count }) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      unit: item.unit,
      costPerUnit: total / count,
      kind: item.kind,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function ingredientLineCost(line: RecipeIngredient, catalog: Map<string, CatalogItem>) {
  const stock = line.sku ? catalog.get(line.sku) : undefined
  const unitPrice = stock ? pricePerUnit(stock.unit, stock.costPerUnit, line.unit) : line.costPerUnit
  return line.quantity * unitPrice
}

export interface RecipeCost {
  ingredients: number
  wastage: number
  extras: number
  /** Full cost of one serving. */
  total: number
}

export function recipeCost(recipe: Pick<Recipe, 'ingredients' | 'extras' | 'wastagePct'>, catalog: Map<string, CatalogItem>): RecipeCost {
  const ingredients = recipe.ingredients.reduce((s, l) => s + ingredientLineCost(l, catalog), 0)
  const wastage = (ingredients * recipe.wastagePct) / 100
  const extras = recipe.extras.reduce((s, e) => s + e.amount, 0)
  return { ingredients, wastage, extras, total: ingredients + wastage + extras }
}

export type CostSource = 'recipe' | 'menu'

export interface UnitCost {
  cost: number
  source: CostSource
}

/** Per-serving cost for every product: its costing sheet when one exists, otherwise the cost typed on the menu. */
export function unitCostMap(products: Product[], recipes: Recipe[], catalog: CatalogItem[]) {
  const bySku = new Map(catalog.map((c) => [c.sku, c]))
  const byProduct = new Map(recipes.map((r) => [r.productId, r]))
  return new Map<string, UnitCost>(
    products.map((p) => {
      const r = byProduct.get(p.id)
      return [p.id, r ? { cost: recipeCost(r, bySku).total, source: 'recipe' } : { cost: p.costPrice, source: 'menu' }]
    }),
  )
}

/** Selling price that hits a target food-cost percentage. */
export function suggestedPrice(cost: number, targetCostPct: number) {
  if (targetCostPct <= 0) return 0
  // Round up to the next Rs 10, the way menu prices are usually set.
  return Math.ceil(cost / (targetCostPct / 100) / 10) * 10
}
