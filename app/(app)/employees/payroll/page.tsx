'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { BanknoteIcon, CheckCircle2Icon, HourglassIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useEmployees } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/lib/utils/format'
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

type LedgerKind = 'basic' | 'commission' | 'deduction' | 'payment'

interface LedgerEntry {
  id: string
  employeeId: string
  employeeName: string
  date: string
  voucher: string
  kind: LedgerKind
  debit: number
  credit: number
  /** Running salary payable for the employee after this entry (credit balance). */
  balance: number
  /** The employee's final entry, where the pay action lives. */
  last: boolean
}

/** Posts a payroll row as ledger entries: earnings are credited to the employee, deductions and payments debited. */
function toLedger(r: PayrollRow, paid: boolean, date: string, period: string): LedgerEntry[] {
  const { employee: e } = r
  const lines: [LedgerKind, string, number, number][] = [
    ['basic', `JV-${period}-${e.code}`, 0, r.base],
    ...(r.commission ? [['commission', `JV-${period}-${e.code}`, 0, r.commission] as [LedgerKind, string, number, number]] : []),
    ...(r.deductions ? [['deduction', `JV-${period}-${e.code}`, r.deductions, 0] as [LedgerKind, string, number, number]] : []),
    ...(paid ? [['payment', `PV-${period}-${e.code}`, r.net, 0] as [LedgerKind, string, number, number]] : []),
  ]
  let balance = 0
  return lines.map(([kind, voucher, debit, credit], i) => {
    balance += credit - debit
    return { id: `${e.id}-${kind}`, employeeId: e.id, employeeName: e.name, date, voucher, kind, debit, credit, balance, last: i === lines.length - 1 }
  })
}

export default function PayrollPage() {
  const { t } = useT()
  const { data, isLoading } = useEmployees()
  const { inBranch } = useScope()
  const [paid, setPaid] = useState<Set<string>>(new Set())
  const [employeeId, setEmployeeId] = useState('all')

  const rows = useMemo(
    () =>
      inBranch(data ?? [])
        .filter((e) => e.status !== 'inactive')
        .map(compute),
    [data, inBranch],
  )
  const total = rows.reduce((s, r) => s + r.net, 0)
  const paidTotal = rows.filter((r) => paid.has(r.id)).reduce((s, r) => s + r.net, 0)

  const ledger = useMemo(() => {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const date = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    const period = date.slice(2, 7).replace('-', '')
    return rows.filter((r) => employeeId === 'all' || r.id === employeeId).flatMap((r) => toLedger(r, paid.has(r.id), date, period))
  }, [rows, paid, employeeId])

  const particulars = useMemo<Record<LedgerKind, string>>(
    () => ({
      basic: t('employees.ledgerBasic'),
      commission: t('employees.ledgerCommission'),
      deduction: t('employees.ledgerDeduction'),
      payment: t('employees.ledgerPayment'),
    }),
    [t],
  )

  const columns = useMemo<ColumnDef<LedgerEntry, unknown>[]>(
    () => [
      { accessorKey: 'date', header: t('common.date'), enableSorting: false, cell: ({ row }) => formatDate(row.original.date) },
      { accessorKey: 'voucher', header: t('employees.voucher'), enableSorting: false, cell: ({ row }) => <span className="font-mono text-xs">{row.original.voucher}</span> },
      { accessorKey: 'employeeName', header: t('common.name'), enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span> },
      { id: 'particulars', header: t('employees.particulars'), enableSorting: false, cell: ({ row }) => particulars[row.original.kind] },
      {
        accessorKey: 'debit',
        header: t('employees.debit'),
        enableSorting: false,
        cell: ({ row }) => (row.original.debit ? <span className="tabular-nums">{formatCurrency(row.original.debit)}</span> : null),
      },
      {
        accessorKey: 'credit',
        header: t('employees.credit'),
        enableSorting: false,
        cell: ({ row }) => (row.original.credit ? <span className="tabular-nums">{formatCurrency(row.original.credit)}</span> : null),
      },
      {
        accessorKey: 'balance',
        header: t('employees.balance'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className={row.original.last ? 'tabular-nums font-semibold' : 'tabular-nums'}>
            {formatCurrency(row.original.balance)}
            {row.original.balance > 0 && ' Cr'}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => (row.original.last ? <StatusBadge status={paid.has(row.original.employeeId) ? 'paid' : 'unpaid'} /> : null),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          !row.original.last || paid.has(row.original.employeeId) ? null : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPaid((p) => new Set(p).add(row.original.employeeId))
                toast.success(t('employees.salaryPaid'))
              }}
            >
              {t('employees.markPaid')}
            </Button>
          ),
      },
    ],
    [t, paid, particulars],
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
        cardTitle="employeeName"
        columns={columns}
        data={ledger}
        isLoading={isLoading}
        defaultPageSize={50}
        exportName="payroll-ledger"
        exportRows={(r) =>
          r.map((x) => ({ date: x.date, voucher: x.voucher, employee: x.employeeName, particulars: particulars[x.kind], debit: x.debit, credit: x.credit, balance: x.balance }))
        }
        filters={
          <OptionSelect
            className="h-9 w-48"
            value={employeeId}
            onValueChange={setEmployeeId}
            aria-label={t('common.name')}
            options={[{ value: 'all', label: t('employees.allEmployees') }, ...rows.map((r) => ({ value: r.id, label: r.employee.name }))]}
          />
        }
      />
    </>
  )
}
