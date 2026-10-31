import type { Deal, Discount, OrderItem, Product, PromoSchedule, SalesChannel } from '@/types'
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
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Where the promo is in its life: switched off, not started, finished, or running. Ignores the day/time window. */
export function promoStatus(p: PromoSchedule & { usageLimit?: number; used?: number }, now = new Date()): PromoStatus {
  if (!p.active) return 'paused'
  const today = localDate(now)
  if (p.endDate && p.endDate < today) return 'expired'
  if (p.startDate > today) return 'scheduled'
  if (p.usageLimit && (p.used ?? 0) >= p.usageLimit) return 'used-up'
  return 'live'
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CHANNEL_NAMES: Record<SalesChannel, string> = {
  'dine-in': 'Dine-in',
  takeaway: 'Takeaway',
  'own-delivery': 'Delivery',
  foodpanda: 'Foodpanda',
  website: 'Website',
}

/** Weekday presets offered in forms. */
export const DAY_PRESETS: { value: string; label: string; days: number[] }[] = [
  { value: 'every', label: 'Every day', days: [] },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)', days: [1, 2, 3, 4, 5] },
  { value: 'mon-sat', label: 'Mon–Sat', days: [1, 2, 3, 4, 5, 6] },
  { value: 'fri-sun', label: 'Fri–Sun', days: [0, 5, 6] },
  { value: 'weekends', label: 'Weekends (Sat–Sun)', days: [0, 6] },
]

const sameDays = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((d, i) => d === [...b].sort()[i])

export const presetFor = (days: number[]) => DAY_PRESETS.find((p) => sameDays(p.days, days))?.value ?? 'custom'

export function describeDays(days: number[]) {
  const preset = DAY_PRESETS.find((p) => sameDays(p.days, days))
  if (preset) return preset.value === 'every' ? 'Every day' : preset.label.replace(/ \(.*\)$/, '')
  return [...days].sort().map((d) => DAY_NAMES[d]).join(', ')
}

/** "Weekdays · 15:00–18:00 · until 31 Dec 2026" */
export function describeSchedule(p: PromoSchedule) {
  const parts = [describeDays(p.days)]
  if (p.startTime && p.endTime) parts.push(`${p.startTime}–${p.endTime}`)
  const today = localDate(new Date())
  if (p.startDate > today) parts.push(`from ${formatDate(p.startDate)}`)
  if (p.endDate) parts.push(`${p.endDate < today ? 'ended' : 'until'} ${formatDate(p.endDate)}`)
  return parts.join(' · ')
}

/** Why the promo cannot be used right now at this branch and channel, or null when it can. */
export function unavailableReason(p: PromoSchedule & { usageLimit?: number; used?: number }, branchId: string, channel: SalesChannel, now = new Date()) {
  const status = promoStatus(p, now)
  if (status !== 'live') return PROMO_STATUS[status].label
  if (p.branchId !== 'all' && p.branchId !== branchId) return 'Other branch'
  if (p.channel !== 'all' && p.channel !== channel) return `${CHANNEL_NAMES[p.channel]} only`
  if (p.days.length && !p.days.includes(now.getDay())) return `${describeDays(p.days)} only`
  if (p.startTime && p.endTime) {
    const t = localTime(now)
    // A window like 22:00–02:00 runs past midnight.
    const open = p.startTime <= p.endTime ? t >= p.startTime && t < p.endTime : t >= p.startTime || t < p.endTime
    if (!open) return `${p.startTime}–${p.endTime} only`
  }
  return null
}

export function describeDiscount(d: Pick<Discount, 'kind' | 'value' | 'maxAmount'>) {
  if (d.kind === 'fixed') return `${formatCurrency(d.value)} off`
  return d.maxAmount ? `${d.value}% off, up to ${formatCurrency(d.maxAmount)}` : `${d.value}% off`
}

/**
 * What a discount takes off a cart. Deal lines are already discounted, so they never count towards it.
 * `reason` explains a zero amount (nothing qualifying, or below the minimum spend).
 */
export function discountFor(d: Discount, lines: OrderItem[], products: Product[]) {
  const categoryOf = new Map(products.map((p) => [p.id, p.categoryId]))
  const covered = lines.filter(
    (l) =>
      !l.dealId &&
      (d.scope === 'order' || (d.scope === 'product' ? l.productId === d.targetId : categoryOf.get(l.productId) === d.targetId)),
  )
  const base = covered.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  if (base === 0) return { amount: 0, reason: 'No qualifying items' }
  if (base < d.minOrder) return { amount: 0, reason: `Add ${formatCurrency(d.minOrder - base)} more` }
  let amount = d.kind === 'percent' ? (base * d.value) / 100 : d.value
  if (d.kind === 'percent' && d.maxAmount) amount = Math.min(amount, d.maxAmount)
  return { amount: Math.round(Math.min(amount, base)), reason: null }
}

/** A deal's normal menu price, ingredient cost, what the customer saves and what the business keeps. */
export function dealValue(deal: Pick<Deal, 'items' | 'price'>, products: Product[]) {
  const byId = new Map(products.map((p) => [p.id, p]))
  let regular = 0
  let cost = 0
  for (const i of deal.items) {
    const p = byId.get(i.productId)
    if (!p) continue
    regular += p.basePrice * i.quantity
    cost += p.costPrice * i.quantity
  }
  const saving = regular - deal.price
  return {
    regular,
    cost,
    saving,
    savingPct: regular ? (saving / regular) * 100 : 0,
    margin: deal.price ? ((deal.price - cost) / deal.price) * 100 : 0,
  }
}

/** "2× Zinger Burger, 1× Chicken Tikka Pizza" */
export const describeDealItems = (deal: Pick<Deal, 'items'>, products: Product[]) =>
  deal.items.map((i) => `${i.quantity}× ${products.find((p) => p.id === i.productId)?.name ?? 'Removed item'}`).join(', ')
