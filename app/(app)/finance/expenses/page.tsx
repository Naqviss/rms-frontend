'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, CalendarClockIcon, ClockIcon, PercentIcon, PiggyBankIcon, PlusIcon, ReceiptTextIcon, RepeatIcon, TrophyIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { BudgetsPanel } from '@/components/expenses/budgets-panel'
import { RecurringPanel } from '@/components/expenses/recurring-panel'
import { useBudgets, useRecurringExpenses, useTransactions } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useAppStore } from '@/stores/app-store'
import { useT } from '@/lib/i18n/use-t'
import { config } from '@/lib/config'
import { cn } from '@/lib/utils'
import { budgetState, daysUntil, EXPENSE_CATEGORIES, monthProgress } from '@/lib/utils/expenses'
import { formatCompactCurrency, formatCurrency, formatDateTime, formatPercent } from '@/lib/utils/format'
import { branchName, currentBranchIds, currentTenantBranches } from '@/mocks/branches'
import type { Transaction } from '@/types'

/** Mock data is anchored to a fixed trading day; "today" means that day everywhere in the app. */
const TODAY = config.referenceDate

const PERIOD_LABEL: Record<string, string> = { today: 'today', '7d': 'the last 7 days', '30d': 'the last 30 days', month: 'this month' }

type Tab = 'log' | 'budgets' | 'recurring'

export default function ExpensesPage() {
  const { t } = useT()
  const { data: txData, isLoading, create, update, remove, removeMany } = useTransactions()
  const { data: budgets } = useBudgets()
  const { data: recurring } = useRecurringExpenses()
  const { inBranch, inRange, preset } = useScope()
  const globalBranch = useAppStore((s) => s.branchId)
  const [tab, setTab] = useState<Tab>('log')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const defaultBranch = globalBranch === 'all' ? currentBranchIds[0] : globalBranch

  const branchTx = useMemo(() => inBranch(txData ?? []), [txData, inBranch])
  const periodTx = useMemo(() => inRange(branchTx, (x) => x.date), [branchTx, inRange])

  const expenses = useMemo(
    () =>
      periodTx
        .filter((x) => x.type === 'expense')
        .filter((x) => category === 'all' || x.category === category)
        .filter((x) => status === 'all' || (status === 'paid' ? x.status === 'completed' : x.status === 'pending'))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [periodTx, category, status],
  )

  const period = useMemo(() => {
    let total = 0
    let income = 0
    const byCategory = new Map<string, number>()
    for (const x of periodTx) {
      if (x.type === 'income') income += x.amount
      if (x.type !== 'expense') continue
      total += x.amount
      byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount)
    }
    return { total, income, breakdown: [...byCategory.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount) }
  }, [periodTx])

  // Budgets and pending bills are about the calendar month and the whole ledger, not the top-bar range.
  const month = useMemo(() => {
    const { start } = monthProgress(TODAY)
    const spend = new Map<string, number>()
    let total = 0
    for (const x of branchTx) {
      if (x.type !== 'expense' || x.date.slice(0, 10) < start) continue
      total += x.amount
      spend.set(x.category, (spend.get(x.category) ?? 0) + x.amount)
    }
    const pending = branchTx.filter((x) => x.type === 'expense' && x.status === 'pending')
    return { spend, total, pending, pendingTotal: pending.reduce((s, x) => s + x.amount, 0) }
  }, [branchTx])

  const budgetTotal = (budgets ?? []).reduce((s, b) => s + b.monthly, 0)
  const overBudget = (budgets ?? []).filter((b) => budgetState(month.spend.get(b.category) ?? 0, b.monthly) === 'over')
  const activeRecurring = (recurring ?? []).filter((r) => r.active && (globalBranch === 'all' || r.branchId === globalBranch))
  const dueSoon = activeRecurring.filter((r) => daysUntil(r.nextDue, TODAY) <= 7)
  const overdue = activeRecurring.filter((r) => daysUntil(r.nextDue, TODAY) < 0)

  const columns = useMemo<ColumnDef<Transaction, unknown>[]>(
    () => [
      { accessorKey: 'date', header: t('common.date'), cell: ({ row }) => formatDateTime(row.original.date) },
      {
        accessorKey: 'description',
        header: t('common.description'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex max-w-64 items-center gap-1.5 truncate font-medium">
              {row.original.description}
              {row.original.recurringId && <RepeatIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="From a recurring bill" />}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.payee ? `${row.original.payee} · ` : ''}
              {row.original.reference}
            </p>
          </div>
        ),
      },
      { accessorKey: 'category', header: t('common.category'), cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      { accessorKey: 'method', header: t('common.method'), cell: ({ row }) => <span className="capitalize">{row.original.method}</span> },
      {
        accessorKey: 'amount',
        header: t('common.amount'),
        cell: ({ row }) => <span className="font-medium text-destructive tabular-nums">-{formatCurrency(row.original.amount)}</span>,
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => <StatusBadge status={row.original.status === 'completed' ? 'paid' : 'pending'} />,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              ...(row.original.status === 'pending'
                ? [
                    {
                      label: 'Mark as paid',
                      onSelect: async () => {
                        await update(row.original.id, { status: 'completed' })
                        toast.success('Marked as paid')
                      },
                    },
                  ]
                : []),
              { label: t('common.edit'), onSelect: () => setEditing(row.original) },
              {
                label: 'Duplicate for today',
                onSelect: async () => {
                  const { id: _id, recurringId: _recurring, ...copy } = row.original
                  await create({ ...copy, reference: `EXP-${Date.now().toString().slice(-6)}`, date: `${TODAY}T${new Date().toTimeString().slice(0, 8)}` })
                  toast.success('Expense duplicated for today')
                },
              },
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    [t, update, create],
  )

  const save = async (v: FormValues) => {
    const record = {
      category: String(v.category),
      payee: String(v.payee).trim() || undefined,
      description: String(v.description).trim() || String(v.category),
      amount: Number(v.amount),
      method: String(v.method) as Transaction['method'],
      branchId: String(v.branchId),
      status: v.paid ? ('completed' as const) : ('pending' as const),
    }
    if (editing && editing !== 'new') {
      // Keep the original time of day when only the date changes.
      await update(editing.id, { ...record, date: `${String(v.date)}${editing.date.slice(10)}` })
      toast.success('Expense updated')
    } else {
      await create({
        ...record,
        reference: `EXP-${Date.now().toString().slice(-6)}`,
        type: 'expense',
        date: `${String(v.date)}T${new Date().toTimeString().slice(0, 8)}`,
      })
      toast.success('Expense recorded')
    }
  }

  const initial: FormValues =
    editing && editing !== 'new'
      ? {
          category: editing.category,
          payee: editing.payee ?? '',
          amount: editing.amount,
          date: editing.date.slice(0, 10),
          method: editing.method,
          branchId: editing.branchId,
          description: editing.description,
          paid: editing.status === 'completed',
        }
      : { category: 'Ingredients', payee: '', amount: '', date: TODAY, method: 'cash', branchId: defaultBranch, description: '', paid: true }

  const alerts = [
    ...overdue.map((r) => ({
      key: r.id,
      title: `${r.name} is overdue`,
      body: `${formatCurrency(r.amount)} to ${r.payee} was due ${-daysUntil(r.nextDue, TODAY)} day(s) ago.`,
      tab: 'recurring' as Tab,
    })),
    ...overBudget.map((b) => ({
      key: b.id,
      title: `${b.category} is over budget`,
      body: `${formatCurrency(month.spend.get(b.category) ?? 0)} spent of ${formatCurrency(b.monthly)} this month.`,
      tab: 'budgets' as Tab,
    })),
  ]

  return (
    <>
      <PageHeader
        title={t('expenses.title')}
        description={t('expenses.subtitle')}
        actions={
          <>
            <Button variant="outline" render={<Link href="/finance/item-profit" />} nativeButton={false}>
              <TrophyIcon data-icon="inline-start" />
              {t('nav.itemProfit')}
            </Button>
            <Button onClick={() => setEditing('new')}>
              <PlusIcon data-icon="inline-start" />
              {t('expenses.add')}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Spent this month"
              value={formatCompactCurrency(month.total)}
              icon={PiggyBankIcon}
              tone={month.total > budgetTotal ? 'danger' : 'primary'}
              hint={budgetTotal ? `${formatPercent((month.total / budgetTotal) * 100)} of ${formatCompactCurrency(budgetTotal)} budget` : 'No budgets set'}
            />
            <StatCard
              label={t('expenses.pending')}
              value={formatCompactCurrency(month.pendingTotal)}
              icon={ClockIcon}
              tone="warning"
              hint={`${month.pending.length} unpaid bill${month.pending.length === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Due in 7 days"
              value={formatCompactCurrency(dueSoon.reduce((s, r) => s + r.amount, 0))}
              icon={CalendarClockIcon}
              tone={overdue.length ? 'danger' : 'delivery'}
              hint={overdue.length ? `${overdue.length} overdue` : `${dueSoon.length} recurring bills`}
            />
            <StatCard
              label={t('expenses.ratio')}
              value={formatPercent(period.income ? (period.total / period.income) * 100 : 0)}
              icon={PercentIcon}
              tone="takeaway"
              hint={`${formatCompactCurrency(period.total)} of ${formatCompactCurrency(period.income)} income, ${PERIOD_LABEL[preset]}`}
            />
          </div>

          {alerts.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {alerts.slice(0, 4).map((a) => (
                <Alert key={a.key} variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>{a.title}</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                    {a.body}
                    <Button size="xs" variant="outline" onClick={() => setTab(a.tab)}>
                      View
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="log">
                <ReceiptTextIcon />
                {t('expenses.log')}
              </TabsTrigger>
              <TabsTrigger value="budgets">
                <WalletIcon />
                Budgets
                {overBudget.length > 0 && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                    {overBudget.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="recurring">
                <RepeatIcon />
                Recurring bills
                {dueSoon.length > 0 && <Badge className="h-4 min-w-4 px-1 text-[10px]">{dueSoon.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="log" className="mt-4 flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('finance.expenseByCategory')} · {PERIOD_LABEL[preset]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {period.breakdown.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No expenses in this period.</p>
                  ) : (
                    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      {period.breakdown.map((c) => {
                        const share = period.total ? (c.amount / period.total) * 100 : 0
                        return (
                          <li key={c.name}>
                            <button
                              type="button"
                              onClick={() => setCategory(category === c.name ? 'all' : c.name)}
                              aria-pressed={category === c.name}
                              className={cn(
                                'flex w-full flex-col gap-1.5 rounded-md p-1 text-start transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                                category === c.name && 'bg-muted',
                              )}
                            >
                              <span className="flex items-center justify-between gap-2 text-sm">
                                <span className="truncate">{c.name}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {formatCompactCurrency(c.amount)} · {formatPercent(share)}
                                </span>
                              </span>
                              <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                                <span className="block h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <DataTable
                columns={columns}
                data={expenses}
                exportName="expenses"
                initialSort={[{ id: 'date', desc: true }]}
                emptyTitle="No expenses found"
                emptyDescription="Try another category, status or date range in the top bar."
                exportRows={(r) =>
                  r.map((x) => ({
                    reference: x.reference,
                    date: x.date,
                    category: x.category,
                    payee: x.payee ?? '',
                    description: x.description,
                    amount: x.amount,
                    method: x.method,
                    status: x.status,
                  }))
                }
                onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
                filters={
                  <>
                    <OptionSelect
                      className="h-9 w-48"
                      value={category}
                      onValueChange={setCategory}
                      aria-label={t('common.category')}
                      options={[
                        { value: 'all', label: `${t('common.category')}: ${t('common.all')}` },
                        ...[...new Set([...EXPENSE_CATEGORIES, ...period.breakdown.map((b) => b.name)])].map((c) => ({ value: c, label: c })),
                      ]}
                    />
                    <OptionSelect
                      className="h-9 w-36"
                      value={status}
                      onValueChange={setStatus}
                      aria-label={t('common.status')}
                      options={[
                        { value: 'all', label: `${t('common.status')}: ${t('common.all')}` },
                        { value: 'paid', label: 'Paid' },
                        { value: 'pending', label: 'Pending' },
                      ]}
                    />
                  </>
                }
              />
            </TabsContent>

            <TabsContent value="budgets" className="mt-4">
              <BudgetsPanel monthSpend={month.spend} today={TODAY} />
            </TabsContent>

            <TabsContent value="recurring" className="mt-4">
              <RecurringPanel today={TODAY} defaultBranchId={defaultBranch} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing && editing !== 'new' ? 'Edit expense' : t('expenses.add')}
        description="Record a bill or purchase. Unpaid bills stay pending until marked paid."
        fields={[
          { name: 'category', label: t('common.category'), type: 'select', options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: 'payee', label: 'Paid to', placeholder: 'e.g. Metro Cash & Carry' },
          { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
          { name: 'date', label: t('common.date'), type: 'date', required: true },
          {
            name: 'method',
            label: t('common.method'),
            type: 'select',
            options: [
              { value: 'cash', label: t('pay.cash') },
              { value: 'card', label: t('pay.card') },
              { value: 'online', label: t('pay.online') },
            ],
          },
          { name: 'branchId', label: t('common.branch'), type: 'select', options: currentTenantBranches.map((b) => ({ value: b.id, label: b.name })) },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true, placeholder: 'e.g. 20 kg chicken for the weekend' },
          { name: 'paid', label: 'Already paid', type: 'switch' },
        ]}
        initial={initial}
        onSubmit={save}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.deleteTitle')}
        description={t('common.deleteBody')}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          if (deleting) await remove(deleting.id)
          toast.success(t('common.deleted'))
        }}
      />
    </>
  )
}
