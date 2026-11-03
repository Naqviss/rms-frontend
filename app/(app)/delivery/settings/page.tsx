'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowLeftIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { useDeliveryConfig } from '@/hooks/use-front-of-house'
import { useScope } from '@/hooks/use-scope'
import { config as appConfig } from '@/lib/config'
import { branchName } from '@/lib/directory'
import { formatCurrency } from '@/lib/utils/format'
import { createZone, saveDeliverySettings, updateZone, type ZoneInput } from '@/services/api/modules/delivery'
import type { DeliveryZoneResponseDto, OpeningHoursDto } from '@/services/api/generated/schemas'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DayRow {
  open: boolean
  opens: string
  closes: string
}

const toRows = (hours: OpeningHoursDto[]): DayRow[] =>
  WEEKDAYS.map((_, i) => {
    const h = hours.find((x) => x.weekday === i + 1)
    return { open: !!h, opens: h?.opens ?? '11:00', closes: h?.closes ?? '23:00' }
  })

const zoneInput = (v: FormValues): ZoneInput => ({
  code: String(v.code ?? ''),
  name: String(v.name),
  areas: String(v.areas)
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean),
  fee: Number(v.fee) || 0,
  minOrder: Number(v.minOrder) || null,
  freeAbove: Number(v.freeAbove) || null,
  estimatedMinutes: Number(v.estimatedMinutes) || null,
})

/** Per-branch delivery settings (GET/PUT /api/delivery/settings/{branchId}) and zones. */
export default function DeliverySettingsPage() {
  const { branchIds, primaryBranch } = useScope()
  const [localBranch, setLocalBranch] = useState<string | null>(null)
  const branchId = localBranch && branchIds.includes(localBranch) ? localBranch : primaryBranch
  const { data, isLoading, busy, write } = useDeliveryConfig()
  const entry = data?.find((b) => b.branchId === branchId)

  const [enabled, setEnabled] = useState(false)
  const [prep, setPrep] = useState('')
  const [limitHours, setLimitHours] = useState(false)
  const [days, setDays] = useState<DayRow[]>(toRows([]))
  const [editing, setEditing] = useState<DeliveryZoneResponseDto | 'new' | null>(null)

  // Load the form from the server copy whenever the branch or its version changes.
  const loadedKey = entry ? `${entry.branchId}:${entry.settings.version ?? 'new'}` : ''
  useEffect(() => {
    if (!entry) return
    setEnabled(entry.settings.enabled)
    setPrep(entry.settings.default_prep_minutes != null ? String(entry.settings.default_prep_minutes) : '')
    setLimitHours(entry.settings.opening_hours.length > 0)
    setDays(toRows(entry.settings.opening_hours))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey])

  const saveSettings = async () => {
    if (!entry) return
    const opening_hours = limitHours
      ? days.flatMap((d, i) => (d.open ? [{ weekday: i + 1, opens: d.opens, closes: d.closes }] : []))
      : []
    const saved = await write(() =>
      saveDeliverySettings(entry.settings, { enabled, opening_hours, default_prep_minutes: prep.trim() ? Number(prep) : null }),
    )
    if (saved) toast.success('Delivery settings saved')
  }

  const currency = entry?.zones[0]?.currency ?? appConfig.currency

  const saveZone = async (v: FormValues) => {
    const input = zoneInput(v)
    if (!input.areas.length) {
      toast.error('Add at least one area or postal code')
      return false
    }
    const out =
      editing && editing !== 'new'
        ? await write(() => updateZone(editing, input))
        : await write(() => createZone(branchId, currency, input))
    if (!out) return false
    toast.success(editing === 'new' ? 'Zone added' : 'Zone updated')
  }

  const columns = useMemo<ColumnDef<DeliveryZoneResponseDto, unknown>[]>(
    () => [
      { accessorKey: 'name', header: 'Zone', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: 'code', header: 'Code' },
      { id: 'areas', header: 'Areas', cell: ({ row }) => <span className="line-clamp-2 text-muted-foreground">{row.original.areas.join(', ')}</span> },
      { id: 'fee', header: 'Fee', cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.fee_minor / 100)}</span> },
      {
        id: 'min',
        header: 'Min order',
        cell: ({ row }) => <span className="tabular-nums">{row.original.min_order_minor ? formatCurrency(row.original.min_order_minor / 100) : '-'}</span>,
      },
      {
        id: 'eta',
        header: 'ETA',
        cell: ({ row }) => <span className="tabular-nums">{row.original.estimated_minutes ? `${row.original.estimated_minutes} min` : '-'}</span>,
      },
      { id: 'active', header: 'Active', cell: ({ row }) => (row.original.is_active ? 'Yes' : 'No') },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: 'Edit', onSelect: () => setEditing(row.original) },
              {
                label: row.original.is_active ? 'Deactivate' : 'Activate',
                onSelect: async () => {
                  if (await write(() => updateZone(row.original, { active: !row.original.is_active }))) toast.success('Zone updated')
                },
              },
            ]}
          />
        ),
      },
    ],
    [write],
  )

  const initial: FormValues =
    editing && editing !== 'new'
      ? {
          name: editing.name,
          areas: editing.areas.join(', '),
          fee: editing.fee_minor / 100,
          minOrder: (editing.min_order_minor ?? 0) / 100,
          freeAbove: (editing.free_delivery_threshold_minor ?? 0) / 100,
          estimatedMinutes: editing.estimated_minutes ?? 0,
        }
      : { code: '', name: '', areas: '', fee: 0, minOrder: 0, freeAbove: 0, estimatedMinutes: 0 }

  return (
    <>
      <PageHeader
        title="Delivery settings"
        description="Branch delivery hours and the zones (with fees) that decide which addresses can be served."
        actions={
          <>
            <Button variant="outline" render={<Link href="/delivery" />} nativeButton={false}>
              <ArrowLeftIcon data-icon="inline-start" />
              Delivery board
            </Button>
            <OptionSelect
              className="h-9 w-52"
              value={branchId}
              onValueChange={setLocalBranch}
              aria-label="Branch"
              options={branchIds.map((id) => ({ value: id, label: branchName(id) }))}
            />
          </>
        }
      />
      {isLoading || !entry ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settings · {branchName(branchId)}</CardTitle>
              <CardDescription>{entry.settings.version == null ? 'Defaults: not saved yet for this branch.' : 'Saved settings (version-checked).'}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <label className="flex items-center justify-between text-sm">
                  Delivery enabled
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </label>
                <Field>
                  <FieldLabel htmlFor="prep">Default preparation time (minutes)</FieldLabel>
                  <Input id="prep" type="number" min={0} inputMode="numeric" className="w-32" value={prep} onChange={(e) => setPrep(e.target.value)} />
                </Field>
                <label className="flex items-center justify-between text-sm">
                  Limit delivery hours (off: always open)
                  <Switch checked={limitHours} onCheckedChange={setLimitHours} />
                </label>
                {limitHours && (
                  <ul className="flex flex-col gap-2">
                    {days.map((d, i) => (
                      <li key={WEEKDAYS[i]} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="w-10">{WEEKDAYS[i]}</span>
                        <Switch
                          checked={d.open}
                          aria-label={`${WEEKDAYS[i]} open`}
                          onCheckedChange={(open) => setDays((prev) => prev.map((x, j) => (j === i ? { ...x, open } : x)))}
                        />
                        <Input
                          type="time"
                          className="h-8 w-28"
                          disabled={!d.open}
                          aria-label={`${WEEKDAYS[i]} opens`}
                          value={d.opens}
                          onChange={(e) => setDays((prev) => prev.map((x, j) => (j === i ? { ...x, opens: e.target.value } : x)))}
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          className="h-8 w-28"
                          disabled={!d.open}
                          aria-label={`${WEEKDAYS[i]} closes`}
                          value={d.closes}
                          onChange={(e) => setDays((prev) => prev.map((x, j) => (j === i ? { ...x, closes: e.target.value } : x)))}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </FieldGroup>
            </CardContent>
            <CardFooter>
              <Button disabled={busy} onClick={saveSettings}>
                {busy && <Spinner data-icon="inline-start" />}
                Save settings
              </Button>
            </CardFooter>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Zones</h2>
            <Button disabled={busy} onClick={() => setEditing('new')}>
              <PlusIcon data-icon="inline-start" />
              Add zone
            </Button>
          </div>
          <DataTable columns={columns} data={entry.zones} isLoading={false} exportName="delivery-zones" />
        </div>
      )}
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Add zone' : 'Edit zone'}
        description="Addresses are matched to a zone by area name or postal code. The server checks serviceability when a delivery is created."
        fields={[
          ...(editing === 'new' ? [{ name: 'code', label: 'Code', required: true }] : []),
          { name: 'name', label: 'Name', required: true },
          { name: 'areas', label: 'Areas / postal codes (comma separated)', required: true, wide: true },
          { name: 'fee', label: `Fee (${currency})`, type: 'number' as const },
          { name: 'estimatedMinutes', label: 'Estimated minutes', type: 'number' as const },
          { name: 'minOrder', label: 'Minimum order (0 = none)', type: 'number' as const },
          { name: 'freeAbove', label: 'Free delivery above (0 = never)', type: 'number' as const },
        ]}
        initial={initial}
        onSubmit={saveZone}
      />
    </>
  )
}
