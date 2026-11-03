'use client'

import { useMemo } from 'react'
import { DownloadIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartCard } from '@/components/common/chart-card'
import { PageHeader } from '@/components/common/page-header'
import { TaxToggle } from '@/components/common/tax-toggle'
import { useOrders, useProducts, useTaxRates } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { downloadCsv } from '@/lib/utils/csv'
import { formatCompactCurrency, formatCurrency, titleCase } from '@/lib/utils/format'
import { productPriceSplit } from '@/lib/utils/tax'
import { useAppStore } from '@/stores/app-store'
import { presetWindow, sumMinor, useDailySales, useInsightsReport } from '@/hooks/use-insights'
import { ReportCards } from './report-cards'

const salesConfig = { revenue: { label: 'Revenue', color: 'var(--chart-1)' }, orders: { label: 'Orders', color: 'var(--chart-3)' } } satisfies ChartConfig
const hourConfig = { orders: { label: 'Orders', color: 'var(--chart-2)' } } satisfies ChartConfig
const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function ReportsPage() {
  const { t } = useT()
  const { data, isLoading } = useOrders()
  const { inBranch, preset } = useScope()
  const { data: products } = useProducts()
  const { data: taxRates } = useTaxRates()
  const includeTax = useAppStore((s) => s.includeTax)

  const window = useMemo(() => presetWindow(preset), [preset])
  const daily = useDailySales(window)
  const sales = useInsightsReport('sales', window)
  const cur = sales.currency
  // Peak hours and top products have no report model; they come from the loaded orders.
  const orders = useMemo(
    () => inBranch(data ?? []).filter((o) => o.createdAt.slice(0, 10) >= window.from && o.status !== 'cancelled'),
    [data, inBranch, window.from],
  )

  const report = useMemo(() => {
    const productById = new Map((products ?? []).map((p) => [p.id, p]))
    const byHour = new Map<number, number>()
    const byProduct = new Map<string, { qty: number; revenue: number }>()
    for (const o of orders) {
      const h = Number(o.createdAt.slice(11, 13))
      byHour.set(h, (byHour.get(h) ?? 0) + 1)
      for (const i of o.items) {
        const p = byProduct.get(i.name) ?? { qty: 0, revenue: 0 }
        const product = productById.get(i.productId)
        const amount = i.quantity * i.unitPrice
        const split = product ? productPriceSplit(product, taxRates ?? [], amount) : { net: amount, gross: amount }
        p.qty += i.quantity
        p.revenue += includeTax ? split.gross : split.net
        byProduct.set(i.name, p)
      }
    }
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
      hours: Array.from({ length: 16 }, (_, i) => ({ hour: `${i + 8}h`, orders: byHour.get(i + 8) ?? 0 })),
      top: [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      total: sumMinor(sales.data?.rows, revenueOf, cur),
    }
  }, [orders, products, taxRates, includeTax, daily.data, sales.data, cur])

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
      {isLoading && !daily.data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
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
          <ChartCard title={t('reports.peakHours')} description="From loaded orders">
            <ChartContainer config={hourConfig} className="h-64 w-full">
              <BarChart data={report.hours}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={1} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
              </BarChart>
            </ChartContainer>
          </ChartCard>
          <ChartCard className="lg:col-span-2" title={t('reports.topProducts')} description="From loaded orders (no server report for items yet)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead className="text-end">{t('common.quantity')}</TableHead>
                  <TableHead className="text-end">{t('common.revenue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.top.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{p.qty}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatCurrency(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ChartCard>
          <div className="lg:col-span-2">
            <ReportCards window={window} />
          </div>
        </div>
      )}
    </>
  )
}
