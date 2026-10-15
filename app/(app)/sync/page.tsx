'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, CheckCircle2Icon, CloudOffIcon, RefreshCwIcon, WifiIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useSyncRecords } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatRelative, titleCase } from '@/lib/utils/format'
import type { SyncRecord } from '@/types'

export default function SyncPage() {
  const { t } = useT()
  const { data, isLoading, update, mutate } = useSyncRecords()
  const [offline, setOffline] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const counts = useMemo(() => {
    const c = { pending: 0, failed: 0, synced: 0, conflict: 0 }
    for (const r of data ?? []) c[r.status]++
    return c
  }, [data])

  const syncAll = async () => {
    setSyncing(true)
    await new Promise((r) => setTimeout(r, 900))
    await Promise.all((data ?? []).filter((r) => r.status === 'pending').map((r) => update(r.id, { status: 'synced' })))
    await mutate?.()
    setSyncing(false)
    toast.success(t('sync.done'))
  }

  const columns = useMemo<ColumnDef<SyncRecord, unknown>[]>(
    () => [
      { accessorKey: 'entity', header: t('sync.entity'), cell: ({ row }) => <span className="font-medium">{titleCase(row.original.entity)}</span> },
      { accessorKey: 'action', header: t('sync.action'), cell: ({ row }) => <span className="capitalize">{row.original.action}</span> },
      {
        accessorKey: 'description',
        header: t('common.description'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p>{row.original.description}</p>
            {row.original.error && <p className="text-xs text-destructive">{row.original.error}</p>}
          </div>
        ),
      },
      { accessorKey: 'createdAt', header: t('common.date'), cell: ({ row }) => formatRelative(row.original.createdAt) },
      { accessorKey: 'attempts', header: t('sync.attempts'), cell: ({ row }) => <span className="tabular-nums">{row.original.attempts}</span> },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          row.original.status === 'synced' ? null : (
            <RowActions
              actions={[
                { label: t('sync.retry'), onSelect: async () => { await update(row.original.id, { status: 'synced', error: undefined, attempts: row.original.attempts + 1 }); toast.success(t('sync.done')) } },
                ...(row.original.status === 'conflict'
                  ? [{ label: t('sync.keepLocal'), onSelect: async () => { await update(row.original.id, { status: 'synced' }); toast.success(t('sync.done')) } }]
                  : []),
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
      <PageHeader
        title={t('sync.title')}
        description={t('sync.subtitle')}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={offline} onCheckedChange={setOffline} />
              {t('sync.simulateOffline')}
            </label>
            <Button onClick={syncAll} disabled={syncing || offline}>
              {syncing ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
              {t('sync.syncNow')}
            </Button>
          </>
        }
      />
      {offline && (
        <Alert variant="destructive">
          <CloudOffIcon />
          <AlertTitle>{t('status.offline')}</AlertTitle>
          <AlertDescription>{t('sync.offlineHint')}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('status.pending')} value={String(counts.pending)} icon={WifiIcon} />
        <StatCard label={t('status.failed')} value={String(counts.failed)} icon={AlertTriangleIcon} />
        <StatCard label={t('status.conflict')} value={String(counts.conflict)} icon={AlertTriangleIcon} />
        <StatCard label={t('status.synced')} value={String(counts.synced)} icon={CheckCircle2Icon} />
      </div>
      <DataTable columns={columns} data={data} isLoading={isLoading} exportName="sync-queue" />
    </>
  )
}
