import type { FieldDef, FormValues } from '@/components/common/form-dialog'
import { config } from '@/lib/config'
import { channels } from '@/lib/utils/channels'
import { DAY_PRESETS, describeDays, presetFor } from '@/lib/utils/promotions'
import { currentTenantBranches } from '@/mocks/branches'
import type { PromoSchedule, SalesChannel } from '@/types'

type Translate = (key: string, fallback?: string) => string

/** Form fields for where and when a discount or deal runs. `days` keeps a custom weekday set selectable. */
export function scheduleFields(td: Translate, days: number[] = []): FieldDef[] {
  const custom = presetFor(days) === 'custom' ? [{ value: 'custom', label: describeDays(days) }] : []
  return [
    {
      name: 'channel',
      label: 'Channel',
      type: 'select',
      options: [{ value: 'all', label: td('channel.all') }, ...channels.map((c) => ({ value: c, label: td(`channel.${c}`) }))],
    },
    {
      name: 'branchId',
      label: td('common.branch'),
      type: 'select',
      options: [{ value: 'all', label: td('shell.allBranches') }, ...currentTenantBranches.map((b) => ({ value: b.id, label: b.name }))],
    },
    { name: 'startDate', label: 'Starts', type: 'date', required: true },
    { name: 'endDate', label: 'Ends (leave empty to keep running)', type: 'date' },
    { name: 'days', label: 'Days', type: 'select', options: [...DAY_PRESETS.map((p) => ({ value: p.value, label: p.label })), ...custom] },
    { name: 'startTime', label: 'From time (optional)', type: 'time' },
    { name: 'endTime', label: 'Until time', type: 'time' },
    { name: 'active', label: td('common.active'), type: 'switch' },
  ]
}

export const NEW_SCHEDULE: PromoSchedule = {
  startDate: config.referenceDate,
  endDate: null,
  days: [],
  startTime: '',
  endTime: '',
  branchId: 'all',
  channel: 'all',
  active: true,
}

export const scheduleValues = (p: PromoSchedule): FormValues => ({
  channel: p.channel,
  branchId: p.branchId,
  startDate: p.startDate,
  endDate: p.endDate ?? '',
  days: presetFor(p.days),
  startTime: p.startTime,
  endTime: p.endTime,
  active: p.active,
})

/** Back from form values; a time window only counts when both ends are set. */
export function scheduleFromValues(v: FormValues, previousDays: number[] = []): PromoSchedule {
  const window = v.startTime && v.endTime
  return {
    channel: String(v.channel) as SalesChannel | 'all',
    branchId: String(v.branchId),
    startDate: String(v.startDate),
    endDate: v.endDate ? String(v.endDate) : null,
    days: v.days === 'custom' ? previousDays : (DAY_PRESETS.find((p) => p.value === v.days)?.days ?? []),
    startTime: window ? String(v.startTime) : '',
    endTime: window ? String(v.endTime) : '',
    active: !!v.active,
  }
}
