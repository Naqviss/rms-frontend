'use client'

import { useMemo } from 'react'
import { BuildingIcon, CircleCheckIcon, CircleSlashIcon, HourglassIcon } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/chart-card'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { useTenants } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatNumber } from '@/lib/utils/format'
import { text } from '@/services/api/mappers'
import { subscriptionOf } from '@/services/api/modules/platform'
import { AdminGuard } from '../admin-guard'

const palette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function AdminAnalyticsPage() {
  return (
    <AdminGuard>
      <Analytics />
    </AdminGuard>
  )
}

/**
 * Tenant and subscription counts from the platform API. There is no platform-wide revenue, order
 * or user reporting endpoint, so those figures are not shown.
 */
function Analytics() {
  const { t } = useT()
  const { data, isLoading } = useTenants()

  const stats = useMemo(() => {
    const list = data ?? []
    const byPlan = new Map<string, number>()
    for (const x of list) {
      const sub = subscriptionOf(x.id)
      const name = sub ? text(sub.plan.name) || sub.plan.code : 'No subscription'
      byPlan.set(name, (byPlan.get(name) ?? 0) + 1)
    }
    return {
      tenants: list.length,
      active: list.filter((x) => x.status === 'active').length,
      trial: list.filter((x) => x.status === 'trial').length,
      suspended: list.filter((x) => x.status === 'suspended').length,
      plans: [...byPlan.entries()].map(([name, value], i) => ({ name, value, fill: palette[i % palette.length] })),
    }
  }, [data])

  const planConfig = Object.fromEntries(stats.plans.map((p) => [p.name, { label: p.name, color: p.fill }])) satisfies ChartConfig

  return (
    <>
      <PageHeader title={t('admin.analytics')} description="Tenants and subscriptions across the platform." />
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('admin.tenants')} value={formatNumber(stats.tenants)} icon={BuildingIcon} />
            <StatCard label={t('status.active')} value={formatNumber(stats.active)} icon={CircleCheckIcon} />
            <StatCard label={t('status.trial')} value={formatNumber(stats.trial)} icon={HourglassIcon} />
            <StatCard label={t('status.suspended')} value={formatNumber(stats.suspended)} icon={CircleSlashIcon} />
          </div>
          <ChartCard title={t('admin.planMix')}>
            <ChartContainer config={planConfig} className="mx-auto h-72 w-full max-w-lg">
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
        </>
      )}
    </>
  )
}
