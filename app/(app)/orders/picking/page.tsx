'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PackageOpenIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { ChannelIcon } from '@/components/common/channel-icon'
import { PageHeader } from '@/components/common/page-header'
import { useOrders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { channelOf } from '@/lib/utils/channels'
import { formatLineQty, formatRelative } from '@/lib/utils/format'
import { branchName } from '@/mocks/branches'
import type { Order, OrderStatus } from '@/types'

type ColumnKey = 'new' | 'picking' | 'packed'

const columns: {
  key: ColumnKey
  label: 'orders.colNew' | 'orders.colPreparing' | 'orders.colReady'
  statuses: OrderStatus[]
  action: 'orders.startPreparing' | 'orders.markReady' | 'orders.complete'
}[] = [
  { key: 'new', label: 'orders.colNew', statuses: ['pending', 'confirmed'], action: 'orders.startPreparing' },
  { key: 'picking', label: 'orders.colPreparing', statuses: ['preparing'], action: 'orders.markReady' },
  { key: 'packed', label: 'orders.colReady', statuses: ['ready'], action: 'orders.complete' },
]

/** Packed delivery orders leave with a rider; everything else is collected at the counter. */
const goesOut = (o: Order) => !!o.delivery || o.type === 'delivery'

function nextStatus(col: ColumnKey, o: Order): OrderStatus {
  if (col === 'new') return 'preparing'
  if (col === 'picking') return 'ready'
  return goesOut(o) ? 'out-for-delivery' : 'completed'
}

export default function PickingPage() {
  const { t, td } = useT()
  const { data, update } = useOrders()
  const { inBranch } = useScope()
  /** Lines ticked off per order while picking. Kept on this screen only; the order itself just moves column. */
  const [picked, setPicked] = useState<Record<string, number[]>>({})

  // Walk-in sales are handed over at the till, so only orders someone has to pick from the shelves show up here.
  const active = useMemo(
    () =>
      inBranch(data ?? [])
        .filter((o) => o.type !== 'walk-in' && ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data, inBranch],
  )

  const toggle = (orderId: string, idx: number, on: boolean) =>
    setPicked((p) => {
      const current = p[orderId] ?? []
      return { ...p, [orderId]: on ? [...current, idx] : current.filter((i) => i !== idx) }
    })

  const advance = async (o: Order, next: OrderStatus) => {
    await update(o.id, { status: next })
    toast.success(`${o.number}: ${td(`status.${next}`)}`)
  }

  return (
    <>
      <PageHeader title={t('orders.picking')} description={t('orders.pickingSubtitle')} />
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => {
          const list = active.filter((o) => col.statuses.includes(o.status))
          return (
            <section key={col.key} aria-label={t(col.label)} className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/40 p-3">
              <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
                {t(col.label)}
                <Badge variant="secondary" className="tabular-nums">
                  {list.length}
                </Badge>
              </h2>
              {list.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                  <PackageOpenIcon className="size-6" aria-hidden />
                  {t('common.noData')}
                </div>
              )}
              {list.slice(0, 12).map((o) => {
                const ticks = picked[o.id] ?? []
                const picking = col.key === 'picking'
                const allPicked = ticks.length >= o.items.length
                const next = nextStatus(col.key, o)
                return (
                  <Card key={o.id} size="sm">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2 text-base">
                        <span className="flex items-center gap-2">
                          <ChannelIcon channel={channelOf(o)} size="sm" />
                          {o.number}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">{formatRelative(o.createdAt)}</span>
                      </CardTitle>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.customerName} · {o.delivery?.area || td(`type.${o.type}`)} · {branchName(o.branchId)}
                      </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      {picking && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Progress value={(ticks.length / o.items.length) * 100} className="h-1.5 flex-1" aria-label={`${ticks.length} of ${o.items.length} picked`} />
                          <span className="tabular-nums">
                            {ticks.length}/{o.items.length}
                          </span>
                        </div>
                      )}
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {o.items.map((i, idx) => {
                          const done = ticks.includes(idx)
                          const label = (
                            <>
                              <span className="shrink-0 font-semibold tabular-nums">{formatLineQty(i)}</span>
                              <span className={cn('min-w-0', done && 'text-muted-foreground line-through')}>
                                {i.name}
                                {!!i.options?.length && <span className="block text-xs text-muted-foreground">{i.options.join(', ')}</span>}
                              </span>
                            </>
                          )
                          return (
                            <li key={idx}>
                              {picking ? (
                                <label className="flex cursor-pointer items-start gap-2">
                                  <Checkbox className="mt-0.5" checked={done} onCheckedChange={(v) => toggle(o.id, idx, v === true)} />
                                  {label}
                                </label>
                              ) : (
                                <span className="flex gap-2">{label}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      {o.notes && <p className="rounded bg-warning/20 px-2 py-1 text-xs">{o.notes}</p>}
                    </CardContent>
                    <CardFooter className="gap-2">
                      <Button className="flex-1" size="sm" disabled={picking && !allPicked} onClick={() => advance(o, next)}>
                        {col.key === 'packed' && goesOut(o) ? td('status.out-for-delivery') : t(col.action)}
                      </Button>
                      {col.key === 'new' && (
                        <Button variant="outline" size="sm" onClick={() => advance(o, 'cancelled')}>
                          {t('common.cancel')}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}
