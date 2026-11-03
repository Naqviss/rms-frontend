'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useTransactions } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useAccess } from '@/hooks/use-access'
import { todayIso } from '@/hooks/use-insights'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import { branchName } from '@/lib/directory'
import type { Transaction, TransactionType } from '@/types'

const types: TransactionType[] = ['income', 'expense', 'refund']

export default function TransactionsPage() {
  const { t } = useT()
  const { data, isLoading, create, remove, removeMany } = useTransactions()
  const { inBranch, primaryBranch } = useScope()
  const { can } = useAccess()
  const canVoid = can('finance', 'delete')
  const [type, setType] = useState('all')
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Transaction | null>(null)

  const rows = useMemo(
    () =>
      inBranch(data ?? [])
        .filter((x) => (type === 'all' ? true : x.type === type))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data, inBranch, type],
  )

  const columns = useMemo<ColumnDef<Transaction, unknown>[]>(
    () => [
      { accessorKey: 'date', header: t('common.date'), cell: ({ row }) => formatDateTime(row.original.date) },
      {
        accessorKey: 'reference',
        header: t('common.reference'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.reference}</p>
            <p className="max-w-64 truncate text-xs text-muted-foreground">{row.original.description}</p>
          </div>
        ),
      },
      { accessorKey: 'category', header: t('common.category') },
      {
        accessorKey: 'type',
        header: t('common.type'),
        cell: ({ row }) => (
          <Badge variant={row.original.type === 'income' ? 'secondary' : 'outline'} className="capitalize">
            {row.original.type}
          </Badge>
        ),
      },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      { accessorKey: 'method', header: t('common.method'), cell: ({ row }) => <span className="capitalize">{row.original.method}</span> },
      {
        accessorKey: 'amount',
        header: t('common.amount'),
        cell: ({ row }) => (
          <span className={cn('tabular-nums font-medium', row.original.type === 'income' ? 'text-success' : 'text-destructive')}>
            {row.original.type === 'income' ? '+' : '-'}
            {formatCurrency(row.original.amount)}
          </span>
        ),
      },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        // Income and refunds come from POS payments and are read-only; expenses can be voided.
        cell: ({ row }) =>
          row.original.type === 'expense' && canVoid ? <RowActions actions={[{ label: 'Void…', destructive: true, onSelect: () => setDeleting(row.original) }]} /> : null,
      },
    ],
    [t, canVoid],
  )

  // Only expenses can be recorded by hand (as an unpaid bill; pay it from the expense log).
  const save = async (v: FormValues) => {
    try {
      await create({
        reference: '',
        type: 'expense',
        category: String(v.category),
        description: String(v.description),
        amount: Number(v.amount),
        method: String(v.method) as Transaction['method'],
        date: `${todayIso()}T${new Date().toTimeString().slice(0, 8)}`,
        branchId: primaryBranch,
        status: 'pending',
      })
      toast.success(t('common.created'))
    } catch {
      return false
    }
  }

  return (
    <>
      <PageHeader
        title={t('finance.transactions')}
        description={t('finance.subtitle')}
        actions={
          <Button onClick={() => setOpen(true)} disabled={!can('finance', 'create')}>
            <PlusIcon data-icon="inline-start" />
            {t('finance.addTransaction')}
          </Button>
        }
      />
      <DataTable
        cardTitle="reference"
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="transactions"
        initialSort={[{ id: 'date', desc: true }]}
        exportRows={(r) => r.map((x) => ({ reference: x.reference, date: x.date, type: x.type, category: x.category, amount: x.amount, method: x.method }))}
        onBulkDelete={canVoid ? (sel) => removeMany(sel.filter((s) => s.type === 'expense').map((s) => s.id)) : undefined}
        filters={
          <OptionSelect
            className="h-9 w-40"
            value={type}
            onValueChange={setType}
            aria-label={t('common.type')}
            options={[{ value: 'all', label: `${t('common.type')}: ${t('common.all')}` }, ...types.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]}
          />
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t('finance.addTransaction')}
        fields={[
          { name: 'category', label: t('common.category'), required: true },
          { name: 'amount', label: t('common.amount'), type: 'number', required: true },
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
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
        ]}
        description="Records an unpaid expense. Income and refunds come from POS payments."
        initial={{ category: '', amount: 0, method: 'cash', description: '' }}
        onSubmit={save}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Void this expense?"
        description="Voiding is permanent and audited; a cash-paid expense goes back into its register."
        confirmLabel="Void expense"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove(deleting.id)
            toast.success('Expense voided')
          } catch {
            // reported by useResource
          }
        }}
      />
    </>
  )
}
