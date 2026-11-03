import type { FieldDef, FormValues } from '@/components/common/form-dialog'
import { config } from '@/lib/config'
import { channels } from '@/lib/utils/channels'
import { currentTenantBranches } from '@/lib/directory'
import type { PromoSchedule, SalesChannel } from '@/types'

type Translate = (key: string, fallback?: string) => string

/** Form fields for where and when a discount runs. */
export function scheduleFields(td: Translate): FieldDef[] {
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
    { name: 'active', label: td('common.active'), type: 'switch' },
  ]
}

export const NEW_SCHEDULE: PromoSchedule = {
  startDate: config.referenceDate,
  endDate: null,
  branchId: 'all',
  channel: 'all',
  active: true,
}

export const scheduleValues = (p: PromoSchedule): FormValues => ({
  channel: p.channel,
  branchId: p.branchId,
  startDate: p.startDate,
  endDate: p.endDate ?? '',
  active: p.active,
})

/** Back from form values. */
export function scheduleFromValues(v: FormValues): PromoSchedule {
  return {
    channel: String(v.channel) as SalesChannel | 'all',
    branchId: String(v.branchId),
    startDate: String(v.startDate),
    endDate: v.endDate ? String(v.endDate) : null,
    active: !!v.active,
  }
}
