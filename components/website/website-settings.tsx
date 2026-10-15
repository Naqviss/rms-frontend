'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BanknoteIcon, BikeIcon, CheckIcon, ClockIcon, CopyIcon, CreditCardIcon, ExternalLinkIcon, GlobeIcon, ShoppingBagIcon, TagIcon, WalletIcon, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import { channelMeta } from '@/components/common/channel-icon'
import { cn } from '@/lib/utils'
import { useChannelStore, type WebsiteSettings } from '@/stores/channel-store'

function Toggle({ icon: Icon, label, checked, onChange }: { icon: LucideIcon; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border p-3">
      <span className={cn('flex size-9 items-center justify-center rounded-lg', channelMeta.website.tile)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

function Amount({ icon: Icon, label, value, unit, onChange }: { icon: LucideIcon; label: string; value: number; unit: string; onChange: (v: number) => void }) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <Icon aria-hidden />
      </InputGroupAddon>
      <InputGroupInput type="number" min={0} aria-label={label} placeholder={label} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
      <InputGroupAddon align="inline-end">{unit}</InputGroupAddon>
    </InputGroup>
  )
}

export function WebsiteSettings() {
  const { websiteOrderingEnabled, setWebsiteOrderingEnabled, website, setWebsite } = useChannelStore()
  const [copied, setCopied] = useState(false)
  const set = (patch: Partial<WebsiteSettings>) => setWebsite(patch)
  const url = typeof window === 'undefined' ? '/store' : `${window.location.origin}/store`

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className={cn('flex size-11 items-center justify-center rounded-xl', channelMeta.website.tile)}>
            <GlobeIcon aria-hidden />
          </span>
          <InputGroup className="flex-1">
            <InputGroupInput readOnly value={url} aria-label="Storefront link" />
            <InputGroupAddon align="inline-end">
              <Button size="icon-xs" variant="ghost" onClick={copy} aria-label="Copy link">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <Button variant="outline" render={<Link href="/store" target="_blank" />} nativeButton={false}>
            <ExternalLinkIcon data-icon="inline-start" />
            Open storefront
          </Button>
          <Switch checked={websiteOrderingEnabled} onCheckedChange={setWebsiteOrderingEnabled} aria-label="Accept website orders" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fulfilment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Toggle icon={BikeIcon} label="Delivery" checked={website.acceptDelivery} onChange={(v) => set({ acceptDelivery: v })} />
          <Toggle icon={ShoppingBagIcon} label="Pickup" checked={website.acceptPickup} onChange={(v) => set({ acceptPickup: v })} />
          <Amount icon={ClockIcon} label="Preparation time" value={website.prepMinutes} unit="min" onChange={(v) => set({ prepMinutes: v })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Toggle icon={BanknoteIcon} label="Cash on delivery" checked={website.paymentCash} onChange={(v) => set({ paymentCash: v })} />
          <Toggle icon={CreditCardIcon} label="Online payment" checked={website.paymentOnline} onChange={(v) => set({ paymentOnline: v })} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Pricing rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Amount icon={WalletIcon} label="Minimum order" value={website.minOrder} unit="Rs" onChange={(v) => set({ minOrder: v })} />
          <Amount icon={BikeIcon} label="Delivery fee" value={website.deliveryFee} unit="Rs" onChange={(v) => set({ deliveryFee: v })} />
          <Amount icon={TagIcon} label="Free delivery over" value={website.freeDeliveryOver} unit="Rs" onChange={(v) => set({ freeDeliveryOver: v })} />
        </CardContent>
      </Card>
    </div>
  )
}
