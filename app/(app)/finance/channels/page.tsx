'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/chart-card'
import { channelMeta } from '@/components/common/channel-icon'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useOrders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { channelOf, channels, isRejected, summarizeChannels } from '@/lib/utils/channels'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/utils/format'
import type { SalesChannel } from '@/types'

const chartConfig = {
  'dine-in': { label: 'Dine-in', color: 'var(--chart-1)' },
  takeaway: { label: 'Takeaway', color: 'var(--chart-2)' },
  'own-delivery': { label: 'Own delivery', color: 'var(--chart-3)' },
  foodpanda: { label: 'Foodpanda', color: 'var(--chart-4)' },
  website: { label: 'Website', color: 'var(--chart-5)' },
} satisfies ChartConfig

const compareConfig = {
  gross: { label: 'Gross sales', color: 'var(--chart-1)' },
  net: { label: 'Net after commission', color: 'var(--chart-2)' },
} satisfies ChartConfig

export default function ChannelComparisonPage() {
  const { t } = useT()
  const { data, isLoading } = useOrders()
  const { inBranch, inRange } = useScope()
  const [channel, setChannel] = useState('all')

  const orders = useMemo(() => inRange(inBranch(data ?? []), (o) => o.createdAt), [data, inBranch, inRange])
  const summary = useMemo(() => summarizeChannels(orders), [orders])
  const totalGross = summary.reduce((s, c) => s + c.gross, 0)
  const totalNet = summary.reduce((s, c) => s + c.net, 0)

  const daily = useMemo(() => {
    const byDay = new Map<string, Record<SalesChannel, number>>()
    for (const o of orders) {
      if (o.status === 'cancelled' || isRejected(o)) continue
      const ch = channelOf(o)
      if (channel !== 'all' && ch !== channel) continue
      const day = o.createdAt.slice(0, 10)
      const bucket = byDay.get(day) ?? { 'dine-in': 0, takeaway: 0, 'own-delivery': 0, foodpanda: 0, website: 0 }
      bucket[ch] += o.total
      byDay.set(day, bucket)
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), ...v }))
  }, [orders, channel])

  const visible = channel === 'all' ? channels : channels.filter((c) => c === channel)

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('nav.channels')} />
        <Skeleton className="h-96" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('nav.channels')}
        description="Compare earnings from dine-in, takeaway, your own delivery, Foodpanda and your website."
        actions={
          <OptionSelect
            className="h-9 w-48"
            value={channel}
            onValueChange={setChannel}
            aria-label="Channel"
            options={[{ value: 'all', label: t('channel.all') }, ...channels.map((c) => ({ value: c, label: chartConfig[c].label }))]}
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {summary.map((c) => {
          return (
            <StatCard
              key={c.channel}
              label={chartConfig[c.channel].label}
              value={formatCurrency(c.net)}
              icon={channelMeta[c.channel].icon}
              tone={c.channel === 'dine-in' ? 'dine' : c.channel === 'own-delivery' ? 'delivery' : c.channel}
              hint={`${c.orders} orders · ${totalGross ? formatPercent((c.gross / totalGross) * 100) : '0%'} of sales`}
            />
          )
        })}
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-5">
        <ChartCard title="Daily sales by channel" description="Gross sales per day" className="xl:col-span-3">
          <ChartContainer config={chartConfig} className="h-72 w-full">
            <BarChart data={daily} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(v) => formatCompactCurrency(v)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {visible.map((c) => (
                <Bar key={c} dataKey={c} stackId="a" fill={`var(--color-${c})`} />
              ))}
            </BarChart>
          </ChartContainer>
        </ChartCard>
        <ChartCard title="Gross vs net" description="Foodpanda commission reduces what you keep" className="xl:col-span-2">
          <ChartContainer config={compareConfig} className="h-72 w-full">
            <BarChart data={summary.map((c) => ({ name: chartConfig[c.channel].label, gross: c.gross, net: c.net }))} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(v) => formatCompactCurrency(v)} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="gross" fill="var(--color-gross)" radius={4} />
              <Bar dataKey="net" fill="var(--color-net)" radius={4} />
            </BarChart>
          </ChartContainer>
        </ChartCard>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Avg order</TableHead>
              <TableHead className="text-right">Gross sales</TableHead>
              <TableHead className="text-right">Delivery fees</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Net earnings</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.map((c) => (
              <TableRow key={c.channel} data-state={channel === c.channel ? 'selected' : undefined}>
                <TableCell className="font-medium">{chartConfig[c.channel].label}</TableCell>
                <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(c.avgOrder)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(c.gross)}</TableCell>
                <TableCell className="text-right tabular-nums">{c.deliveryFees ? formatCurrency(c.deliveryFees) : '-'}</TableCell>
                <TableCell className="text-right tabular-nums">{c.commission ? `-${formatCurrency(c.commission)}` : '-'}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCurrency(c.net)}</TableCell>
                <TableCell className="text-right tabular-nums">{totalNet ? formatPercent((c.net / totalNet) * 100) : '0%'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{summary.reduce((s, c) => s + c.orders, 0)}</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{formatCurrency(totalGross)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(summary.reduce((s, c) => s + c.deliveryFees, 0))}</TableCell>
              <TableCell className="text-right tabular-nums">-{formatCurrency(summary.reduce((s, c) => s + c.commission, 0))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(totalNet)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  )
}
