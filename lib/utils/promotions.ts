import type { Discount, OrderItem, Product, PromoSchedule, SalesChannel } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils/format'

export type PromoStatus = 'live' | 'scheduled' | 'expired' | 'paused' | 'used-up'

export const PROMO_STATUS: Record<PromoStatus, { label: string; tone: 'success' | 'info' | 'neutral' | 'warning' }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  expired: { label: 'Expired', tone: 'neutral' },
  paused: { label: 'Paused', tone: 'neutral' },
  'used-up': { label: 'Used up', tone: 'warning' },
}

const pad = (n: number) => String(n).padStart(2, '0')
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Where the promo is in its life: switched off, not started, finished, or running. */
export function promoStatus(p: PromoSchedule & { usageLimit?: number; used?: number }, now = new Date()): PromoStatus {
  if (!p.active) return 'paused'
  const today = localDate(now)
  if (p.endDate && p.endDate < today) return 'expired'
  if (p.startDate > today) return 'scheduled'
  if (p.usageLimit && (p.used ?? 0) >= p.usageLimit) return 'used-up'
  return 'live'
}

const CHANNEL_NAMES: Record<SalesChannel, string> = {
  'dine-in': 'Dine-in',
  takeaway: 'Takeaway',
  'own-delivery': 'Delivery',
  foodpanda: 'Foodpanda',
  website: 'Website',
}

/** "From 1 Dec 2026 · until 31 Dec 2026"; "No end date" when it has started and never ends. */
export function describeSchedule(p: PromoSchedule) {
  const parts: string[] = []
  const today = localDate(new Date())
  if (p.startDate > today) parts.push(`from ${formatDate(p.startDate)}`)
  if (p.endDate) parts.push(`${p.endDate < today ? 'ended' : 'until'} ${formatDate(p.endDate)}`)
  if (!parts.length) return 'No end date'
  parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1)
  return parts.join(' · ')
}

/** Why the promo cannot be used right now at this branch and channel, or null when it can. */
export function unavailableReason(p: PromoSchedule & { usageLimit?: number; used?: number }, branchId: string, channel: SalesChannel, now = new Date()) {
  const status = promoStatus(p, now)
  if (status !== 'live') return PROMO_STATUS[status].label
  if (p.branchId !== 'all' && p.branchId !== branchId) return 'Other branch'
  if (p.channel !== 'all' && p.channel !== channel) return `${CHANNEL_NAMES[p.channel]} only`
  return null
}

export function describeDiscount(d: Pick<Discount, 'kind' | 'value' | 'maxAmount'>) {
  if (d.kind === 'fixed') return `${formatCurrency(d.value)} off`
  return d.maxAmount ? `${d.value}% off, up to ${formatCurrency(d.maxAmount)}` : `${d.value}% off`
}

/**
 * What a discount takes off a cart.
 * `reason` explains a zero amount (nothing qualifying, or below the minimum spend).
 */
export function discountFor(d: Discount, lines: OrderItem[], products: Product[]) {
  const categoryOf = new Map(products.map((p) => [p.id, p.categoryId]))
  const covered = lines.filter(
    (l) =>
      (d.scope === 'order' || (d.scope === 'product' ? l.productId === d.targetId : categoryOf.get(l.productId) === d.targetId)),
  )
  const base = covered.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  if (base === 0) return { amount: 0, reason: 'No qualifying items' }
  if (base < d.minOrder) return { amount: 0, reason: `Add ${formatCurrency(d.minOrder - base)} more` }
  let amount = d.kind === 'percent' ? (base * d.value) / 100 : d.value
  if (d.kind === 'percent' && d.maxAmount) amount = Math.min(amount, d.maxAmount)
  return { amount: Math.round(Math.min(amount, base)), reason: null }
}
