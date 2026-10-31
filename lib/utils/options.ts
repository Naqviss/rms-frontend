import { formatCurrency } from '@/lib/utils/format'
import type { Product, ProductOption, ProductOptionGroup } from '@/types'

/** Chosen option indexes, keyed by option group id. */
export type OptionSelection = Record<string, number[]>

export const hasOptions = (p: Product) => p.optionGroups.some((g) => g.options.length > 0)

/** First choice of every pick-one group, nothing from pick-any groups. */
export const defaultSelection = (groups: ProductOptionGroup[]): OptionSelection =>
  Object.fromEntries(groups.map((g) => [g.id, g.type === 'single' && g.options.length ? [0] : []]))

export const chosenOptions = (groups: ProductOptionGroup[], sel: OptionSelection): ProductOption[] =>
  groups.flatMap((g) => (sel[g.id] ?? []).flatMap((i) => (g.options[i] ? [g.options[i]] : [])))

export const selectionPrice = (basePrice: number, groups: ProductOptionGroup[], sel: OptionSelection) =>
  basePrice + chosenOptions(groups, sel).reduce((s, o) => s + o.price, 0)

/** Cheapest and most expensive way to order the item. */
export function priceRange(basePrice: number, groups: ProductOptionGroup[]) {
  let min = basePrice
  let max = basePrice
  for (const g of groups) {
    const prices = g.options.map((o) => o.price)
    if (prices.length === 0) continue
    if (g.type === 'single') {
      min += Math.min(...prices)
      max += Math.max(...prices)
    } else {
      max += prices.filter((p) => p > 0).reduce((s, p) => s + p, 0)
    }
  }
  return { min, max }
}

/** "+Rs 350", "-Rs 300", or empty for free choices. */
export const formatOptionPrice = (price: number) => (price > 0 ? `+${formatCurrency(price)}` : price < 0 ? `-${formatCurrency(-price)}` : '')
