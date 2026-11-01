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
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import { branchName } from '@/mocks/branches'
import type { Transaction, TransactionType } from '@/types'

const types: TransactionType[] = ['income', 'expense', 'refund']

export default function TransactionsPage() {
  const { t } = useT()
  const { data, isLoading, create, remove, removeMany } = useTransactions()
  const { inBranch, primaryBranch } = useScope()
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
        cell: ({ row }) => <RowActions actions={[{ label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) }]} />,
      },
    ],
    [t],
  )

  const save = async (v: FormValues) => {
    await create({
      reference: `TX-${Date.now().toString().slice(-6)}`,
      type: String(v.type) as TransactionType,
      category: String(v.category),
      description: String(v.description),
      amount: Number(v.amount),
      method: String(v.method) as Transaction['method'],
      date: new Date().toISOString().slice(0, 19),
      branchId: primaryBranch,
      status: 'completed',
    })
    toast.success(t('common.created'))
  }

  return (
    <>
      <PageHeader
        title={t('finance.transactions')}
        description={t('finance.subtitle')}
        actions={
          <Button onClick={() => setOpen(true)}>
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
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
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
          { name: 'type', label: t('common.type'), type: 'select', options: types.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })) },
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
        initial={{ type: 'expense', category: '', amount: 0, method: 'cash', description: '' }}
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
