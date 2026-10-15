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
import { useOrders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { downloadCsv } from '@/lib/utils/csv'
import { formatCompactCurrency, formatCurrency, titleCase } from '@/lib/utils/format'

const salesConfig = { revenue: { label: 'Revenue', color: 'var(--chart-1)' }, orders: { label: 'Orders', color: 'var(--chart-3)' } } satisfies ChartConfig
const hourConfig = { orders: { label: 'Orders', color: 'var(--chart-2)' } } satisfies ChartConfig
const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function ReportsPage() {
  const { t } = useT()
  const { data, isLoading } = useOrders()
  const { inBranch, inRange } = useScope()

  const orders = useMemo(() => inRange(inBranch(data ?? []), (o) => o.createdAt).filter((o) => o.status !== 'cancelled'), [data, inBranch, inRange])

  const report = useMemo(() => {
    const byDay = new Map<string, { revenue: number; orders: number }>()
    const byType = new Map<string, number>()
    const byHour = new Map<number, number>()
    const byProduct = new Map<string, { qty: number; revenue: number }>()
    for (const o of orders) {
      const d = o.createdAt.slice(5, 10)
      const b = byDay.get(d) ?? { revenue: 0, orders: 0 }
      b.revenue += o.total
      b.orders++
      byDay.set(d, b)
      byType.set(o.type, (byType.get(o.type) ?? 0) + o.total)
      const h = Number(o.createdAt.slice(11, 13))
      byHour.set(h, (byHour.get(h) ?? 0) + 1)
      for (const i of o.items) {
        const p = byProduct.get(i.name) ?? { qty: 0, revenue: 0 }
        p.qty += i.quantity
        p.revenue += i.quantity * i.unitPrice
        byProduct.set(i.name, p)
      }
    }
    return {
      days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
      types: [...byType.entries()].map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] })),
      hours: Array.from({ length: 16 }, (_, i) => ({ hour: `${i + 8}h`, orders: byHour.get(i + 8) ?? 0 })),
      top: [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
      total: orders.reduce((s, o) => s + o.total, 0),
    }
  }, [orders])

  const typeConfig = Object.fromEntries(report.types.map((x) => [x.name, { label: titleCase(x.name), color: x.fill }])) satisfies ChartConfig

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        description={`${t('reports.subtitle')} · ${formatCurrency(report.total)}`}
        actions={
          <Button variant="outline" onClick={() => downloadCsv('sales-report', report.days)} disabled={isLoading}>
            <DownloadIcon data-icon="inline-start" />
            {t('common.exportCsv')}
          </Button>
        }
      />
      {isLoading ? (
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
          <ChartCard title={t('reports.peakHours')}>
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
          <ChartCard className="lg:col-span-2" title={t('reports.topProducts')}>
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
        </div>
      )}
    </>
  )
}
