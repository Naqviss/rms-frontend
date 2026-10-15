'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BikeIcon,
  CheckCircle2Icon,
  ClockIcon,
  HourglassIcon,
  MapPinIcon,
  PackageCheckIcon,
  PhoneIcon,
  TruckIcon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ChannelFilter } from '@/components/common/channel-filter'
import { channelMeta, ChannelIcon } from '@/components/common/channel-icon'
import { ChannelSettings } from '@/components/common/channel-settings'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { useOrders, useRiders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { channelOf, deliveryChannels, isRejected } from '@/lib/utils/channels'
import { cn } from '@/lib/utils'
import { formatCurrency, formatTime } from '@/lib/utils/format'
import { useChannelStore } from '@/stores/channel-store'
import type { DeliveryStatus, Order, SalesChannel } from '@/types'

const columns: { status: DeliveryStatus; title: string; icon: LucideIcon; tone: string }[] = [
  { status: 'unassigned', title: 'Waiting', icon: HourglassIcon, tone: 'bg-warning/20 text-warning-foreground dark:text-warning' },
  { status: 'assigned', title: 'Assigned', icon: BikeIcon, tone: 'bg-primary/10 text-primary' },
  { status: 'picked-up', title: 'On the way', icon: TruckIcon, tone: 'bg-delivery/15 text-delivery' },
  { status: 'delivered', title: 'Delivered', icon: CheckCircle2Icon, tone: 'bg-success/15 text-success' },
]

/** Foodpanda orders have no dispatch of their own; their stage follows the order status and Foodpanda's rider. */
function stageOf(o: Order): DeliveryStatus {
  if (o.delivery) return o.delivery.status
  if (o.status === 'completed') return 'delivered'
  if (o.status === 'out-for-delivery') return 'picked-up'
  return o.foodpanda?.riderName ? 'assigned' : 'unassigned'
}

export default function DeliveryBoardPage() {
  const { t } = useT()
  const enabled = useChannelStore((s) => s.deliveryEnabled)
  const setEnabled = useChannelStore((s) => s.setDeliveryEnabled)
  const { data, isLoading, update } = useOrders()
  const { data: riders, update: updateRiderRaw } = useRiders()
  const { inBranch, inRange } = useScope()
  const [shown, setShown] = useState<SalesChannel[]>(deliveryChannels)

  const all = useMemo(
    () =>
      inRange(
        inBranch(data ?? []).filter((o) => deliveryChannels.includes(channelOf(o)) && (o.delivery || o.foodpanda) && o.status !== 'cancelled' && !isRejected(o)),
        (o) => o.createdAt,
      ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data, inBranch, inRange],
  )

  const counts = useMemo(() => {
    const c: Partial<Record<SalesChannel, number>> = {}
    for (const o of all) c[channelOf(o)] = (c[channelOf(o)] ?? 0) + 1
    return c
  }, [all])

  const deliveries = useMemo(() => all.filter((o) => shown.includes(channelOf(o))), [all, shown])

  const stats = useMemo(() => {
    const done = deliveries.filter((o) => stageOf(o) === 'delivered')
    const times = done.map((o) => o.delivery?.durationMinutes ?? 0).filter(Boolean)
    return {
      waiting: deliveries.filter((o) => stageOf(o) === 'unassigned').length,
      active: deliveries.filter((o) => ['assigned', 'picked-up'].includes(stageOf(o))).length,
      avgTime: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      fees: done.reduce((s, o) => s + (o.delivery?.fee ?? 0), 0),
    }
  }, [deliveries])

  const updateRider = (id: string, status: 'available' | 'on-delivery') => updateRiderRaw(id, { status })

  const advance = async (o: Order, status: DeliveryStatus, extra?: { riderId: string; riderName: string }) => {
    if (!o.delivery) return
    const delivery = { ...o.delivery, status, ...(extra ?? {}) }
    const orderStatus = status === 'delivered' ? 'completed' : status === 'picked-up' ? 'out-for-delivery' : o.status
    await update(o.id, { delivery, status: orderStatus })
    if (extra) {
      const rider = riders?.find((r) => r.id === extra.riderId)
      if (rider) await updateRider(rider.id, 'on-delivery')
    }
    if (status === 'delivered' && o.delivery.riderId) await updateRider(o.delivery.riderId, 'available')
    toast.success(t('common.updated'))
  }

  if (!enabled) {
    return (
      <>
        <PageHeader title={t('nav.deliveryBoard')} actions={<ChannelSettings />} />
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TruckIcon />
            </EmptyMedia>
            <EmptyTitle>Own delivery is turned off</EmptyTitle>
            <EmptyDescription>Turn it on to dispatch riders for your own and website orders.</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setEnabled(true)}>
            <TruckIcon data-icon="inline-start" />
            Enable delivery
          </Button>
        </Empty>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('nav.deliveryBoard')}
        actions={
          <>
            <ChannelSettings />
            <Button variant="outline" render={<Link href="/delivery/riders" />} nativeButton={false}>
              <BikeIcon data-icon="inline-start" />
              {t('nav.riders')}
            </Button>
          </>
        }
      />

      <ChannelFilter className="mb-4" channels={deliveryChannels} value={shown} onChange={setShown} counts={counts} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Waiting for rider" value={String(stats.waiting)} icon={PackageCheckIcon} />
        <StatCard label="Out for delivery" value={String(stats.active)} icon={TruckIcon} />
        <StatCard label="Avg delivery time" value={`${stats.avgTime} min`} icon={ClockIcon} />
        <StatCard label="Delivery fees earned" value={formatCurrency(stats.fees)} icon={BikeIcon} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {columns.map((c) => (
            <Skeleton key={c.status} className="h-64" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const items = deliveries.filter((o) => stageOf(o) === col.status).slice(0, col.status === 'delivered' ? 8 : 30)
            const Icon = col.icon
            return (
              <section key={col.status} aria-label={col.title} className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between rounded-xl bg-muted/60 p-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <span className={cn('flex size-7 items-center justify-center rounded-lg', col.tone)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    {col.title}
                  </h2>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                {items.length === 0 && (
                  <div className="flex h-20 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
                    <Icon className="size-5 opacity-40" aria-hidden />
                  </div>
                )}
                {items.map((o) => (
                  <DeliveryCard
                    key={o.id}
                    order={o}
                    stage={stageOf(o)}
                    riderOptions={(riders ?? [])
                      .filter((r) => r.branchId === o.branchId && r.status === 'available')
                      .map((r) => ({ value: r.id, label: r.name }))}
                    onAssign={(riderId) => {
                      const rider = riders?.find((r) => r.id === riderId)
                      if (rider) advance(o, 'assigned', { riderId, riderName: rider.name })
                    }}
                    onAdvance={(s) => advance(o, s)}
                  />
                ))}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

function DeliveryCard({
  order,
  stage,
  riderOptions,
  onAssign,
  onAdvance,
}: {
  order: Order
  stage: DeliveryStatus
  riderOptions: { value: string; label: string }[]
  onAssign: (riderId: string) => void
  onAdvance: (s: DeliveryStatus) => void
}) {
  const d = order.delivery
  const channel = channelOf(order)
  const riderName = d?.riderName ?? order.foodpanda?.riderName ?? null
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4 text-sm">
        <div className="flex items-center gap-2">
          <ChannelIcon channel={channel} />
          <span className="font-semibold">{order.number}</span>
          <span className="ml-auto text-xs text-muted-foreground">{formatTime(order.createdAt)}</span>
        </div>
        <div>
          <p className="font-medium">{order.customerName}</p>
          {d && (
            <>
              <p className="mt-1 flex items-start gap-1.5 text-muted-foreground">
                <MapPinIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span className="text-pretty">{d.address}</span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <PhoneIcon className="size-3.5 shrink-0" aria-hidden />
                {d.phone}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {d ? (
            <>
              <span>{d.distanceKm.toFixed(1)} km</span>
              <span>{formatCurrency(d.fee)}</span>
            </>
          ) : (
            <span className={cn('font-medium', channelMeta.foodpanda.text)}>Foodpanda rider</span>
          )}
          <span className="font-medium text-foreground tabular-nums">{formatCurrency(order.total)}</span>
        </div>
        {riderName && (
          <p className="flex items-center gap-1.5 text-xs">
            <BikeIcon className="size-3.5" aria-hidden />
            {riderName}
            {stage === 'delivered' && d?.durationMinutes ? ` · ${d.durationMinutes} min` : ''}
          </p>
        )}
        {d && stage === 'unassigned' &&
          (riderOptions.length ? (
            <OptionSelect value="" onValueChange={onAssign} options={riderOptions} placeholder="Assign rider" aria-label="Assign rider" />
          ) : (
            <p className="text-xs text-muted-foreground">No riders available at this branch.</p>
          ))}
        {d && stage === 'assigned' && (
          <Button size="sm" onClick={() => onAdvance('picked-up')}>
            <TruckIcon data-icon="inline-start" />
            Picked up
          </Button>
        )}
        {d && stage === 'picked-up' && (
          <Button size="sm" onClick={() => onAdvance('delivered')}>
            <CheckCircle2Icon data-icon="inline-start" />
            Delivered
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
