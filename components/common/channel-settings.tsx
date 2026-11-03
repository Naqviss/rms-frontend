'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { BikeIcon, PawPrintIcon, SlidersHorizontalIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { channelMeta } from '@/components/common/channel-icon'
import { useAccess } from '@/hooks/use-access'
import { useConnections } from '@/hooks/use-platform'
import { useScope } from '@/hooks/use-scope'
import { branchName } from '@/lib/directory'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/services/api/client'
import { deliverySettings, saveDeliverySettings } from '@/services/api/modules/delivery'
import { useSession } from '@/services/api/session'
import { setConnectionStatus } from '@/services/api/modules/workspace'
import type { ConnectionResponseDto } from '@/services/api/generated/schemas'

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

/**
 * Channel switches backed by the API:
 *  - Foodpanda: each branch connection's enabled state (PATCH /api/integrations/connections/{id}).
 *  - Own delivery: the primary branch's delivery settings `enabled` (PUT /api/delivery/settings/{branchId}).
 * Foodpanda "open for orders" / auto-accept and website ordering have no API and are not offered.
 */
export function ChannelSettings() {
  const { can } = useAccess()
  const { branchIds, primaryBranch } = useScope()
  const tenantId = useSession((s) => s.tenant?.id)
  const connections = useConnections()
  const delivery = useSWR(tenantId && primaryBranch ? `channel:delivery-settings:${tenantId}:${primaryBranch}` : null, () => deliverySettings(primaryBranch), {
    revalidateOnFocus: false,
  })
  const [busy, setBusy] = useState<string | null>(null)
  const canEdit = can('settings', 'edit')
  const rows = (connections.data ?? []).filter((c) => branchIds.includes(c.branch_id))

  const toggleConnection = async (c: ConnectionResponseDto, on: boolean) => {
    setBusy(c.id)
    try {
      await setConnectionStatus(c, on ? 'active' : 'disabled')
      await connections.mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const toggleDelivery = async (on: boolean) => {
    const current = delivery.data
    if (!current) return
    setBusy('delivery')
    try {
      const next = await saveDeliverySettings(current, { enabled: on, opening_hours: current.opening_hours, default_prep_minutes: current.default_prep_minutes ?? null })
      await delivery.mutate(next, { revalidate: false })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

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
          {rows.map((c) => (
            <Row
              key={c.id}
              icon={PawPrintIcon}
              label={`${c.provider.charAt(0).toUpperCase()}${c.provider.slice(1)} · ${branchName(c.branch_id)}`}
              tone={channelMeta.foodpanda.tile}
              checked={c.status === 'active'}
              onChange={(v) => void toggleConnection(c, v)}
              disabled={!canEdit || busy !== null}
            />
          ))}
          {connections.data && rows.length === 0 && <p className="p-2 text-xs text-muted-foreground">No Foodpanda connection for the selected branches.</p>}
          {primaryBranch && (
            <Row
              icon={BikeIcon}
              label={`Own delivery · ${branchName(primaryBranch)}`}
              tone={channelMeta['own-delivery'].tile}
              checked={!!delivery.data?.enabled}
              onChange={(v) => void toggleDelivery(v)}
              disabled={!canEdit || !delivery.data || busy !== null}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
