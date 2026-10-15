'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BanknoteIcon,
  BellRingIcon,
  BikeIcon,
  CheckIcon,
  ChefHatIcon,
  ClockIcon,
  CookingPotIcon,
  CreditCardIcon,
  GlobeIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  MonitorIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { channelMeta } from '@/components/common/channel-icon'
import { useOrders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { channelOf } from '@/lib/utils/channels'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import type { Order, OrderStatus } from '@/types'

type Stage = 'new' | 'preparing' | 'ready' | 'done'

const stages: { id: Stage; label: string; icon: LucideIcon }[] = [
  { id: 'new', label: 'New', icon: BellRingIcon },
  { id: 'preparing', label: 'Preparing', icon: CookingPotIcon },
  { id: 'ready', label: 'Ready', icon: PackageCheckIcon },
  { id: 'done', label: 'Done', icon: CheckIcon },
]

function stageOf(o: Order): Stage | 'cancelled' {
  if (o.status === 'cancelled' || o.website?.acceptance === 'rejected') return 'cancelled'
  if (o.website?.acceptance === 'awaiting') return 'new'
  if (o.status === 'completed') return 'done'
  if (o.status === 'ready' || o.status === 'out-for-delivery') return 'ready'
  if (o.status === 'preparing') return 'preparing'
  return o.status === 'pending' ? 'new' : 'preparing'
}

export function WebsiteOrders() {
  const { data, isLoading, update } = useOrders()
  const { inBranch } = useScope()
  const [stage, setStage] = useState<Stage>('new')

  const orders = useMemo(
    () => inBranch(data ?? []).filter((o) => channelOf(o) === 'website').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data, inBranch],
  )

  const byStage = useMemo(() => {
    const m: Record<Stage, Order[]> = { new: [], preparing: [], ready: [], done: [] }
    for (const o of orders) {
      const s = stageOf(o)
      if (s !== 'cancelled') m[s].push(o)
    }
    return m
  }, [orders])

  const stats = useMemo(() => {
    const valid = orders.filter((o) => stageOf(o) !== 'cancelled')
    const revenue = valid.reduce((s, o) => s + o.total, 0)
    return {
      count: valid.length,
      revenue,
      avg: valid.length ? Math.round(revenue / valid.length) : 0,
      delivery: valid.filter((o) => o.website?.fulfillment === 'delivery').length,
      pickup: valid.filter((o) => o.website?.fulfillment === 'pickup').length,
    }
  }, [orders])

  const accept = async (o: Order) => {
    await update(o.id, { status: 'confirmed', website: o.website ? { ...o.website, acceptance: 'accepted' } : undefined })
    toast.success('Order accepted')
  }
  const reject = async (o: Order) => {
    await update(o.id, { status: 'cancelled', paymentStatus: 'refunded', website: o.website ? { ...o.website, acceptance: 'rejected' } : undefined })
    toast.success('Order rejected and payment refunded')
  }
  const move = async (o: Order, status: OrderStatus) => {
    await update(o.id, { status })
    toast.success('Updated')
  }

  const list = byStage[stage]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Website orders" value={String(stats.count)} icon={GlobeIcon} />
        <StatCard label="Website revenue" value={formatCurrency(stats.revenue)} icon={BanknoteIcon} />
        <StatCard label="Avg order value" value={formatCurrency(stats.avg)} icon={ReceiptTextIcon} />
        <StatCard label="Delivery / pickup" value={`${stats.delivery} / ${stats.pickup}`} icon={BikeIcon} />
      </div>

      <ol className="flex items-center gap-2 overflow-x-auto rounded-xl bg-muted/60 p-2" aria-label="Order workflow">
        {stages.map((s, i) => {
          const active = s.id === stage
          const count = byStage[s.id].length
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setStage(s.id)}
                aria-pressed={active}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active ? `${channelMeta.website.bar} text-white shadow-sm` : 'text-muted-foreground hover:bg-background',
                )}
              >
                <s.icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{s.label}</span>
                <span className={cn('min-w-5 rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-white/25' : 'bg-background')}>{count}</span>
              </button>
              {i < stages.length - 1 && <span className="h-px w-4 shrink-0 bg-border" aria-hidden />}
            </li>
          )
        })}
      </ol>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChefHatIcon />
            </EmptyMedia>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>Orders placed on your website will show up in this lane.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.slice(0, 30).map((o) => (
            <li key={o.id}>
              <WebsiteOrderCard order={o} stage={stage} onAccept={accept} onReject={reject} onMove={move} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function IconButton({ label, onClick, className, children }: { label: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon" variant="ghost" aria-label={label} className={className} onClick={onClick} />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function WebsiteOrderCard({
  order: o,
  stage,
  onAccept,
  onReject,
  onMove,
}: {
  order: Order
  stage: Stage
  onAccept: (o: Order) => void
  onReject: (o: Order) => void
  onMove: (o: Order, s: OrderStatus) => void
}) {
  const delivery = o.website?.fulfillment === 'delivery'
  const awaiting = o.website?.acceptance === 'awaiting'
  const Device = o.website?.device === 'mobile' ? SmartphoneIcon : MonitorIcon
  const Pay = o.paymentMethod === 'cash' ? BanknoteIcon : CreditCardIcon
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex flex-col gap-3 px-4 text-sm">
        <div className="flex items-center gap-2">
          <span className={cn('flex size-8 items-center justify-center rounded-lg', channelMeta.website.tile)}>
            {delivery ? <BikeIcon className="size-4" aria-label="Delivery" /> : <ShoppingBagIcon className="size-4" aria-label="Pickup" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {o.number} <span className="font-normal text-muted-foreground">{o.customerName}</span>
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClockIcon className="size-3" aria-hidden />
              {formatDateTime(o.createdAt)}
              <Device className="ml-1 size-3" aria-label={o.website?.device} />
            </p>
          </div>
          <StatusBadge status={o.status} />
        </div>
        <ul className="flex flex-col gap-0.5 rounded-lg bg-muted/50 p-2 text-xs">
          {o.items.slice(0, 4).map((i, n) => (
            <li key={n} className="flex justify-between gap-2">
              <span className="truncate">
                {i.quantity} x {i.name}
              </span>
              <span className="tabular-nums text-muted-foreground">{formatCurrency(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
          {o.items.length > 4 && <li className="text-muted-foreground">+{o.items.length - 4} more</li>}
        </ul>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Pay className="size-3.5" aria-label={o.paymentMethod} />
            {o.website?.promoCode && <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{o.website.promoCode}</span>}
          </span>
          <span className="text-base font-bold tabular-nums">{formatCurrency(o.total)}</span>
        </div>

        <div className="flex items-center gap-2">
          {awaiting && (
            <>
              <Button className="flex-1" onClick={() => onAccept(o)}>
                <CheckIcon data-icon="inline-start" />
                Accept
              </Button>
              <IconButton label="Reject" onClick={() => onReject(o)} className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                <XIcon />
              </IconButton>
            </>
          )}
          {!awaiting && stage === 'new' && (
            <Button className="flex-1" onClick={() => onMove(o, 'preparing')}>
              <CookingPotIcon data-icon="inline-start" />
              Start preparing
            </Button>
          )}
          {stage === 'preparing' && (
            <Button className="flex-1" onClick={() => onMove(o, 'ready')}>
              <PackageCheckIcon data-icon="inline-start" />
              Mark ready
            </Button>
          )}
          {stage === 'ready' &&
            (delivery ? (
              <Button className="flex-1" variant="outline" render={<Link href="/delivery" />} nativeButton={false}>
                <BikeIcon data-icon="inline-start" />
                Dispatch on delivery board
              </Button>
            ) : (
              <Button className="flex-1" onClick={() => onMove(o, 'completed')}>
                <ShoppingBagIcon data-icon="inline-start" />
                Picked up
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
