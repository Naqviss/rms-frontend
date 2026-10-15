'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useOrders, useRiders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/utils/format'
import { branchName } from '@/mocks/branches'
import type { Rider, RiderStatus } from '@/types'

interface RiderRow extends Rider {
  deliveries: number
  avgMinutes: number
  fees: number
}

export default function RidersPage() {
  const { t } = useT()
  const { data: riders, isLoading, update } = useRiders()
  const { data: orders } = useOrders()
  const { inBranch, inRange } = useScope()

  const rows = useMemo<RiderRow[]>(() => {
    const done = inRange(
      (orders ?? []).filter((o) => o.delivery?.status === 'delivered' && o.delivery.riderId),
      (o) => o.createdAt,
    )
    return inBranch(riders ?? []).map((r) => {
      const mine = done.filter((o) => o.delivery?.riderId === r.id)
      const mins = mine.map((o) => o.delivery?.durationMinutes ?? 0).filter(Boolean)
      return {
        ...r,
        deliveries: mine.length,
        avgMinutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
        fees: mine.reduce((s, o) => s + (o.delivery?.fee ?? 0), 0),
      }
    })
  }, [riders, orders, inBranch, inRange])

  const setStatus = async (r: Rider, status: RiderStatus) => {
    await update(r.id, { status })
    toast.success(t('common.updated'))
  }

  const columns = useMemo<ColumnDef<RiderRow, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('common.name'), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: 'phone', header: t('common.phone') },
      { accessorKey: 'vehicle', header: 'Vehicle', cell: ({ row }) => <span className="capitalize">{row.original.vehicle}</span> },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { accessorKey: 'deliveries', header: 'Deliveries', cell: ({ row }) => <span className="tabular-nums">{row.original.deliveries}</span> },
      {
        accessorKey: 'avgMinutes',
        header: 'Avg time',
        cell: ({ row }) => <span className="tabular-nums">{row.original.avgMinutes ? `${row.original.avgMinutes} min` : '-'}</span>,
      },
      { accessorKey: 'fees', header: 'Fees collected', cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.fees)}</span> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={(['available', 'on-delivery', 'off-duty'] as RiderStatus[])
              .filter((s) => s !== row.original.status)
              .map((s) => ({ label: `Mark ${s.replace('-', ' ')}`, onSelect: () => setStatus(row.original, s) }))}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  return (
    <>
      <PageHeader title={t('nav.riders')} description="Your delivery team, their availability and performance." />
      <DataTable columns={columns} data={rows} isLoading={isLoading} exportName="riders" />
    </>
  )
}
