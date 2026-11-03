'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, BanknoteIcon, CheckCircle2Icon, HourglassIcon, LockIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useEmployees } from '@/hooks/use-data'
import { useAccess } from '@/hooks/use-access'
import { createPayrollRun, todayIso, useCashAccounts, useExpenseCategories, usePayrollRun, usePayrollRuns } from '@/hooks/use-insights'
import { useScope } from '@/hooks/use-scope'
import { branchName, currentTenantBranches } from '@/lib/directory'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { fromMinor, text, toMinor } from '@/services/api/mappers'
import type { PayPayrollRunDto, PayrollEntryResponseDto, PayrollLineResponseDto, PayrollRunDetailResponseDto, SkippedEmployeeResponseDto } from '@/services/api/generated/schemas'

type LedgerKind = 'basic' | 'bonus' | 'deduction' | 'adjustment' | 'payment'

interface LedgerEntry {
  id: string
  entry: PayrollEntryResponseDto
  line: PayrollLineResponseDto | null
  employeeName: string
  date: string
  voucher: string
  kind: LedgerKind
  detail: string
  debit: number
  credit: number
  /** The employee's final row: carries the server's net pay and the actions. */
  last: boolean
}

const short = (id: string) => id.replace(/-/g, '').slice(0, 6).toUpperCase()

/** Posts a calculated entry as ledger rows. Amounts are the server's; nothing is recomputed. */
function toLedger(d: PayrollRunDetailResponseDto, e: PayrollEntryResponseDto, name: string, code: string): LedgerEntry[] {
  const { run } = d
  const voucher = `PR-${short(run.id)}-${code}`
  const rows: Omit<LedgerEntry, 'last'>[] = [
    {
      id: `${e.id}-basic`,
      entry: e,
      line: null,
      employeeName: name,
      date: run.period_end,
      voucher,
      kind: 'basic',
      detail: `${e.worked_days} worked · ${e.absent_days} absent · ${e.leave_days} leave · ${e.late_days} late`,
      debit: 0,
      credit: fromMinor(e.base_minor),
    },
    ...e.lines.map((l) => ({
      id: l.id,
      entry: e,
      line: l,
      employeeName: name,
      date: l.created_at.slice(0, 10),
      voucher,
      kind: l.kind as LedgerKind,
      detail: l.reason,
      debit: l.kind === 'deduction' || (l.kind === 'adjustment' && l.amount_minor < 0) ? fromMinor(Math.abs(l.amount_minor)) : 0,
      credit: l.kind === 'bonus' || (l.kind === 'adjustment' && l.amount_minor >= 0) ? fromMinor(l.amount_minor) : 0,
    })),
    ...(run.status === 'paid'
      ? [{ id: `${e.id}-paid`, entry: e, line: null, employeeName: name, date: (run.paid_at ?? run.period_end).slice(0, 10), voucher: `PV-${short(run.id)}-${code}`, kind: 'payment' as const, detail: '', debit: fromMinor(e.net_minor), credit: 0 }]
      : []),
  ]
  return rows.map((r, i) => ({ ...r, last: i === rows.length - 1 }))
}

type Pending = { kind: 'pay'; body: Omit<PayPayrollRunDto, 'expected_version'> } | { kind: 'cancel'; reason: string } | null

/**
 * Payroll runs: `GET/POST /api/staff/payroll-runs`, `GET /{id}` (entries + lines) and the run
 * lifecycle — calculate (lists skipped employees), add/remove lines, approve, pay, cancel. Pay and
 * cancel are final and go through an explicit confirmation.
 */
export default function PayrollPage() {
  const { t } = useT()
  const { can } = useAccess()
  const { allBranches, branchIds } = useScope()
  const { data: employees } = useEmployees()
  const runs = usePayrollRuns()
  const [runId, setRunId] = useState<string>('')
  const visibleRuns = runs.data ?? []
  const selected = visibleRuns.find((r) => r.id === runId) ?? visibleRuns.find((r) => r.status !== 'cancelled') ?? visibleRuns[0]
  const run = usePayrollRun(selected?.id)
  const { data: categories } = useExpenseCategories()
  const { data: registers } = useCashAccounts()
  const [employeeId, setEmployeeId] = useState('all')
  const [dialog, setDialog] = useState<'new' | 'pay' | 'cancel' | null>(null)
  const [lineFor, setLineFor] = useState<PayrollEntryResponseDto | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [skipped, setSkipped] = useState<SkippedEmployeeResponseDto[]>([])
  const [busy, setBusy] = useState(false)

  // Compensation and payroll are confidential.
  const canSee = can('employees', 'edit') || can('finance', 'view')
  const canManage = can('employees', 'edit')
  const canPay = canManage && can('finance', 'edit')
  const detail = run.data
  const status = detail?.run.status

  const people = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees])
  const ledger = useMemo(
    () =>
      (detail?.entries ?? [])
        .filter((e) => employeeId === 'all' || e.employee_id === employeeId)
        .flatMap((e) => toLedger(detail!, e, people.get(e.employee_id)?.name ?? 'Employee', people.get(e.employee_id)?.code ?? short(e.employee_id))),
    [detail, employeeId, people],
  )

  const total = detail ? fromMinor(detail.run.total_net_minor) : 0
  const paidTotal = status === 'paid' ? total : 0

  /** Run a lifecycle call with the action buttons disabled; errors are shown, never retried. */
  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      await runs.mutate()
      toast.success(label)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const calculate = () =>
    detail &&
    act(status === 'draft' ? 'Payroll calculated' : 'Payroll recalculated', async () => {
      const res = (await run.calculate(detail)) as { skipped?: SkippedEmployeeResponseDto[] }
      setSkipped(res.skipped ?? [])
    })

  const particulars: Record<LedgerKind, string> = {
    basic: t('employees.ledgerBasic'),
    bonus: 'Bonus',
    deduction: 'Deduction',
    adjustment: 'Adjustment',
    payment: t('employees.ledgerPayment'),
  }

  const columns = useMemo<ColumnDef<LedgerEntry, unknown>[]>(
    () => [
      { accessorKey: 'date', header: t('common.date'), enableSorting: false, cell: ({ row }) => formatDate(row.original.date) },
      { accessorKey: 'voucher', header: t('employees.voucher'), enableSorting: false, cell: ({ row }) => <span className="font-mono text-xs">{row.original.voucher}</span> },
      { accessorKey: 'employeeName', header: t('common.name'), enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span> },
      {
        id: 'particulars',
        header: t('employees.particulars'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>{particulars[row.original.kind]}</p>
            {row.original.detail && <p className="max-w-64 truncate text-xs text-muted-foreground">{row.original.detail}</p>}
          </div>
        ),
      },
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
        id: 'balance',
        header: 'Net pay',
        enableSorting: false,
        cell: ({ row }) => (row.original.last ? <span className="font-semibold tabular-nums">{formatCurrency(fromMinor(row.original.entry.net_minor))}</span> : null),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => (row.original.last ? <StatusBadge status={status === 'paid' ? 'paid' : 'unpaid'} /> : null),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => {
          // Lines can be changed only on a calculated (not yet approved) run.
          if (!canManage || status !== 'calculated' || !detail) return null
          const actions = [
            ...(row.original.last ? [{ label: 'Add bonus / deduction', onSelect: () => setLineFor(row.original.entry) }] : []),
            ...(row.original.line
              ? [
                  {
                    label: 'Remove line',
                    destructive: true,
                    onSelect: () => void act('Line removed', () => run.removeLine(detail, row.original.entry.id, row.original.line!.id)),
                  },
                ]
              : []),
          ]
          return actions.length ? <RowActions actions={actions} /> : null
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, status, canManage, detail],
  )

  if (!canSee) {
    return (
      <>
        <PageHeader title={t('employees.payroll')} description={t('employees.payrollSubtitle')} />
        <Alert>
          <LockIcon />
          <AlertTitle>Payroll is confidential</AlertTitle>
          <AlertDescription>You need staff edit or finance access to see salaries and payroll runs.</AlertDescription>
        </Alert>
      </>
    )
  }

  const salaryCategory =
    (categories ?? []).find((c) => /salar|payroll|wage/i.test(`${c.code} ${c.name ?? text(c.name_i18n)}`) && c.is_active) ?? (categories ?? []).find((c) => c.is_active)
  const runBranch = detail?.run.branch_id
  const openRegisters = (registers ?? []).filter((a) => a.status === 'open' && (!runBranch || a.branch_id === runBranch))
  const monthStart = `${todayIso().slice(0, 7)}-01`
  const monthEnd = (() => {
    const d = new Date(`${monthStart}T00:00:00`)
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA')
  })()

  const submitDialog = async (v: FormValues) => {
    if (dialog === 'new') {
      const ok = await act('Payroll run opened', async () => {
        const created = await createPayrollRun({
          period_start: String(v.from),
          period_end: String(v.to),
          pay_schedule: String(v.schedule) as 'daily' | 'weekly' | 'monthly',
          ...(v.branchId && v.branchId !== 'all' ? { branch_id: String(v.branchId) } : {}),
        })
        setRunId(created.id)
        setSkipped([])
      })
      return ok ? undefined : false
    }
    if (dialog === 'pay') {
      const method = String(v.method) as PayPayrollRunDto['payment_method']
      if (method === 'cash' && !v.cashAccountId) {
        toast.error('Choose the cash register the salaries are paid from')
        return false
      }
      setPending({
        kind: 'pay',
        body: {
          expense_category_id: String(v.categoryId),
          payment_method: method,
          payment_date: String(v.date),
          ...(method === 'cash' ? { cash_account_id: String(v.cashAccountId) } : {}),
        },
      })
    }
    if (dialog === 'cancel') setPending({ kind: 'cancel', reason: String(v.reason).trim() })
  }

  const confirmPending = () => {
    if (!detail || !pending || busy) return
    if (pending.kind === 'pay') void act(t('employees.salaryPaid'), () => run.pay(detail, pending.body))
    else void act('Payroll run cancelled', () => run.cancel(detail, pending.reason))
    setPending(null)
  }

  const submitLine = async (v: FormValues) => {
    if (!detail || !lineFor) return
    const kind = String(v.kind) as PayrollLineResponseDto['kind']
    const amount = Number(v.amount)
    const ok = await act('Line added', () =>
      run.addLine(detail, lineFor.id, { kind, amount_minor: toMinor(kind === 'adjustment' ? amount : Math.abs(amount)), reason: String(v.reason).trim() }),
    )
    return ok ? undefined : false
  }

  const stepButton =
    !detail || !canManage ? null : status === 'draft' ? (
      <Button onClick={calculate} disabled={busy}>
        Calculate
      </Button>
    ) : status === 'calculated' ? (
      <>
        <Button variant="outline" onClick={calculate} disabled={busy}>
          Recalculate
        </Button>
        <Button onClick={() => void act('Payroll approved', () => run.approve(detail))} disabled={busy}>
          Approve
        </Button>
      </>
    ) : status === 'approved' ? (
      <Button onClick={() => setDialog('pay')} disabled={busy || !canPay}>
        <BanknoteIcon data-icon="inline-start" />
        {t('employees.payAll')}
      </Button>
    ) : null

  return (
    <>
      <PageHeader
        title={t('employees.payroll')}
        description={t('employees.payrollSubtitle')}
        actions={
          <>
            {visibleRuns.length > 0 && (
              <OptionSelect
                className="h-9 w-64"
                value={selected?.id ?? ''}
                onValueChange={(v) => {
                  setRunId(v)
                  setSkipped([])
                }}
                aria-label="Payroll run"
                options={visibleRuns.map((r) => ({
                  value: r.id,
                  label: `${formatDate(r.period_start)} – ${formatDate(r.period_end)} · ${r.branch_id ? branchName(r.branch_id) : 'All branches'} · ${r.status}`,
                }))}
              />
            )}
            {stepButton}
            {detail && canManage && status !== 'paid' && status !== 'cancelled' && (
              <Button variant="outline" onClick={() => setDialog('cancel')} disabled={busy}>
                Cancel run
              </Button>
            )}
            {canManage && (
              <Button variant={detail ? 'outline' : 'default'} onClick={() => setDialog('new')} disabled={busy}>
                <PlusIcon data-icon="inline-start" />
                New run
              </Button>
            )}
          </>
        }
      />
      {!runs.data && !runs.isLoading ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Payroll runs are not available</AlertTitle>
          <AlertDescription>The server did not return payroll runs for your account.</AlertDescription>
        </Alert>
      ) : runs.data && visibleRuns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No payroll runs yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Open a run for a pay period, then calculate it from attendance and compensation.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t('employees.payrollTotal')} value={detail ? formatCompactCurrency(total) : '—'} icon={BanknoteIcon} hint={detail ? `Status: ${status}` : undefined} />
            <StatCard label={t('common.paid')} value={detail ? formatCompactCurrency(paidTotal) : '—'} icon={CheckCircle2Icon} />
            <StatCard label={t('common.unpaid')} value={detail ? formatCompactCurrency(status === 'cancelled' ? 0 : total - paidTotal) : '—'} icon={HourglassIcon} />
          </div>
          {skipped.length > 0 && (
            <Alert>
              <AlertTriangleIcon />
              <AlertTitle>{skipped.length} employee(s) skipped</AlertTitle>
              <AlertDescription>
                Already paid by another active run of the same schedule:{' '}
                {skipped.map((s) => people.get(s.employee_id)?.name ?? short(s.employee_id)).join(', ')}.
              </AlertDescription>
            </Alert>
          )}
          {status === 'draft' && (
            <Alert>
              <HourglassIcon />
              <AlertTitle>Not calculated yet</AlertTitle>
              <AlertDescription>Calculate the run to build entries from attendance and compensation.</AlertDescription>
            </Alert>
          )}
          <DataTable
            cardTitle="employeeName"
            columns={columns}
            data={ledger}
            isLoading={run.isLoading || runs.isLoading}
            defaultPageSize={50}
            exportName="payroll-ledger"
            emptyTitle={detail ? 'No entries' : 'Select a payroll run'}
            exportRows={(r) =>
              r.map((x) => ({ date: x.date, voucher: x.voucher, employee: x.employeeName, particulars: particulars[x.kind], detail: x.detail, debit: x.debit, credit: x.credit, net: x.last ? fromMinor(x.entry.net_minor) : '' }))
            }
            filters={
              <OptionSelect
                className="h-9 w-48"
                value={employeeId}
                onValueChange={setEmployeeId}
                aria-label={t('common.name')}
                options={[
                  { value: 'all', label: t('employees.allEmployees') },
                  ...(detail?.entries ?? []).map((e) => ({ value: e.employee_id, label: people.get(e.employee_id)?.name ?? short(e.employee_id) })),
                ]}
              />
            }
          />
        </>
      )}

      <FormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'new' ? 'Open a payroll run' : dialog === 'pay' ? 'Pay this payroll run' : 'Cancel this payroll run'}
        description={
          dialog === 'pay'
            ? `${formatCurrency(total)} is recorded as one salary expense. You will confirm before anything is paid.`
            : dialog === 'cancel'
              ? 'The reason is kept in the audit trail. You will confirm before the run is cancelled.'
              : undefined
        }
        fields={
          dialog === 'new'
            ? [
                { name: 'from', label: 'Period start', type: 'date', required: true },
                { name: 'to', label: 'Period end', type: 'date', required: true },
                {
                  name: 'schedule',
                  label: 'Pay schedule',
                  type: 'select',
                  options: [
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'daily', label: 'Daily' },
                  ],
                },
                {
                  name: 'branchId',
                  label: 'Branch',
                  type: 'select',
                  options: [{ value: 'all', label: 'All branches' }, ...currentTenantBranches.map((b) => ({ value: b.id, label: b.name }))],
                },
              ]
            : dialog === 'pay'
              ? [
                  {
                    name: 'categoryId',
                    label: 'Expense category',
                    type: 'select',
                    options: (categories ?? []).filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name || text(c.name_i18n) || c.code })),
                  },
                  {
                    name: 'method',
                    label: 'Paid by',
                    type: 'select',
                    options: [
                      { value: 'bank_transfer', label: 'Bank transfer' },
                      { value: 'cash', label: 'Cash' },
                      { value: 'card', label: 'Card' },
                      { value: 'other', label: 'Other' },
                    ],
                  },
                  {
                    name: 'cashAccountId',
                    label: 'Cash register (cash only)',
                    type: 'select',
                    options: [{ value: '', label: '—' }, ...openRegisters.map((a) => ({ value: a.id, label: `${a.name} · ${branchName(a.branch_id)}` }))],
                  },
                  { name: 'date', label: 'Payment date', type: 'date', required: true },
                ]
              : [{ name: 'reason', label: 'Reason', type: 'textarea', required: true, wide: true }]
        }
        initial={
          dialog === 'new'
            ? { from: monthStart, to: monthEnd, schedule: 'monthly', branchId: allBranches ? 'all' : (branchIds[0] ?? 'all') }
            : dialog === 'pay'
              ? { categoryId: salaryCategory?.id ?? '', method: 'bank_transfer', cashAccountId: '', date: todayIso() }
              : { reason: '' }
        }
        submitLabel={dialog === 'new' ? 'Open run' : 'Continue'}
        onSubmit={submitDialog}
      />
      <FormDialog
        open={lineFor !== null}
        onOpenChange={(o) => !o && setLineFor(null)}
        title="Add bonus, deduction or adjustment"
        description={lineFor ? people.get(lineFor.employee_id)?.name : undefined}
        fields={[
          {
            name: 'kind',
            label: 'Type',
            type: 'select',
            options: [
              { value: 'bonus', label: 'Bonus' },
              { value: 'deduction', label: 'Deduction' },
              { value: 'adjustment', label: 'Adjustment (+/-)' },
            ],
          },
          { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
          { name: 'reason', label: 'Reason', required: true, wide: true },
        ]}
        initial={{ kind: 'bonus', amount: '', reason: '' }}
        onSubmit={submitLine}
      />
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        destructive={pending?.kind === 'cancel'}
        title={pending?.kind === 'pay' ? `Pay ${formatCurrency(total)} in salaries?` : 'Cancel this payroll run?'}
        description={
          pending?.kind === 'pay'
            ? `This is final: one salary expense is recorded${pending.body.payment_method === 'cash' ? ' and the cash leaves the selected register' : ''}, and the run can no longer change.`
            : 'This is final: a cancelled run cannot be reopened. Open a new run to pay this period.'
        }
        confirmLabel={pending?.kind === 'pay' ? 'Pay salaries' : 'Cancel run'}
        onConfirm={confirmPending}
      />
    </>
  )
}
