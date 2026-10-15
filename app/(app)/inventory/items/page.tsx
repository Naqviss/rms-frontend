'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FieldDef, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useInventory, useStockMovements, useVendors } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useAppStore } from '@/stores/app-store'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { stockStatus, stockValue } from '@/lib/utils/inventory'
import { branchName, currentBranchIds } from '@/mocks/branches'
import type { InventoryItem } from '@/types'

type Mode = { kind: 'edit'; item: InventoryItem } | { kind: 'create' } | { kind: 'adjust'; item: InventoryItem } | null

export default function StockItemsPage() {
  const { t, td } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useInventory()
  const { create: logMovement } = useStockMovements()
  const { data: vendors } = useVendors()
  const { inBranch } = useScope()
  const globalBranch = useAppStore((s) => s.branchId)
  const [mode, setMode] = useState<Mode>(null)
  const [deleting, setDeleting] = useState<InventoryItem | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const rows = useMemo(
    () => inBranch(data ?? []).filter((i) => (statusFilter === 'all' ? true : stockStatus(i) === statusFilter)),
    [data, inBranch, statusFilter],
  )

  const itemFields: FieldDef[] = [
    { name: 'name', label: t('common.name'), required: true, wide: true },
    { name: 'sku', label: 'SKU', required: true },
    { name: 'category', label: t('common.category'), required: true },
    { name: 'quantity', label: t('common.quantity'), type: 'number', required: true },
    { name: 'unit', label: t('inventory.unit'), required: true },
    { name: 'minStock', label: t('inventory.minStock'), type: 'number', required: true },
    { name: 'costPerUnit', label: t('inventory.costPerUnit'), type: 'number', required: true },
    { name: 'vendorId', label: t('inventory.supplier'), type: 'select', options: (vendors ?? []).map((v) => ({ value: v.id, label: v.name })) },
    { name: 'expiryDate', label: t('inventory.expiry'), type: 'date' },
  ]

  const columns = useMemo<ColumnDef<InventoryItem, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.sku}</p>
          </div>
        ),
      },
      { accessorKey: 'category', header: t('common.category') },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      {
        accessorKey: 'quantity',
        header: t('common.quantity'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.quantity} {row.original.unit}
          </span>
        ),
      },
      { accessorKey: 'minStock', header: t('inventory.minStock'), cell: ({ row }) => <span className="tabular-nums">{row.original.minStock}</span> },
      {
        id: 'value',
        header: t('inventory.stockValue'),
        accessorFn: (r) => stockValue(r),
        cell: ({ row }) => <span className="tabular-nums">{formatCurrency(stockValue(row.original))}</span>,
      },
      {
        accessorKey: 'expiryDate',
        header: t('inventory.expiry'),
        cell: ({ row }) => (row.original.expiryDate ? formatDate(row.original.expiryDate) : '-'),
      },
      {
        id: 'status',
        header: t('common.status'),
        accessorFn: (r) => stockStatus(r),
        cell: ({ row }) => <StatusBadge status={stockStatus(row.original)} />,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: t('inventory.adjust'), onSelect: () => setMode({ kind: 'adjust', item: row.original }) },
              { label: t('common.edit'), onSelect: () => setMode({ kind: 'edit', item: row.original }) },
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    [t],
  )

  const initial: FormValues =
    mode?.kind === 'edit'
      ? {
          name: mode.item.name,
          sku: mode.item.sku,
          category: mode.item.category,
          quantity: mode.item.quantity,
          unit: mode.item.unit,
          minStock: mode.item.minStock,
          costPerUnit: mode.item.costPerUnit,
          vendorId: mode.item.vendorId,
          expiryDate: mode.item.expiryDate ?? '',
        }
      : { name: '', sku: '', category: '', quantity: 0, unit: 'kg', minStock: 0, costPerUnit: 0, vendorId: vendors?.[0]?.id ?? '', expiryDate: '' }

  const saveItem = async (v: FormValues) => {
    const patch = {
      name: String(v.name),
      sku: String(v.sku),
      category: String(v.category),
      quantity: Number(v.quantity),
      unit: String(v.unit),
      minStock: Number(v.minStock),
      costPerUnit: Number(v.costPerUnit),
      vendorId: String(v.vendorId),
      expiryDate: v.expiryDate ? String(v.expiryDate) : null,
    }
    if (mode?.kind === 'edit') {
      await update(mode.item.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create({
        ...patch,
        branchId: globalBranch === 'all' ? currentBranchIds[0] : globalBranch,
        kind: 'ingredient',
        image: '/food/desi.jpg',
      })
      toast.success(t('common.created'))
    }
  }

  const adjust = async (v: FormValues) => {
    if (mode?.kind !== 'adjust') return
    const delta = Number(v.delta)
    const type = String(v.type) as 'adjustment' | 'wastage' | 'purchase'
    const signed = type === 'wastage' ? -Math.abs(delta) : type === 'purchase' ? Math.abs(delta) : delta
    await update(mode.item.id, { quantity: Math.max(0, mode.item.quantity + signed) })
    await logMovement({
      itemId: mode.item.id,
      itemName: mode.item.name,
      type,
      quantity: signed,
      unit: mode.item.unit,
      branchId: mode.item.branchId,
      date: new Date().toISOString().slice(0, 19),
      note: String(v.note ?? ''),
      by: 'Imran Qureshi',
    })
    toast.success(t('common.updated'))
  }

  return (
    <>
      <PageHeader
        title={t('inventory.stockList')}
        description={t('inventory.subtitle')}
        actions={
          <Button onClick={() => setMode({ kind: 'create' })}>
            <PlusIcon data-icon="inline-start" />
            {t('inventory.addItem')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="stock-items"
        exportRows={(r) => r.map((i) => ({ name: i.name, sku: i.sku, category: i.category, quantity: i.quantity, unit: i.unit, value: stockValue(i) }))}
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
        initialHidden={{ minStock: false }}
        filters={
          <OptionSelect
            className="h-9 w-44"
            value={statusFilter}
            onValueChange={setStatusFilter}
            aria-label={t('common.status')}
            options={[{ value: 'all', label: `${t('common.status')}: ${t('common.all')}` }, ...(['in-stock', 'low', 'expiring', 'out'] as const).map((s) => ({ value: s, label: td(`status.${s}`) }))]}
          />
        }
      />
      <FormDialog
        open={mode?.kind === 'create' || mode?.kind === 'edit'}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode?.kind === 'edit' ? t('common.edit') : t('inventory.addItem')}
        fields={itemFields}
        initial={initial}
        onSubmit={saveItem}
      />
      <FormDialog
        open={mode?.kind === 'adjust'}
        onOpenChange={(o) => !o && setMode(null)}
        title={t('inventory.adjust')}
        description={mode?.kind === 'adjust' ? mode.item.name : undefined}
        fields={[
          {
            name: 'type',
            label: t('common.type'),
            type: 'select',
            options: [
              { value: 'purchase', label: t('inventory.purchase') },
              { value: 'wastage', label: t('inventory.wastage') },
              { value: 'adjustment', label: t('inventory.adjust') },
            ],
          },
          { name: 'delta', label: t('common.quantity'), type: 'number', required: true },
          { name: 'note', label: t('common.notes'), type: 'textarea', wide: true },
        ]}
        initial={{ type: 'purchase', delta: 0, note: '' }}
        onSubmit={adjust}
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
