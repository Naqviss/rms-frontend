'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, CheckCircle2Icon, MonitorSmartphoneIcon, RefreshCwIcon, ShieldOffIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useAccess } from '@/hooks/use-access'
import { useSyncRecords } from '@/hooks/use-data'
import { useDeviceBackups, useDeviceDiagnostics, useDeviceSyncHistory, useOfflineDevices } from '@/hooks/use-platform'
import { useScope } from '@/hooks/use-scope'
import { branchName } from '@/lib/directory'
import { useT } from '@/lib/i18n/use-t'
import { formatDateTime, formatRelative, titleCase } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { revokeOfflineDevice } from '@/services/api/modules/platform'
import type { BackupResponseDto, DeviceResponseDto, SyncEventResponseDto } from '@/services/api/generated/schemas'
import type { SyncRecord } from '@/types'

const when = (iso: string | null | undefined) => (iso ? formatDateTime(iso.slice(0, 19)) : '—')
const ago = (iso: string | null | undefined) => (iso ? formatRelative(iso.slice(0, 19)) : '—')
const latest = (...isos: (string | null | undefined)[]) => isos.filter((x): x is string => !!x).sort().pop() ?? null
const expired = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() < Date.now()

/**
 * Offline operations: registered POS devices (licence, sync state, diagnostics, backups, revoke)
 * and the unresolved offline conflicts/rejections of the selected branches.
 * Diagnostics can contain personal data; it is only rendered, never logged.
 */
export default function SyncPage() {
  const { t } = useT()
  const { can } = useAccess()
  const { branchIds } = useScope()
  const { data: conflicts, isLoading, update, mutate: refetchConflicts } = useSyncRecords()
  const { data: allDevices, isLoading: loadingDevices, mutate: refetchDevices } = useOfflineDevices()
  const [detail, setDetail] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<DeviceResponseDto | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const canResolve = can('settings', 'edit')
  const canRevoke = can('settings', 'delete')

  // Deep link from the hardware page: /sync?device=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('device')
    if (id) setDetail(id)
  }, [])

  const devices = useMemo(() => (allDevices ?? []).filter((d) => branchIds.includes(d.branch_id)), [allDevices, branchIds])

  const counts = useMemo(() => {
    const c = { conflict: 0, failed: 0 }
    for (const r of conflicts ?? []) if (r.status === 'conflict' || r.status === 'failed') c[r.status]++
    return c
  }, [conflicts])

  const resolve = async (r: SyncRecord) => {
    setBusy(r.id)
    try {
      await update(r.id, { status: 'synced' })
      toast.success(t('sync.done'))
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (d: DeviceResponseDto) => {
    setBusy(d.id)
    try {
      await revokeOfflineDevice(d.id)
      toast.success('Device revoked')
      await refetchDevices()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const deviceColumns = useMemo<ColumnDef<DeviceResponseDto, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {[row.original.platform, row.original.app_version && `v${row.original.app_version}`, row.original.code].filter(Boolean).join(' · ')}
            </p>
          </div>
        ),
      },
      { id: 'branch', header: t('common.branch'), accessorFn: (d) => branchName(d.branch_id) },
      { id: 'lastSync', header: t('common.lastSync'), accessorFn: (d) => latest(d.last_push_at, d.last_pull_at) ?? '', cell: ({ row }) => ago(latest(row.original.last_push_at, row.original.last_pull_at)) },
      {
        id: 'license',
        header: 'Licence',
        accessorFn: (d) => d.license_expires_at ?? '',
        cell: ({ row }) => {
          const d = row.original
          if (d.status === 'revoked') return '—'
          return (
            <span className="flex items-center gap-2">
              {when(d.license_expires_at)}
              {expired(d.license_expires_at) && <StatusBadge status="expired" label="Expired" tone="danger" />}
            </span>
          )
        },
      },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status === 'revoked' ? 'blocked' : 'active'} label={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: 'Details', onSelect: () => setDetail(row.original.id) },
              ...(canRevoke && row.original.status === 'active' && busy !== row.original.id
                ? [{ label: 'Revoke', destructive: true, onSelect: () => setRevoking(row.original) }]
                : []),
            ]}
          />
        ),
      },
    ],
    [t, canRevoke, busy],
  )

  const conflictColumns = useMemo<ColumnDef<SyncRecord, unknown>[]>(
    () => [
      { accessorKey: 'entity', header: t('sync.entity'), cell: ({ row }) => <span className="font-medium">{titleCase(row.original.entity)}</span> },
      { accessorKey: 'action', header: t('sync.action'), cell: ({ row }) => <span className="capitalize">{row.original.action}</span> },
      {
        accessorKey: 'description',
        header: t('common.description'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono text-xs">{row.original.description}</p>
            {row.original.error && <p className="break-all text-xs text-destructive">{row.original.error}</p>}
          </div>
        ),
      },
      { accessorKey: 'createdAt', header: t('common.date'), cell: ({ row }) => ago(row.original.createdAt) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.status === 'failed' ? 'rejected' : undefined} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          row.original.status === 'synced' || !canResolve || busy === row.original.id ? null : (
            <RowActions actions={[{ label: 'Mark resolved', onSelect: () => void resolve(row.original) }]} />
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canResolve, busy],
  )

  return (
    <>
      <PageHeader
        title={t('sync.title')}
        description="Registered POS devices, their licence and sync state, and offline changes that need attention."
        actions={
          <Button variant="outline" onClick={() => void Promise.all([refetchConflicts(), refetchDevices()])}>
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active devices" value={String(devices.filter((d) => d.status === 'active').length)} icon={MonitorSmartphoneIcon} />
        <StatCard label="Expired licences" value={String(devices.filter((d) => d.status === 'active' && expired(d.license_expires_at)).length)} icon={ShieldOffIcon} />
        <StatCard label={t('status.conflict')} value={String(counts.conflict)} icon={AlertTriangleIcon} />
        <StatCard label="Rejected" value={String(counts.failed)} icon={CheckCircle2Icon} />
      </div>
      <DataTable
        cardTitle="Devices"
        columns={deviceColumns}
        data={devices}
        isLoading={loadingDevices}
        exportName="offline-devices"
        emptyTitle="No registered devices"
        emptyDescription="POS devices appear here once they register from the desktop app."
      />
      <DataTable
        cardTitle="Conflicts & rejections"
        columns={conflictColumns}
        data={conflicts}
        isLoading={isLoading}
        exportName="offline-conflicts"
        emptyTitle="Nothing to resolve"
        emptyDescription="Offline changes the server could not apply show up here. Fix the record through the normal screens, then mark it resolved."
      />
      <DeviceDetail
        device={(allDevices ?? []).find((d) => d.id === detail) ?? null}
        deviceId={detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Revoke this device?"
        description="The device will no longer sync or renew its licence. It has to be registered again to be used."
        confirmLabel="Revoke"
        onConfirm={() => {
          if (revoking) void revoke(revoking)
        }}
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end tabular-nums">{children}</span>
    </p>
  )
}

const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`)

/** Sync status, diagnostics, history and backups of one device (all read-only). */
function DeviceDetail({ device, deviceId, onOpenChange }: { device: DeviceResponseDto | null; deviceId: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: diag, isLoading } = useDeviceDiagnostics(deviceId)
  const { data: history } = useDeviceSyncHistory(deviceId)
  const { data: backups } = useDeviceBackups(deviceId)
  const d = diag?.device ?? device
  const s = diag?.sync_status

  return (
    <Sheet open={!!deviceId} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{d?.name ?? 'Device'}</SheetTitle>
          <SheetDescription>{d ? `${branchName(d.branch_id)} · ${d.platform} v${d.app_version}` : ''}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          {isLoading && <Skeleton className="h-48 w-full" />}
          {diag && (diag.license_alert || diag.backup_alert || diag.full_sync_required) && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>Needs attention</AlertTitle>
              <AlertDescription>
                {[
                  diag.license_alert && `Licence ${diag.license_alert}`,
                  diag.backup_alert && `Backup ${diag.backup_alert.replace('_', ' ')}${diag.backup_due_at ? ` (due ${when(diag.backup_due_at)})` : ''}`,
                  diag.full_sync_required && 'Full sync required',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AlertDescription>
            </Alert>
          )}
          {d && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Licence & sync</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Row label={'Status'}>{d.status}{d.revoked_reason ? ` (${d.revoked_reason})` : ''}</Row>
                <Row label="Licence expires">
                  {when(s?.license_expires_at ?? d.license_expires_at)}
                  {s?.lease_type === 'sync_grace' && ' · grace lease'}
                </Row>
                <Row label="Last push">
                  {when(s?.last_push_at ?? d.last_push_at)}
                  {s?.last_push_status ? ` · ${s.last_push_status}` : ''}
                </Row>
                <Row label="Last pull">
                  {when(s?.last_pull_at ?? d.last_pull_at)}
                  {s ? ` · ${s.last_pull_complete ? 'complete' : 'incomplete'}` : ''}
                </Row>
                {s && <Row label="Last successful sync">{when(s.last_successful_sync_at)}</Row>}
                {s && <Row label="Latest backup">{when(s.latest_backup_at)}{s.backup_required ? (s.backup_fresh ? ' · fresh' : ' · stale') : ''}</Row>}
                {s && s.next_renewal_requirements.length > 0 && <Row label="Before next renewal">{s.next_renewal_requirements.join(', ').replace(/_/g, ' ')}</Row>}
                {diag && <Row label="Unresolved conflicts / rejections">{diag.unresolved_conflicts} / {diag.unresolved_rejections}</Row>}
                {diag?.last_failure && <Row label="Last failure">{diag.last_failure.failure_code ?? diag.last_failure.outcome} · {when(diag.last_failure.completed_at)}</Row>}
                {diag?.recovered_at && <Row label="Recovered">{when(diag.recovered_at)}</Row>}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sync history (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {!history?.length ? (
                <p className="text-sm text-muted-foreground">No sync events.</p>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {history.map((e: SyncEventResponseDto) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="uppercase">{e.kind}</Badge>
                        {e.outcome}
                        {e.failure_code && <span className="text-xs text-destructive">{e.failure_code}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {e.operations} ops · {e.applied} applied · {e.conflicts} conflicts · {e.rejected} rejected · {when(e.completed_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Backups</CardTitle>
            </CardHeader>
            <CardContent>
              {!backups?.length ? (
                <p className="text-sm text-muted-foreground">No backups retained.</p>
              ) : (
                <ul className="flex flex-col divide-y text-sm">
                  {backups.map((b: BackupResponseDto) => (
                    <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                      <span>{when(b.uploaded_at ?? b.created_at)}</span>
                      <span className="text-xs text-muted-foreground">
                        {kb(b.size_bytes)} · v{b.app_version} · {b.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
