'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, CalculatorIcon, CrownIcon, FlameIcon, PercentIcon, RotateCcwIcon, TrophyIcon } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartCard } from '@/components/common/chart-card'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { TaxToggle } from '@/components/common/tax-toggle'
import { useOrders, useTaxRates } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useUnitCosts } from '@/hooks/use-unit-costs'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format'
import { profitabilityWithOverhead, rankItems, RANK_METRICS, type ItemProfit, type RankMetric } from '@/lib/utils/profitability'
import { aggregateSales } from '@/mocks/finance'
import { categories } from '@/mocks/menu'
import { useAppStore } from '@/stores/app-store'

const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Menu item'

const splitConfig = {
  itemCost: { label: 'Item cost', color: 'var(--chart-2)' },
  overhead: { label: 'Overhead', color: 'var(--chart-3)' },
  profit: { label: 'Profit', color: 'var(--chart-5)' },
} satisfies ChartConfig

/** Income of one item split into what it costs and what it earns, as a single stacked bar. */
function SplitBar({ item }: { item: ItemProfit }) {
  const pct = (v: number) => (item.income ? Math.max(0, (v / item.income) * 100) : 0)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span style={{ width: `${pct(item.itemCost)}%`, background: splitConfig.itemCost.color }} />
        <span style={{ width: `${pct(item.overhead)}%`, background: splitConfig.overhead.color }} />
        <span style={{ width: `${pct(item.profit)}%`, background: splitConfig.profit.color }} />
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <span>Item cost {formatPercent(pct(item.itemCost))}</span>
        <span>Overhead {formatPercent(pct(item.overhead))}</span>
        <span className="font-medium text-success">Profit {formatPercent(item.margin)}</span>
      </p>
    </div>
  )
}

function CostSourceBadge({ source }: { source: ItemProfit['costSource'] }) {
  return source === 'recipe' ? (
    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
      Costed
    </Badge>
  ) : (
    <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
      Estimate
    </Badge>
  )
}

function HeroCard({ item, metric, totalProfit }: { item: ItemProfit; metric: RankMetric; totalProfit: number }) {
  const metrics = [
    { label: 'Units sold', value: formatNumber(item.units) },
    { label: 'Income', value: formatCurrency(item.income) },
    { label: 'Expense / item', value: formatCurrency(item.expensePerUnit) },
    { label: 'Profit / item', value: formatCurrency(item.profitPerUnit) },
  ]
  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card lg:col-span-2">
      <TrophyIcon className="pointer-events-none absolute -end-6 -top-6 size-40 text-primary/[0.07]" aria-hidden />
      <CardContent className="relative flex flex-col gap-5 sm:flex-row">
        <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl border bg-muted sm:size-36">
          <Image src={item.image} alt="" fill className="object-cover" sizes="144px" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Badge className="gap-1">
                <CrownIcon data-icon="inline-start" />
                Hero item
              </Badge>
              <Badge variant="outline">#1 by {RANK_METRICS.find((m) => m.value === metric)?.label.toLowerCase()}</Badge>
              <CostSourceBadge source={item.costSource} />
            </div>
            <h2 className="truncate text-xl font-semibold tracking-tight">{item.name}</h2>
            <p className="text-sm text-muted-foreground">
              {categoryName(item.categoryId)} · earned <span className="font-semibold text-success">{formatCurrency(item.profit)}</span> profit,{' '}
              {formatPercent(totalProfit > 0 ? (Math.max(0, item.profit) / totalProfit) * 100 : 0)} of all item profit
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-lg border bg-background/70 px-3 py-2">
                <dt className="text-[11px] text-muted-foreground">{m.label}</dt>
                <dd className="text-sm font-semibold tabular-nums">{m.value}</dd>
              </div>
            ))}
          </dl>
          <SplitBar item={item} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function ItemProfitPage() {
  const { t } = useT()
  const { data: orderData, isLoading: ordersLoading } = useOrders()
  const { products, unitCosts, isLoading: costsLoading } = useUnitCosts()
  const { branchIds, days, inBranch, inRange } = useScope()
  const [metric, setMetric] = useState<RankMetric>('profit')
  const [overrideRate, setOverrideRate] = useState<number | null>(null)
  const { data: taxRates } = useTaxRates()
  const includeTax = useAppStore((s) => s.includeTax)

  const profit = useMemo(() => {
    const orders = inRange(inBranch(orderData ?? []), (o) => o.createdAt)
    const pl = aggregateSales(branchIds, days)
    return profitabilityWithOverhead(
      orders,
      products,
      { revenue: pl.reduce((s, d) => s + d.revenue, 0), expenses: pl.reduce((s, d) => s + d.expenses, 0) },
      overrideRate,
      unitCosts,
      { rates: taxRates ?? [], include: includeTax },
    )
  }, [orderData, products, unitCosts, inBranch, inRange, branchIds, days, overrideRate, taxRates, includeTax])

  const ranked = useMemo(() => rankItems(profit.items, metric), [profit.items, metric])
  const hero = ranked[0] ?? null
  const totalProfit = profit.items.reduce((s, i) => s + Math.max(0, i.profit), 0)
  const estimates = profit.items.filter((i) => i.costSource === 'menu').length
  const bestMargin = rankItems(profit.items, 'margin')[0]
  const bestSeller = rankItems(profit.items, 'units')[0]
  const weakest = rankItems(profit.items, 'margin').at(-1)

  const columns = useMemo<ColumnDef<ItemProfit, unknown>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        enableSorting: false,
        cell: ({ row }) => <span className="text-xs text-muted-foreground tabular-nums">{ranked.indexOf(row.original) + 1}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Item',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image src={row.original.image} alt="" fill className="object-cover" sizes="32px" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-medium">
                {row.original.name}
                {row.original.id === hero?.id && <CrownIcon className="size-3.5 shrink-0 text-primary" aria-label="Hero item" />}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {categoryName(row.original.categoryId)} <CostSourceBadge source={row.original.costSource} />
              </p>
            </div>
          </div>
        ),
      },
      { accessorKey: 'units', header: 'Sold', cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.units)}</span> },
      { accessorKey: 'income', header: 'Income', cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.income)}</span> },
      {
        accessorKey: 'expense',
        header: 'Expense',
        cell: ({ row }) => (
          <div className="tabular-nums">
            <p>{formatCurrency(row.original.expense)}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatCompactCurrency(row.original.itemCost)} item + {formatCompactCurrency(row.original.overhead)} overhead
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'expensePerUnit',
        header: 'Expense / item',
        cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.expensePerUnit)}</span>,
      },
      {
        accessorKey: 'profitPerUnit',
        header: 'Profit / item',
        cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.profitPerUnit)}</span>,
      },
      {
        accessorKey: 'profit',
        header: 'Profit',
        cell: ({ row }) => (
          <span className={cn('font-medium tabular-nums', row.original.profit >= 0 ? 'text-success' : 'text-destructive')}>
            {formatCurrency(row.original.profit)}
          </span>
        ),
      },
      {
        accessorKey: 'margin',
        header: 'Margin',
        cell: ({ row }) => (
          <div className="flex w-24 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full', row.original.margin >= 30 ? 'bg-success' : row.original.margin >= 15 ? 'bg-warning' : 'bg-destructive')}
                style={{ width: `${Math.max(0, Math.min(100, row.original.margin))}%` }}
              />
            </div>
            <span className="w-9 text-end text-xs tabular-nums">{formatPercent(row.original.margin)}</span>
          </div>
        ),
      },
    ],
    [ranked, hero?.id],
  )

  const chartItems = ranked.slice(0, 8).map((i) => ({ ...i, name: i.name.length > 20 ? `${i.name.slice(0, 19)}…` : i.name }))
  const ratePct = Math.round(profit.rate * 1000) / 10

  return (
    <>
      <PageHeader
        title={t('itemProfit.title')}
        description={t('itemProfit.subtitle')}
        actions={
          <>
            <TaxToggle />
            <OptionSelect
              className="h-9 w-56"
              value={metric}
              onValueChange={(v) => setMetric(v as RankMetric)}
              aria-label="Rank items by"
              options={RANK_METRICS.map((m) => ({ value: m.value, label: `Rank by: ${m.label}` }))}
            />
            <Button variant="outline" render={<Link href="/finance/costing" />} nativeButton={false}>
              <CalculatorIcon data-icon="inline-start" />
              {t('nav.costing')}
            </Button>
          </>
        }
      />

      {ordersLoading || costsLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {hero ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <HeroCard item={hero} metric={metric} totalProfit={totalProfit} />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('expenses.standouts')}</CardTitle>
                  <CardDescription>{t('expenses.standoutsHint')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-4">
                    {[
                      { icon: PercentIcon, tone: 'bg-success/15 text-success', label: 'Best margin', item: bestMargin, value: formatPercent(bestMargin?.margin ?? 0) },
                      { icon: FlameIcon, tone: 'bg-delivery/15 text-delivery', label: 'Best seller', item: bestSeller, value: `${formatNumber(bestSeller?.units ?? 0)} sold` },
                      { icon: AlertTriangleIcon, tone: 'bg-destructive/12 text-destructive', label: 'Needs attention (lowest margin)', item: weakest, value: formatPercent(weakest?.margin ?? 0) },
                    ].map(
                      (r) =>
                        r.item && (
                          <li key={r.label} className="flex items-center gap-3">
                            <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', r.tone)}>
                              <r.icon className="size-4" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-muted-foreground">{r.label}</p>
                              <p className="truncate text-sm font-medium">{r.item.name}</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">{r.value}</span>
                          </li>
                        ),
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
                <TrophyIcon className="size-5" aria-hidden />
                {t('expenses.noSales')}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{t('expenses.howCalculated')}</p>
                <p className="text-pretty text-muted-foreground">
                  Income is {includeTax ? 'counted with' : 'counted without'} the sales tax collected on each item (rates from{' '}
                  <Link href="/taxes" className="font-medium text-primary underline-offset-2 hover:underline">Tax Management</Link>). Expense per item = item cost per
                  serving + overhead at {formatPercent(ratePct, 1)} of the item&apos;s income before tax. Item cost comes from the
                  item&apos;s costing sheet (ingredients, wastage, packaging, gas, labour); items without one use the menu cost as an estimate
                  {estimates > 0 && (
                    <>
                      {' '}
                      (<Link href="/finance/costing" className="font-medium text-primary underline-offset-2 hover:underline">{estimates} sold items still estimated</Link>)
                    </>
                  )}
                  . Auto overhead = total costs ({formatPercent((profit.autoRate + profit.foodCostRate) * 100)} of sales) minus item cost (
                  {formatPercent(profit.foodCostRate * 100)}).
                </p>
              </div>
              <InputGroup className="w-full shrink-0 sm:w-56">
                <InputGroupAddon>
                  <InputGroupText>Overhead</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  type="number"
                  min={0}
                  max={90}
                  step={0.5}
                  inputMode="decimal"
                  aria-label="Overhead allocation percent"
                  value={ratePct}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) setOverrideRate(Math.min(90, Math.max(0, v)) / 100)
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>%</InputGroupText>
                  {overrideRate !== null && (
                    <InputGroupButton size="icon-xs" onClick={() => setOverrideRate(null)} aria-label="Reset to automatic overhead">
                      <RotateCcwIcon />
                    </InputGroupButton>
                  )}
                </InputGroupAddon>
              </InputGroup>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-5">
            <ChartCard
              className="lg:col-span-3"
              title={t('expenses.whereMoneyGoes')}
              description={`Top 8 by ${RANK_METRICS.find((m) => m.value === metric)?.label.toLowerCase()}: income split into item cost, overhead and profit`}
            >
              <ChartContainer config={splitConfig} className="h-80 w-full">
                <BarChart data={chartItems} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactCurrency(Number(v))} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={150} />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(v, name) => `${splitConfig[name as keyof typeof splitConfig]?.label ?? name}: ${formatCurrency(Number(v))}`} />}
                  />
                  <Bar dataKey="itemCost" stackId="a" fill="var(--color-itemCost)" />
                  <Bar dataKey="overhead" stackId="a" fill="var(--color-overhead)" />
                  <Bar dataKey="profit" stackId="a" fill="var(--color-profit)" radius={[0, 4, 4, 0]} />
                  <ChartLegend content={<ChartLegendContent />} />
                </BarChart>
              </ChartContainer>
            </ChartCard>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t('expenses.menuTotals')}</CardTitle>
                <CardDescription>{formatNumber(profit.items.length)} items sold in this period</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {[
                  { label: includeTax ? 'Item income (incl. tax)' : 'Item income (excl. tax)', value: profit.income, cls: '' },
                  { label: t('finance.taxCollected'), value: profit.tax, cls: 'text-muted-foreground' },
                  { label: 'Item expense', value: profit.expense, cls: 'text-destructive' },
                  { label: 'Item profit', value: profit.profit, cls: 'text-success' },
                ].map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-muted-foreground">{r.label}</span>
                    <span className={cn('text-lg font-semibold tabular-nums', r.cls)}>{formatCurrency(r.value)}</span>
                  </div>
                ))}
                <div className="rounded-lg bg-muted/60 p-3 text-sm">
                  <span className="text-muted-foreground">Average margin </span>
                  <span className="font-semibold">{formatPercent(profit.income ? (profit.profit / profit.income) * 100 : 0, 1)}</span>
                  <span className="text-muted-foreground"> · item cost </span>
                  <span className="font-semibold">{formatPercent(profit.foodCostRate * 100, 1)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <DataTable
            key={metric}
            columns={columns}
            data={ranked}
            exportName="item-profitability"
            initialSort={[{ id: metric, desc: true }]}
            exportRows={(r) =>
              r.map((x) => ({
                item: x.name,
                costSource: x.costSource,
                units: x.units,
                income: Math.round(x.income),
                tax: Math.round(x.tax),
                itemCost: Math.round(x.itemCost),
                overhead: Math.round(x.overhead),
                expensePerItem: Math.round(x.expensePerUnit),
                profitPerItem: Math.round(x.profitPerUnit),
                profit: Math.round(x.profit),
                marginPct: Math.round(x.margin * 10) / 10,
              }))
            }
          />
        </div>
      )}
    </>
  )
}
