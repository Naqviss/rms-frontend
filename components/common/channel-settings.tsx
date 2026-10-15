'use client'

import { BikeIcon, CheckCheckIcon, GlobeIcon, PawPrintIcon, PowerIcon, SlidersHorizontalIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { channelMeta } from '@/components/common/channel-icon'
import { cn } from '@/lib/utils'
import { useChannelStore } from '@/stores/channel-store'

function Row({ icon: Icon, label, tone, checked, onChange, disabled }: { icon: LucideIcon; label: string; tone: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center gap-3 rounded-lg p-2 hover:bg-muted', disabled && 'opacity-50')}>
      <span className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </label>
  )
}

/** Channel switches: Foodpanda connection, auto-accept and open/closed, plus own delivery and website ordering. */
export function ChannelSettings() {
  const s = useChannelStore()
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="icon" aria-label="Channel settings" />}>
        <SlidersHorizontalIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Channels</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-col">
          <Row icon={PawPrintIcon} label="Foodpanda connected" tone={channelMeta.foodpanda.tile} checked={s.foodpandaConnected} onChange={s.setFoodpandaConnected} />
          <Row icon={PowerIcon} label="Foodpanda open for orders" tone={channelMeta.foodpanda.tile} checked={s.foodpandaOpen} onChange={s.setFoodpandaOpen} disabled={!s.foodpandaConnected} />
          <Row icon={CheckCheckIcon} label="Auto-accept Foodpanda" tone={channelMeta.foodpanda.tile} checked={s.foodpandaAutoAccept} onChange={s.setFoodpandaAutoAccept} disabled={!s.foodpandaConnected} />
          <Row icon={BikeIcon} label="Own delivery" tone={channelMeta['own-delivery'].tile} checked={s.deliveryEnabled} onChange={s.setDeliveryEnabled} />
          <Row icon={GlobeIcon} label="Website ordering" tone={channelMeta.website.tile} checked={s.websiteOrderingEnabled} onChange={s.setWebsiteOrderingEnabled} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
