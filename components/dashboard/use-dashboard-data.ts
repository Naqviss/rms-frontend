'use client'

import { useMemo } from 'react'
import { branchName } from '@/lib/directory'
import { useTransactions } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import {
  countBy,
  daysOf,
  expenseBuckets,
  presetWindow,
  previousWindow,
  sumMinor,
  todayIso,
  useAuditLog,
  useDailySales,
  useExpenseSummary,
  useInsightsDashboard,
  useInsightsReport,
} from '@/hooks/use-insights'
import type { ActivityLog, SalesPoint } from '@/types'

const delta = (cur: number, prev: number) => (prev === 0 ? 0 : ((cur - prev) / prev) * 100)

/** Order statuses that still need the kitchen or a confirmation. */
const OPEN_STATUSES = ['placed', 'accepted', 'preparing']

const activityType = (resource: string): ActivityLog['type'] =>
  /order|payment|table/.test(resource)
    ? 'order'
    : /inventory|stock|vendor|purchase/.test(resource)
      ? 'inventory'
      : /expense|cash|finance|payroll/.test(resource)
        ? 'finance'
        : /menu|product|category/.test(resource)
          ? 'menu'
          : /user|member|role/.test(resource)
            ? 'user'
            : 'system'

/** Relative stock level of a low-stock row (quantity / reorder level), for ordering merged branch lists. */
const stockRatio = (quantity: number, reorder: number) => (reorder > 0 ? quantity / reorder : quantity)

/**
 * Dashboard data. Every figure comes from a server read model for the top-bar window:
 * KPI tiles from /api/insights/reports/{sales,expenses} (current and previous window), the trend
 * from daily /api/insights/reports/sales plus /api/finance/expenses/summary, the payment mix from
 * /api/insights/reports/payments, the branch comparison from /api/insights/reports/branches, and
 * pending orders and low stock from /api/insights/dashboard (today). Server aggregates are only
 * combined across days/branches, never recomputed from order, expense or product lists.
 * `available` says which sections actually loaded, so widgets can show "not available" instead of
 * a misleading zero.
 */
export function useDashboardData() {
  const { preset, inBranch } = useScope()
  const { data: transactions } = useTransactions()

  const today = todayIso()
  const window = presetWindow(preset, today)
  const prev = previousWindow(window)
  const daily = useDailySales(window)
  const expenseDays = useExpenseSummary('day', window)
  const sales = useInsightsReport('sales', window)
  const prevSales = useInsightsReport('sales', prev)
  const expenses = useInsightsReport('expenses', window)
  const prevExpenses = useInsightsReport('expenses', prev)
  const payments = useInsightsReport('payments', window)
  const branches = useInsightsReport('branches', window)
  const dashboard = useInsightsDashboard(today)
  const audit = useAuditLog(6)
  const cur = sales.currency

  return useMemo(() => {
    const inCurrency = <R extends { currency: string }>(rows: R[] | null | undefined) => (rows ?? []).filter((r) => !cur || r.currency === cur)
    const byDay = expenseBuckets(expenseDays.data, cur)
    const salesByDay = new Map((daily.data ?? []).map((d) => [d.date, d]))
    const series: SalesPoint[] = daily.data
      ? daysOf(window).map((date) => {
          const d = salesByDay.get(date)
          const revenue = sumMinor(d?.sales, (r) => r.total_minor, cur)
          const exp = byDay.get(date) ?? 0
          return {
            date,
            label: d?.label ?? date.slice(5),
            revenue,
            orders: inCurrency(d?.sales).reduce((s, r) => s + r.order_count, 0),
            expenses: exp,
            profit: revenue - exp,
          }
        })
      : []
    const total = (s: typeof sales.data, e: typeof expenses.data) => {
      const revenue = sumMinor(s?.rows, (r) => r.total_minor, cur)
      const exp = sumMinor(e?.rows, (r) => r.total_minor, cur)
      return { revenue, orders: inCurrency(s?.rows).reduce((n, r) => n + r.order_count, 0), expenses: exp, profit: revenue - exp }
    }
    const totals = total(sales.data, expenses.data)
    const prevTotals = total(prevSales.data, prevExpenses.data)
    const aov = totals.orders ? totals.revenue / totals.orders : 0
    const prevAov = prevTotals.orders ? prevTotals.revenue / prevTotals.orders : 0

    const d = dashboard.data
    const statuses = countBy(d?.order_statuses, (r) => r.status, (r) => r.count)
    const payMap = countBy(inCurrency(payments.data?.payments), (r) => r.method, (r) => r.amount_minor / 100)

    // Low stock as the server reports it (today); per-branch lists merged for a branch subset are
    // re-ordered lowest relative stock first, like a single server list.
    const lowStock = (d?.low_stock?.items ?? [])
      .map((i) => {
        const quantity = Number(i.quantity)
        const reorder = Number(i.reorder_level)
        return {
          id: `${i.branch_id}:${i.inventory_item_id}`,
          name: i.item_name || i.sku || 'Inventory item',
          quantity,
          unit: i.unit,
          branchId: i.branch_id,
          status: quantity <= 0 ? ('out' as const) : ('low' as const),
          ratio: stockRatio(quantity, reorder),
        }
      })
      .sort((a, b) => a.ratio - b.ratio)

    return {
      available: {
        sales: !!sales.data,
        expenses: !!expenses.data,
        trend: !!daily.data,
        payments: !!payments.data,
        branches: !!branches.data,
        orderStatuses: !!d?.order_statuses,
        lowStock: !!d?.low_stock,
      },
      series,
      totals,
      deltas: {
        revenue: delta(totals.revenue, prevTotals.revenue),
        orders: delta(totals.orders, prevTotals.orders),
        expenses: delta(totals.expenses, prevTotals.expenses),
        profit: delta(totals.profit, prevTotals.profit),
        aov: delta(aov, prevAov),
      },
      aov,
      pending: OPEN_STATUSES.reduce((n, s) => n + (statuses.get(s) ?? 0), 0),
      lowStockCount: d?.low_stock?.total ?? 0,
      byPayment: [...payMap.entries()].map(([name, value]) => ({ name, value })),
      branchPerformance: inCurrency(branches.data?.rows).map((r) => ({
        id: r.branch_id,
        name: branchName(r.branch_id).replace(/ (Flagship|Phase 6|Branch)$/i, ''),
        revenue: r.sales_minor / 100,
        // Without finance read access the report omits expenses; profit is then unknown (0).
        profit: r.expense_minor == null ? 0 : (r.sales_minor - r.expense_minor) / 100,
      })),
      // Individual ledger records (payments and expenses), newest first — listed, not aggregated.
      recentTransactions: [...inBranch(transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
      recentActivity: (audit.data ?? []).map(
        (a): ActivityLog => ({
          id: a.id,
          userName: a.actor.charAt(0).toUpperCase() + a.actor.slice(1),
          action: a.action.replace(/[._]/g, ' '),
          target: a.resource.replace(/[._]/g, ' '),
          at: a.at,
          type: activityType(a.resource),
        }),
      ),
      inventoryAlerts: lowStock.slice(0, 6),
    }
    // `window`/`prev` are derived from preset + today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, today, cur, inBranch, transactions, daily.data, expenseDays.data, sales.data, prevSales.data, expenses.data, prevExpenses.data, payments.data, branches.data, dashboard.data, audit.data])
}

export type DashboardData = ReturnType<typeof useDashboardData>
