'use client'

import type { ComponentType } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangleIcon,
  BanknoteIcon,
  ArrowRightIcon,
  ClockIcon,
  CrownIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartCard } from '@/components/common/chart-card'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useT } from '@/lib/i18n/use-t'
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelative,
  initials,
  titleCase,
} from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import { branchName } from '@/mocks/branches'
import { OptionSelect } from '@/components/common/option-select'
import { metricValue, rankItems, RANK_METRICS, type RankMetric } from '@/lib/utils/profitability'
import { useDashboardStore, type WidgetSize } from '@/stores/dashboard-store'
import type { DashboardData } from './use-dashboard-data'

interface WidgetProps {
  data: DashboardData
  title: string
}

export interface WidgetDefinition {
  id: string
  icon: LucideIcon
  sizes: WidgetSize[]
  Component: ComponentType<WidgetProps>
}

const PIE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>
}

function ListRow({ children }: { children: React.ReactNode }) {
  return <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">{children}</li>
}

/* KPI widgets */

function SalesKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard
      label={title}
      value={formatCurrency(data.series.at(-1)?.revenue ?? 0)}
      icon={BanknoteIcon}
      delta={
        data.series.length > 1
          ? (((data.series.at(-1)?.revenue ?? 0) - (data.series.at(-2)?.revenue ?? 1)) / (data.series.at(-2)?.revenue ?? 1)) * 100
          : undefined
      }
      deltaLabel={t('dashboard.vsYesterday')}
      className="h-full"
    />
  )
}

function OrdersKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard label={title} value={formatNumber(data.totals.orders)} icon={ShoppingBagIcon} delta={data.deltas.orders} deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function AovKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard label={title} value={formatCurrency(data.aov)} icon={ReceiptIcon} delta={data.deltas.aov} deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function ProfitKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard label={title} value={formatCompactCurrency(data.totals.profit)} icon={TrendingUpIcon} delta={data.deltas.profit} deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function ExpensesKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard label={title} value={formatCompactCurrency(data.totals.expenses)} icon={WalletIcon} delta={data.deltas.expenses} invertDelta deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function PendingKpi({ data, title }: WidgetProps) {
  return <StatCard label={title} value={formatNumber(data.pending)} icon={ClockIcon} hint="Awaiting kitchen or confirmation" className="h-full" />
}

function EmployeesKpi({ data, title }: WidgetProps) {
  return <StatCard label={title} value={formatNumber(data.activeEmployees)} icon={UsersIcon} hint="Currently on the roster" className="h-full" />
}

function LowStockKpi({ data, title }: WidgetProps) {
  return <StatCard label={title} value={formatNumber(data.lowStockCount)} icon={AlertTriangleIcon} hint="Items at or below minimum" className="h-full" />
}

/* Chart widgets */

const revenueConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-4)' },
} satisfies ChartConfig

function RevenueTrend({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Revenue versus expenses">
      <ChartContainer config={revenueConfig} className="h-64 w-full">
        <AreaChart data={data.series} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompactCurrency(v).replace('Rs ', '')} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
          <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} fill="url(#fillRevenue)" />
          <Area dataKey="expenses" type="monotone" stroke="var(--color-expenses)" strokeWidth={2} fill="none" strokeDasharray="4 4" />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  )
}

const orderConfig = { orders: { label: 'Orders', color: 'var(--chart-2)' } } satisfies ChartConfig

function OrderTrend({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Orders per day">
      <ChartContainer config={orderConfig} className="h-64 w-full">
        <BarChart data={data.series} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

function Donut({ rows, title, description }: { rows: { name: string; value: number }[]; title: string; description: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0)
  const config = Object.fromEntries(rows.map((r, i) => [r.name, { label: titleCase(r.name), color: PIE_COLORS[i % PIE_COLORS.length] }])) satisfies ChartConfig
  return (
    <ChartCard title={title} description={description}>
      {rows.length === 0 ? (
        <EmptyNote>No sales in this range</EmptyNote>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ChartContainer config={config} className="aspect-square h-44 shrink-0">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel formatter={(v) => formatCurrency(Number(v))} />} />
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} strokeWidth={2}>
                {rows.map((r, i) => (
                  <Cell key={r.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="flex w-full flex-col gap-2 text-sm">
            {rows.map((r, i) => (
              <li key={r.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden />
                  <span className="truncate">{titleCase(r.name)}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{total ? Math.round((r.value / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  )
}

function SalesCategory({ data, title }: WidgetProps) {
  return <Donut rows={data.byCategory.slice(0, 5)} title={title} description="Share of revenue" />
}

function SalesPayment({ data, title }: WidgetProps) {
  return <Donut rows={data.byPayment} title={title} description="How customers paid" />
}

const branchConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  profit: { label: 'Profit', color: 'var(--chart-3)' },
} satisfies ChartConfig

function BranchPerformance({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Revenue and profit by branch">
      <ChartContainer config={branchConfig} className="h-60 w-full">
        <BarChart data={data.branchPerformance} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompactCurrency(v).replace('Rs ', '')} />
          <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />} />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit" fill="var(--color-profit)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

/* List widgets */

const MEDALS = [
  { label: '1st', ring: 'ring-amber-400/70', chip: 'bg-amber-400 text-amber-950' },
  { label: '2nd', ring: 'ring-slate-300', chip: 'bg-slate-300 text-slate-900' },
  { label: '3rd', ring: 'ring-orange-300/80', chip: 'bg-orange-300 text-orange-950' },
]

function HeroItems({ data, title }: WidgetProps) {
  const { items, orders, profit, date } = data.heroItems
  const metric = useDashboardStore((s) => s.heroMetric)
  const setMetric = useDashboardStore((s) => s.setHeroMetric)
  const top = rankItems(items, metric).slice(0, 3)
  const estimated = top.some((i) => i.costSource === 'menu')
  return (
    <ChartCard
      title={title}
      description={`${formatDate(date)} · ${formatNumber(orders)} orders · ${formatCompactCurrency(profit)} item profit`}
      action={
        <div className="flex items-center gap-1">
          <OptionSelect
            className="h-8 w-44 text-xs"
            value={metric}
            onValueChange={(v) => setMetric(v as RankMetric)}
            aria-label="Rank hero items by"
            options={RANK_METRICS.map((m) => ({ value: m.value, label: m.label }))}
          />
          <Button variant="ghost" size="sm" render={<Link href="/finance/item-profit" />} nativeButton={false} aria-label="All items">
            <span className="hidden @lg/card-header:inline">All items</span>
            <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
          </Button>
        </div>
      }
    >
      {top.length === 0 ? (
        <EmptyNote>No sales yet today</EmptyNote>
      ) : (
        <div className="@container flex flex-col gap-2">
          <ol className="grid gap-3 @2xl:grid-cols-3">
            {top.map((item, i) => {
              const medal = MEDALS[i]
              const hero = i === 0
              const secondary = RANK_METRICS.filter((m) => m.value !== metric).map((m) => metricValue(item, m.value))
              return (
                <li
                  key={item.id}
                  className={cn(
                    'relative flex gap-3 rounded-xl border p-3',
                    hero ? 'border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card' : 'bg-card',
                  )}
                >
                  <div className={cn('relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted ring-2', medal.ring)}>
                    <Image src={item.image} alt="" fill className="object-cover" sizes="64px" />
                    <span className={cn('absolute start-1 top-1 rounded px-1 text-[10px] font-bold leading-4', medal.chip)}>{medal.label}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="min-w-0">
                      {hero && (
                        <Badge className="mb-1 h-5 gap-1 px-1.5 text-[10px]">
                          <CrownIcon data-icon="inline-start" />
                          Hero item
                        </Badge>
                      )}
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.category} · {formatCurrency(item.income)} income
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('text-base font-semibold tabular-nums', metric === 'units' ? 'text-foreground' : 'text-success')}>
                        {metricValue(item, metric)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">{secondary.join(' · ')}</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, item.margin))} className="h-1.5" aria-label={`Margin ${formatPercent(item.margin)}`} />
                  </div>
                </li>
              )
            })}
          </ol>
          {estimated && (
            <p className="text-[11px] text-muted-foreground">
              Some items use the menu cost as an estimate.{' '}
              <Link href="/finance/costing" className="font-medium text-primary underline-offset-2 hover:underline">
                Add their costing
              </Link>{' '}
              for exact profit.
            </p>
          )}
        </div>
      )}
    </ChartCard>
  )
}

function BestSellers({ data, title }: WidgetProps) {
  const max = data.bestSellers[0]?.qty ?? 1
  return (
    <ChartCard title={title} description="By units sold">
      {data.bestSellers.length === 0 ? (
        <EmptyNote>No orders in this range</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.bestSellers.map((p) => (
            <li key={p.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{p.qty} sold</span>
              </div>
              <Progress value={(p.qty / max) * 100} className="h-1.5" />
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}

function RecentTransactions({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Latest income and expenses">
      <ul className="divide-y">
        {data.recentTransactions.map((tx) => (
          <ListRow key={tx.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{tx.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                {tx.category} · {branchName(tx.branchId)} · {formatRelative(tx.date)}
              </p>
            </div>
            <span className={tx.type === 'income' ? 'shrink-0 text-sm font-medium tabular-nums text-success' : 'shrink-0 text-sm font-medium tabular-nums'}>
              {tx.type === 'income' ? '+' : '-'}
              {formatCurrency(tx.amount)}
            </span>
          </ListRow>
        ))}
      </ul>
    </ChartCard>
  )
}

function RecentActivity({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Across your team today">
      <ul className="divide-y">
        {data.recentActivity.slice(0, 6).map((a) => (
          <ListRow key={a.id}>
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(a.userName)}</AvatarFallback>
              </Avatar>
              <p className="min-w-0 text-sm">
                <span className="font-medium">{a.userName}</span> <span className="text-muted-foreground">{a.action}</span>{' '}
                <span className="font-medium">{a.target}</span>
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(a.at)}</span>
          </ListRow>
        ))}
      </ul>
    </ChartCard>
  )
}

function VendorAlerts({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Largest outstanding balances">
      <ul className="divide-y">
        {data.vendorAlerts.map((v) => (
          <ListRow key={v.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{v.name}</p>
              <p className="truncate text-xs text-muted-foreground">{v.category}</p>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums">{formatCurrency(v.outstanding)}</span>
          </ListRow>
        ))}
      </ul>
    </ChartCard>
  )
}

function TopCustomers({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="By lifetime spend">
      <ul className="divide-y">
        {data.topCustomers.map((c) => (
          <ListRow key={c.id}>
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(c.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.totalOrders} orders</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums">{formatCurrency(c.totalSpent)}</span>
          </ListRow>
        ))}
      </ul>
    </ChartCard>
  )
}

function InventoryAlerts({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Items that need attention">
      {data.inventoryAlerts.length === 0 ? (
        <EmptyNote>Stock levels look healthy</EmptyNote>
      ) : (
        <ul className="divide-y">
          {data.inventoryAlerts.map(({ item, status }) => (
            <ListRow key={item.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.quantity} {item.unit} left · {branchName(item.branchId)}
                </p>
              </div>
              <StatusBadge status={status} />
            </ListRow>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}

function EmployeePerformance({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Top performers by score">
      <ul className="divide-y">
        {data.topEmployees.map((e) => (
          <ListRow key={e.id}>
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(e.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="text-xs capitalize text-muted-foreground">{titleCase(e.role)}</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums">{e.performance}%</span>
          </ListRow>
        ))}
      </ul>
    </ChartCard>
  )
}

const KPI_SIZES: WidgetSize[] = ['sm', 'md']
const CHART_SIZES: WidgetSize[] = ['md', 'lg', 'full']

export const widgetRegistry: WidgetDefinition[] = [
  { id: 'sales', icon: BanknoteIcon, sizes: KPI_SIZES, Component: SalesKpi },
  { id: 'orders', icon: ShoppingBagIcon, sizes: KPI_SIZES, Component: OrdersKpi },
  { id: 'aov', icon: ReceiptIcon, sizes: KPI_SIZES, Component: AovKpi },
  { id: 'profit', icon: TrendingUpIcon, sizes: KPI_SIZES, Component: ProfitKpi },
  { id: 'expenses', icon: WalletIcon, sizes: KPI_SIZES, Component: ExpensesKpi },
  { id: 'pending', icon: ClockIcon, sizes: KPI_SIZES, Component: PendingKpi },
  { id: 'employees', icon: UsersIcon, sizes: KPI_SIZES, Component: EmployeesKpi },
  { id: 'lowstock', icon: AlertTriangleIcon, sizes: KPI_SIZES, Component: LowStockKpi },
  { id: 'revenueTrend', icon: TrendingUpIcon, sizes: CHART_SIZES, Component: RevenueTrend },
  { id: 'orderTrend', icon: ShoppingBagIcon, sizes: CHART_SIZES, Component: OrderTrend },
  { id: 'heroItems', icon: CrownIcon, sizes: CHART_SIZES, Component: HeroItems },
  { id: 'bestSellers', icon: ShoppingBagIcon, sizes: CHART_SIZES, Component: BestSellers },
  { id: 'salesCategory', icon: ReceiptIcon, sizes: CHART_SIZES, Component: SalesCategory },
  { id: 'salesPayment', icon: WalletIcon, sizes: CHART_SIZES, Component: SalesPayment },
  { id: 'branchPerformance', icon: TrendingUpIcon, sizes: CHART_SIZES, Component: BranchPerformance },
  { id: 'recentTransactions', icon: BanknoteIcon, sizes: CHART_SIZES, Component: RecentTransactions },
  { id: 'recentActivity', icon: ClockIcon, sizes: CHART_SIZES, Component: RecentActivity },
  { id: 'vendorAlerts', icon: AlertTriangleIcon, sizes: CHART_SIZES, Component: VendorAlerts },
  { id: 'topCustomers', icon: UsersIcon, sizes: CHART_SIZES, Component: TopCustomers },
  { id: 'inventoryAlerts', icon: AlertTriangleIcon, sizes: CHART_SIZES, Component: InventoryAlerts },
  { id: 'employeePerformance', icon: UsersIcon, sizes: CHART_SIZES, Component: EmployeePerformance },
]

export const widgetById = Object.fromEntries(widgetRegistry.map((w) => [w.id, w])) as Record<string, WidgetDefinition>
