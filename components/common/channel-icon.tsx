'use client'

import { BikeIcon, GlobeIcon, PackageCheckIcon, PawPrintIcon, StoreIcon, type LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import type { SalesChannel } from '@/types'

export const channelMeta: Record<SalesChannel, { icon: LucideIcon; tile: string; text: string; bar: string; ring: string }> = {
  'in-store': { icon: StoreIcon, tile: 'bg-instore/15 text-instore', text: 'text-instore', bar: 'bg-instore', ring: 'border-instore/50 bg-instore/10' },
  pickup: { icon: PackageCheckIcon, tile: 'bg-pickup/20 text-pickup', text: 'text-pickup', bar: 'bg-pickup', ring: 'border-pickup/50 bg-pickup/10' },
  'own-delivery': { icon: BikeIcon, tile: 'bg-delivery/15 text-delivery', text: 'text-delivery', bar: 'bg-delivery', ring: 'border-delivery/50 bg-delivery/10' },
  foodpanda: { icon: PawPrintIcon, tile: 'bg-foodpanda/15 text-foodpanda', text: 'text-foodpanda', bar: 'bg-foodpanda', ring: 'border-foodpanda/50 bg-foodpanda/10' },
  website: { icon: GlobeIcon, tile: 'bg-website/15 text-website', text: 'text-website', bar: 'bg-website', ring: 'border-website/50 bg-website/10' },
}

interface ChannelIconProps {
  channel: SalesChannel
  size?: 'sm' | 'md'
  className?: string
}

/** Colour-coded icon tile that identifies where an order came from. */
export function ChannelIcon({ channel, size = 'md', className }: ChannelIconProps) {
  const { td } = useT()
  const meta = channelMeta[channel]
  const Icon = meta.icon
  const label = td(`channel.${channel}`)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className={cn(
              'inline-flex shrink-0 items-center justify-center rounded-lg',
              size === 'sm' ? 'size-6' : 'size-8',
              meta.tile,
              className,
            )}
          />
        }
      >
        <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
