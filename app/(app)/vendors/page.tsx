'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon, StarIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FieldDef, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useVendorPayments, useVendors } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/utils/format'
import type { Vendor } from '@/types'

type Mode = { kind: 'create' } | { kind: 'edit'; vendor: Vendor } | { kind: 'pay'; vendor: Vendor } | null

export default function VendorsPage() {
  const { t } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useVendors()
  const { create: createPayment } = useVendorPayments()
  const [mode, setMode] = useState<Mode>(null)
  const [deleting, setDeleting] = useState<Vendor | null>(null)

  const totalOutstanding = (data ?? []).reduce((s, v) => s + v.outstanding, 0)
  const avgRating = data?.length ? data.reduce((s, v) => s + v.rating, 0) / data.length : 0

  const fields: FieldDef[] = [
    { name: 'name', label: t('common.name'), required: true, wide: true },
    { name: 'category', label: t('common.category'), required: true },
    { name: 'contactPerson', label: t('vendors.contact'), required: true },
    { name: 'phone', label: t('common.phone'), type: 'tel', required: true },
    { name: 'email', label: t('common.email'), type: 'email' },
    { name: 'address', label: t('common.address'), wide: true },
    {
      name: 'status',
      label: t('common.status'),
      type: 'select',
      options: [
        { value: 'active', label: t('status.active') },
        { value: 'inactive', label: t('status.inactive') },
      ],
    },
  ]

  const columns = useMemo<ColumnDef<Vendor, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: row.original.color }} className="text-xs text-white">
                {row.original.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.category}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: 'contactPerson', header: t('vendors.contact') },
      { accessorKey: 'phone', header: t('common.phone') },
      {
        accessorKey: 'outstanding',
        header: t('vendors.outstanding'),
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">{formatCurrency(row.original.outstanding)}</span>
        ),
      },
      {
        accessorKey: 'rating',
        header: t('vendors.rating'),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <StarIcon className="size-3.5 fill-warning text-warning" aria-hidden />
            {row.original.rating.toFixed(1)}
          </span>
        ),
      },
      { accessorKey: 'onTimeRate', header: t('vendors.onTime'), cell: ({ row }) => <span className="tabular-nums">{row.original.onTimeRate}%</span> },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              ...(row.original.outstanding > 0 ? [{ label: t('vendors.recordPayment'), onSelect: () => setMode({ kind: 'pay', vendor: row.original }) }] : []),
              { label: t('common.edit'), onSelect: () => setMode({ kind: 'edit', vendor: row.original }) },
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
          name: mode.vendor.name,
          category: mode.vendor.category,
          contactPerson: mode.vendor.contactPerson,
          phone: mode.vendor.phone,
          email: mode.vendor.email,
          address: mode.vendor.address,
          status: mode.vendor.status,
        }
      : { name: '', category: '', contactPerson: '', phone: '', email: '', address: '', status: 'active' }

  const save = async (v: FormValues) => {
    const patch = {
      name: String(v.name),
      category: String(v.category),
      contactPerson: String(v.contactPerson),
      phone: String(v.phone),
      email: String(v.email),
      address: String(v.address),
      status: String(v.status) as Vendor['status'],
    }
    if (mode?.kind === 'edit') {
      await update(mode.vendor.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create({ ...patch, outstanding: 0, rating: 4, onTimeRate: 90, color: 'oklch(0.55 0.12 40)' })
      toast.success(t('common.created'))
    }
  }

  const pay = async (v: FormValues) => {
    if (mode?.kind !== 'pay') return
    const amount = Math.min(Number(v.amount), mode.vendor.outstanding)
    await createPayment({
      vendorId: mode.vendor.id,
      amount,
      date: new Date().toISOString().slice(0, 19),
      method: String(v.method) as 'cash' | 'card' | 'online',
      reference: String(v.reference || `PAY-${Date.now().toString().slice(-6)}`),
    })
    await update(mode.vendor.id, { outstanding: mode.vendor.outstanding - amount })
    toast.success(t('vendors.paymentRecorded'))
  }

  return (
    <>
      <PageHeader
        title={t('vendors.title')}
        description={t('vendors.subtitle')}
        actions={
          <Button onClick={() => setMode({ kind: 'create' })}>
            <PlusIcon data-icon="inline-start" />
            {t('vendors.addVendor')}
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label={t('vendors.title')} value={String(data?.length ?? 0)} icon={WalletIcon} />
          <StatCard label={t('vendors.outstanding')} value={formatCurrency(totalOutstanding)} icon={WalletIcon} />
          <StatCard label={t('vendors.rating')} value={avgRating.toFixed(1)} icon={StarIcon} />
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        exportName="vendors"
        exportRows={(r) => r.map((v) => ({ name: v.name, category: v.category, contact: v.contactPerson, phone: v.phone, outstanding: v.outstanding }))}
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
      />
      <FormDialog
        open={mode?.kind === 'create' || mode?.kind === 'edit'}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode?.kind === 'edit' ? t('common.edit') : t('vendors.addVendor')}
        fields={fields}
        initial={initial}
        onSubmit={save}
      />
      <FormDialog
        open={mode?.kind === 'pay'}
        onOpenChange={(o) => !o && setMode(null)}
        title={t('vendors.recordPayment')}
        description={mode?.kind === 'pay' ? `${mode.vendor.name} · ${formatCurrency(mode.vendor.outstanding)}` : undefined}
        fields={[
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
          { name: 'reference', label: t('common.reference'), wide: true },
        ]}
        initial={{ amount: mode?.kind === 'pay' ? mode.vendor.outstanding : 0, method: 'online', reference: '' }}
        onSubmit={pay}
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
