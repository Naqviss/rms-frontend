'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, BoxesIcon, PackageXIcon, WalletIcon } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/chart-card'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useInventory } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatNumber } from '@/lib/utils/format'
import { stockStatus, stockValue } from '@/lib/utils/inventory'
import { branchName } from '@/lib/directory'

const statusConfig = {
  'in-stock': { label: 'In stock', color: 'var(--chart-2)' },
  low: { label: 'Low', color: 'var(--chart-4)' },
  out: { label: 'Out', color: 'var(--chart-5)' },
} satisfies ChartConfig

export default function InventoryOverviewPage() {
  const { t } = useT()
  const { data, isLoading } = useInventory()
  const { inBranch } = useScope()
  const items = useMemo(() => inBranch(data ?? []), [data, inBranch])

  const stats = useMemo(() => {
    const byStatus = { 'in-stock': 0, low: 0, out: 0 }
    for (const i of items) byStatus[stockStatus(i)]++
    return {
      byStatus,
      total: items.reduce((s, i) => s + stockValue(i), 0),
    }
  }, [items])

  const alerts = useMemo(() => items.filter((i) => stockStatus(i) !== 'in-stock').slice(0, 8), [items])

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('inventory.title')} description={t('inventory.subtitle')} />
        <Skeleton className="h-96 w-full" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('inventory.title')}
        description={t('inventory.subtitle')}
        actions={
          <Button render={<Link href="/inventory/items" />} nativeButton={false} variant="outline">
            {t('inventory.stockList')}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('inventory.totalValue')} value={formatCompactCurrency(stats.total)} icon={WalletIcon} />
        <StatCard label={t('inventory.totalItems')} value={formatNumber(items.length)} icon={BoxesIcon} />
        <StatCard label={t('inventory.lowItems')} value={String(stats.byStatus.low)} icon={AlertTriangleIcon} />
        <StatCard label={t('inventory.outItems')} value={String(stats.byStatus.out)} icon={PackageXIcon} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard className="lg:col-span-2" title={t('inventory.statusMix')}>
          <ChartContainer config={statusConfig} className="mx-auto h-64 w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={(Object.keys(stats.byStatus) as (keyof typeof stats.byStatus)[]).map((k) => ({ name: k, value: stats.byStatus[k], fill: `var(--color-${k})` }))}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                strokeWidth={2}
              >
                {(Object.keys(stats.byStatus) as (keyof typeof stats.byStatus)[]).map((k) => (
                  <Cell key={k} fill={`var(--color-${k})`} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </ChartCard>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('w.inventoryAlerts')}</CardTitle>
          <CardDescription>{alerts.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {alerts.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {branchName(i.branchId)} · {i.quantity} {i.unit} / min {i.minStock}
                  </p>
                </div>
                <StatusBadge status={stockStatus(i)} />
              </li>
            ))}
            {alerts.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{t('common.noData')}</li>}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
