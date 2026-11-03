'use client'

import type { ComponentType } from 'react'
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
  ClockIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { ChartCard } from '@/components/common/chart-card'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useT } from '@/lib/i18n/use-t'
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatRelative,
  initials,
  titleCase,
} from '@/lib/utils/format'
import { branchName } from '@/lib/directory'
import type { WidgetId, WidgetSize } from '@/stores/dashboard-store'
import type { DashboardData } from './use-dashboard-data'

interface WidgetProps {
  data: DashboardData
  title: string
}

export interface WidgetDefinition {
  id: WidgetId
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

/** Value shown when the server section did not load (no permission / failed), unlike a real zero. */
const NA = '—'
const NA_HINT = 'Not available'

function SalesKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard
      label={title}
      value={data.available.trend ? formatCurrency(data.series.at(-1)?.revenue ?? 0) : NA}
      icon={BanknoteIcon}
      hint={data.available.trend ? undefined : NA_HINT}
      delta={
        data.available.trend && data.series.length > 1
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
    <StatCard label={title} value={data.available.sales ? formatNumber(data.totals.orders) : NA} hint={data.available.sales ? undefined : NA_HINT} icon={ShoppingBagIcon} delta={data.available.sales ? data.deltas.orders : undefined} deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function AovKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard label={title} value={data.available.sales ? formatCurrency(data.aov) : NA} hint={data.available.sales ? undefined : NA_HINT} icon={ReceiptIcon} delta={data.available.sales ? data.deltas.aov : undefined} deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function ProfitKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard
      label={title}
      value={data.available.sales && data.available.expenses ? formatCompactCurrency(data.totals.profit) : NA}
      hint={data.available.sales && data.available.expenses ? 'Sales minus recorded expenses' : NA_HINT}
      icon={TrendingUpIcon}
      delta={data.available.sales && data.available.expenses ? data.deltas.profit : undefined}
      deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function ExpensesKpi({ data, title }: WidgetProps) {
  const { t } = useT()
  return (
    <StatCard label={title} value={data.available.expenses ? formatCompactCurrency(data.totals.expenses) : NA} hint={data.available.expenses ? undefined : NA_HINT} icon={WalletIcon} delta={data.available.expenses ? data.deltas.expenses : undefined} invertDelta deltaLabel={t('dashboard.vsPrevious')} className="h-full" />
  )
}

function PendingKpi({ data, title }: WidgetProps) {
  return <StatCard label={title} value={data.available.orderStatuses ? formatNumber(data.pending) : NA} icon={ClockIcon} hint={data.available.orderStatuses ? 'Awaiting kitchen or confirmation (today)' : NA_HINT} className="h-full" />
}

function LowStockKpi({ data, title }: WidgetProps) {
  return <StatCard label={title} value={data.available.lowStock ? formatNumber(data.lowStockCount) : NA} icon={AlertTriangleIcon} hint={data.available.lowStock ? 'Items below their reorder level' : NA_HINT} className="h-full" />
}

/* Chart widgets */

const revenueConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-4)' },
} satisfies ChartConfig

function RevenueTrend({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Revenue versus expenses">
      {!data.available.trend ? (
        <EmptyNote>Sales trend not available</EmptyNote>
      ) : (
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
      )}
    </ChartCard>
  )
}

const orderConfig = { orders: { label: 'Orders', color: 'var(--chart-2)' } } satisfies ChartConfig

function OrderTrend({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Orders per day">
      {!data.available.trend ? (
        <EmptyNote>Order trend not available</EmptyNote>
      ) : (
      <ChartContainer config={orderConfig} className="h-64 w-full">
        <BarChart data={data.series} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
      )}
    </ChartCard>
  )
}

function Donut({ rows, title, description, unavailable }: { rows: { name: string; value: number }[]; title: string; description: string; unavailable?: boolean }) {
  const total = rows.reduce((s, r) => s + r.value, 0)
  const config = Object.fromEntries(rows.map((r, i) => [r.name, { label: titleCase(r.name), color: PIE_COLORS[i % PIE_COLORS.length] }])) satisfies ChartConfig
  return (
    <ChartCard title={title} description={description}>
      {unavailable ? (
        <EmptyNote>Not available</EmptyNote>
      ) : rows.length === 0 ? (
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

function SalesPayment({ data, title }: WidgetProps) {
  return <Donut rows={data.byPayment} title={title} description="How customers paid" unavailable={!data.available.payments} />
}

const branchConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  profit: { label: 'Profit', color: 'var(--chart-3)' },
} satisfies ChartConfig

function BranchPerformance({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Revenue and profit (sales minus expenses) by branch">
      {!data.available.branches ? (
        <EmptyNote>Branch comparison not available</EmptyNote>
      ) : data.branchPerformance.length === 0 ? (
        <EmptyNote>No sales in this range</EmptyNote>
      ) : (
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
      )}
    </ChartCard>
  )
}

/* List widgets */


function RecentTransactions({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Latest income and expenses">
      {data.recentTransactions.length === 0 && <EmptyNote>No transactions yet</EmptyNote>}
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
    <ChartCard title={title} description="Latest audited changes">
      {data.recentActivity.length === 0 && <EmptyNote>No recent activity</EmptyNote>}
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

function InventoryAlerts({ data, title }: WidgetProps) {
  return (
    <ChartCard title={title} description="Below their reorder level today">
      {!data.available.lowStock ? (
        <EmptyNote>Stock alerts not available</EmptyNote>
      ) : data.inventoryAlerts.length === 0 ? (
        <EmptyNote>Stock levels look healthy</EmptyNote>
      ) : (
        <ul className="divide-y">
          {data.inventoryAlerts.map((item) => (
            <ListRow key={item.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.quantity} {item.unit} left · {branchName(item.branchId)}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </ListRow>
          ))}
        </ul>
      )}
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
  { id: 'lowstock', icon: AlertTriangleIcon, sizes: KPI_SIZES, Component: LowStockKpi },
  { id: 'revenueTrend', icon: TrendingUpIcon, sizes: CHART_SIZES, Component: RevenueTrend },
  { id: 'orderTrend', icon: ShoppingBagIcon, sizes: CHART_SIZES, Component: OrderTrend },
  { id: 'salesPayment', icon: WalletIcon, sizes: CHART_SIZES, Component: SalesPayment },
  { id: 'branchPerformance', icon: TrendingUpIcon, sizes: CHART_SIZES, Component: BranchPerformance },
  { id: 'recentTransactions', icon: BanknoteIcon, sizes: CHART_SIZES, Component: RecentTransactions },
  { id: 'recentActivity', icon: ClockIcon, sizes: CHART_SIZES, Component: RecentActivity },
  { id: 'inventoryAlerts', icon: AlertTriangleIcon, sizes: CHART_SIZES, Component: InventoryAlerts },
]

export const widgetById = Object.fromEntries(widgetRegistry.map((w) => [w.id, w])) as Record<string, WidgetDefinition>
