'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useTenants } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatDate, formatNumber, initials, titleCase } from '@/lib/utils/format'
import type { Tenant } from '@/types'

export default function TenantsPage() {
  const { t } = useT()
  const { data, isLoading, update, remove, removeMany } = useTenants()
  const [status, setStatus] = useState('all')
  const rows = useMemo(() => (data ?? []).filter((x) => (status === 'all' ? true : x.status === status)), [data, status])

  const columns = useMemo<ColumnDef<Tenant, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: row.original.color }} className="text-xs text-white">
                {initials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.owner} · {row.original.city}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: 'plan', header: t('admin.plan'), cell: ({ row }) => <Badge variant="outline">{titleCase(row.original.plan)}</Badge> },
      { accessorKey: 'branches', header: t('nav.branches'), cell: ({ row }) => <span className="tabular-nums">{row.original.branches}</span> },
      { accessorKey: 'usersCount', header: t('nav.users'), cell: ({ row }) => <span className="tabular-nums">{row.original.usersCount}</span> },
      { accessorKey: 'monthlyRevenue', header: t('common.revenue'), cell: ({ row }) => <span className="tabular-nums">{formatCompactCurrency(row.original.monthlyRevenue)}</span> },
      { accessorKey: 'ordersThisMonth', header: t('common.orders'), cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.ordersThisMonth)}</span> },
      { accessorKey: 'registeredAt', header: t('admin.registered'), cell: ({ row }) => formatDate(row.original.registeredAt) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: row.original.status === 'suspended' ? t('admin.activate') : t('admin.suspend'),
                onSelect: async () => {
                  await update(row.original.id, { status: row.original.status === 'suspended' ? 'active' : 'suspended' })
                  toast.success(t('common.updated'))
                },
              },
              {
                label: t('common.delete'),
                destructive: true,
                onSelect: async () => {
                  await remove(row.original.id)
                  toast.success(t('common.deleted'))
                },
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  return (
    <>
      <PageHeader title={t('admin.tenants')} description={t('admin.tenantsSubtitle')} />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="tenants"
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
        filters={
          <OptionSelect
            className="h-9 w-40"
            value={status}
            onValueChange={setStatus}
            aria-label={t('common.status')}
            options={[
              { value: 'all', label: `${t('common.status')}: ${t('common.all')}` },
              { value: 'active', label: t('status.active') },
              { value: 'trial', label: t('status.trial') },
              { value: 'suspended', label: t('status.suspended') },
            ]}
          />
        }
      />
    </>
  )
}
