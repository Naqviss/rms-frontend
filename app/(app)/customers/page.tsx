'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CrownIcon, PlusIcon, UserCheckIcon, UsersIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useCustomers } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber, formatRelative, initials } from '@/lib/utils/format'
import type { Customer } from '@/types'

const segments: Customer['segment'][] = ['vip', 'regular', 'new', 'at-risk']

const segmentVariant: Record<Customer['segment'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  vip: 'default',
  regular: 'secondary',
  new: 'outline',
  'at-risk': 'destructive',
}

export default function CustomersPage() {
  const { t } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useCustomers()
  const [segment, setSegment] = useState('all')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)

  const rows = useMemo(() => (data ?? []).filter((c) => (segment === 'all' ? true : c.segment === segment)), [data, segment])
  const totals = useMemo(() => {
    const list = data ?? []
    return {
      count: list.length,
      vip: list.filter((c) => c.segment === 'vip').length,
      spent: list.reduce((s, c) => s + c.totalSpent, 0),
      active: list.filter((c) => c.accountStatus === 'active').length,
    }
  }, [data])

  const columns = useMemo<ColumnDef<Customer, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <button type="button" className="flex items-center gap-3 text-start" onClick={() => setViewing(row.original)}>
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: row.original.color }} className="text-xs text-white">
                {initials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.phone}</p>
            </div>
          </button>
        ),
      },
      {
        accessorKey: 'segment',
        header: t('customers.segment'),
        cell: ({ row }) => (
          <Badge variant={segmentVariant[row.original.segment]} className="capitalize">
            {row.original.segment}
          </Badge>
        ),
      },
      { accessorKey: 'totalOrders', header: t('common.orders'), cell: ({ row }) => <span className="tabular-nums">{row.original.totalOrders}</span> },
      { accessorKey: 'totalSpent', header: t('customers.totalSpent'), cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.totalSpent)}</span> },
      { accessorKey: 'loyaltyPoints', header: t('customers.loyalty'), cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.loyaltyPoints)}</span> },
      { accessorKey: 'lastVisit', header: t('customers.lastVisit'), cell: ({ row }) => formatRelative(row.original.lastVisit) },
      { accessorKey: 'accountStatus', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.accountStatus} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: t('common.view'), onSelect: () => setViewing(row.original) },
              { label: t('common.edit'), onSelect: () => setEditing(row.original) },
              {
                label: row.original.accountStatus === 'active' ? t('customers.block') : t('customers.unblock'),
                onSelect: async () => {
                  await update(row.original.id, { accountStatus: row.original.accountStatus === 'active' ? 'blocked' : 'active' })
                  toast.success(t('common.updated'))
                },
              },
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const initial: FormValues =
    editing && editing !== 'new'
      ? { name: editing.name, phone: editing.phone, email: editing.email, city: editing.city, notes: editing.notes }
      : { name: '', phone: '', email: '', city: 'Lahore', notes: '' }

  const save = async (v: FormValues) => {
    const patch = { name: String(v.name), phone: String(v.phone), email: String(v.email), city: String(v.city), notes: String(v.notes) }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      const today = new Date().toISOString().slice(0, 10)
      await create({
        ...patch,
        registeredAt: today,
        totalOrders: 0,
        totalSpent: 0,
        loyaltyPoints: 0,
        lastVisit: today,
        segment: 'new',
        authMethod: 'walk-in',
        accountStatus: 'active',
        favoriteItems: [],
        color: 'oklch(0.55 0.12 40)',
      })
      toast.success(t('common.created'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('customers.title')}
        description={t('customers.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('customers.add')}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('common.customers')} value={formatNumber(totals.count)} icon={UsersIcon} />
        <StatCard label="VIP" value={formatNumber(totals.vip)} icon={CrownIcon} />
        <StatCard label={t('common.active')} value={formatNumber(totals.active)} icon={UserCheckIcon} />
        <StatCard label={t('customers.totalSpent')} value={formatCompactCurrency(totals.spent)} icon={WalletIcon} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="customers"
        exportRows={(r) => r.map((c) => ({ name: c.name, phone: c.phone, email: c.email, segment: c.segment, orders: c.totalOrders, spent: c.totalSpent }))}
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
        filters={
          <OptionSelect
            className="h-9 w-40"
            value={segment}
            onValueChange={setSegment}
            aria-label={t('customers.segment')}
            options={[{ value: 'all', label: `${t('customers.segment')}: ${t('common.all')}` }, ...segments.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))]}
          />
        }
      />
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.name}</SheetTitle>
                <SheetDescription>{viewing.phone}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    [t('common.email'), viewing.email || '-'],
                    [t('customers.segment'), viewing.segment],
                    [t('common.orders'), String(viewing.totalOrders)],
                    [t('customers.totalSpent'), formatCurrency(viewing.totalSpent)],
                    [t('customers.loyalty'), formatNumber(viewing.loyaltyPoints)],
                    [t('customers.lastVisit'), formatDate(viewing.lastVisit)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="font-medium capitalize">{v}</dd>
                    </div>
                  ))}
                </dl>
                <Separator />
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">{t('customers.favorites')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewing.favoriteItems.length ? viewing.favoriteItems.map((f) => <Badge key={f} variant="secondary">{f}</Badge>) : <span className="text-muted-foreground">-</span>}
                  </div>
                </div>
                {viewing.notes && (
                  <>
                    <Separator />
                    <p className="text-muted-foreground">{viewing.notes}</p>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('customers.add') : t('common.edit')}
        fields={[
          { name: 'name', label: t('common.name'), required: true, wide: true },
          { name: 'phone', label: t('common.phone'), type: 'tel', required: true },
          { name: 'email', label: t('common.email'), type: 'email' },
          { name: 'city', label: t('customers.city') },
          { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
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
