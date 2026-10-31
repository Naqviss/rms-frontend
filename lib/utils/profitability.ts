import type { Order, Product, TaxRate } from '@/types'
import type { CostSource, UnitCost } from '@/lib/utils/costing'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format'
import { productPriceSplit } from '@/lib/utils/tax'

/** How sales tax is treated: the rates products are taxed at, and whether collected tax counts as income. */
export interface TaxView {
  rates: TaxRate[]
  include: boolean
}

export interface ItemProfit {
  id: string
  name: string
  categoryId: string
  image: string
  units: number
  /**
   * Money taken for the item (quantity x selling price, before order-level discount), net of tax.
   * Includes the tax collected on it when the tax view says to.
   */
  income: number
  /** Sales tax collected on the item, whether or not it is counted in `income`. */
  tax: number
  /** Direct cost of everything sold: units x cost per serving (costing sheet, or the menu cost price). */
  itemCost: number
  /** Where the per-serving cost came from. */
  costSource: CostSource
  /** The item's share of running costs (rent, salaries, utilities...), allocated in proportion to its income. */
  overhead: number
  expense: number
  expensePerUnit: number
  profit: number
  profitPerUnit: number
  /** Profit as a percentage of income. */
  margin: number
  /** This item's share of the profit made by all items, in percent. */
  profitShare: number
}

export interface ProfitSummary {
  items: ItemProfit[]
  income: number
  tax: number
  expense: number
  profit: number
  /** Direct item cost as a share of item income (0-1). */
  foodCostRate: number
  hero: ItemProfit | null
  bestMargin: ItemProfit | null
  bestSeller: ItemProfit | null
  /** Lowest-margin item that still sells, i.e. the one to reprice or re-cost first. */
  weakest: ItemProfit | null
}

/** Running cost as a share of sales once ingredients are taken out: total cost ratio minus food cost ratio. */
export function overheadRateFrom(totalRevenue: number, totalExpenses: number, foodCostRate: number) {
  if (totalRevenue <= 0) return 0
  return Math.max(0, totalExpenses / totalRevenue - foodCostRate)
}

/**
 * Per-item income, expense and profit from sold order lines.
 * Expense per item = direct cost per serving (from `unitCosts`, else the menu cost price)
 * + overhead allocated at `overheadRate` of the item's net (tax-free) income.
 * Without a `tax` view, prices are treated as untaxed.
 * The hero item is the one that contributes the most total profit.
 */
export function itemProfitability(
  orders: Order[],
  products: Product[],
  overheadRate: number,
  unitCosts?: Map<string, UnitCost>,
  tax?: TaxView,
): ProfitSummary {
  const byId = new Map(products.map((p) => [p.id, p]))
  const sold = new Map<string, { units: number; net: number; tax: number }>()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    for (const line of o.items) {
      const s = sold.get(line.productId) ?? { units: 0, net: 0, tax: 0 }
      const amount = line.quantity * line.unitPrice
      const p = byId.get(line.productId)
      const split = tax && p ? productPriceSplit(p, tax.rates, amount) : { net: amount, tax: 0 }
      s.units += line.quantity
      s.net += split.net
      s.tax += split.tax
      sold.set(line.productId, s)
    }
  }

  let net = 0
  const rows = [...sold.entries()].flatMap(([id, s]) => {
    const p = byId.get(id)
    if (!p || s.units === 0) return []
    net += s.net
    const income = s.net + (tax?.include ? s.tax : 0)
    const unit = unitCosts?.get(id) ?? { cost: p.costPrice, source: 'menu' as const }
    const itemCost = s.units * unit.cost
    const overhead = s.net * overheadRate
    const expense = itemCost + overhead
    const profit = income - expense
    return [
      {
        id,
        name: p.name,
        categoryId: p.categoryId,
        image: p.image,
        units: s.units,
        income,
        tax: s.tax,
        itemCost,
        costSource: unit.source,
        overhead,
        expense,
        expensePerUnit: expense / s.units,
        profit,
        profitPerUnit: profit / s.units,
        margin: income ? (profit / income) * 100 : 0,
        profitShare: 0,
      },
    ]
  })

  const income = rows.reduce((t, r) => t + r.income, 0)
  const expense = rows.reduce((t, r) => t + r.expense, 0)
  const direct = rows.reduce((t, r) => t + r.itemCost, 0)
  const positive = rows.reduce((t, r) => t + Math.max(0, r.profit), 0)
  for (const r of rows) r.profitShare = positive ? (Math.max(0, r.profit) / positive) * 100 : 0

  const items = rows.sort((a, b) => b.profit - a.profit)
  const top = <K extends keyof ItemProfit>(key: K, dir: 1 | -1 = 1) =>
    items.length ? items.reduce((best, r) => ((r[key] as number) * dir > (best[key] as number) * dir ? r : best)) : null

  return {
    items,
    income,
    tax: rows.reduce((t, r) => t + r.tax, 0),
    expense,
    profit: income - expense,
    foodCostRate: net ? direct / net : 0,
    hero: items[0] ?? null,
    bestMargin: top('margin'),
    bestSeller: top('units'),
    weakest: top('margin', -1),
  }
}

/**
 * Item profitability with overhead derived from the period's P&L (see `overheadRateFrom`),
 * unless `overrideRate` pins it to a fixed share of income.
 */
export function profitabilityWithOverhead(
  orders: Order[],
  products: Product[],
  pl: { revenue: number; expenses: number },
  overrideRate: number | null = null,
  unitCosts?: Map<string, UnitCost>,
  tax?: TaxView,
) {
  const base = itemProfitability(orders, products, 0, unitCosts, tax)
  const autoRate = overheadRateFrom(pl.revenue, pl.expenses, base.foodCostRate)
  const rate = overrideRate ?? autoRate
  return { ...itemProfitability(orders, products, rate, unitCosts, tax), rate, autoRate }
}

export type RankMetric = 'profit' | 'profitPerUnit' | 'units' | 'margin'

export const RANK_METRICS: { value: RankMetric; label: string; hint: string }[] = [
  { value: 'profit', label: 'Total profit', hint: 'Profit earned across all units sold' },
  { value: 'profitPerUnit', label: 'Profit per item sold', hint: 'Profit on each serving' },
  { value: 'units', label: 'Units sold (count)', hint: 'How many were sold' },
  { value: 'margin', label: 'Profit margin %', hint: 'Profit as a share of the selling price' },
]

/** Items ordered best-first by the chosen metric; ties fall back to total profit. */
export function rankItems<T extends ItemProfit>(items: T[], metric: RankMetric): T[] {
  return [...items].sort((a, b) => b[metric] - a[metric] || b.profit - a.profit)
}

/** The value an item is ranked on, formatted for display. */
export function metricValue(item: ItemProfit, metric: RankMetric) {
  if (metric === 'units') return `${formatNumber(item.units)} sold`
  if (metric === 'margin') return formatPercent(item.margin)
  if (metric === 'profitPerUnit') return `${formatCurrency(item.profitPerUnit)}/item`
  return formatCurrency(item.profit)
}
