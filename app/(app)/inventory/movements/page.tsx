'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { useStockMovements } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils/format'
import { branchName } from '@/mocks/branches'
import type { MovementType, StockMovement } from '@/types'

const types: MovementType[] = ['purchase', 'consumption', 'adjustment', 'transfer', 'wastage']

export default function StockMovementsPage() {
  const { t } = useT()
  const { data, isLoading } = useStockMovements()
  const { inBranch } = useScope()
  const [type, setType] = useState('all')

  const rows = useMemo(
    () =>
      inBranch(data ?? [])
        .filter((m) => (type === 'all' ? true : m.type === type))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data, inBranch, type],
  )

  const columns = useMemo<ColumnDef<StockMovement, unknown>[]>(
    () => [
      { accessorKey: 'date', header: t('common.date'), cell: ({ row }) => formatDateTime(row.original.date) },
      { accessorKey: 'itemName', header: t('common.name'), cell: ({ row }) => <span className="font-medium">{row.original.itemName}</span> },
      {
        accessorKey: 'type',
        header: t('common.type'),
        cell: ({ row }) => (
          <Badge variant="secondary" className="capitalize">
            {row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'quantity',
        header: t('common.quantity'),
        cell: ({ row }) => (
          <span className={cn('tabular-nums font-medium', row.original.quantity < 0 ? 'text-destructive' : 'text-success')}>
            {row.original.quantity > 0 ? '+' : ''}
            {row.original.quantity} {row.original.unit}
          </span>
        ),
      },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      { accessorKey: 'by', header: 'By' },
      { accessorKey: 'note', header: t('common.notes'), cell: ({ row }) => <span className="text-muted-foreground">{row.original.note || '-'}</span> },
    ],
    [t],
  )

  return (
    <>
      <PageHeader title={t('inventory.movements')} description={t('inventory.subtitle')} />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="stock-movements"
        initialSort={[{ id: 'date', desc: true }]}
        filters={
          <OptionSelect
            className="h-9 w-44"
            value={type}
            onValueChange={setType}
            aria-label={t('common.type')}
            options={[{ value: 'all', label: `${t('common.type')}: ${t('common.all')}` }, ...types.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]}
          />
        }
      />
    </>
  )
}
