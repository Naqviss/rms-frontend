'use client'

import { useMemo } from 'react'
import { DownloadIcon } from 'lucide-react'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/chart-card'
import { PageHeader } from '@/components/common/page-header'
import { TaxToggle } from '@/components/common/tax-toggle'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { downloadCsv } from '@/lib/utils/csv'
import { formatCompactCurrency, formatCurrency, titleCase } from '@/lib/utils/format'
import { useAppStore } from '@/stores/app-store'
import { presetWindow, sumMinor, useDailySales, useInsightsReport } from '@/hooks/use-insights'
import { ReportCards } from './report-cards'

const salesConfig = { revenue: { label: 'Revenue', color: 'var(--chart-1)' }, orders: { label: 'Orders', color: 'var(--chart-3)' } } satisfies ChartConfig
const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function ReportsPage() {
  const { t } = useT()
  const { preset } = useScope()
  const includeTax = useAppStore((s) => s.includeTax)

  const window = useMemo(() => presetWindow(preset), [preset])
  const daily = useDailySales(window)
  const sales = useInsightsReport('sales', window)
  const cur = sales.currency
  // Everything here comes from /api/insights/reports/sales (per day for the trend); the cards
  // below read the other report models.
  const report = useMemo(() => {
    // Server sales report: totals include tax; "excluding tax" removes added and inclusive tax.
    const revenueOf = (r: { total_minor: number; tax_minor: number; inclusive_tax_minor: number }) =>
      includeTax ? r.total_minor : r.total_minor - r.tax_minor - r.inclusive_tax_minor
    const byType = new Map<string, number>()
    for (const r of sales.data?.rows ?? []) {
      if (cur && r.currency !== cur) continue
      byType.set(r.service_type, (byType.get(r.service_type) ?? 0) + revenueOf(r) / 100)
    }
    return {
      days: (daily.data ?? []).map((d) => ({
        date: d.date.slice(5),
        revenue: sumMinor(d.sales, revenueOf, cur),
        orders: d.sales.filter((r) => !cur || r.currency === cur).reduce((n, r) => n + r.order_count, 0),
      })),
      types: [...byType.entries()].map(([name, value], i) => ({ name: name.replace(/_/g, '-'), value, fill: colors[i % colors.length] })),
      total: sumMinor(sales.data?.rows, revenueOf, cur),
    }
  }, [includeTax, daily.data, sales.data, cur])

  const typeConfig = Object.fromEntries(report.types.map((x) => [x.name, { label: titleCase(x.name), color: x.fill }])) satisfies ChartConfig

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        description={`${t('reports.subtitle')} · ${sales.data ? formatCurrency(report.total) : '—'}`}
        actions={
          <>
            <TaxToggle />
            <Button variant="outline" onClick={() => downloadCsv('sales-report', report.days)} disabled={!daily.data}>
              <DownloadIcon data-icon="inline-start" />
              {t('common.exportCsv')}
            </Button>
          </>
        }
      />
      {daily.isLoading && !daily.data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard className="lg:col-span-2" title={t('reports.salesTrend')}>
            <ChartContainer config={salesConfig} className="h-72 w-full">
              <LineChart data={report.days} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </ChartCard>
          <ChartCard title={t('reports.byType')}>
            <ChartContainer config={typeConfig} className="mx-auto h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v) => formatCurrency(Number(v))} />} />
                <Pie data={report.types} dataKey="value" nameKey="name" innerRadius={55} strokeWidth={2}>
                  {report.types.map((x) => (
                    <Cell key={x.name} fill={x.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </ChartCard>
          <div className="lg:col-span-3">
            <ReportCards window={window} />
          </div>
        </div>
      )}
    </>
  )
}
