'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertCircleIcon,
  CalendarClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GlobeIcon,
  PlusIcon,
  RefreshCwIcon,
  Settings2Icon,
  ShieldAlertIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect, type Option } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions, type RowAction } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useAccess } from '@/hooks/use-access'
import { useScope } from '@/hooks/use-scope'
import {
  useBranchZones,
  useCustomerSearch,
  useDiningAreas,
  useDiningTables,
  useReservation,
  useReservationActions,
  useReservations,
  useReservationSettings,
} from '@/hooks/use-reservations'
import { branchName } from '@/lib/directory'
import { useT } from '@/lib/i18n/use-t'
import { text } from '@/services/api/mappers'
import { NetworkError, operationId } from '@/services/api/client'
import {
  acceptsTable,
  addDays,
  formatClock,
  formatDateTimeIn,
  isEditable,
  isPermissionError,
  isStaleVersion,
  minutesBetween,
  NEXT_STATUSES,
  RESERVATION_SOURCES,
  RESERVATION_STATUSES,
  requiresReason,
  reservationError,
  todayIn,
  utcToZoned,
  zoneAbbr,
  zonedToUtc,
  type Reservation,
  type ReservationPatch,
  type ReservationSettings,
  type ReservationSource,
  type ReservationStatus,
  type ServiceWindow,
  type Zone,
} from '@/services/api/modules/reservations'
import type { CreateReservationDto, SaveReservationSettingsDto } from '@/services/api/generated/schemas'

/* ----------------------------------------------------------------- copy */

const STATUS_LABEL: Record<ReservationStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  seated: 'Seated',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  rejected: 'Rejected',
}

const STATUS_TONE: Record<ReservationStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  requested: 'warning',
  confirmed: 'info',
  seated: 'success',
  completed: 'neutral',
  cancelled: 'danger',
  no_show: 'danger',
  rejected: 'danger',
}

/** Row action / dialog copy for each target status. */
const TRANSITION: Record<ReservationStatus, { action: string; title: string; body: string; destructive?: boolean }> = {
  requested: { action: 'Back to requested', title: 'Move back to requested', body: 'The reservation returns to the request queue.' },
  confirmed: { action: 'Confirm', title: 'Confirm reservation', body: 'Confirming checks the table and the branch capacity for this time.' },
  seated: { action: 'Seat guests', title: 'Seat guests', body: 'Mark the party as arrived and seated.' },
  completed: { action: 'Complete', title: 'Complete reservation', body: 'The party has finished and left.' },
  cancelled: { action: 'Cancel reservation', title: 'Cancel reservation', body: 'The booking is cancelled and its table is released.', destructive: true },
  no_show: { action: 'Mark no-show', title: 'Mark as no-show', body: 'The party did not arrive. This cannot be undone.', destructive: true },
  rejected: { action: 'Reject', title: 'Reject request', body: 'Decline this booking request. A reason is required.', destructive: true },
}

const SOURCE_LABEL: Record<ReservationSource, string> = { phone: 'Phone', walk_in: 'Walk-in', online: 'Online', pos: 'POS', other: 'Other' }

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const ZONE_SOURCE_LABEL: Record<Zone['source'], string> = {
  branch: 'branch time',
  tenant: 'restaurant time (tenant default)',
  local: 'your device’s local time (no branch or tenant time zone set)',
}

const NONE = '__none__'

function zoneCaption(z: Zone) {
  return `Times in ${ZONE_SOURCE_LABEL[z.source]} · ${z.tz} (${zoneAbbr(z.tz)})`
}

/* ------------------------------------------------------------------ page */

type Tab = 'all' | ReservationStatus
type Pending = { id: string; to: ReservationStatus }

export default function ReservationsPage() {
  const { t } = useT()
  const { can } = useAccess()
  const canView = can('customers', 'view')
  const canCreate = can('customers', 'create')
  const canEdit = can('customers', 'edit')
  const { branchIds, primaryBranch } = useScope()
  const { zoneFor, isLoading: zonesLoading } = useBranchZones()

  const primaryZone = zoneFor(primaryBranch ?? '')
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked ?? todayIn(primaryZone.tz)
  const [tab, setTab] = useState<Tab>('all')

  const list = useReservations(date, zoneFor, canView && !zonesLoading)
  const [editing, setEditing] = useState<Reservation | 'new' | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const rows = useMemo(() => list.data ?? [], [list.data])
  const counts = useMemo(() => {
    const c: Partial<Record<Tab, number>> = { all: rows.length }
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [rows])
  const shown = useMemo(() => (tab === 'all' ? rows : rows.filter((r) => r.status === tab)), [rows, tab])

  const zones = useMemo(() => {
    const m = new Map<string, Zone>()
    for (const id of branchIds) {
      const z = zoneFor(id)
      m.set(`${z.tz}|${z.source}`, z)
    }
    return [...m.values()]
  }, [branchIds, zoneFor])
  const mixedZones = new Set(zones.map((z) => z.tz)).size > 1
  const multiBranch = branchIds.length > 1

  const byId = (id: string | null | undefined) => (id ? rows.find((r) => r.id === id) : undefined)

  const columns = useMemo<ColumnDef<Reservation, unknown>[]>(() => {
    const cols: ColumnDef<Reservation, unknown>[] = [
      {
        id: 'time',
        accessorFn: (r) => r.starts_at,
        header: 'Time',
        cell: ({ row }) => {
          const r = row.original
          const tz = zoneFor(r.branch_id).tz
          return (
            <span className="whitespace-nowrap tabular-nums">
              {formatClock(r.starts_at, tz)} – {formatClock(r.ends_at, tz)}
              {mixedZones && <span className="ms-1 text-xs text-muted-foreground">{zoneAbbr(tz, new Date(r.starts_at))}</span>}
            </span>
          )
        },
      },
      {
        id: 'guest',
        accessorFn: (r) => `${r.guest_name} ${r.guest_phone ?? ''}`,
        header: 'Guest',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium">
              {row.original.guest_name}
              {row.original.customer_id && <UserIcon className="size-3.5 text-muted-foreground" aria-label="Directory customer" />}
            </p>
            {row.original.guest_phone && <p className="text-xs text-muted-foreground">{row.original.guest_phone}</p>}
          </div>
        ),
      },
      {
        accessorKey: 'party_size',
        header: 'Party',
        cell: ({ row }) => <span className="tabular-nums">{row.original.party_size}</span>,
      },
    ]
    if (multiBranch) {
      cols.push({ id: 'branch', accessorFn: (r) => branchName(r.branch_id), header: t('common.branch') })
    }
    cols.push(
      {
        id: 'table',
        header: 'Table',
        enableSorting: false,
        cell: ({ row }) => <TableLabel branchId={row.original.branch_id} tableId={row.original.table_id} areaId={row.original.dining_area_id} />,
      },
      { id: 'source', accessorFn: (r) => SOURCE_LABEL[r.source], header: 'Source' },
      {
        accessorKey: 'status',
        header: t('common.status'),
        cell: ({ row }) => <StatusBadge status={row.original.status} label={STATUS_LABEL[row.original.status]} tone={STATUS_TONE[row.original.status]} />,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => {
          const actions = actionsFor(row.original)
          return actions.length ? <RowActions actions={actions} /> : null
        },
      },
    )
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, zoneFor, mixedZones, multiBranch, canEdit])

  function actionsFor(r: Reservation): RowAction[] {
    const out: RowAction[] = [{ label: t('common.view'), onSelect: () => setViewingId(r.id) }]
    if (!canEdit) return out
    if (isEditable(r)) out.push({ label: t('common.edit'), onSelect: () => setEditing(r) })
    for (const to of NEXT_STATUSES[r.status]) {
      out.push({ label: TRANSITION[to].action, destructive: TRANSITION[to].destructive, onSelect: () => setPending({ id: r.id, to }) })
    }
    return out
  }

  if (!canView || isPermissionError(list.error)) {
    return (
      <>
        <PageHeader title={t('nav.reservations')} />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlertIcon />
            </EmptyMedia>
            <EmptyTitle>You don’t have access to reservations</EmptyTitle>
            <EmptyDescription>Ask an owner or manager to grant reservation access for this branch.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('nav.reservations')}
        description="Bookings for the selected day across the branches in view."
        actions={
          <>
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2Icon data-icon="inline-start" />
              Settings
            </Button>
            {canCreate && (
              <Button onClick={() => setEditing('new')}>
                <PlusIcon data-icon="inline-start" />
                New reservation
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setPicked(addDays(date, -1))}>
            <ChevronLeftIcon />
          </Button>
          <Input
            type="date"
            aria-label={t('common.date')}
            className="w-40"
            value={date}
            onChange={(e) => e.target.value && setPicked(e.target.value)}
          />
          <Button variant="outline" size="icon" aria-label="Next day" onClick={() => setPicked(addDays(date, 1))}>
            <ChevronRightIcon />
          </Button>
          <Button variant="ghost" onClick={() => setPicked(null)}>
            {t('common.today')}
          </Button>
          {list.isValidating && !list.isLoading && <Spinner className="ms-1 size-4 text-muted-foreground" aria-label={t('common.loading')} />}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GlobeIcon className="size-3.5 shrink-0" aria-hidden />
          {mixedZones ? 'Times in each branch’s own time zone (abbreviation shown per row)' : zones[0] ? zoneCaption(zones[0]) : ''}
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {(['all', ...RESERVATION_STATUSES] as Tab[]).map((s) => (
              <TabsTrigger key={s} value={s} className="px-2.5">
                {s === 'all' ? t('common.all') : STATUS_LABEL[s]}
                <Badge variant="secondary" className="ms-1 h-4 min-w-4 px-1 text-[10px] tabular-nums">
                  {counts[s] ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {list.error && !list.data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertCircleIcon />
            </EmptyMedia>
            <EmptyTitle>Reservations could not be loaded</EmptyTitle>
            <EmptyDescription>{reservationError(list.error)}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => list.mutate()} disabled={list.isValidating}>
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {list.error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Showing the last loaded list</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                {reservationError(list.error)}
                <Button size="sm" variant="outline" onClick={() => list.mutate()} disabled={list.isValidating}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <DataTable
            columns={columns}
            data={shown}
            isLoading={list.isLoading}
            onRowClick={(r) => setViewingId(r.id)}
            defaultPageSize={25}
            exportName={`reservations-${date}`}
            exportRows={(r) =>
              r.map((x) => ({
                start: formatDateTimeIn(x.starts_at, zoneFor(x.branch_id).tz),
                time_zone: zoneFor(x.branch_id).tz,
                guest: x.guest_name,
                phone: x.guest_phone ?? '',
                party: x.party_size,
                branch: branchName(x.branch_id),
                status: x.status,
                source: x.source,
              }))
            }
            emptyTitle={tab === 'all' ? 'No reservations on this day' : `No ${STATUS_LABEL[tab].toLowerCase()} reservations on this day`}
            emptyDescription={canCreate ? 'Pick another day or add a booking.' : 'Pick another day.'}
          />
        </>
      )}

      <ReservationDialog
        target={editing}
        onClose={() => setEditing(null)}
        branchIds={branchIds}
        defaultBranchId={primaryBranch}
        defaultDate={date}
        zoneFor={zoneFor}
      />

      <TransitionDialog pending={pending} current={byId(pending?.id)} onClose={() => setPending(null)} zoneFor={zoneFor} />

      <DetailSheet
        id={viewingId}
        row={byId(viewingId)}
        onClose={() => setViewingId(null)}
        zoneFor={zoneFor}
        actions={(r) => actionsFor(r).filter((a) => a.label !== t('common.view'))}
      />

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} branchIds={branchIds} defaultBranchId={primaryBranch} canEdit={canEdit} />
    </>
  )
}

/* -------------------------------------------------------------- helpers */

function TableLabel({ branchId, tableId, areaId }: { branchId: string; tableId?: string | null; areaId?: string | null }) {
  const { data: tables } = useDiningTables(tableId ? branchId : null)
  const { data: areas } = useDiningAreas(areaId ? branchId : null)
  if (!tableId && !areaId) return <span className="text-muted-foreground">-</span>
  const table = tables?.find((x) => x.id === tableId)
  const area = areas?.find((x) => x.id === areaId)
  return (
    <span className="whitespace-nowrap">
      {tableId ? (table?.code ?? '…') : ''}
      {area && <span className="ms-1 text-xs text-muted-foreground">{text(area.name ?? area.name_i18n)}</span>}
    </span>
  )
}

function ErrorAlert({ message, onLoadLatest }: { message: string; onLoadLatest?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>{message}</span>
        {onLoadLatest && (
          <Button type="button" size="sm" variant="outline" onClick={onLoadLatest}>
            Load latest values
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

const positiveInt = (v: string) => /^\d+$/.test(v.trim()) && Number(v) > 0

/* ------------------------------------------------------- create / edit */

interface Draft {
  branchId: string
  customer: { id: string; name: string; phone: string } | null
  guestName: string
  guestPhone: string
  partySize: string
  date: string
  time: string
  duration: string
  areaId: string
  tableId: string
  source: ReservationSource
  notes: string
  confirm: boolean
}

function draftFrom(r: Reservation, zone: Zone): Draft {
  const { date, time } = utcToZoned(r.starts_at, zone.tz)
  return {
    branchId: r.branch_id,
    customer: r.customer_id ? { id: r.customer_id, name: r.guest_name, phone: r.guest_phone ?? '' } : null,
    guestName: r.guest_name,
    guestPhone: r.guest_phone ?? '',
    partySize: String(r.party_size),
    date,
    time,
    duration: String(minutesBetween(r.starts_at, r.ends_at)),
    areaId: r.dining_area_id ?? NONE,
    tableId: r.table_id ?? NONE,
    source: r.source,
    notes: r.notes ?? '',
    confirm: false,
  }
}

function ReservationDialog({
  target,
  onClose,
  branchIds,
  defaultBranchId,
  defaultDate,
  zoneFor,
}: {
  target: Reservation | 'new' | null
  onClose: () => void
  branchIds: string[]
  defaultBranchId: string | undefined
  defaultDate: string
  zoneFor: (branchId: string) => Zone
}) {
  const { t } = useT()
  const open = target !== null
  const editingRow = target && target !== 'new' ? target : null
  const detail = useReservation(editingRow?.id, editingRow?.branch_id)
  /** Latest server copy (status checks, "load latest"). */
  const base = editingRow ? (detail.data ?? editingRow) : null
  /** The copy the draft was built from: PATCH's expected_version comes from it. */
  const basis = useRef<Reservation | null>(null)
  const { create, update } = useReservationActions()

  const blank = (): Draft => ({
    branchId: defaultBranchId ?? branchIds[0] ?? '',
    customer: null,
    guestName: '',
    guestPhone: '',
    partySize: '2',
    date: defaultDate,
    time: '19:00',
    duration: '',
    areaId: NONE,
    tableId: NONE,
    source: 'phone',
    notes: '',
    confirm: false,
  })

  const [draft, setDraft] = useState<Draft>(blank)
  const initial = useRef<Draft | null>(null)
  const clientId = useRef(operationId())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; stale: boolean } | null>(null)
  const [touched, setTouched] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')

  useEffect(() => {
    if (!open) return
    const d = editingRow ? draftFrom(editingRow, zoneFor(editingRow.branch_id)) : blank()
    basis.current = editingRow
    initial.current = d
    setDraft(d)
    setError(null)
    setTouched(false)
    setCustomerQuery('')
    if (!editingRow) clientId.current = operationId()
    // Reset only when the dialog opens for a new target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingRow?.id])

  // A newer server copy arrived before the user typed anything: show it instead of the list row.
  const fresh = detail.data
  useEffect(() => {
    if (!open || !fresh || !basis.current || fresh.id !== basis.current.id || fresh.version === basis.current.version) return
    if (JSON.stringify(draft) !== JSON.stringify(initial.current)) return
    const d = draftFrom(fresh, zoneFor(fresh.branch_id))
    basis.current = fresh
    initial.current = d
    setDraft(d)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fresh?.id, fresh?.version])

  const zone = zoneFor(draft.branchId)
  const settings = useReservationSettings(open ? draft.branchId : null)
  const { data: tables } = useDiningTables(open ? draft.branchId : null)
  const { data: areas } = useDiningAreas(open ? draft.branchId : null)
  const customers = useCustomerSearch(open && !editingRow && !draft.customer ? customerQuery : '')

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((p) => ({ ...p, [k]: v }))

  const areaOptions: Option[] = [
    { value: NONE, label: 'Any area' },
    ...(areas ?? []).filter((a) => a.is_active || a.id === draft.areaId).map((a) => ({ value: a.id, label: text(a.name ?? a.name_i18n) || 'Area' })),
  ]
  const tableOptions: Option[] = [
    { value: NONE, label: 'No table yet' },
    ...(tables ?? [])
      .filter((x) => draft.areaId === NONE || x.area_id === draft.areaId || x.id === draft.tableId)
      .map((x) => ({
        value: x.id,
        label: `${x.code} · ${x.seats} seats${x.status === 'out_of_service' ? ' · out of service' : ''}`,
        disabled: x.status === 'out_of_service' && x.id !== draft.tableId,
      })),
  ]

  const s = settings.data
  const slot = s?.slot_minutes ?? undefined
  const needsName = !draft.customer
  const invalid = {
    guestName: needsName && !draft.guestName.trim(),
    partySize: !positiveInt(draft.partySize),
    date: !draft.date,
    time: !draft.time,
    duration: draft.duration.trim() !== '' && !positiveInt(draft.duration),
    branch: !draft.branchId,
  }
  const hasErrors = Object.values(invalid).some(Boolean)

  const close = () => {
    if (!busy) onClose()
  }

  const loadLatest = () => {
    if (!base) return
    const d = draftFrom(base, zoneFor(base.branch_id))
    basis.current = base
    initial.current = d
    setDraft(d)
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (hasErrors || busy) return
    setBusy(true)
    setError(null)
    try {
      const startsAt = zonedToUtc(draft.date, draft.time, zone.tz)
      if (!base) {
        const body: CreateReservationDto = {
          id: clientId.current,
          branch_id: draft.branchId,
          party_size: Number(draft.partySize),
          starts_at: startsAt,
          source: draft.source,
          confirm: draft.confirm,
          ...(draft.customer
            ? { customer_id: draft.customer.id }
            : { guest_name: draft.guestName.trim(), ...(draft.guestPhone.trim() ? { guest_phone: draft.guestPhone.trim() } : {}) }),
          ...(draft.duration.trim() ? { duration_minutes: Number(draft.duration) } : {}),
          ...(draft.areaId !== NONE ? { dining_area_id: draft.areaId } : {}),
          ...(draft.tableId !== NONE ? { table_id: draft.tableId } : {}),
          ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        }
        const saved = await create(body)
        toast.success(saved.duplicate ? 'This booking was already saved.' : t('common.created'))
      } else {
        const was = initial.current ?? draftFrom(base, zone)
        const patch: ReservationPatch = {}
        if (draft.guestName.trim() !== was.guestName.trim()) patch.guest_name = draft.guestName.trim()
        if (draft.guestPhone.trim() !== was.guestPhone.trim()) patch.guest_phone = draft.guestPhone.trim() || null
        if (draft.partySize !== was.partySize) patch.party_size = Number(draft.partySize)
        if (draft.date !== was.date || draft.time !== was.time) patch.starts_at = startsAt
        if (draft.duration.trim() && draft.duration !== was.duration) patch.duration_minutes = Number(draft.duration)
        if (draft.areaId !== was.areaId) patch.dining_area_id = draft.areaId === NONE ? null : draft.areaId
        if (draft.tableId !== was.tableId) patch.table_id = draft.tableId === NONE ? null : draft.tableId
        if (draft.notes.trim() !== was.notes.trim()) patch.notes = draft.notes.trim() || null
        if (Object.keys(patch).length === 0) {
          setBusy(false)
          onClose()
          return
        }
        await update(basis.current ?? base, patch)
        toast.success(t('common.updated'))
      }
      setBusy(false)
      onClose()
    } catch (err) {
      const stale = isStaleVersion(err)
      // The server copy moved on: reload it. Typed values stay; the next save is checked against
      // the reloaded version, or "Load latest values" replaces the form with it.
      if (stale && base) {
        const latest = await detail.mutate().catch(() => undefined)
        if (latest) basis.current = latest
      }
      setBusy(false)
      let message = reservationError(err)
      if (err instanceof NetworkError && !base) message += ' Submitting again is safe: it reuses the same booking reference.'
      setError({ message, stale })
    }
  }

  const editingLocked = base && !isEditable(base)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] grid-cols-1 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{base ? 'Edit reservation' : 'New reservation'}</DialogTitle>
          <DialogDescription>{zoneCaption(zone)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {s && !s.enabled && (
            <Alert>
              <AlertCircleIcon />
              <AlertDescription>Reservations are turned off for this branch. Turn them on in Settings before booking.</AlertDescription>
            </Alert>
          )}
          {editingLocked && (
            <Alert>
              <AlertCircleIcon />
              <AlertDescription>This reservation is now {STATUS_LABEL[base.status].toLowerCase()} and can no longer be changed.</AlertDescription>
            </Alert>
          )}
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!base && branchIds.length > 1 && (
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="rsv-branch">{t('common.branch')}</FieldLabel>
                <OptionSelect
                  id="rsv-branch"
                  value={draft.branchId}
                  onValueChange={(v) => setDraft((p) => ({ ...p, branchId: v, areaId: NONE, tableId: NONE }))}
                  options={branchIds.map((id) => ({ value: id, label: branchName(id) }))}
                />
              </Field>
            )}

            {/* Customer: directory link on create; read-only on edit (PATCH cannot change it). */}
            {!base ? (
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="rsv-customer">{t('common.customer')} (optional)</FieldLabel>
                {draft.customer ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{draft.customer.name}</p>
                      {draft.customer.phone && <p className="text-xs text-muted-foreground">{draft.customer.phone}</p>}
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove customer" onClick={() => set('customer', null)}>
                      <XIcon />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="rsv-customer"
                      placeholder="Search the customer directory by name or phone"
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      autoComplete="off"
                    />
                    {customerQuery.trim().length >= 2 && (
                      <div className="max-h-40 overflow-y-auto rounded-lg border">
                        {customers.isLoading ? (
                          <p className="p-2 text-xs text-muted-foreground">{t('common.loading')}</p>
                        ) : customers.error ? (
                          <p className="p-2 text-xs text-destructive">{reservationError(customers.error)}</p>
                        ) : (customers.data ?? []).length === 0 ? (
                          <p className="p-2 text-xs text-muted-foreground">No matching customers. Enter the guest below instead.</p>
                        ) : (
                          (customers.data ?? []).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-sm hover:bg-muted"
                              onClick={() => set('customer', { id: c.id, name: c.display_name, phone: c.phone ?? '' })}
                            >
                              <span className="truncate">{c.display_name}</span>
                              <span className="text-xs text-muted-foreground">{c.phone}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    <FieldDescription>Linking a customer fills the guest name and phone from the directory.</FieldDescription>
                  </>
                )}
              </Field>
            ) : (
              base.customer_id && (
                <p className="text-xs text-muted-foreground sm:col-span-2">Linked to a directory customer. The guest name and phone below can still be adjusted for this booking.</p>
              )
            )}

            {(needsName || base) && (
              <>
                <Field data-invalid={(touched && invalid.guestName) || undefined}>
                  <FieldLabel htmlFor="rsv-name">Guest name</FieldLabel>
                  <Input id="rsv-name" value={draft.guestName} onChange={(e) => set('guestName', e.target.value)} aria-invalid={(touched && invalid.guestName) || undefined} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="rsv-phone">{t('common.phone')}</FieldLabel>
                  <Input id="rsv-phone" type="tel" value={draft.guestPhone} onChange={(e) => set('guestPhone', e.target.value)} />
                </Field>
              </>
            )}

            <Field data-invalid={(touched && invalid.partySize) || undefined}>
              <FieldLabel htmlFor="rsv-party">Party size</FieldLabel>
              <Input
                id="rsv-party"
                type="number"
                min={1}
                max={s?.max_party_size ?? undefined}
                inputMode="numeric"
                value={draft.partySize}
                onChange={(e) => set('partySize', e.target.value)}
                aria-invalid={(touched && invalid.partySize) || undefined}
              />
              {s?.max_party_size ? <FieldDescription>Up to {s.max_party_size} guests per booking.</FieldDescription> : null}
            </Field>
            <Field data-invalid={(touched && invalid.duration) || undefined}>
              <FieldLabel htmlFor="rsv-duration">Duration (minutes)</FieldLabel>
              <Input
                id="rsv-duration"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder={s?.default_duration_minutes ? `Default ${s.default_duration_minutes}` : 'Branch default'}
                value={draft.duration}
                onChange={(e) => set('duration', e.target.value)}
                aria-invalid={(touched && invalid.duration) || undefined}
              />
            </Field>
            <Field data-invalid={(touched && invalid.date) || undefined}>
              <FieldLabel htmlFor="rsv-date">{t('common.date')}</FieldLabel>
              <Input id="rsv-date" type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} aria-invalid={(touched && invalid.date) || undefined} />
            </Field>
            <Field data-invalid={(touched && invalid.time) || undefined}>
              <FieldLabel htmlFor="rsv-time">Time ({zoneAbbr(zone.tz)})</FieldLabel>
              <Input
                id="rsv-time"
                type="time"
                step={slot ? slot * 60 : undefined}
                value={draft.time}
                onChange={(e) => set('time', e.target.value)}
                aria-invalid={(touched && invalid.time) || undefined}
              />
              {slot ? <FieldDescription>Bookings start on {slot}-minute slots.</FieldDescription> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="rsv-area">Dining area</FieldLabel>
              <OptionSelect id="rsv-area" value={draft.areaId} onValueChange={(v) => setDraft((p) => ({ ...p, areaId: v, tableId: NONE }))} options={areaOptions} />
            </Field>
            <Field>
              <FieldLabel htmlFor="rsv-table">Table</FieldLabel>
              <OptionSelect id="rsv-table" value={draft.tableId} onValueChange={(v) => set('tableId', v)} options={tableOptions} />
            </Field>

            {!base && (
              <Field>
                <FieldLabel htmlFor="rsv-source">Source</FieldLabel>
                <OptionSelect
                  id="rsv-source"
                  value={draft.source}
                  onValueChange={(v) => set('source', v as ReservationSource)}
                  options={RESERVATION_SOURCES.map((x) => ({ value: x, label: SOURCE_LABEL[x] }))}
                />
              </Field>
            )}
            {!base && (
              <Field orientation="horizontal" className="items-center justify-between self-end">
                <FieldLabel htmlFor="rsv-confirm">Confirm now</FieldLabel>
                <Switch id="rsv-confirm" checked={draft.confirm} onCheckedChange={(v) => set('confirm', v)} />
              </Field>
            )}

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="rsv-notes">{t('common.notes')}</FieldLabel>
              <Textarea id="rsv-notes" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </FieldGroup>

          {touched && hasErrors && <p className="text-sm text-destructive">Fill in the highlighted fields.</p>}
          {error && <ErrorAlert message={error.message} onLoadLatest={error.stale && base ? loadLatest : undefined} />}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy || !!editingLocked}>
              {busy && <Spinner data-icon="inline-start" />}
              {base ? t('common.saveChanges') : 'Book'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------- transitions */

function TransitionDialog({
  pending,
  current,
  onClose,
  zoneFor,
}: {
  pending: Pending | null
  /** Latest list copy of the reservation (refreshed after a conflict). */
  current: Reservation | undefined
  onClose: () => void
  zoneFor: (branchId: string) => Zone
}) {
  const { t } = useT()
  const { transition } = useReservationActions()
  const to = pending?.to
  const withTable = !!to && acceptsTable(to)
  const { data: tables } = useDiningTables(pending && current && withTable ? current.branch_id : null)
  const [tableId, setTableId] = useState(NONE)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pending) return
    setTableId(current?.table_id ?? NONE)
    setReason('')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id, pending?.to])

  if (!pending || !to) return null
  const copy = TRANSITION[to]
  const stillAllowed = !!current && NEXT_STATUSES[current.status].includes(to)
  const needsReason = requiresReason(to)
  const offersReason = needsReason || to === 'cancelled'

  const close = () => {
    if (!busy) onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current || busy || !stillAllowed) return
    if (needsReason && !reason.trim()) {
      setError('Enter a reason to reject this request.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await transition(current, to, {
        tableId: withTable && tableId !== NONE ? tableId : undefined,
        reasonCode: offersReason && reason.trim() ? reason.trim() : undefined,
      })
      toast.success(t('common.updated'))
      setBusy(false)
      onClose()
    } catch (err) {
      setBusy(false)
      setError(reservationError(err))
    }
  }

  const tableOptions: Option[] = [
    { value: NONE, label: current?.table_id ? 'Keep the current table' : 'No table' },
    ...(tables ?? []).map((x) => ({
      value: x.id,
      label: `${x.code} · ${x.seats} seats · ${x.status_label || x.status}`,
      disabled: x.status === 'out_of_service' || (to === 'seated' && x.status === 'occupied' && x.id !== current?.table_id),
    })),
  ]

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {current
              ? `${current.guest_name} · ${current.party_size} guests · ${formatDateTimeIn(current.starts_at, zoneFor(current.branch_id).tz)}`
              : copy.body}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
          {!current ? (
            <ErrorAlert message="This reservation is no longer in the list for this day." />
          ) : !stillAllowed ? (
            <ErrorAlert message={`This reservation is now ${STATUS_LABEL[current.status].toLowerCase()}, so this change is no longer available.`} />
          ) : null}
          {withTable && current && (
            <Field>
              <FieldLabel htmlFor="rsv-tr-table">Table</FieldLabel>
              <OptionSelect id="rsv-tr-table" value={tableId} onValueChange={setTableId} options={tableOptions} />
              <FieldDescription>Optional. The table and branch capacity are checked when you save.</FieldDescription>
            </Field>
          )}
          {offersReason && (
            <Field data-invalid={(needsReason && !!error && !reason.trim()) || undefined}>
              <FieldLabel htmlFor="rsv-tr-reason">Reason{needsReason ? '' : ' (optional)'}</FieldLabel>
              <Input id="rsv-tr-reason" placeholder="e.g. fully_booked" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          {error && <ErrorAlert message={error} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant={copy.destructive ? 'destructive' : 'default'} disabled={busy || !current || !stillAllowed}>
              {busy && <Spinner data-icon="inline-start" />}
              {copy.action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------------------------------------------- detail */

function DetailSheet({
  id,
  row,
  onClose,
  zoneFor,
  actions,
}: {
  id: string | null
  row: Reservation | undefined
  onClose: () => void
  zoneFor: (branchId: string) => Zone
  actions: (r: Reservation) => RowAction[]
}) {
  const { t } = useT()
  const detail = useReservation(id, row?.branch_id)
  const r = detail.data ?? row
  const tz = r ? zoneFor(r.branch_id) : null
  const at = (iso: string | null | undefined) => (iso && tz ? formatDateTimeIn(iso, tz.tz) : '-')

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {!r ? (
          <div className="flex flex-col gap-3 p-4">
            {detail.error ? (
              <ErrorAlert message={reservationError(detail.error)} />
            ) : (
              <>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-24" />
              </>
            )}
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{r.guest_name}</SheetTitle>
              <SheetDescription>{tz ? zoneCaption(tz) : ''}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
                {detail.isValidating && <Spinner className="size-3.5 text-muted-foreground" />}
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['Starts', at(r.starts_at)],
                    ['Ends', at(r.ends_at)],
                    ['Party', String(r.party_size)],
                    [t('common.phone'), r.guest_phone || '-'],
                    [t('common.branch'), branchName(r.branch_id)],
                    ['Source', SOURCE_LABEL[r.source]],
                    ['Directory customer', r.customer_id ? t('common.yes') : t('common.no')],
                    ['Reason', r.reason_code || '-'],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-muted-foreground">Table</dt>
                  <dd className="font-medium">
                    <TableLabel branchId={r.branch_id} tableId={r.table_id} areaId={r.dining_area_id} />
                  </dd>
                </div>
                {r.order_id && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Dine-in order</dt>
                    <dd className="truncate font-mono text-xs">{r.order_id}</dd>
                  </div>
                )}
              </dl>
              {r.notes && (
                <>
                  <Separator />
                  <p className="whitespace-pre-wrap text-muted-foreground">{r.notes}</p>
                </>
              )}
              <Separator />
              <dl className="grid grid-cols-2 gap-3 text-xs">
                {(
                  [
                    ['Booked', r.created_at],
                    ['Confirmed', r.confirmed_at],
                    ['Seated', r.seated_at],
                    ['Completed', r.completed_at],
                    ['Cancelled', r.cancelled_at],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd>{at(v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            {actions(r).length > 0 && (
              <SheetFooter className="flex-row flex-wrap">
                {actions(r).map((a) => (
                  <Button key={a.label} size="sm" variant={a.destructive ? 'destructive' : 'outline'} onClick={a.onSelect}>
                    {a.label}
                  </Button>
                ))}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* -------------------------------------------------------------- settings */

interface SettingsDraft {
  enabled: boolean
  slot: string
  duration: string
  maxParty: string
  maxCovers: string
  reminder: string
  windows: ServiceWindow[]
}

const settingsDraft = (s: ReservationSettings): SettingsDraft => ({
  enabled: s.enabled,
  slot: String(s.slot_minutes ?? 15),
  duration: String(s.default_duration_minutes ?? 90),
  maxParty: String(s.max_party_size ?? 10),
  maxCovers: s.max_covers == null ? '' : String(s.max_covers),
  reminder: String(s.reminder_minutes ?? 0),
  windows: (s.opening_hours ?? []).map((w) => ({ ...w })),
})

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function SettingsSheet({
  open,
  onOpenChange,
  branchIds,
  defaultBranchId,
  canEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchIds: string[]
  defaultBranchId: string | undefined
  canEdit: boolean
}) {
  const { t } = useT()
  const [branchId, setBranchId] = useState(defaultBranchId ?? branchIds[0] ?? '')
  const settings = useReservationSettings(open && branchId ? branchId : null)
  const { saveSettings } = useReservationActions()
  const [draft, setDraft] = useState<SettingsDraft | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; stale: boolean } | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setBranchId((b) => (branchIds.includes(b) ? b : (defaultBranchId ?? branchIds[0] ?? '')))
      setLoadedFor(null)
      setError(null)
      setTouched(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Fill the form once per branch; later revalidations (e.g. after a conflict) don't overwrite typing.
  useEffect(() => {
    if (open && settings.data && settings.data.branch_id === branchId && loadedFor !== branchId) {
      setDraft(settingsDraft(settings.data))
      setLoadedFor(branchId)
    }
  }, [open, settings.data, branchId, loadedFor])

  const d = draft && loadedFor === branchId ? draft : null
  const set = <K extends keyof SettingsDraft>(k: K, v: SettingsDraft[K]) => setDraft((p) => (p ? { ...p, [k]: v } : p))
  const setWindow = (i: number, patch: Partial<ServiceWindow>) =>
    setDraft((p) => (p ? { ...p, windows: p.windows.map((w, j) => (j === i ? { ...w, ...patch } : w)) } : p))

  const invalid = d
    ? {
        slot: !positiveInt(d.slot),
        duration: !positiveInt(d.duration),
        maxParty: !positiveInt(d.maxParty),
        maxCovers: d.maxCovers.trim() !== '' && !positiveInt(d.maxCovers),
        reminder: !/^\d+$/.test(d.reminder.trim()),
        windows: d.windows.some((w) => !HHMM.test(w.opens) || !HHMM.test(w.closes)),
      }
    : null
  const hasErrors = !!invalid && Object.values(invalid).some(Boolean)
  const readOnly = !canEdit

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!d || hasErrors || busy || readOnly) return
    setBusy(true)
    setError(null)
    try {
      const version = settings.data?.version
      const body: SaveReservationSettingsDto = {
        ...(version != null ? { expected_version: version } : {}),
        enabled: d.enabled,
        opening_hours: d.windows,
        slot_minutes: Number(d.slot),
        default_duration_minutes: Number(d.duration),
        max_party_size: Number(d.maxParty),
        max_covers: d.maxCovers.trim() ? Number(d.maxCovers) : null,
        reminder_minutes: Number(d.reminder),
      }
      const saved = await saveSettings(branchId, body)
      await settings.mutate(saved, { revalidate: false })
      setDraft(settingsDraft(saved))
      toast.success(t('common.saved'))
    } catch (err) {
      setError({ message: reservationError(err), stale: isStaleVersion(err) })
    } finally {
      setBusy(false)
    }
  }

  const loadLatest = () => {
    if (settings.data) setDraft(settingsDraft(settings.data))
    setError(null)
  }

  const bad = (k: keyof NonNullable<typeof invalid>) => (touched && invalid?.[k]) || undefined

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Reservation settings</SheetTitle>
          <SheetDescription>Booking rules for one branch. Opening hours are in the branch’s local time.</SheetDescription>
        </SheetHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            {branchIds.length > 1 && (
              <Field>
                <FieldLabel htmlFor="rsv-set-branch">{t('common.branch')}</FieldLabel>
                <OptionSelect
                  id="rsv-set-branch"
                  value={branchId}
                  disabled={busy}
                  onValueChange={(v) => {
                    setBranchId(v)
                    setError(null)
                    setTouched(false)
                  }}
                  options={branchIds.map((id) => ({ value: id, label: branchName(id) }))}
                />
              </Field>
            )}

            {settings.error && !settings.data ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">{isPermissionError(settings.error) ? <ShieldAlertIcon /> : <AlertCircleIcon />}</EmptyMedia>
                  <EmptyTitle>{isPermissionError(settings.error) ? 'No access to these settings' : 'Settings could not be loaded'}</EmptyTitle>
                  <EmptyDescription>{reservationError(settings.error)}</EmptyDescription>
                </EmptyHeader>
                {!isPermissionError(settings.error) && (
                  <EmptyContent>
                    <Button type="button" variant="outline" onClick={() => settings.mutate()} disabled={settings.isValidating}>
                      <RefreshCwIcon data-icon="inline-start" />
                      Retry
                    </Button>
                  </EmptyContent>
                )}
              </Empty>
            ) : !d ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <fieldset disabled={readOnly || busy} className="flex flex-col gap-4">
                {readOnly && <p className="text-xs text-muted-foreground">You can view these settings but not change them.</p>}
                {settings.data?.version == null && (
                  <Alert>
                    <CalendarClockIcon />
                    <AlertDescription>Not saved yet: reservations stay off for this branch until settings are saved.</AlertDescription>
                  </Alert>
                )}
                <Field orientation="horizontal" className="items-center justify-between">
                  <FieldLabel htmlFor="rsv-set-enabled">Accept reservations</FieldLabel>
                  <Switch id="rsv-set-enabled" checked={d.enabled} onCheckedChange={(v) => set('enabled', v)} />
                </Field>
                <FieldGroup className="grid grid-cols-2 gap-4">
                  <Field data-invalid={bad('slot')}>
                    <FieldLabel htmlFor="rsv-set-slot">Slot length (min)</FieldLabel>
                    <Input id="rsv-set-slot" type="number" min={1} inputMode="numeric" value={d.slot} onChange={(e) => set('slot', e.target.value)} />
                  </Field>
                  <Field data-invalid={bad('duration')}>
                    <FieldLabel htmlFor="rsv-set-duration">Default duration (min)</FieldLabel>
                    <Input id="rsv-set-duration" type="number" min={1} inputMode="numeric" value={d.duration} onChange={(e) => set('duration', e.target.value)} />
                  </Field>
                  <Field data-invalid={bad('maxParty')}>
                    <FieldLabel htmlFor="rsv-set-party">Largest party</FieldLabel>
                    <Input id="rsv-set-party" type="number" min={1} inputMode="numeric" value={d.maxParty} onChange={(e) => set('maxParty', e.target.value)} />
                  </Field>
                  <Field data-invalid={bad('maxCovers')}>
                    <FieldLabel htmlFor="rsv-set-covers">Max guests at once</FieldLabel>
                    <Input id="rsv-set-covers" type="number" min={1} inputMode="numeric" placeholder="Unlimited" value={d.maxCovers} onChange={(e) => set('maxCovers', e.target.value)} />
                  </Field>
                  <Field data-invalid={bad('reminder')} className="col-span-2">
                    <FieldLabel htmlFor="rsv-set-reminder">Reminder (minutes before, 0 = none)</FieldLabel>
                    <Input id="rsv-set-reminder" type="number" min={0} inputMode="numeric" value={d.reminder} onChange={(e) => set('reminder', e.target.value)} />
                  </Field>
                </FieldGroup>

                <Separator />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Opening hours</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => set('windows', [...d.windows, { weekday: 1, opens: '12:00', closes: '23:00' }])}>
                      <PlusIcon data-icon="inline-start" />
                      {t('common.add')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">No windows means always open. A closing time before the opening time ends the next day.</p>
                  {d.windows.map((w, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                      <OptionSelect
                        aria-label="Weekday"
                        value={String(w.weekday)}
                        onValueChange={(v) => setWindow(i, { weekday: Number(v) })}
                        options={WEEKDAYS.map((name, j) => ({ value: String(j + 1), label: name }))}
                        disabled={readOnly || busy}
                      />
                      <Input aria-label="Opens" type="time" className="w-28" value={w.opens} onChange={(e) => setWindow(i, { opens: e.target.value })} aria-invalid={(touched && !HHMM.test(w.opens)) || undefined} />
                      <Input aria-label="Closes" type="time" className="w-28" value={w.closes} onChange={(e) => setWindow(i, { closes: e.target.value })} aria-invalid={(touched && !HHMM.test(w.closes)) || undefined} />
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove window" onClick={() => set('windows', d.windows.filter((_, j) => j !== i))}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  ))}
                </div>
                {touched && hasErrors && <p className="text-sm text-destructive">Check the highlighted values.</p>}
              </fieldset>
            )}
            {error && <ErrorAlert message={error.message} onLoadLatest={error.stale ? loadLatest : undefined} />}
          </div>
          <SheetFooter className="flex-row justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.close')}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={busy || !d}>
                {busy && <Spinner data-icon="inline-start" />}
                {t('common.save')}
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
