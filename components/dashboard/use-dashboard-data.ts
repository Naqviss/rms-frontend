'use client'

import { useMemo } from 'react'
import { profitabilityWithOverhead } from '@/lib/utils/profitability'
import { ingredientCatalog, unitCostMap } from '@/lib/utils/costing'
import { branchName } from '@/lib/directory'
import {
  useCategories,
  useCustomers,
  useEmployees,
  useInventory,
  useOrders,
  useProducts,
  useRecipes,
  useTransactions,
  useVendors,
} from '@/hooks/use-data'
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
import type { ActivityLog, InventoryItem, SalesPoint } from '@/types'

const delta = (cur: number, prev: number) => (prev === 0 ? 0 : ((cur - prev) / prev) * 100)

/** Order statuses that still need the kitchen or a confirmation. */
const OPEN_STATUSES = ['placed', 'accepted', 'preparing']

function stockStatus(item: InventoryItem, today: string): 'in-stock' | 'low' | 'out' | 'expiring' {
  if (item.quantity <= 0) return 'out'
  if (item.expiryDate && (new Date(item.expiryDate).getTime() - new Date(today).getTime()) / 86_400_000 <= 4) return 'expiring'
  if (item.quantity <= item.minStock) return 'low'
  return 'in-stock'
}

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

/**
 * Dashboard data. KPI tiles, trends, payment mix and the branch comparison come from the server's
 * report models (/api/insights/*, /api/finance/expenses/summary) for the top-bar window — server
 * aggregates are only combined across days/branches, never recomputed from order lists. Item-level
 * widgets (hero items, best sellers, sales by category) have no report model and derive from the
 * loaded orders. `available` says which sections actually loaded, so widgets can show "not
 * available" instead of a misleading zero.
 */
export function useDashboardData() {
  const { preset, inBranch } = useScope()
  const { data: orders } = useOrders()
  const { data: products } = useProducts()
  const { data: categories } = useCategories()
  const { data: customers } = useCustomers()
  const { data: employees } = useEmployees()
  const { data: inventory } = useInventory()
  const { data: transactions } = useTransactions()
  const { data: vendors } = useVendors()
  const { data: recipes } = useRecipes()

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

    const scopedOrders = inBranch(orders ?? []).filter((o) => o.createdAt.slice(0, 10) >= window.from && o.status !== 'cancelled')
    const categoryOf = new Map((products ?? []).map((p) => [p.id, p.categoryId]))
    const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]))
    const bestMap = new Map<string, { name: string; qty: number; revenue: number }>()
    const catMap = new Map<string, number>()
    for (const o of scopedOrders) {
      for (const it of o.items) {
        const b = bestMap.get(it.productId) ?? { name: it.name, qty: 0, revenue: 0 }
        b.qty += it.quantity
        b.revenue += it.quantity * it.unitPrice
        bestMap.set(it.productId, b)
        const cat = categoryName.get(categoryOf.get(it.productId) ?? '') ?? 'Other'
        catMap.set(cat, (catMap.get(cat) ?? 0) + it.quantity * it.unitPrice)
      }
    }

    // Hero items look at today itself, whatever range the top bar is set to; overhead is shared
    // out from today's server sales and expense totals.
    const todayOrders = inBranch(orders ?? []).filter((o) => o.createdAt.startsWith(today) && o.status !== 'cancelled')
    const todayPl = { revenue: sumMinor(d?.sales, (r) => r.amount_minor, cur), expenses: sumMinor(d?.expenses, (r) => r.amount_minor, cur) }
    const unitCosts = unitCostMap(products ?? [], recipes ?? [], ingredientCatalog(inventory ?? []))
    const hero = profitabilityWithOverhead(todayOrders, products ?? [], todayPl, null, unitCosts)

    const alerts = inBranch(inventory ?? [])
      .map((i) => ({ item: i, status: stockStatus(i, today) }))
      .filter((a) => a.status !== 'in-stock')
      .sort((a, b) => a.item.quantity / (a.item.minStock || 1) - b.item.quantity / (b.item.minStock || 1))

    const scopedEmployees = inBranch(employees ?? [])

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
      activeEmployees: scopedEmployees.filter((e) => e.status === 'active').length,
      lowStockCount: d?.low_stock?.total ?? 0,
      heroItems: {
        items: hero.items.map((i) => ({ ...i, category: categoryName.get(i.categoryId) ?? 'Menu item' })),
        orders: todayOrders.length,
        profit: hero.profit,
        date: today,
      },
      bestSellers: [...bestMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
      byCategory: [...catMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byPayment: [...payMap.entries()].map(([name, value]) => ({ name, value })),
      branchPerformance: inCurrency(branches.data?.rows).map((r) => ({
        id: r.branch_id,
        name: branchName(r.branch_id).replace(/ (Flagship|Phase 6|Branch)$/i, ''),
        revenue: r.sales_minor / 100,
        // Without finance read access the report omits expenses; profit is then unknown (0).
        profit: r.expense_minor == null ? 0 : (r.sales_minor - r.expense_minor) / 100,
      })),
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
      vendorAlerts: [...(vendors ?? [])].filter((v) => v.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5),
      topCustomers: [...(customers ?? [])].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5),
      inventoryAlerts: alerts.slice(0, 6),
      topEmployees: [...scopedEmployees].sort((a, b) => b.performance - a.performance).slice(0, 5),
    }
    // `window`/`prev` are derived from preset + today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, today, cur, inBranch, orders, products, categories, customers, employees, inventory, transactions, vendors, recipes, daily.data, expenseDays.data, sales.data, prevSales.data, expenses.data, prevExpenses.data, payments.data, branches.data, dashboard.data, audit.data])
}

export type DashboardData = ReturnType<typeof useDashboardData>
