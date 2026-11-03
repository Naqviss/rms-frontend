'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowDownRightIcon, ArrowUpRightIcon, PiggyBankIcon, ReceiptIcon } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/chart-card'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { TaxToggle } from '@/components/common/tax-toggle'
import { useTransactions } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/utils/format'
import { useAppStore } from '@/stores/app-store'
import { daysOf, expenseBuckets, presetWindow, sumMinor, useDailySales, useExpenseSummary, useInsightsReport } from '@/hooks/use-insights'

const flowConfig = {
  income: { label: 'Income', color: 'var(--chart-2)' },
  expense: { label: 'Expense', color: 'var(--chart-5)' },
} satisfies ChartConfig

const categoryConfig = { amount: { label: 'Amount', color: 'var(--chart-1)' } } satisfies ChartConfig

export default function FinancePage() {
  const { t } = useT()
  const { data, isLoading } = useTransactions()
  const { inBranch, preset } = useScope()
  const includeTax = useAppStore((s) => s.includeTax)
  const window = useMemo(() => presetWindow(preset), [preset])
  // Totals and the daily flow come from the server's sales report and expense summary.
  const sales = useInsightsReport('sales', window)
  const expensesReport = useInsightsReport('expenses', window)
  const daily = useDailySales(window)
  const expenseDays = useExpenseSummary('day', window)
  const cur = sales.currency

  const summary = useMemo(() => {
    const net = (r: { total_minor: number; tax_minor: number; inclusive_tax_minor: number }) =>
      includeTax ? r.total_minor : r.total_minor - r.tax_minor - r.inclusive_tax_minor
    const expByDay = expenseBuckets(expenseDays.data, cur)
    const salesByDay = new Map((daily.data ?? []).map((d) => [d.date, d.sales]))
    // No report breaks expenses down by category, so this one card groups the loaded expense rows.
    const byCategory = new Map<string, number>()
    for (const x of inBranch(data ?? [])) {
      if (x.type !== 'expense' || x.date.slice(0, 10) < window.from) continue
      byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount)
    }
    return {
      income: sumMinor(sales.data?.rows, net, cur),
      tax: sumMinor(sales.data?.rows, (r) => r.tax_minor + r.inclusive_tax_minor, cur),
      expense: sumMinor(expensesReport.data?.rows, (r) => r.total_minor, cur),
      days: daily.data
        ? daysOf(window).map((date) => ({ date: date.slice(5), income: sumMinor(salesByDay.get(date), net, cur), expense: expByDay.get(date) ?? 0 }))
        : [],
      categories: [...byCategory.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 7),
    }
  }, [data, inBranch, window, includeTax, sales.data, expensesReport.data, daily.data, expenseDays.data, cur])

  const profit = summary.income - summary.expense
  const NA = '—'
  const haveSales = !!sales.data
  const haveExpenses = !!expensesReport.data

  if (isLoading && !sales.data) {
    return (
      <>
        <PageHeader title={t('finance.title')} description={t('finance.subtitle')} />
        <Skeleton className="h-96 w-full" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('finance.title')}
        description={t('finance.subtitle')}
        actions={
          <>
          <TaxToggle />
<Button variant="outline" render={<Link href="/finance/closing" />} nativeButton={false}>{t('finance.closing')}</Button>
          <Button render={<Link href="/finance/transactions" />} nativeButton={false}>{t('finance.transactions')}</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('common.revenue')}
          value={haveSales ? formatCompactCurrency(summary.income) : NA}
          icon={ArrowUpRightIcon}
          hint={haveSales ? `${t('finance.taxCollected')}: ${formatCompactCurrency(summary.tax)}` : 'Not available'}
        />
        <StatCard label={t('common.expenses')} value={haveExpenses ? formatCompactCurrency(summary.expense) : NA} hint={haveExpenses ? undefined : 'Not available'} icon={ArrowDownRightIcon} />
        <StatCard label={t('common.profit')} value={haveSales && haveExpenses ? formatCompactCurrency(profit) : NA} hint="Sales minus recorded expenses" icon={PiggyBankIcon} />
        <StatCard
          label={t('finance.margin')}
          value={haveSales && haveExpenses ? formatPercent(summary.income ? (profit / summary.income) * 100 : 0) : NA}
          icon={ReceiptIcon}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-3" title={t('finance.cashFlow')}>
          <ChartContainer config={flowConfig} className="h-72 w-full">
            <AreaChart data={summary.days} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
              <Area dataKey="income" type="monotone" stroke="var(--color-income)" fill="var(--color-income)" fillOpacity={0.18} />
              <Area dataKey="expense" type="monotone" stroke="var(--color-expense)" fill="var(--color-expense)" fillOpacity={0.12} />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard className="lg:col-span-2" title={t('finance.expenseByCategory')}>
          <ChartContainer config={categoryConfig} className="h-72 w-full">
            <BarChart data={summary.categories} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={96} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>
    </>
  )
}
