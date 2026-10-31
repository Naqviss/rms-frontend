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

const flowConfig = {
  income: { label: 'Income', color: 'var(--chart-2)' },
  expense: { label: 'Expense', color: 'var(--chart-5)' },
} satisfies ChartConfig

const categoryConfig = { amount: { label: 'Amount', color: 'var(--chart-1)' } } satisfies ChartConfig

export default function FinancePage() {
  const { t } = useT()
  const { data, isLoading } = useTransactions()
  const { inBranch } = useScope()
  const includeTax = useAppStore((s) => s.includeTax)
  const txs = useMemo(() => inBranch(data ?? []).filter((x) => x.status === 'completed'), [data, inBranch])

  const summary = useMemo(() => {
    let income = 0
    let tax = 0
    let expense = 0
    const byDay = new Map<string, { income: number; expense: number }>()
    const byCategory = new Map<string, number>()
    for (const x of txs) {
      const day = x.date.slice(0, 10)
      const bucket = byDay.get(day) ?? { income: 0, expense: 0 }
      if (x.type === 'income') {
        const amount = includeTax ? x.amount : x.amount - (x.tax ?? 0)
        income += amount
        tax += x.tax ?? 0
        bucket.income += amount
      } else {
        expense += x.amount
        bucket.expense += x.amount
        byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount)
      }
      byDay.set(day, bucket)
    }
    return {
      income,
      tax,
      expense,
      days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, v]) => ({ date: date.slice(5), ...v })),
      categories: [...byCategory.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 7),
    }
  }, [txs, includeTax])

  const profit = summary.income - summary.expense

  if (isLoading) {
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
          value={formatCompactCurrency(summary.income)}
          icon={ArrowUpRightIcon}
          hint={`${t('finance.taxCollected')}: ${formatCompactCurrency(summary.tax)}`}
        />
        <StatCard label={t('common.expenses')} value={formatCompactCurrency(summary.expense)} icon={ArrowDownRightIcon} />
        <StatCard label={t('common.profit')} value={formatCompactCurrency(profit)} icon={PiggyBankIcon} />
        <StatCard label={t('finance.margin')} value={formatPercent(summary.income ? (profit / summary.income) * 100 : 0)} icon={ReceiptIcon} />
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
