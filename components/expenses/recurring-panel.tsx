'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon, RepeatIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { RowActions } from '@/components/common/row-actions'
import { useRecurringExpenses, useTransactions } from '@/hooks/use-data'
import { cn } from '@/lib/utils'
import { advanceDue, daysUntil, dueLabel, EXPENSE_CATEGORIES, FREQUENCY_LABEL, monthlyEquivalent } from '@/lib/utils/expenses'
import { formatCompactCurrency, formatCurrency, formatDate } from '@/lib/utils/format'
import { branchName, currentTenantBranches } from '@/mocks/branches'
import type { PaymentMethod, RecurringExpense, RecurringFrequency } from '@/types'

interface RecurringPanelProps {
  today: string
  defaultBranchId: string
}

export function RecurringPanel({ today, defaultBranchId }: RecurringPanelProps) {
  const { data, isLoading, create, update, remove } = useRecurringExpenses()
  const { create: createTransaction } = useTransactions()
  const [editing, setEditing] = useState<RecurringExpense | 'new' | null>(null)
  const [deleting, setDeleting] = useState<RecurringExpense | null>(null)

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.nextDue.localeCompare(b.nextDue)), [data])
  const active = rows.filter((r) => r.active)
  const commitment = active.reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0)
  const dueSoon = active.filter((r) => daysUntil(r.nextDue, today) <= 7)
  const overdue = active.filter((r) => daysUntil(r.nextDue, today) < 0)

  const recordPayment = async (r: RecurringExpense) => {
    await createTransaction({
      reference: `REC-${Date.now().toString().slice(-6)}`,
      type: 'expense',
      category: r.category,
      description: `${r.name} (${FREQUENCY_LABEL[r.frequency].toLowerCase()})`,
      payee: r.payee,
      amount: r.amount,
      method: r.method,
      date: `${today}T${new Date().toTimeString().slice(0, 8)}`,
      branchId: r.branchId,
      status: 'completed',
      recurringId: r.id,
    })
    const nextDue = advanceDue(r.nextDue, r.frequency)
    await update(r.id, { nextDue })
    toast.success(`${r.name} paid · next due ${formatDate(nextDue)}`)
  }

  const columns = useMemo<ColumnDef<RecurringExpense, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Bill',
        cell: ({ row }) => (
          <div className={cn('min-w-0', !row.original.active && 'opacity-60')}>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.payee} · {branchName(row.original.branchId)}
            </p>
          </div>
        ),
      },
      { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <div className="tabular-nums">
            <p className="font-medium">{formatCurrency(row.original.amount)}</p>
            <p className="text-[11px] text-muted-foreground">{FREQUENCY_LABEL[row.original.frequency]}</p>
          </div>
        ),
      },
      {
        accessorKey: 'nextDue',
        header: 'Next due',
        cell: ({ row }) => {
          const days = daysUntil(row.original.nextDue, today)
          return (
            <div>
              <p className="tabular-nums">{formatDate(row.original.nextDue)}</p>
              {row.original.active && (
                <p className={cn('text-[11px]', days < 0 ? 'font-medium text-destructive' : days <= 3 ? 'text-warning-foreground dark:text-warning' : 'text-muted-foreground')}>
                  {dueLabel(days)}
                </p>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'active',
        header: 'Active',
        cell: ({ row }) => (
          <Switch
            checked={row.original.active}
            aria-label={`${row.original.active ? 'Pause' : 'Resume'} ${row.original.name}`}
            onCheckedChange={async (v) => {
              await update(row.original.id, { active: v })
              toast.success(v ? `${row.original.name} resumed` : `${row.original.name} paused`)
            }}
          />
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {row.original.active && daysUntil(row.original.nextDue, today) <= 7 && (
              <Button size="sm" variant={daysUntil(row.original.nextDue, today) < 0 ? 'default' : 'outline'} onClick={() => recordPayment(row.original)}>
                Record payment
              </Button>
            )}
            <RowActions
              actions={[
                ...(row.original.active && daysUntil(row.original.nextDue, today) > 7 ? [{ label: 'Record payment now', onSelect: () => recordPayment(row.original) }] : []),
                { label: 'Edit', onSelect: () => setEditing(row.original) },
                { label: 'Delete', destructive: true, onSelect: () => setDeleting(row.original) },
              ]}
            />
          </div>
        ),
      },
    ],
    // recordPayment closes over the latest data through `update`/`createTransaction`, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, update],
  )

  const save = async (v: FormValues) => {
    const record = {
      name: String(v.name),
      category: String(v.category),
      payee: String(v.payee),
      amount: Number(v.amount),
      frequency: String(v.frequency) as RecurringFrequency,
      nextDue: String(v.nextDue),
      branchId: String(v.branchId),
      method: String(v.method) as PaymentMethod,
    }
    if (editing && editing !== 'new') {
      await update(editing.id, record)
      toast.success('Recurring bill updated')
    } else {
      await create({ ...record, active: true })
      toast.success('Recurring bill added')
    }
  }

  const initial: FormValues =
    editing && editing !== 'new'
      ? { ...editing, active: editing.active }
      : { name: '', category: 'Utilities', payee: '', amount: '', frequency: 'monthly', nextDue: today, branchId: defaultBranchId, method: 'online' }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Monthly commitment', value: formatCompactCurrency(commitment), hint: `${active.length} active schedules` },
          { label: 'Due in the next 7 days', value: formatCompactCurrency(dueSoon.reduce((s, r) => s + r.amount, 0)), hint: `${dueSoon.length} bills` },
          { label: 'Overdue', value: String(overdue.length), hint: overdue.length ? overdue.map((r) => r.name).join(', ') : 'Nothing overdue', danger: overdue.length > 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={cn('mt-1 text-xl font-semibold tabular-nums', s.danger && 'text-destructive')}>{s.value}</p>
            <p className="truncate text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="recurring-expenses"
        emptyTitle="No recurring bills"
        emptyDescription="Add rent, utilities and other bills that repeat so they are never missed."
        exportRows={(r) => r.map((x) => ({ name: x.name, payee: x.payee, category: x.category, amount: x.amount, frequency: x.frequency, nextDue: x.nextDue, active: x.active }))}
        toolbarActions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            Add recurring bill
          </Button>
        }
      />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RepeatIcon className="size-3.5" aria-hidden />
        Recording a payment adds it to the expense log and moves the bill to its next due date.
      </p>

      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing && editing !== 'new' ? 'Edit recurring bill' : 'Add recurring bill'}
        fields={[
          { name: 'name', label: 'Bill name', required: true, placeholder: 'e.g. Electricity bill' },
          { name: 'payee', label: 'Paid to', required: true, placeholder: 'e.g. K-Electric' },
          { name: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
          {
            name: 'frequency',
            label: 'Repeats',
            type: 'select',
            options: (Object.keys(FREQUENCY_LABEL) as RecurringFrequency[]).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] })),
          },
          { name: 'nextDue', label: 'Next due date', type: 'date', required: true },
          { name: 'branchId', label: 'Branch', type: 'select', options: currentTenantBranches.map((b) => ({ value: b.id, label: b.name })) },
          {
            name: 'method',
            label: 'Paid by',
            type: 'select',
            options: [
              { value: 'online', label: 'Online / bank' },
              { value: 'card', label: 'Card' },
              { value: 'cash', label: 'Cash' },
            ],
          },
        ]}
        initial={initial}
        onSubmit={save}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this recurring bill?"
        description="Payments already recorded stay in the expense log."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id)
          toast.success('Recurring bill deleted')
        }}
      />
    </div>
  )
}
