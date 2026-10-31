import type { Product, TaxRate } from '@/types'

export interface PriceSplit {
  /** What the business keeps. */
  net: number
  /** Tax collected on behalf of the government. */
  tax: number
  /** What the customer pays. */
  gross: number
}

/**
 * Split a price into net, tax and gross.
 * `inclusive`: the price already contains the tax. Otherwise the tax is added on top at checkout.
 */
export function splitPrice(price: number, rate: number, inclusive: boolean): PriceSplit {
  if (rate <= 0) return { net: price, tax: 0, gross: price }
  if (inclusive) {
    const net = price / (1 + rate / 100)
    return { net, tax: price - net, gross: price }
  }
  const tax = (price * rate) / 100
  return { net: price, tax, gross: price + tax }
}

/** The active tax rate charged on a product, or null when it is untaxed or its rate is switched off. */
export const productTaxRate = (product: Pick<Product, 'taxRateId'>, rates: TaxRate[]) =>
  rates.find((r) => r.id === product.taxRateId && r.active) ?? null

/** Net / tax / gross for `amount` sold of a product (defaults to one unit at the menu price). */
export function productPriceSplit(product: Pick<Product, 'taxRateId' | 'basePrice'>, rates: TaxRate[], amount = product.basePrice) {
  const rate = productTaxRate(product, rates)
  return splitPrice(amount, rate?.rate ?? 0, rate?.inclusive ?? false)
}

/** Revenue with or without the tax collected in it. */
export const revenueWithTax = (gross: number, tax: number, includeTax: boolean) => (includeTax ? gross : gross - tax)
