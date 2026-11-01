'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { useOrders, useTables } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { branchName } from '@/mocks/branches'
import type { DiningTable, TableStatus } from '@/types'

const tone: Record<TableStatus, string> = {
  available: 'border-success/50 bg-success/10',
  occupied: 'border-primary/50 bg-primary/10',
  reserved: 'border-warning/60 bg-warning/15',
}

export default function TablesPage() {
  const { t, td } = useT()
  const { branchIds, primaryBranch } = useScope()
  const [localBranch, setLocalBranch] = useState<string | null>(null)
  // The floor plan shows one branch at a time, chosen from those picked in the top bar.
  const branchId = localBranch && branchIds.includes(localBranch) ? localBranch : primaryBranch
  const { data: tables, isLoading, update } = useTables()
  const { data: orders } = useOrders()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const floor = useMemo(() => (tables ?? []).filter((x) => x.branchId === branchId), [tables, branchId])
  const selected = floor.find((x) => x.id === selectedId) ?? null
  const order = selected?.orderId ? orders?.find((o) => o.id === selected.orderId) : null

  const setStatus = async (tb: DiningTable, status: TableStatus) => {
    await update(tb.id, { status, orderId: status === 'occupied' ? tb.orderId : null })
    toast.success(t('common.updated'))
  }

  const counts = (['available', 'occupied', 'reserved'] as const).map((s) => ({ s, n: floor.filter((x) => x.status === s).length }))

  return (
    <>
      <PageHeader
        title={t('nav.tables')}
        description={t('orders.floor')}
        actions={
          <OptionSelect
            className="h-9 w-52"
            value={branchId}
            onValueChange={setLocalBranch}
            aria-label={t('common.branch')}
            options={branchIds.map((id) => ({ value: id, label: branchName(id) }))}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('orders.floor')}</CardTitle>
            <CardDescription className="flex flex-wrap gap-3">
              {counts.map(({ s, n }) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <StatusBadge status={s} /> <span className="tabular-nums">{n}</span>
                </span>
              ))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {floor.map((tb) => (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => setSelectedId(tb.id)}
                    aria-pressed={selectedId === tb.id}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center gap-1 border-2 text-center transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      tb.shape === 'round' ? 'rounded-full' : 'rounded-2xl',
                      tone[tb.status],
                      selectedId === tb.id && 'ring-2 ring-foreground/70',
                    )}
                  >
                    <span className="text-lg font-semibold">{tb.number}</span>
                    <span className="text-xs text-muted-foreground">
                      {tb.capacity} {t('orders.seats')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{selected ? `${t('orders.table')} ${selected.number}` : t('orders.table')}</CardTitle>
            <CardDescription>{selected ? `${selected.capacity} ${t('orders.seats')}` : t('orders.selectTable')}</CardDescription>
          </CardHeader>
          {selected && (
            <CardContent className="flex flex-col gap-4">
              <StatusBadge status={selected.status} className="self-start" />
              {order && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    {t('orders.number')} {order.number}
                  </p>
                  <p className="text-muted-foreground">
                    {order.items.length} {t('common.items').toLowerCase()} · {formatCurrency(order.total)}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {(['available', 'reserved', 'occupied'] as const)
                  .filter((s) => s !== selected.status)
                  .map((s) => (
                    <Button key={s} variant="outline" onClick={() => setStatus(selected, s)}>
                      {td(`status.${s}`)}
                    </Button>
                  ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  )
}
