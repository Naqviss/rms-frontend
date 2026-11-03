'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon, WalletIcon } from 'lucide-react'
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
import { useVendors } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import type { Vendor } from '@/types'

type Mode = { kind: 'create' } | { kind: 'edit'; vendor: Vendor } | null

export default function VendorsPage() {
  const { t } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useVendors()
  const [mode, setMode] = useState<Mode>(null)
  const [deleting, setDeleting] = useState<Vendor | null>(null)

  const fields: FieldDef[] = [
    { name: 'name', label: t('common.name'), required: true, wide: true },
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
            <p className="min-w-0 font-medium">{row.original.name}</p>
          </div>
        ),
      },
      { accessorKey: 'contactPerson', header: t('vendors.contact') },
      { accessorKey: 'phone', header: t('common.phone') },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
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
          contactPerson: mode.vendor.contactPerson,
          phone: mode.vendor.phone,
          email: mode.vendor.email,
          address: mode.vendor.address,
          status: mode.vendor.status,
        }
      : { name: '', contactPerson: '', phone: '', email: '', address: '', status: 'active' }

  const save = async (v: FormValues) => {
    const patch = {
      name: String(v.name),
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
      await create({ ...patch, color: 'oklch(0.55 0.12 40)' })
      toast.success(t('common.created'))
    }
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
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        exportName="vendors"
        exportRows={(r) => r.map((v) => ({ name: v.name, contact: v.contactPerson, phone: v.phone }))}
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
      />
      <FormDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        title={mode?.kind === 'edit' ? t('common.edit') : t('vendors.addVendor')}
        fields={fields}
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
