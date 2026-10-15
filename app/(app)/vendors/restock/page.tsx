'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useInventory, usePurchaseOrders, useVendors } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useAppStore } from '@/stores/app-store'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { stockStatus } from '@/lib/utils/inventory'
import { branchName, currentBranchIds } from '@/mocks/branches'
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types'

export default function PurchaseOrdersPage() {
  const { t, td } = useT()
  const { data, isLoading, create, update } = usePurchaseOrders()
  const { data: vendors } = useVendors()
  const { data: inventory } = useInventory()
  const { inBranch } = useScope()
  const globalBranch = useAppStore((s) => s.branchId)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('all')

  const rows = useMemo(
    () =>
      inBranch(data ?? [])
        .filter((p) => (status === 'all' ? true : p.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data, inBranch, status],
  )

  const lowItems = (inventory ?? []).filter((i) => ['low', 'out'].includes(stockStatus(i)))
  const poNumber = (id: string) => `PO-${id.replace(/\D/g, '').padStart(4, '0')}`

  const setPoStatus = async (po: PurchaseOrder, next: PurchaseOrderStatus) => {
    await update(po.id, { status: next })
    toast.success(t('common.updated'))
  }

  const columns = useMemo<ColumnDef<PurchaseOrder, unknown>[]>(
    () => [
      { id: 'number', header: 'PO', accessorFn: (r) => r.id, cell: ({ row }) => <span className="font-medium">{poNumber(row.original.id)}</span> },
      { accessorKey: 'vendorName', header: t('vendors.vendor') },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      {
        id: 'items',
        header: t('common.items'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.items.map((i) => `${i.quantity} ${i.unit} ${i.name}`).join(', ').slice(0, 48)}
          </span>
        ),
      },
      { accessorKey: 'createdAt', header: t('common.date'), cell: ({ row }) => formatDate(row.original.createdAt) },
      { accessorKey: 'total', header: t('common.total'), cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.total)}</span> },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => {
          const s = row.original.status
          return (
            <RowActions
              actions={[
                ...(s === 'draft' ? [{ label: t('vendors.send'), onSelect: () => setPoStatus(row.original, 'sent') }] : []),
                ...(s === 'sent' ? [{ label: t('vendors.markReceived'), onSelect: () => setPoStatus(row.original, 'received') }] : []),
                ...(s === 'draft' || s === 'sent'
                  ? [{ label: t('common.cancel'), destructive: true, onSelect: () => setPoStatus(row.original, 'cancelled') }]
                  : []),
              ]}
            />
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const submit = async (v: FormValues) => {
    const vendor = vendors?.find((x) => x.id === v.vendorId)
    const item = inventory?.find((x) => x.id === v.itemId)
    if (!vendor || !item) return
    const quantity = Number(v.quantity)
    await create({
      vendorId: vendor.id,
      vendorName: vendor.name,
      items: [{ itemId: item.id, name: item.name, quantity, unit: item.unit, unitCost: item.costPerUnit }],
      total: Math.round(quantity * item.costPerUnit),
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 19),
      branchId: globalBranch === 'all' ? currentBranchIds[0] : globalBranch,
    })
    toast.success(t('common.created'))
  }

  return (
    <>
      <PageHeader
        title={t('vendors.purchaseOrders')}
        description={`${lowItems.length} ${t('vendors.itemsNeedRestock')}`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t('vendors.newPo')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="purchase-orders"
        exportRows={(r) => r.map((p) => ({ po: poNumber(p.id), vendor: p.vendorName, total: p.total, status: p.status, date: p.createdAt }))}
        filters={
          <OptionSelect
            className="h-9 w-40"
            value={status}
            onValueChange={setStatus}
            aria-label={t('common.status')}
            options={[{ value: 'all', label: `${t('common.status')}: ${t('common.all')}` }, ...(['draft', 'sent', 'received', 'cancelled'] as const).map((s) => ({ value: s, label: td(`status.${s}`) }))]}
          />
        }
      />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t('vendors.newPo')}
        fields={[
          { name: 'vendorId', label: t('vendors.vendor'), type: 'select', required: true, wide: true, options: (vendors ?? []).map((v) => ({ value: v.id, label: v.name })) },
          {
            name: 'itemId',
            label: t('inventory.stockList'),
            type: 'select',
            required: true,
            wide: true,
            options: [...lowItems, ...(inventory ?? []).filter((i) => !lowItems.includes(i))].slice(0, 80).map((i) => ({ value: i.id, label: `${i.name} (${branchName(i.branchId)})` })),
          },
          { name: 'quantity', label: t('common.quantity'), type: 'number', required: true },
        ]}
        initial={{ vendorId: vendors?.[0]?.id ?? '', itemId: lowItems[0]?.id ?? '', quantity: 10 }}
        onSubmit={submit}
      />
    </>
  )
}
