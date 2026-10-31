'use client'

import { useMemo } from 'react'
import { toast } from 'sonner'
import { ChefHatIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/common/page-header'
import { useOrders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatRelative } from '@/lib/utils/format'
import { branchName } from '@/mocks/branches'
import type { Order, OrderStatus } from '@/types'

const columns: { key: string; label: 'orders.colNew' | 'orders.colPreparing' | 'orders.colReady'; statuses: OrderStatus[]; next: OrderStatus; action: 'orders.startPreparing' | 'orders.markReady' | 'orders.complete' }[] = [
  { key: 'new', label: 'orders.colNew', statuses: ['pending', 'confirmed'], next: 'preparing', action: 'orders.startPreparing' },
  { key: 'preparing', label: 'orders.colPreparing', statuses: ['preparing'], next: 'ready', action: 'orders.markReady' },
  { key: 'ready', label: 'orders.colReady', statuses: ['ready'], next: 'completed', action: 'orders.complete' },
]

export default function KitchenPage() {
  const { t, td } = useT()
  const { data, update } = useOrders()
  const { inBranch } = useScope()

  const active = useMemo(
    () => inBranch(data ?? []).filter((o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data, inBranch],
  )

  const advance = async (o: Order, next: OrderStatus) => {
    await update(o.id, { status: next })
    toast.success(`${o.number}: ${td(`status.${next}`)}`)
  }

  return (
    <>
      <PageHeader title={t('orders.kds')} description={t('orders.kdsSubtitle')} />
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
                  <ChefHatIcon className="size-6" aria-hidden />
                  {t('common.noData')}
                </div>
              )}
              {list.slice(0, 12).map((o) => (
                <Card key={o.id} size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span>{o.number}</span>
                      <span className="text-xs font-normal text-muted-foreground">{formatRelative(o.createdAt)}</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {td(`type.${o.type}`)} · {branchName(o.branchId)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-1 text-sm">
                      {o.items.map((i, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="font-semibold tabular-nums">{i.quantity}x</span>
                          <span className="min-w-0">
                            {i.name}
                            {!!i.options?.length && <span className="block text-xs text-muted-foreground">{i.options.join(', ')}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {o.notes && <p className="mt-2 rounded bg-warning/20 px-2 py-1 text-xs">{o.notes}</p>}
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button className="flex-1" size="sm" onClick={() => advance(o, col.next)}>
                      {t(col.action)}
                    </Button>
                    {col.key === 'new' && (
                      <Button variant="outline" size="sm" onClick={() => advance(o, 'cancelled')}>
                        {t('common.cancel')}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </section>
          )
        })}
      </div>
    </>
  )
}
