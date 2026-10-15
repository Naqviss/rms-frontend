'use client'

import { useMemo } from 'react'
import { BuildingIcon, CircleDollarSignIcon, ShoppingBagIcon, UsersIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/chart-card'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { useTenants } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatCurrency, formatNumber, titleCase } from '@/lib/utils/format'

const revenueConfig = { revenue: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig
const planColors: Record<string, string> = { starter: 'var(--chart-3)', professional: 'var(--chart-1)', enterprise: 'var(--chart-2)' }

export default function AdminAnalyticsPage() {
  const { t } = useT()
  const { data, isLoading } = useTenants()

  const stats = useMemo(() => {
    const list = data ?? []
    const byPlan = new Map<string, number>()
    for (const x of list) byPlan.set(x.plan, (byPlan.get(x.plan) ?? 0) + 1)
    return {
      tenants: list.length,
      users: list.reduce((s, x) => s + x.usersCount, 0),
      orders: list.reduce((s, x) => s + x.ordersThisMonth, 0),
      revenue: list.reduce((s, x) => s + x.monthlyRevenue, 0),
      top: [...list].sort((a, b) => b.monthlyRevenue - a.monthlyRevenue).slice(0, 8).map((x) => ({ name: x.name, revenue: x.monthlyRevenue })),
      plans: [...byPlan.entries()].map(([name, value]) => ({ name, value, fill: planColors[name] ?? 'var(--chart-4)' })),
    }
  }, [data])

  const planConfig = Object.fromEntries(stats.plans.map((p) => [p.name, { label: titleCase(p.name), color: p.fill }])) satisfies ChartConfig

  return (
    <>
      <PageHeader title={t('admin.analytics')} description={t('admin.analyticsSubtitle')} />
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('admin.tenants')} value={formatNumber(stats.tenants)} icon={BuildingIcon} />
            <StatCard label={t('nav.users')} value={formatNumber(stats.users)} icon={UsersIcon} />
            <StatCard label={t('common.orders')} value={formatNumber(stats.orders)} icon={ShoppingBagIcon} />
            <StatCard label={t('admin.platformRevenue')} value={formatCompactCurrency(stats.revenue)} icon={CircleDollarSignIcon} />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard className="lg:col-span-3" title={t('admin.topTenants')}>
              <ChartContainer config={revenueConfig} className="h-72 w-full">
                <BarChart data={stats.top} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                </BarChart>
              </ChartContainer>
            </ChartCard>
            <ChartCard className="lg:col-span-2" title={t('admin.planMix')}>
              <ChartContainer config={planConfig} className="mx-auto h-72 w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie data={stats.plans} dataKey="value" nameKey="name" innerRadius={55} strokeWidth={2}>
                    {stats.plans.map((p) => (
                      <Cell key={p.name} fill={p.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            </ChartCard>
          </div>
        </>
      )}
    </>
  )
}
