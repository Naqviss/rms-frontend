'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { channelMeta } from '@/components/common/channel-icon'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import type { SalesChannel } from '@/types'

interface ChannelFilterProps {
  channels: SalesChannel[]
  value: SalesChannel[]
  onChange: (value: SalesChannel[]) => void
  counts?: Partial<Record<SalesChannel, number>>
  className?: string
}

/** One checkbox per sales channel. Checked channels are shown; the icon colour matches the channel everywhere else. */
export function ChannelFilter({ channels, value, onChange, counts, className }: ChannelFilterProps) {
  const { td } = useT()
  const toggle = (c: SalesChannel, on: boolean) => onChange(on ? [...value, c] : value.filter((v) => v !== c))

  return (
    <div role="group" aria-label="Channels" className={cn('flex flex-wrap items-center gap-2', className)}>
      {channels.map((c) => {
        const meta = channelMeta[c]
        const Icon = meta.icon
        const on = value.includes(c)
        return (
          <label
            key={c}
            className={cn(
              'flex h-10 cursor-pointer select-none items-center gap-2 rounded-xl border px-3 text-sm transition-colors',
              on ? meta.ring : 'bg-card text-muted-foreground opacity-70 hover:opacity-100',
            )}
          >
            <Checkbox checked={on} onCheckedChange={(v) => toggle(c, v === true)} aria-label={td(`channel.${c}`)} />
            <span className={cn('flex size-6 items-center justify-center rounded-md', meta.tile)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="hidden font-medium text-foreground md:inline">{td(`channel.${c}`)}</span>
            {counts && <span className="tabular-nums text-xs text-muted-foreground">{counts[c] ?? 0}</span>}
          </label>
        )
      })}
    </div>
  )
}
