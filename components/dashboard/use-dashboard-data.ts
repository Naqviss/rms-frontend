'use client'

import { useMemo } from 'react'
import { config } from '@/lib/config'
import { isoDaysAgo } from '@/lib/utils/seed'
import { aggregateSales, salesByBranch } from '@/mocks/finance'
import { branchName, currentBranchIds } from '@/mocks/branches'
import { stockStatus } from '@/mocks/inventory'
import { activityLog } from '@/mocks/platform'
import {
  useCategories,
  useCustomers,
  useEmployees,
  useInventory,
  useOrders,
  useProducts,
  useTransactions,
  useVendors,
} from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const delta = (cur: number, prev: number) => (prev === 0 ? 0 : ((cur - prev) / prev) * 100)

export function useDashboardData() {
  const { branchIds, days, inBranch } = useScope()
  const { data: orders } = useOrders()
  const { data: products } = useProducts()
  const { data: categories } = useCategories()
  const { data: customers } = useCustomers()
  const { data: employees } = useEmployees()
  const { data: inventory } = useInventory()
  const { data: transactions } = useTransactions()
  const { data: vendors } = useVendors()

  return useMemo(() => {
    const series = aggregateSales(branchIds, days)
    const previous = aggregateSales(branchIds, Math.min(days * 2, 60)).slice(0, Math.max(0, Math.min(days * 2, 60) - days))
    const totals = {
      revenue: sum(series.map((p) => p.revenue)),
      orders: sum(series.map((p) => p.orders)),
      expenses: sum(series.map((p) => p.expenses)),
      profit: sum(series.map((p) => p.profit)),
    }
    const prevTotals = {
      revenue: sum(previous.map((p) => p.revenue)),
      orders: sum(previous.map((p) => p.orders)),
      expenses: sum(previous.map((p) => p.expenses)),
      profit: sum(previous.map((p) => p.profit)),
    }
    const aov = totals.orders ? totals.revenue / totals.orders : 0
    const prevAov = prevTotals.orders ? prevTotals.revenue / prevTotals.orders : 0

    const cutoff = isoDaysAgo(config.referenceDate, days - 1, 0)
    const scopedOrders = inBranch(orders ?? []).filter((o) => o.createdAt >= cutoff && o.status !== 'cancelled')
    const openOrders = inBranch(orders ?? []).filter((o) => ['pending', 'confirmed', 'preparing'].includes(o.status))

    const categoryOf = new Map((products ?? []).map((p) => [p.id, p.categoryId]))
    const categoryName = new Map((categories ?? []).map((c) => [c.id, c.name]))

    const bestMap = new Map<string, { name: string; qty: number; revenue: number }>()
    const catMap = new Map<string, number>()
    const payMap = new Map<string, number>()
    for (const o of scopedOrders) {
      payMap.set(o.paymentMethod, (payMap.get(o.paymentMethod) ?? 0) + o.total)
      for (const it of o.items) {
        const b = bestMap.get(it.productId) ?? { name: it.name, qty: 0, revenue: 0 }
        b.qty += it.quantity
        b.revenue += it.quantity * it.unitPrice
        bestMap.set(it.productId, b)
        const cat = categoryName.get(categoryOf.get(it.productId) ?? '') ?? 'Other'
        catMap.set(cat, (catMap.get(cat) ?? 0) + it.quantity * it.unitPrice)
      }
    }

    const alerts = inBranch(inventory ?? [])
      .map((i) => ({ item: i, status: stockStatus(i) }))
      .filter((a) => a.status !== 'in-stock')
      .sort((a, b) => a.item.quantity / (a.item.minStock || 1) - b.item.quantity / (b.item.minStock || 1))

    const scopedEmployees = inBranch(employees ?? [])

    return {
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
      pending: openOrders.length,
      activeEmployees: scopedEmployees.filter((e) => e.status === 'active').length,
      lowStockCount: alerts.length,
      bestSellers: [...bestMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 6),
      byCategory: [...catMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      byPayment: [...payMap.entries()].map(([name, value]) => ({ name, value })),
      branchPerformance: currentBranchIds.map((id) => ({
        id,
        name: branchName(id).replace(/ (Flagship|Phase 6|Branch)$/i, ''),
        revenue: sum(salesByBranch[id].slice(-days).map((p) => p.revenue)),
        profit: sum(salesByBranch[id].slice(-days).map((p) => p.profit)),
      })),
      recentTransactions: inBranch(transactions ?? []).slice(0, 6),
      recentActivity: activityLog,
      vendorAlerts: [...(vendors ?? [])].filter((v) => v.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5),
      topCustomers: [...(customers ?? [])].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5),
      inventoryAlerts: alerts.slice(0, 6),
      topEmployees: [...scopedEmployees].sort((a, b) => b.performance - a.performance).slice(0, 5),
    }
  }, [branchIds, days, inBranch, orders, products, categories, customers, employees, inventory, transactions, vendors])
}

export type DashboardData = ReturnType<typeof useDashboardData>
