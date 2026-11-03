'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FieldDef, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useAccess } from '@/hooks/use-access'
import { useKitchenTargets, useOfflineDevices, usePosPrinters, usePosStationConfig, usePosStations } from '@/hooks/use-platform'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import { branchName, currentBranchIds } from '@/lib/directory'
import { errorMessage } from '@/services/api/client'
import {
  createKitchenTarget,
  createPosPrinter,
  createPosStation,
  renameOfflineDevice,
  updateKitchenTarget,
  updatePosPrinter,
  updatePosStation,
} from '@/services/api/modules/platform'
import type {
  DeviceResponseDto,
  KitchenTargetResponseDto,
  PosPrinterResponseDto,
  PosStationResponseDto,
} from '@/services/api/generated/schemas'

const ago = (iso: string | null | undefined) => (iso ? formatRelative(iso.slice(0, 19)) : '—')
const NONE = '__none__'
const opt = (v: string | null | undefined) => v ?? NONE
const unopt = (v: unknown) => (v === NONE || v === '' ? null : String(v))

/** Run a write, report the server's reason on failure, keep the dialog open (`false`) if it failed. */
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

const printerKinds = ['receipt', 'kitchen', 'label'] as const
const connections = ['network', 'usb', 'bluetooth', 'system'] as const

type Editing<T> = T | 'new' | null

/**
 * POS hardware configuration: stations (tills), printers, kitchen routing targets and the
 * registered POS devices. Devices register themselves from the desktop app; licence, sync and
 * revoke live on the Offline & Sync page.
 */
export default function HardwarePage() {
  const { t } = useT()
  const { can } = useAccess()
  const { inBranch } = useScope()
  const stations = usePosStations()
  const printers = usePosPrinters()
  const targets = useKitchenTargets()
  const devices = useOfflineDevices()
  const canEdit = can('settings', 'edit')
  const canCreate = can('settings', 'create')

  const [station, setStation] = useState<Editing<PosStationResponseDto>>(null)
  const [printer, setPrinter] = useState<Editing<PosPrinterResponseDto>>(null)
  const [target, setTarget] = useState<Editing<KitchenTargetResponseDto>>(null)
  const [device, setDevice] = useState<DeviceResponseDto | null>(null)
  const [configOf, setConfigOf] = useState<PosStationResponseDto | null>(null)

  const scoped = <T extends { branch_id: string }>(rows: T[] | undefined) =>
    rows ? inBranch(rows.map((r) => ({ ...r, branchId: r.branch_id }))) : undefined
  const stationRows = useMemo(() => scoped(stations.data), [stations.data, inBranch]) // eslint-disable-line react-hooks/exhaustive-deps
  const printerRows = useMemo(() => scoped(printers.data), [printers.data, inBranch]) // eslint-disable-line react-hooks/exhaustive-deps
  const targetRows = useMemo(() => scoped(targets.data), [targets.data, inBranch]) // eslint-disable-line react-hooks/exhaustive-deps
  const deviceRows = useMemo(() => scoped(devices.data), [devices.data, inBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  const printerName = (id: string | null | undefined) => (id ? (printers.data?.find((p) => p.id === id)?.name ?? '—') : '—')
  const deviceName = (id: string | null | undefined) => (id ? (devices.data?.find((d) => d.id === id)?.name ?? '—') : '—')
  const branchOptions = currentBranchIds.map((id) => ({ value: id, label: branchName(id) }))
  const printerOptions = (kind?: PosPrinterResponseDto['kind']) => [
    { value: NONE, label: '—' },
    ...(printers.data ?? []).filter((p) => !kind || p.kind === kind).map((p) => ({ value: p.id, label: `${p.name} (${branchName(p.branch_id)})` })),
  ]
  const deviceOptions = [
    { value: NONE, label: '—' },
    ...(devices.data ?? []).filter((d) => d.status === 'active').map((d) => ({ value: d.id, label: `${d.name} (${branchName(d.branch_id)})` })),
  ]
  const status = (active: boolean) => <StatusBadge status={active ? 'active' : 'inactive'} />
  const nameCell = (name: string, code: string) => (
    <div className="min-w-0">
      <p className="font-medium">{name}</p>
      <p className="font-mono text-xs text-muted-foreground">{code}</p>
    </div>
  )

  // ── Stations ──────────────────────────────────────────────────────────────────────────────
  const stationColumns = useMemo<ColumnDef<PosStationResponseDto & { branchId: string }, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('common.name'), cell: ({ row }) => nameCell(row.original.name, row.original.code) },
      { id: 'branch', header: t('common.branch'), accessorFn: (r) => branchName(r.branch_id) },
      { id: 'device', header: 'Device', accessorFn: (r) => deviceName(r.device_id) },
      { id: 'printer', header: 'Receipt printer', accessorFn: (r) => printerName(r.receipt_printer_id) },
      {
        id: 'peripherals',
        header: 'Peripherals',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.has_cash_drawer && <Badge variant="secondary">Cash drawer</Badge>}
            {row.original.has_scanner && <Badge variant="secondary">Scanner</Badge>}
            {row.original.has_customer_display && <Badge variant="secondary">Customer display</Badge>}
          </div>
        ),
      },
      { id: 'contact', header: 'Last contact', accessorFn: (r) => r.last_contact_at ?? '', cell: ({ row }) => ago(row.original.last_contact_at) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => status(row.original.status === 'active') },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: 'View configuration', onSelect: () => setConfigOf(row.original) },
              ...(canEdit
                ? [
                    { label: t('common.edit'), onSelect: () => setStation(row.original) },
                    {
                      label: row.original.status === 'active' ? t('users.deactivate') : t('users.activate'),
                      onSelect: () =>
                        void attempt(
                          () => updatePosStation(row.original, { status: row.original.status === 'active' ? 'inactive' : 'active' }).then(() => stations.mutate()),
                          t('common.updated'),
                        ),
                    },
                  ]
                : []),
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit, printers.data, devices.data],
  )

  const stationFields: FieldDef[] = [
    ...(station === 'new'
      ? ([
          { name: 'branch_id', label: t('common.branch'), type: 'select', options: branchOptions, required: true },
          { name: 'code', label: 'Code', required: true, placeholder: 'TILL1' },
        ] as FieldDef[])
      : []),
    { name: 'name', label: t('common.name'), required: true, wide: station !== 'new' },
    { name: 'device_id', label: 'Device', type: 'select', options: deviceOptions },
    { name: 'receipt_printer_id', label: 'Receipt printer', type: 'select', options: printerOptions('receipt') },
    { name: 'has_cash_drawer', label: 'Cash drawer', type: 'switch' },
    { name: 'has_scanner', label: 'Barcode scanner', type: 'switch' },
    { name: 'has_customer_display', label: 'Customer display', type: 'switch' },
    { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ]

  const saveStation = (v: FormValues) => {
    const common = {
      name: String(v.name),
      has_cash_drawer: !!v.has_cash_drawer,
      has_scanner: !!v.has_scanner,
      has_customer_display: !!v.has_customer_display,
    }
    if (station === 'new') {
      const device_id = unopt(v.device_id)
      const receipt_printer_id = unopt(v.receipt_printer_id)
      return attempt(
        () =>
          createPosStation({
            branch_id: String(v.branch_id),
            code: String(v.code).trim(),
            ...common,
            ...(device_id ? { device_id } : {}),
            ...(receipt_printer_id ? { receipt_printer_id } : {}),
            ...(String(v.notes).trim() ? { notes: String(v.notes).trim() } : {}),
          }).then(() => stations.mutate()),
        t('common.created'),
      )
    }
    if (!station) return false
    return attempt(
      () =>
        updatePosStation(station, {
          ...common,
          device_id: unopt(v.device_id),
          receipt_printer_id: unopt(v.receipt_printer_id),
          notes: String(v.notes).trim() || null,
        }).then(() => stations.mutate()),
      t('common.updated'),
    )
  }

  // ── Printers ──────────────────────────────────────────────────────────────────────────────
  const printerColumns = useMemo<ColumnDef<PosPrinterResponseDto & { branchId: string }, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('common.name'), cell: ({ row }) => nameCell(row.original.name, row.original.code) },
      { id: 'branch', header: t('common.branch'), accessorFn: (r) => branchName(r.branch_id) },
      { accessorKey: 'kind', header: t('common.type'), cell: ({ row }) => <span className="capitalize">{row.original.kind}</span> },
      { accessorKey: 'connection', header: 'Connection', cell: ({ row }) => <span className="capitalize">{row.original.connection}</span> },
      { id: 'address', header: 'Address', accessorFn: (r) => r.address ?? '', cell: ({ row }) => <span className="font-mono text-xs">{row.original.address ?? '—'}</span> },
      { id: 'paper', header: 'Paper', accessorFn: (r) => r.paper_width_mm ?? 0, cell: ({ row }) => (row.original.paper_width_mm ? `${row.original.paper_width_mm} mm` : '—') },
      { accessorKey: 'is_active', header: t('common.status'), cell: ({ row }) => status(row.original.is_active) },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          canEdit ? (
            <RowActions
              actions={[
                { label: t('common.edit'), onSelect: () => setPrinter(row.original) },
                {
                  label: row.original.is_active ? t('users.deactivate') : t('users.activate'),
                  onSelect: () =>
                    void attempt(() => updatePosPrinter(row.original, { is_active: !row.original.is_active }).then(() => printers.mutate()), t('common.updated')),
                },
              ]}
            />
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit],
  )

  const printerFields: FieldDef[] = [
    ...(printer === 'new'
      ? ([
          { name: 'branch_id', label: t('common.branch'), type: 'select', options: branchOptions, required: true },
          { name: 'code', label: 'Code', required: true, placeholder: 'RCPT1' },
        ] as FieldDef[])
      : []),
    { name: 'name', label: t('common.name'), required: true, wide: printer !== 'new' },
    { name: 'kind', label: t('common.type'), type: 'select', options: printerKinds.map((k) => ({ value: k, label: k })) },
    { name: 'connection', label: 'Connection', type: 'select', options: connections.map((c) => ({ value: c, label: c })) },
    { name: 'address', label: 'Address', placeholder: '192.168.1.50:9100' },
    { name: 'paper_width_mm', label: 'Paper width (mm)', type: 'number' },
  ]

  const savePrinter = (v: FormValues) => {
    const kind = String(v.kind) as PosPrinterResponseDto['kind']
    const connection = String(v.connection) as PosPrinterResponseDto['connection']
    const address = String(v.address).trim()
    const width = Number(v.paper_width_mm) || 0
    if (printer === 'new') {
      return attempt(
        () =>
          createPosPrinter({
            branch_id: String(v.branch_id),
            code: String(v.code).trim(),
            name: String(v.name),
            kind,
            connection,
            ...(address ? { address } : {}),
            ...(width > 0 ? { paper_width_mm: width } : {}),
          }).then(() => printers.mutate()),
        t('common.created'),
      )
    }
    if (!printer) return false
    return attempt(
      () =>
        updatePosPrinter(printer, { name: String(v.name), kind, connection, address: address || null, paper_width_mm: width > 0 ? width : null }).then(() =>
          printers.mutate(),
        ),
      t('common.updated'),
    )
  }

  // ── Kitchen targets ───────────────────────────────────────────────────────────────────────
  const targetColumns = useMemo<ColumnDef<KitchenTargetResponseDto & { branchId: string }, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('common.name'), cell: ({ row }) => nameCell(row.original.name, row.original.code) },
      { id: 'branch', header: t('common.branch'), accessorFn: (r) => branchName(r.branch_id) },
      { accessorKey: 'kind', header: t('common.type'), cell: ({ row }) => <span className="capitalize">{row.original.kind}</span> },
      { id: 'printer', header: 'Printer', accessorFn: (r) => printerName(r.printer_id) },
      {
        id: 'routing',
        header: 'Routing',
        accessorFn: (r) => (r.menu_category_ids.length ? `${r.menu_category_ids.length} categories` : 'All categories'),
      },
      { accessorKey: 'is_active', header: t('common.status'), cell: ({ row }) => status(row.original.is_active) },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          canEdit ? (
            <RowActions
              actions={[
                { label: t('common.edit'), onSelect: () => setTarget(row.original) },
                {
                  label: row.original.is_active ? t('users.deactivate') : t('users.activate'),
                  onSelect: () =>
                    void attempt(() => updateKitchenTarget(row.original, { is_active: !row.original.is_active }).then(() => targets.mutate()), t('common.updated')),
                },
              ]}
            />
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit, printers.data],
  )

  const targetFields: FieldDef[] = [
    ...(target === 'new'
      ? ([
          { name: 'branch_id', label: t('common.branch'), type: 'select', options: branchOptions, required: true },
          { name: 'code', label: 'Code', required: true, placeholder: 'GRILL' },
        ] as FieldDef[])
      : []),
    { name: 'name', label: t('common.name'), required: true, wide: target !== 'new' },
    { name: 'kind', label: t('common.type'), type: 'select', options: [{ value: 'printer', label: 'printer' }, { value: 'display', label: 'display' }] },
    { name: 'printer_id', label: 'Kitchen printer (printer targets)', type: 'select', options: printerOptions('kitchen') },
  ]

  const saveTarget = (v: FormValues) => {
    const kind = String(v.kind) as KitchenTargetResponseDto['kind']
    const printer_id = kind === 'printer' ? unopt(v.printer_id) : null
    if (target === 'new') {
      return attempt(
        () =>
          createKitchenTarget({
            branch_id: String(v.branch_id),
            code: String(v.code).trim(),
            name: String(v.name),
            kind,
            ...(printer_id ? { printer_id } : {}),
          }).then(() => targets.mutate()),
        t('common.created'),
      )
    }
    if (!target) return false
    return attempt(() => updateKitchenTarget(target, { name: String(v.name), kind, printer_id }).then(() => targets.mutate()), t('common.updated'))
  }

  // ── Devices ───────────────────────────────────────────────────────────────────────────────
  const deviceColumns = useMemo<ColumnDef<DeviceResponseDto & { branchId: string }, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('common.name'), cell: ({ row }) => nameCell(row.original.name, row.original.code) },
      { id: 'branch', header: t('common.branch'), accessorFn: (r) => branchName(r.branch_id) },
      { id: 'app', header: t('integrations.model'), accessorFn: (r) => `${r.platform} v${r.app_version}` },
      { id: 'seen', header: 'Last seen', accessorFn: (r) => r.last_seen_at ?? '', cell: ({ row }) => ago(row.original.last_seen_at) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status === 'active' ? 'active' : 'blocked'} label={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" render={<Link href={`/sync?device=${row.original.id}`} />} nativeButton={false}>
              Sync & licence
            </Button>
            {canEdit && row.original.status === 'active' && <RowActions actions={[{ label: 'Rename', onSelect: () => setDevice(row.original) }]} />}
          </div>
        ),
      },
    ],
    [t, canEdit],
  )

  const addButton = (label: string, onClick: () => void) =>
    canCreate ? (
      <Button size="sm" onClick={onClick}>
        <PlusIcon data-icon="inline-start" />
        {label}
      </Button>
    ) : undefined

  return (
    <>
      <PageHeader title={t('integrations.hardware')} description={t('integrations.hardwareSubtitle')} />
      <Tabs defaultValue="stations">
        <TabsList>
          <TabsTrigger value="stations">Stations</TabsTrigger>
          <TabsTrigger value="printers">Printers</TabsTrigger>
          <TabsTrigger value="targets">Kitchen targets</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
        </TabsList>
        <TabsContent value="stations" className="mt-4">
          <DataTable
            columns={stationColumns}
            data={stationRows}
            isLoading={stations.isLoading}
            exportName="pos-stations"
            toolbarActions={addButton('Add station', () => setStation('new'))}
            emptyTitle="No POS stations"
          />
        </TabsContent>
        <TabsContent value="printers" className="mt-4">
          <DataTable
            columns={printerColumns}
            data={printerRows}
            isLoading={printers.isLoading}
            exportName="pos-printers"
            toolbarActions={addButton('Add printer', () => setPrinter('new'))}
            emptyTitle="No printers"
          />
        </TabsContent>
        <TabsContent value="targets" className="mt-4">
          <DataTable
            columns={targetColumns}
            data={targetRows}
            isLoading={targets.isLoading}
            exportName="kitchen-targets"
            toolbarActions={addButton('Add target', () => setTarget('new'))}
            emptyTitle="No kitchen targets"
            emptyDescription="Without targets, kitchen tickets are not routed to any printer or display."
          />
        </TabsContent>
        <TabsContent value="devices" className="mt-4">
          <DataTable
            columns={deviceColumns}
            data={deviceRows}
            isLoading={devices.isLoading}
            exportName="pos-devices"
            emptyTitle="No registered devices"
            emptyDescription="POS devices register themselves from the desktop app."
          />
        </TabsContent>
      </Tabs>

      <FormDialog
        open={station !== null}
        onOpenChange={(o) => !o && setStation(null)}
        title={station === 'new' ? 'Add station' : t('common.edit')}
        fields={stationFields}
        initial={
          station && station !== 'new'
            ? {
                name: station.name,
                device_id: opt(station.device_id),
                receipt_printer_id: opt(station.receipt_printer_id),
                has_cash_drawer: station.has_cash_drawer,
                has_scanner: station.has_scanner,
                has_customer_display: station.has_customer_display,
                notes: station.notes ?? '',
              }
            : { branch_id: currentBranchIds[0] ?? '', code: '', name: '', device_id: NONE, receipt_printer_id: NONE, has_cash_drawer: false, has_scanner: false, has_customer_display: false, notes: '' }
        }
        onSubmit={saveStation}
      />
      <FormDialog
        open={printer !== null}
        onOpenChange={(o) => !o && setPrinter(null)}
        title={printer === 'new' ? 'Add printer' : t('common.edit')}
        fields={printerFields}
        initial={
          printer && printer !== 'new'
            ? { name: printer.name, kind: printer.kind, connection: printer.connection, address: printer.address ?? '', paper_width_mm: printer.paper_width_mm ?? 0 }
            : { branch_id: currentBranchIds[0] ?? '', code: '', name: '', kind: 'receipt', connection: 'network', address: '', paper_width_mm: 80 }
        }
        onSubmit={savePrinter}
      />
      <FormDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target === 'new' ? 'Add kitchen target' : t('common.edit')}
        description="Category routing is set per target; an empty list receives every category."
        fields={targetFields}
        initial={
          target && target !== 'new'
            ? { name: target.name, kind: target.kind, printer_id: opt(target.printer_id) }
            : { branch_id: currentBranchIds[0] ?? '', code: '', name: '', kind: 'printer', printer_id: NONE }
        }
        onSubmit={saveTarget}
      />
      <FormDialog
        open={!!device}
        onOpenChange={(o) => !o && setDevice(null)}
        title="Rename device"
        fields={[{ name: 'name', label: t('common.name'), required: true, wide: true }]}
        initial={{ name: device?.name ?? '' }}
        onSubmit={(v) => (device ? attempt(() => renameOfflineDevice(device, String(v.name)).then(() => devices.mutate()), t('common.updated')) : false)}
      />
      <StationConfig station={configOf} onOpenChange={(o) => !o && setConfigOf(null)} />
    </>
  )
}

/** GET /api/pos/stations/{id}/config — what the till actually resolves (read-only). */
function StationConfig({ station, onOpenChange }: { station: PosStationResponseDto | null; onOpenChange: (o: boolean) => void }) {
  const { data, isLoading } = usePosStationConfig(station?.id ?? null)
  const line = (p: PosPrinterResponseDto) => `${p.name} · ${p.kind} · ${p.connection}${p.address ? ` · ${p.address}` : ''}${p.is_active ? '' : ' (inactive)'}`
  return (
    <Dialog open={!!station} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{station?.name} configuration</DialogTitle>
          <DialogDescription>Resolved receipt printer and kitchen routing for this station.</DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Receipt printer</p>
              <p>{data.receipt_printer ? line(data.receipt_printer) : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Kitchen targets</p>
              {data.kitchen_targets.length ? (
                <ul className="list-inside list-disc">
                  {data.kitchen_targets.map((k) => (
                    <li key={k.id}>
                      {k.name} · {k.kind} · {k.menu_category_ids.length ? `${k.menu_category_ids.length} categories` : 'all categories'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>—</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Kitchen printers</p>
              {data.kitchen_printers.length ? (
                <ul className="list-inside list-disc">
                  {data.kitchen_printers.map((p) => (
                    <li key={p.id}>{line(p)}</li>
                  ))}
                </ul>
              ) : (
                <p>—</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Station updated {formatDateTime(data.station.updated_at.slice(0, 19))}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
