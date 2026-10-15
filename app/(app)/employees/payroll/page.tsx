'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { BanknoteIcon, CheckCircle2Icon, HourglassIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useEmployees } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatCurrency, titleCase } from '@/lib/utils/format'
import { branchName } from '@/mocks/branches'
import type { Employee } from '@/types'

const WORK_DAYS = 26
const AVG_TICKET = 1500

interface PayrollRow {
  employee: Employee
  id: string
  base: number
  commission: number
  deductions: number
  net: number
}

function compute(e: Employee): PayrollRow {
  const att = e.attendanceRate / 100
  const base = e.payType === 'monthly' ? e.payRate : e.payType === 'daily' ? e.payRate * WORK_DAYS * att : e.payRate * 8 * WORK_DAYS * att
  const commission =
    e.commissionType === 'per-order' ? e.ordersHandled * e.commissionRate : e.commissionType === 'percentage' ? (e.ordersHandled * AVG_TICKET * e.commissionRate) / 100 : 0
  const deductions = e.payType === 'monthly' ? Math.round(e.payRate * (1 - att) * 0.5) : 0
  return { employee: e, id: e.id, base: Math.round(base), commission: Math.round(commission), deductions, net: Math.round(base + commission - deductions) }
}

export default function PayrollPage() {
  const { t } = useT()
  const { data, isLoading } = useEmployees()
  const { inBranch } = useScope()
  const [paid, setPaid] = useState<Set<string>>(new Set())

  const rows = useMemo(
    () =>
      inBranch(data ?? [])
        .filter((e) => e.status !== 'inactive')
        .map(compute),
    [data, inBranch],
  )
  const total = rows.reduce((s, r) => s + r.net, 0)
  const paidTotal = rows.filter((r) => paid.has(r.id)).reduce((s, r) => s + r.net, 0)

  const columns = useMemo<ColumnDef<PayrollRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        accessorFn: (r) => r.employee.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.employee.name}</p>
            <p className="text-xs text-muted-foreground">
              {titleCase(row.original.employee.role)} · {branchName(row.original.employee.branchId)}
            </p>
          </div>
        ),
      },
      { id: 'payType', header: t('employees.payType'), accessorFn: (r) => r.employee.payType, cell: ({ row }) => <span className="capitalize">{row.original.employee.payType}</span> },
      { accessorKey: 'base', header: t('employees.basePay'), cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.base)}</span> },
      { accessorKey: 'commission', header: t('employees.commission'), cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.commission)}</span> },
      { accessorKey: 'deductions', header: t('employees.deductions'), cell: ({ row }) => <span className="tabular-nums text-destructive">-{formatCurrency(row.original.deductions)}</span> },
      { accessorKey: 'net', header: t('employees.netPay'), cell: ({ row }) => <span className="tabular-nums font-semibold">{formatCurrency(row.original.net)}</span> },
      {
        id: 'status',
        header: t('common.status'),
        accessorFn: (r) => (paid.has(r.id) ? 'paid' : 'unpaid'),
        cell: ({ row }) => <StatusBadge status={paid.has(row.original.id) ? 'paid' : 'unpaid'} />,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          paid.has(row.original.id) ? null : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPaid((p) => new Set(p).add(row.original.id))
                toast.success(t('employees.salaryPaid'))
              }}
            >
              {t('employees.markPaid')}
            </Button>
          ),
      },
    ],
    [t, paid],
  )

  return (
    <>
      <PageHeader
        title={t('employees.payroll')}
        description={t('employees.payrollSubtitle')}
        actions={
          <Button
            onClick={() => {
              setPaid(new Set(rows.map((r) => r.id)))
              toast.success(t('employees.salaryPaid'))
            }}
            disabled={paid.size === rows.length && rows.length > 0}
          >
            {t('employees.payAll')}
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('employees.payrollTotal')} value={formatCompactCurrency(total)} icon={BanknoteIcon} />
        <StatCard label={t('common.paid')} value={formatCompactCurrency(paidTotal)} icon={CheckCircle2Icon} />
        <StatCard label={t('common.unpaid')} value={formatCompactCurrency(total - paidTotal)} icon={HourglassIcon} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="payroll"
        exportRows={(r) => r.map((p) => ({ name: p.employee.name, base: p.base, commission: p.commission, deductions: p.deductions, net: p.net }))}
      />
    </>
  )
}
