'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { useAccess } from '@/hooks/use-access'
import { useConnections, useIntegrationInbox, useIntegrationLogs } from '@/hooks/use-platform'
import { useScope } from '@/hooks/use-scope'
import { branchName, currentBranchIds } from '@/lib/directory'
import { useT } from '@/lib/i18n/use-t'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { colorFor } from '@/services/api/mappers'
import {
  clearConnectionCredentials,
  createConnection,
  reconcileInboxEntry,
  setConnectionCredentials,
  setConnectionStatus,
  updateConnection,
} from '@/services/api/modules/platform'
import type { ConnectionResponseDto, InboxEntryResponseDto, IntegrationLogResponseDto, UpdateConnectionDto } from '@/services/api/generated/schemas'

const when = (iso: string | null | undefined) => (iso ? formatDateTime(iso.slice(0, 19)) : '—')
const providerName = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)

async function attempt(run: () => Promise<unknown>, ok: string): Promise<boolean> {
  try {
    await run()
    toast.success(ok)
    return true
  } catch (err) {
    toast.error(errorMessage(err))
    return false
  }
}

/**
 * Delivery-aggregator connections (Foodpanda / Delivery Hero) per branch, their inbound deliveries
 * that need reconciliation, and the provider call log (metadata only).
 * Credentials are write-only: entered here, sent once to PUT …/credentials, never shown back.
 */
export default function IntegrationsPage() {
  const { t } = useT()
  const { can } = useAccess()
  const { branchIds } = useScope()
  const connections = useConnections()
  const [creating, setCreating] = useState(false)
  const [configuring, setConfiguring] = useState<ConnectionResponseDto | null>(null)
  const [credentialsFor, setCredentialsFor] = useState<ConnectionResponseDto | null>(null)
  const [clearing, setClearing] = useState<ConnectionResponseDto | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const canEdit = can('settings', 'edit')
  const rows = (connections.data ?? []).filter((c) => branchIds.includes(c.branch_id))
  const refetch = () => connections.mutate()

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id)
    await attempt(fn, ok)
    setBusy(null)
  }

  const saveSettings = (v: FormValues) => {
    if (!configuring) return false
    const mode = String(v.credential_mode)
    const vendor = String(v.platform_vendor_id).trim()
    const body: UpdateConnectionDto = {
      expected_version: configuring.version,
      ...(mode && mode !== (configuring.credential_mode ?? '') ? { credential_mode: mode as 'branch' | 'platform' } : {}),
      ...(vendor !== (configuring.platform_vendor_id ?? '') ? { platform_vendor_id: vendor || null } : {}),
      ...(Number(v.default_preparation_minutes) !== configuring.default_preparation_minutes
        ? { settings: { default_preparation_minutes: Number(v.default_preparation_minutes) } }
        : {}),
    }
    return attempt(() => updateConnection(configuring.id, body).then(refetch), t('common.saved'))
  }

  return (
    <>
      <PageHeader
        title={t('integrations.title')}
        description="Delivery-platform connections for each branch."
        actions={
          <>
            <Button variant="outline" render={<Link href="/integrations/hardware" />} nativeButton={false}>
              {t('integrations.hardware')}
            </Button>
            {can('settings', 'create') && (
              <Button onClick={() => setCreating(true)}>
                <PlusIcon data-icon="inline-start" />
                Connect branch
              </Button>
            )}
          </>
        }
      />
      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="inbox">Deliveries to reconcile</TabsTrigger>
          <TabsTrigger value="logs">Call log</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="mt-4">
          {connections.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-44" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">No connections for the selected branches.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((c) => {
                const on = c.status === 'active'
                const name = providerName(c.provider)
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: colorFor(c.provider) }} aria-hidden>
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base">{name}</CardTitle>
                          <CardDescription>{branchName(c.branch_id)}</CardDescription>
                        </div>
                        <StatusBadge status={on ? 'connected' : 'disconnected'} />
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                      <p>
                        Remote ID <span className="font-mono text-xs text-foreground">{c.remote_id}</span>
                      </p>
                      <p>
                        Credentials:{' '}
                        {c.credential_mode === 'platform'
                          ? 'platform account'
                          : c.credential_mode === 'branch'
                            ? c.has_credentials
                              ? 'branch account (stored)'
                              : 'branch account (missing)'
                            : 'not configured'}
                      </p>
                      <p>Preparation time: {c.default_preparation_minutes} min</p>
                      <p className="text-xs">
                        Last inbound {c.last_inbound_at ? formatRelative(c.last_inbound_at.slice(0, 19)) : t('common.never')} · outbound{' '}
                        {c.last_outbound_at ? formatRelative(c.last_outbound_at.slice(0, 19)) : t('common.never')}
                      </p>
                      {c.last_error_code && (
                        <p className="text-xs text-destructive">
                          Last error {c.last_error_code} · {when(c.last_error_at)}
                        </p>
                      )}
                    </CardContent>
                    {canEdit && (
                      <CardFooter className="flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={on ? 'outline' : 'default'}
                          disabled={busy === c.id}
                          onClick={() =>
                            void run(c.id, () => setConnectionStatus(c, on ? 'disabled' : 'active').then(refetch), on ? t('integrations.disconnected') : t('integrations.connectedToast'))
                          }
                        >
                          {busy === c.id && <Spinner data-icon="inline-start" />}
                          {on ? t('common.disconnect') : t('common.connect')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfiguring(c)}>
                          Settings
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setCredentialsFor(c)}>
                          {c.has_credentials ? 'Replace credentials' : 'Set credentials'}
                        </Button>
                        {c.has_credentials && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setClearing(c)}>
                            Clear credentials
                          </Button>
                        )}
                      </CardFooter>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="inbox" className="mt-4">
          <InboxTable canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LogsTable />
        </TabsContent>
      </Tabs>

      <FormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Connect branch"
        description="The connection is created disabled. Configure credentials, then connect it."
        fields={[
          { name: 'branch_id', label: t('common.branch'), type: 'select', required: true, options: currentBranchIds.map((id) => ({ value: id, label: branchName(id) })) },
          {
            name: 'credential_mode',
            label: 'Credentials',
            type: 'select',
            options: [
              { value: 'branch', label: 'Branch account' },
              { value: 'platform', label: 'Platform account' },
            ],
          },
          { name: 'platform_vendor_id', label: 'Delivery Hero vendor ID (platform mode)' },
          { name: 'remote_id', label: 'Remote ID (optional)', placeholder: 'Generated when empty' },
          { name: 'default_preparation_minutes', label: 'Preparation time (min)', type: 'number' },
        ]}
        initial={{ branch_id: currentBranchIds[0] ?? '', credential_mode: 'branch', platform_vendor_id: '', remote_id: '', default_preparation_minutes: 20 }}
        onSubmit={(v) => {
          const vendor = String(v.platform_vendor_id).trim()
          const remote = String(v.remote_id).trim()
          return attempt(
            () =>
              createConnection({
                branch_id: String(v.branch_id),
                credential_mode: String(v.credential_mode) as 'branch' | 'platform',
                ...(vendor ? { platform_vendor_id: vendor } : {}),
                ...(remote ? { remote_id: remote } : {}),
                ...(Number(v.default_preparation_minutes) > 0 ? { settings: { default_preparation_minutes: Number(v.default_preparation_minutes) } } : {}),
              }).then(refetch),
            t('common.created'),
          )
        }}
      />
      <FormDialog
        open={!!configuring}
        onOpenChange={(o) => !o && setConfiguring(null)}
        title="Connection settings"
        fields={[
          {
            name: 'credential_mode',
            label: 'Credentials',
            type: 'select',
            options: [
              { value: 'branch', label: 'Branch account' },
              { value: 'platform', label: 'Platform account' },
            ],
          },
          { name: 'platform_vendor_id', label: 'Delivery Hero vendor ID' },
          { name: 'default_preparation_minutes', label: 'Preparation time (min)', type: 'number' },
        ]}
        initial={{
          credential_mode: configuring?.credential_mode ?? '',
          platform_vendor_id: configuring?.platform_vendor_id ?? '',
          default_preparation_minutes: configuring?.default_preparation_minutes ?? 0,
        }}
        onSubmit={saveSettings}
      />
      <CredentialsDialog
        connection={credentialsFor}
        onOpenChange={(o) => !o && setCredentialsFor(null)}
        onSaved={refetch}
      />
      <ConfirmDialog
        open={!!clearing}
        onOpenChange={(o) => !o && setClearing(null)}
        title="Clear stored credentials?"
        description="The branch credentials are deleted and the connection is disconnected."
        confirmLabel="Clear"
        onConfirm={() => {
          if (clearing) void run(clearing.id, () => clearConnectionCredentials(clearing).then(refetch), 'Credentials cleared')
        }}
      />
    </>
  )
}

/** Write-only credential entry: values live only in this dialog's state and are dropped on close. */
function CredentialsDialog({ connection, onOpenChange, onSaved }: { connection: ConnectionResponseDto | null; onOpenChange: (o: boolean) => void; onSaved: () => unknown }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const close = (o: boolean) => {
    if (!o) {
      setUsername('')
      setPassword('')
    }
    onOpenChange(o)
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connection || !username.trim() || !password) return
    setSaving(true)
    const ok = await attempt(() => setConnectionCredentials(connection, username.trim(), password).then(onSaved), 'Credentials saved')
    setSaving(false)
    if (ok) close(false)
  }
  return (
    <Dialog open={!!connection} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Middleware credentials</DialogTitle>
          <DialogDescription>Stored encrypted on the server and never shown again. Saving selects branch credentials for this connection.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="cred-user">Username</FieldLabel>
              <Input id="cred-user" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cred-pass">Password</FieldLabel>
              <Input id="cred-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !username.trim() || !password}>
              {saving && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function InboxTable({ canEdit }: { canEdit: boolean }) {
  const { t } = useT()
  const { data, isLoading, mutate } = useIntegrationInbox('required')
  const [busy, setBusy] = useState<string | null>(null)
  const columns = useMemo<ColumnDef<InboxEntryResponseDto, unknown>[]>(
    () => [
      { accessorKey: 'received_at', header: t('common.date'), cell: ({ row }) => when(row.original.received_at) },
      { id: 'branch', header: t('common.branch'), accessorFn: (r) => branchName(r.branch_id) },
      { id: 'provider', header: 'Provider', accessorFn: (r) => `${providerName(r.provider)} · ${r.kind}` },
      { id: 'ref', header: 'Reference', accessorFn: (r) => r.external_reference ?? '—' },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status === 'processed' ? 'completed' : row.original.status} label={row.original.status} /> },
      { id: 'error', header: 'Error', accessorFn: (r) => r.error_code ?? '—' },
      { accessorKey: 'attempts', header: t('sync.attempts') },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          canEdit && row.original.reconciliation_status === 'required' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === row.original.id}
              onClick={async () => {
                setBusy(row.original.id)
                await attempt(() => reconcileInboxEntry(row.original.id).then(() => mutate()), 'Marked as reconciled')
                setBusy(null)
              }}
            >
              Reconciled
            </Button>
          ) : (
            <Badge variant="secondary">{row.original.reconciliation_status ?? '—'}</Badge>
          ),
      },
    ],
    [t, canEdit, busy, mutate],
  )
  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      exportName="integration-inbox"
      emptyTitle="Nothing to reconcile"
      emptyDescription="Deliveries the provider was told were accepted but that did not take effect appear here. Handle them with the provider, then mark them reconciled."
    />
  )
}

function LogsTable() {
  const { t } = useT()
  const { data, isLoading } = useIntegrationLogs()
  const columns = useMemo<ColumnDef<IntegrationLogResponseDto, unknown>[]>(
    () => [
      { accessorKey: 'created_at', header: t('common.date'), cell: ({ row }) => when(row.original.created_at) },
      { id: 'provider', header: 'Provider', accessorFn: (r) => providerName(r.provider) },
      { accessorKey: 'direction', header: 'Direction' },
      { accessorKey: 'operation', header: t('sync.action'), cell: ({ row }) => <span className="font-mono text-xs">{row.original.operation}</span> },
      { id: 'http', header: 'HTTP', accessorFn: (r) => r.http_status ?? '—' },
      { id: 'duration', header: 'Duration', accessorFn: (r) => (r.duration_ms != null ? `${r.duration_ms} ms` : '—') },
      { accessorKey: 'success', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.success ? 'completed' : 'failed'} label={row.original.success ? 'ok' : (row.original.error_code ?? 'failed')} /> },
    ],
    [t],
  )
  return <DataTable columns={columns} data={data} isLoading={isLoading} exportName="integration-logs" emptyTitle="No provider calls yet" />
}
