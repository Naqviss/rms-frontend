import type { ExpenseBudget, RecurringExpense, SalesChannel, SalesPoint, TaxRate, Transaction } from '@/types'
import { config } from '@/lib/config'
import { createRng, int, isoDaysAgo, pick } from '@/lib/utils/seed'

const BRANCH_BASE: Record<string, number> = { b1: 265000, b2: 182000, b3: 214000 }
const DAYS = 60

/** Daily sales per branch for the trailing 60 days (index 0 = oldest, last = today). */
export const salesByBranch: Record<string, SalesPoint[]> = Object.fromEntries(
  Object.entries(BRANCH_BASE).map(([branchId, base], bi) => {
    const rng = createRng(300 + bi * 13)
    const points: SalesPoint[] = Array.from({ length: DAYS }, (_, idx) => {
      const daysAgo = DAYS - 1 - idx
      const date = isoDaysAgo(config.referenceDate, daysAgo, 0).slice(0, 10)
      const dow = new Date(`${date}T00:00:00`).getDay()
      // Weekends and the first days of the month (salary week) are the busiest for grocery.
      const weekend = dow === 6 || dow === 0 ? 1.22 : 1
      const payday = Number(date.slice(8, 10)) <= 5 ? 1.18 : 1
      const trend = 1 + (idx / DAYS) * 0.16
      const revenue = Math.round(base * weekend * payday * trend * (0.86 + rng() * 0.28))
      // Grocery runs on thin margins: stock purchases eat most of the till.
      const expenses = Math.round(revenue * (0.8 + rng() * 0.06))
      const d = new Date(`${date}T00:00:00`)
      return {
        date,
        label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        revenue,
        orders: Math.round(revenue / (1450 + rng() * 300)),
        expenses,
        profit: revenue - expenses,
      }
    })
    return [branchId, points]
  }),
)

export function aggregateSales(branchIds: string[], days: number): SalesPoint[] {
  const slice = (id: string) => salesByBranch[id].slice(-days)
  const first = slice(branchIds[0])
  return first.map((p, i) => {
    const merged = branchIds.map((id) => slice(id)[i])
    const revenue = merged.reduce((s, m) => s + m.revenue, 0)
    const expenses = merged.reduce((s, m) => s + m.expenses, 0)
    return {
      date: p.date,
      label: p.label,
      revenue,
      orders: merged.reduce((s, m) => s + m.orders, 0),
      expenses,
      profit: revenue - expenses,
    }
  })
}

export const SALES_CHANNELS: SalesChannel[] = ['in-store', 'pickup', 'own-delivery', 'foodpanda', 'website']

/** Default Foodpanda shops commission (percent of basket value) and own-delivery running cost (share of delivery revenue). */
export const FOODPANDA_COMMISSION = 18
export const OWN_DELIVERY_COST_RATE = 0.06

export interface ChannelPoint {
  date: string
  label: string
  revenue: number
  orders: number
  deductions: number
}

const channelShares: Record<string, Record<SalesChannel, number>[]> = Object.fromEntries(
  Object.keys(BRANCH_BASE).map((branchId, bi) => {
    const rng = createRng(900 + bi * 7)
    const shares = Array.from({ length: DAYS }, (_, idx) => {
      const date = salesByBranch[branchId][idx].date
      const dow = new Date(`${date}T00:00:00`).getDay()
      const weekend = dow === 6 || dow === 0
      const raw: Record<SalesChannel, number> = {
        'in-store': (weekend ? 0.66 : 0.6) * (0.92 + rng() * 0.16),
        pickup: 0.05 * (0.9 + rng() * 0.2),
        'own-delivery': (weekend ? 0.13 : 0.17) * (0.9 + rng() * 0.2),
        foodpanda: (0.09 + (idx / DAYS) * 0.05) * (0.88 + rng() * 0.24),
        website: (0.04 + (idx / DAYS) * 0.04) * (0.85 + rng() * 0.3),
      }
      const sum = Object.values(raw).reduce((s, v) => s + v, 0)
      return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / sum])) as Record<SalesChannel, number>
    })
    return [branchId, shares]
  }),
)

/** Daily revenue split by sales channel with the platform commission or delivery cost taken out as `deductions`. */
export function channelSales(branchIds: string[], days: number): Record<SalesChannel, ChannelPoint[]> {
  const total = aggregateSales(branchIds, days)
  const result = Object.fromEntries(SALES_CHANNELS.map((c) => [c, [] as ChannelPoint[]])) as Record<SalesChannel, ChannelPoint[]>
  total.forEach((day, i) => {
    const offset = DAYS - days + i
    const avg = {} as Record<SalesChannel, number>
    SALES_CHANNELS.forEach((c) => {
      avg[c] = branchIds.reduce((s, id) => s + salesByBranch[id][offset].revenue * channelShares[id][offset][c], 0)
    })
    const rounded = Object.fromEntries(SALES_CHANNELS.map((c) => [c, Math.round(avg[c])])) as Record<SalesChannel, number>
    rounded['in-store'] += day.revenue - SALES_CHANNELS.reduce((s, c) => s + rounded[c], 0)
    SALES_CHANNELS.forEach((c) => {
      const revenue = rounded[c]
      const deductions =
        c === 'foodpanda'
          ? Math.round((revenue * FOODPANDA_COMMISSION) / 100)
          : c === 'own-delivery'
            ? Math.round(revenue * OWN_DELIVERY_COST_RATE)
            : 0
      const aov = c === 'foodpanda' ? 1850 : c === 'website' ? 3200 : c === 'own-delivery' ? 2900 : c === 'pickup' ? 2100 : 1250
      result[c].push({ date: day.date, label: day.label, revenue, orders: Math.max(1, Math.round(revenue / aov)), deductions })
    })
  })
  return result
}

const expenseCategories: [string, string, number, number, SalesChannel?][] = [
  ['Platform commission', 'Foodpanda weekly commission', 30000, 110000, 'foodpanda'],
  ['Rider payouts', 'Own delivery rider payouts', 20000, 60000, 'own-delivery'],
  ['Rent', 'Monthly store rent', 180000, 320000],
  ['Utilities', 'Electricity bill (chillers and lights)', 60000, 160000],
  ['Salaries', 'Staff payroll', 350000, 800000],
  ['Supplies', 'Shopping bags & receipt rolls', 8000, 40000],
  ['Marketing', 'Flyers and social media ads', 15000, 60000],
  ['Maintenance', 'Chiller and freezer repair', 5000, 45000],
  ['Stock purchase', 'Distributor invoice', 120000, 600000],
]

const channelIncomeCategory: Record<SalesChannel, string> = {
  'in-store': 'Counter sales',
  pickup: 'Pickup sales',
  'own-delivery': 'Delivery sales',
  foodpanda: 'Foodpanda sales',
  website: 'Website sales',
}

export const transactions: Transaction[] = (() => {
  const rng = createRng(1717)
  const list: Transaction[] = []
  for (let i = 0; i < 70; i++) {
    const daysAgo = Math.floor(i / 2.6)
    const roll = rng()
    const branchId = pick(rng, ['b1', 'b2', 'b3'])
    if (roll < 0.52) {
      const channel = pick(rng, ['in-store', 'in-store', 'in-store', 'pickup', 'own-delivery', 'foodpanda', 'website'] as const)
      const amount = int(rng, 45, 260) * 1000
      list.push({
        id: `tx-${i + 1}`,
        reference: `INV-${7000 + i}`,
        type: 'income',
        category: channelIncomeCategory[channel],
        description: channel === 'foodpanda' ? 'Foodpanda payout' : 'Daily settlement',
        amount,
        // Shelf prices include GST; about 13% of a typical day's takings is tax (fresh produce is exempt).
        tax: Math.round(amount * 0.13),
        channel,
        method: channel === 'foodpanda' ? 'online' : pick(rng, ['cash', 'card', 'online'] as const),
        date: isoDaysAgo(config.referenceDate, daysAgo, int(rng, 9, 23), int(rng, 0, 59)),
        branchId,
        status: 'completed',
      })
    } else if (roll < 0.94) {
      const [category, description, min, max, channel] = pick(rng, expenseCategories)
      list.push({
        id: `tx-${i + 1}`,
        reference: `EXP-${2100 + i}`,
        type: 'expense',
        category,
        description,
        channel,
        amount: int(rng, min / 1000, max / 1000) * 1000,
        method: pick(rng, ['cash', 'card', 'online'] as const),
        date: isoDaysAgo(config.referenceDate, daysAgo, int(rng, 9, 20), int(rng, 0, 59)),
        branchId,
        status: rng() < 0.12 ? 'pending' : 'completed',
      })
    } else {
      list.push({
        id: `tx-${i + 1}`,
        reference: `RFD-${900 + i}`,
        type: 'refund',
        category: 'Customer refund',
        description: 'Damaged item returned',
        amount: int(rng, 6, 35) * 100,
        method: 'online',
        date: isoDaysAgo(config.referenceDate, daysAgo, 14),
        branchId,
        status: 'completed',
      })
    }
  }
  return list.sort((a, b) => b.date.localeCompare(a.date))
})()

export const taxRates: TaxRate[] = [
  { id: 'tx1', name: 'GST (standard)', rate: 18, category: 'Packaged goods', inclusive: true, branchId: 'all', active: true, appliesTo: 'Packaged and branded goods' },
  { id: 'tx2', name: 'Reduced GST (dairy)', rate: 10, category: 'Dairy', inclusive: true, branchId: 'all', active: true, appliesTo: 'Packaged milk, yogurt and butter' },
  { id: 'tx3', name: 'Exempt (fresh & loose)', rate: 0, category: 'Fresh produce', inclusive: true, branchId: 'all', active: true, appliesTo: 'Fruit, vegetables and loose staples' },
  { id: 'tx4', name: 'Punjab sales tax on services', rate: 16, category: 'Services', inclusive: false, branchId: 'all', active: false, appliesTo: 'Delivery charges (Punjab)' },
  { id: 'tx5', name: 'Card payment surcharge', rate: 2, category: 'Payments', inclusive: false, branchId: 'all', active: false, appliesTo: 'Card payments' },
  { id: 'tx6', name: 'Sindh sales tax on delivery', rate: 15, category: 'Delivery', inclusive: false, branchId: 'b2', active: true, appliesTo: 'Delivery charges' },
]

export const recurringExpenses: RecurringExpense[] = [
  { id: 'rec1', name: 'Shop rent', category: 'Rent', payee: 'Clifton Properties', amount: 320000, frequency: 'monthly', nextDue: '2026-11-01', branchId: 'b1', method: 'online', active: true },
  { id: 'rec2', name: 'Shop rent', category: 'Rent', payee: 'DHA Estates', amount: 240000, frequency: 'monthly', nextDue: '2026-11-01', branchId: 'b2', method: 'online', active: true },
  { id: 'rec3', name: 'Shop rent', category: 'Rent', payee: 'Gulshan Plaza Mgmt', amount: 180000, frequency: 'monthly', nextDue: '2026-11-01', branchId: 'b3', method: 'online', active: true },
  { id: 'rec4', name: 'Electricity bill', category: 'Utilities', payee: 'K-Electric', amount: 95000, frequency: 'monthly', nextDue: '2026-10-18', branchId: 'b1', method: 'online', active: true },
  { id: 'rec5', name: 'Generator fuel', category: 'Utilities', payee: 'PSO Fuel Station', amount: 38000, frequency: 'monthly', nextDue: '2026-10-20', branchId: 'b1', method: 'online', active: true },
  { id: 'rec6', name: 'Internet & POS licences', category: 'Utilities', payee: 'Nayatel', amount: 12000, frequency: 'monthly', nextDue: '2026-10-13', branchId: 'b2', method: 'card', active: true },
  { id: 'rec7', name: 'Shopping bags restock', category: 'Supplies', payee: 'PackRight Supplies', amount: 8000, frequency: 'weekly', nextDue: '2026-10-17', branchId: 'b1', method: 'cash', active: true },
  { id: 'rec8', name: 'Social media ads', category: 'Marketing', payee: 'Meta Ads', amount: 40000, frequency: 'monthly', nextDue: '2026-10-16', branchId: 'b1', method: 'card', active: true },
  { id: 'rec9', name: 'Pest control', category: 'Maintenance', payee: 'SafeHome Services', amount: 15000, frequency: 'quarterly', nextDue: '2026-11-10', branchId: 'b2', method: 'cash', active: true },
  { id: 'rec10', name: 'Security guard service', category: 'Other', payee: 'SafeGuard Security', amount: 45000, frequency: 'quarterly', nextDue: '2026-12-01', branchId: 'b1', method: 'card', active: false },
]

export const expenseBudgets: ExpenseBudget[] = [
  { id: 'bud-salaries', category: 'Salaries', monthly: 1600000 },
  { id: 'bud-rent', category: 'Rent', monthly: 760000 },
  { id: 'bud-stock', category: 'Stock purchase', monthly: 9000000 },
  { id: 'bud-commission', category: 'Platform commission', monthly: 250000 },
  { id: 'bud-utilities', category: 'Utilities', monthly: 250000 },
  { id: 'bud-riders', category: 'Rider payouts', monthly: 120000 },
  { id: 'bud-marketing', category: 'Marketing', monthly: 90000 },
  { id: 'bud-supplies', category: 'Supplies', monthly: 80000 },
  { id: 'bud-maintenance', category: 'Maintenance', monthly: 60000 },
]
