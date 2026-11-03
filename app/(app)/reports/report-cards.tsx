'use client'

/**
 * One card per server report (/api/insights/reports/*) for the top-bar window. Rows are shown as
 * the server reports them, only grouped by their key when several branches are combined.
 * "Not available" (not loaded / no permission) is kept distinct from "nothing in this period".
 */
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartCard } from '@/components/common/chart-card'
import { useAccess } from '@/hooks/use-access'
import { useInsightsReport, type DateWindow, type ReportName } from '@/hooks/use-insights'
import { branchName } from '@/lib/directory'
import { formatCurrency, formatNumber, formatPercent, titleCase } from '@/lib/utils/format'

type Cell = string | number
interface Column {
  label: string
  /** Numeric columns are end-aligned. */
  numeric?: boolean
}

function ReportTable({
  title,
  description,
  loading,
  available,
  columns,
  rows,
  footer,
}: {
  title: string
  description?: string
  loading: boolean
  available: boolean
  columns: Column[]
  rows: Cell[][]
  footer?: React.ReactNode
}) {
  return (
    <ChartCard title={title} description={description}>
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : !available ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Not available</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing in this period</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.label} className={c.numeric ? 'text-end' : undefined}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((v, j) => (
                    <TableCell key={j} className={columns[j]?.numeric ? 'text-end tabular-nums' : j === 0 ? 'font-medium' : undefined}>
                      {v}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {footer}
    </ChartCard>
  )
}

/** Group rows by key and add up their numeric fields (combining branches or days). */
function groupSum<R, K extends string>(rows: R[], key: (r: R) => string, fields: Record<K, (r: R) => number>) {
  const out = new Map<string, Record<K, number>>()
  for (const r of rows) {
    const k = key(r)
    const acc = out.get(k) ?? (Object.fromEntries(Object.keys(fields).map((f) => [f, 0])) as Record<K, number>)
    for (const f of Object.keys(fields) as K[]) acc[f] += fields[f](r)
    out.set(k, acc)
  }
  return [...out.entries()]
}

const money = (minor: number) => formatCurrency(minor / 100)
const label = (s: string) => titleCase(s.replace(/_/g, '-'))

function useReport<K extends ReportName>(name: K, w: DateWindow) {
  const r = useInsightsReport(name, w)
  const inCur = <T extends { currency: string }>(rows: T[] | undefined | null) => (rows ?? []).filter((x) => !r.currency || x.currency === r.currency)
  return { data: r.data, loading: r.isLoading && !r.data, available: !!r.data, inCur }
}

export function ReportCards({ window: w }: { window: DateWindow }) {
  const { can } = useAccess()
  const sales = useReport('sales', w)
  const orders = useReport('orders', w)
  const discounts = useReport('discounts', w)
  const tax = useReport('tax', w)
  const payments = useReport('payments', w)
  const expenses = useReport('expenses', w)
  const inventory = useReport('inventory', w)
  const attendance = useReport('attendance', w)
  const payroll = useReport('payroll', w)
  const branches = useReport('branches', w)
  // Payroll is confidential: only for staff editors or finance readers.
  const showPayroll = can('employees', 'edit') || can('finance', 'view')

  const salesRows = groupSum(sales.inCur(sales.data?.rows), (r) => r.service_type, {
    orders: (r) => r.order_count,
    subtotal: (r) => r.subtotal_minor,
    discount: (r) => r.discount_minor,
    tax: (r) => r.tax_minor + r.inclusive_tax_minor,
    fees: (r) => r.delivery_fee_minor + r.service_charge_minor,
    tips: (r) => r.tip_minor,
    total: (r) => r.total_minor,
    refunded: (r) => r.refunded_minor,
  })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ReportTable
          title="Sales by service type"
          description="Completed orders"
          loading={sales.loading}
          available={sales.available}
          columns={[
            { label: 'Service' },
            { label: 'Orders', numeric: true },
            { label: 'Subtotal', numeric: true },
            { label: 'Discount', numeric: true },
            { label: 'Tax', numeric: true },
            { label: 'Delivery + service', numeric: true },
            { label: 'Tips', numeric: true },
            { label: 'Total', numeric: true },
            { label: 'Refunded', numeric: true },
          ]}
          rows={salesRows.map(([k, v]) => [label(k), formatNumber(v.orders), money(v.subtotal), money(v.discount), money(v.tax), money(v.fees), money(v.tips), money(v.total), money(v.refunded)])}
        />
      </div>
      <ReportTable
        title="Orders by status"
        description="Orders created in the period"
        loading={orders.loading}
        available={orders.available}
        columns={[{ label: 'Status' }, { label: 'Orders', numeric: true }]}
        rows={groupSum(orders.data?.rows ?? [], (r) => r.status, { n: (r) => r.order_count }).map(([k, v]) => [label(k), formatNumber(v.n)])}
      />
      <ReportTable
        title="Payments by method"
        loading={payments.loading}
        available={payments.available}
        columns={[{ label: 'Method' }, { label: 'Payments', numeric: true }, { label: 'Amount', numeric: true }, { label: 'Refunds', numeric: true }, { label: 'Refunded', numeric: true }]}
        rows={(() => {
          const paid = new Map(groupSum(payments.inCur(payments.data?.payments), (r) => r.method, { n: (r) => r.payment_count, a: (r) => r.amount_minor }))
          const refunded = new Map(groupSum(payments.inCur(payments.data?.refunds), (r) => r.method, { n: (r) => r.refund_count, a: (r) => r.amount_minor }))
          return [...new Set([...paid.keys(), ...refunded.keys()])].map((m) => [
            label(m),
            formatNumber(paid.get(m)?.n ?? 0),
            money(paid.get(m)?.a ?? 0),
            formatNumber(refunded.get(m)?.n ?? 0),
            money(refunded.get(m)?.a ?? 0),
          ])
        })()}
      />
      <ReportTable
        title="Tax by rate"
        description="Tax on completed orders"
        loading={tax.loading}
        available={tax.available}
        columns={[{ label: 'Rate' }, { label: 'Orders', numeric: true }, { label: 'Taxable', numeric: true }, { label: 'Tax', numeric: true }]}
        rows={groupSum(tax.inCur(tax.data?.rows), (r) => `${r.code} · ${formatPercent(r.rate_bp / 100, 2)}${r.inclusive ? ' incl.' : ''}`, {
          n: (r) => r.order_count,
          base: (r) => r.base_minor,
          amount: (r) => r.amount_minor,
        }).map(([k, v]) => [k, formatNumber(v.n), money(v.base), money(v.amount)])}
      />
      <ReportTable
        title="Discounts"
        description="Discounts on completed orders"
        loading={discounts.loading}
        available={discounts.available}
        columns={[{ label: 'Offer' }, { label: 'Orders', numeric: true }, { label: 'Amount', numeric: true }]}
        rows={groupSum(discounts.inCur(discounts.data?.rows), (r) => `${r.code || r.discount_id} (${label(r.source)})`, {
          n: (r) => r.order_count,
          amount: (r) => r.amount_minor,
        }).map(([k, v]) => [k, formatNumber(v.n), money(v.amount)])}
      />
      <ReportTable
        title="Expenses by branch"
        loading={expenses.loading}
        available={expenses.available}
        columns={[{ label: 'Branch' }, { label: 'Expenses', numeric: true }, { label: 'Total', numeric: true }]}
        rows={groupSum(expenses.inCur(expenses.data?.rows), (r) => r.branch_id ?? '', { n: (r) => r.count, total: (r) => r.total_minor }).map(([k, v]) => [
          k ? branchName(k) : 'Tenant-wide',
          formatNumber(v.n),
          money(v.total),
        ])}
      />
      <ReportTable
        title="Branch comparison"
        loading={branches.loading}
        available={branches.available}
        columns={[{ label: 'Branch' }, { label: 'Orders', numeric: true }, { label: 'Sales', numeric: true }, { label: 'Expenses', numeric: true }]}
        rows={branches.inCur(branches.data?.rows).map((r) => [
          branchName(r.branch_id),
          formatNumber(r.order_count),
          money(r.sales_minor),
          r.expense_minor == null ? '—' : money(r.expense_minor),
        ])}
      />
      <ReportTable
        title="Stock movements"
        description={inventory.data ? `${formatNumber(inventory.data.low_stock.total)} items below their reorder level now` : undefined}
        loading={inventory.loading}
        available={inventory.available}
        columns={[{ label: 'Movement' }, { label: 'Movements', numeric: true }, { label: 'Items', numeric: true }]}
        rows={groupSum(inventory.data?.movements ?? [], (r) => r.type, { n: (r) => r.movement_count, items: (r) => r.item_count }).map(([k, v]) => [
          label(k),
          formatNumber(v.n),
          formatNumber(v.items),
        ])}
      />
      <ReportTable
        title="Attendance"
        loading={attendance.loading}
        available={attendance.available}
        columns={[{ label: 'Status' }, { label: 'Records', numeric: true }, { label: 'Employees', numeric: true }]}
        rows={groupSum(attendance.data?.rows ?? [], (r) => r.status, { n: (r) => r.record_count, e: (r) => r.employee_count }).map(([k, v]) => [
          label(k),
          formatNumber(v.n),
          formatNumber(v.e),
        ])}
      />
      {showPayroll && (
        <ReportTable
          title="Payroll runs"
          description="Runs overlapping the period"
          loading={payroll.loading}
          available={payroll.available}
          columns={[{ label: 'Status' }, { label: 'Runs', numeric: true }, { label: 'Net pay', numeric: true }]}
          rows={groupSum(payroll.inCur(payroll.data?.rows), (r) => r.status, { n: (r) => r.run_count, net: (r) => r.total_net_minor }).map(([k, v]) => [
            label(k),
            formatNumber(v.n),
            money(v.net),
          ])}
        />
      )}
    </div>
  )
}
