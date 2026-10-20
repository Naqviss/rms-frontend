import type { RecurringExpense, RecurringFrequency } from '@/types'

export const EXPENSE_CATEGORIES = [
  'Ingredients',
  'Salaries',
  'Rent',
  'Utilities',
  'Supplies',
  'Marketing',
  'Maintenance',
  'Platform commission',
  'Rider payouts',
  'Vendor payment',
  'Other',
]

export const FREQUENCY_LABEL: Record<RecurringFrequency, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly' }

/** How many times a schedule bills per month on average, to compare commitments on one scale. */
const PER_MONTH: Record<RecurringFrequency, number> = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3 }

export const monthlyEquivalent = (amount: number, frequency: RecurringFrequency) => amount * PER_MONTH[frequency]

const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The due date after `date` for a schedule. Month steps keep the day, clamped to short months. */
export function advanceDue(date: string, frequency: RecurringFrequency) {
  const d = new Date(`${date}T00:00:00`)
  if (frequency === 'weekly') {
    d.setDate(d.getDate() + 7)
    return toIso(d)
  }
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + (frequency === 'monthly' ? 1 : 3))
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toIso(d)
}

/** Whole days from `today` until `date`; negative when overdue. */
export function daysUntil(date: string, today: string) {
  return Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86_400_000)
}

export function dueLabel(days: number) {
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days > 0) return `Due in ${days} days`
  return days === -1 ? 'Overdue by 1 day' : `Overdue by ${-days} days`
}

/** First day of the month, days elapsed so far (inclusive) and days in the month, for `today`. */
export function monthProgress(today: string) {
  const d = new Date(`${today}T00:00:00`)
  return {
    start: `${today.slice(0, 7)}-01`,
    elapsed: d.getDate(),
    length: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
  }
}

export type BudgetState = 'ok' | 'near' | 'over'

export function budgetState(spent: number, budget: number): BudgetState {
  if (budget <= 0) return 'ok'
  const ratio = spent / budget
  return ratio > 1 ? 'over' : ratio >= 0.85 ? 'near' : 'ok'
}

/** Total a schedule still has to bill up to and including `to`. Overdue bills count: they are unpaid until recorded. */
export function scheduledUntil(r: Pick<RecurringExpense, 'amount' | 'frequency' | 'nextDue'>, to: string) {
  let total = 0
  for (let due = r.nextDue; due <= to; due = advanceDue(due, r.frequency)) total += r.amount
  return total
}

/** Last day of `today`'s month as YYYY-MM-DD. */
export function monthEnd(today: string) {
  const { length } = monthProgress(today)
  return `${today.slice(0, 7)}-${String(length).padStart(2, '0')}`
}
