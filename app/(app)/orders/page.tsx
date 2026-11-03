'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { BikeIcon, CheckIcon, GlobeIcon, PlusIcon, ShoppingBagIcon, UtensilsCrossedIcon, XIcon, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { channelOf, channels } from '@/lib/utils/channels'
import { ChannelFilter } from '@/components/common/channel-filter'
import { ChannelIcon } from '@/components/common/channel-icon'
import { ChannelSettings } from '@/components/common/channel-settings'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useOrders } from '@/hooks/use-data'
import { useOrderPayments } from '@/hooks/use-front-of-house'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { PaymentResponseDto } from '@/services/api/generated/schemas'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDateTime } from '@/lib/utils/format'
import { branchName } from '@/lib/directory'
import type { Order, OrderStatus, OrderType, SalesChannel } from '@/types'

const statuses: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'out-for-delivery', 'completed', 'cancelled']

const typeIcon: Record<OrderType, LucideIcon> = {
  'dine-in': UtensilsCrossedIcon,
  takeaway: ShoppingBagIcon,
  delivery: BikeIcon,
  online: GlobeIcon,
}

const isAwaiting = (o: Order) => o.foodpanda?.acceptance === 'awaiting' || o.website?.acceptance === 'awaiting'

function IconAction({ label, onClick, tone, children }: { label: string; onClick: () => void; tone: 'accept' | 'reject'; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={label}
            className={tone === 'accept' ? 'bg-success/15 text-success hover:bg-success/25' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export default function OrdersPage() {
  const { t, td } = useT()
  const { data, isLoading, update } = useOrders()
  const { inBranch } = useScope()
  const [status, setStatus] = useState('all')
  const [shown, setShown] = useState<SalesChannel[]>(channels)
  const [selected, setSelected] = useState<Order | null>(null)

  const scoped = useMemo(() => inBranch(data ?? []), [data, inBranch])

  const counts = useMemo(() => {
    const c: Partial<Record<SalesChannel, number>> = {}
    for (const o of scoped) c[channelOf(o)] = (c[channelOf(o)] ?? 0) + 1
    return c
  }, [scoped])

  const rows = useMemo(
    () =>
      scoped
        .filter((o) => (status === 'all' ? true : o.status === status))
        .filter((o) => shown.includes(channelOf(o)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [scoped, status, shown],
  )

  const awaitingCount = useMemo(() => scoped.filter((o) => isAwaiting(o) && o.status !== 'cancelled').length, [scoped])

  const [busyId, setBusyId] = useState<string | null>(null)
  /** Server transition (version-checked); the sheet shows the record the server returned. */
  const run = async (o: Order, patch: Partial<Order>, done: string) => {
    if (busyId) return
    setBusyId(o.id)
    try {
      const next = await update(o.id, patch)
      toast.success(done)
      setSelected((s) => (s && s.id === o.id ? next : s))
    } catch {
      // reported by useResource
    } finally {
      setBusyId(null)
    }
  }

  const setOrderStatus = (o: Order, next: OrderStatus) => run(o, { status: next }, t('common.updated'))

  // Refunds are separate (payments below); rejecting does not refund by itself.
  const respond = (o: Order, accept: boolean) => {
    const patch: Partial<Order> = accept ? { status: 'confirmed' } : { status: 'cancelled' }
    if (o.foodpanda) patch.foodpanda = { ...o.foodpanda, acceptance: accept ? 'accepted' : 'rejected' }
    if (o.website) patch.website = { ...o.website, acceptance: accept ? 'accepted' : 'rejected' }
    return run(o, patch, accept ? 'Order accepted' : 'Order rejected')
  }

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      {
        id: 'channel',
        header: () => <span className="sr-only">Channel</span>,
        accessorFn: (o) => channelOf(o),
        cell: ({ row }) => <ChannelIcon channel={channelOf(row.original)} />,
      },
      { accessorKey: 'number', header: t('orders.number'), cell: ({ row }) => <span className="font-medium">{row.original.number}</span> },
      { accessorKey: 'createdAt', header: t('common.date'), cell: ({ row }) => formatDateTime(row.original.createdAt) },
      { accessorKey: 'customerName', header: t('common.customer') },
      {
        accessorKey: 'type',
        header: () => <span className="sr-only">{t('common.type')}</span>,
        cell: ({ row }) => {
          const Icon = typeIcon[row.original.type]
          return <Icon className="size-4 text-muted-foreground" aria-label={td(`type.${row.original.type}`)} role="img" />
        },
      },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { accessorKey: 'paymentStatus', header: t('orders.payment'), cell: ({ row }) => <StatusBadge status={row.original.paymentStatus} /> },
      {
        accessorKey: 'total',
        header: t('common.total'),
        cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.total)}</span>,
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {isAwaiting(row.original) && row.original.status !== 'cancelled' && (
              <>
                <IconAction label="Accept order" tone="accept" onClick={() => respond(row.original, true)}>
                  <CheckIcon />
                </IconAction>
                <IconAction label="Reject order" tone="reject" onClick={() => respond(row.original, false)}>
                  <XIcon />
                </IconAction>
              </>
            )}
            <RowActions
              actions={[
                { label: t('common.details'), onSelect: () => setSelected(row.original) },
                ...(row.original.status !== 'completed' && row.original.status !== 'cancelled' && !isAwaiting(row.original)
                  ? [
                      { label: t('orders.complete'), onSelect: () => setOrderStatus(row.original, 'completed') },
                      { label: t('orders.cancelOrder'), destructive: true, onSelect: () => setOrderStatus(row.original, 'cancelled') },
                    ]
                  : []),
              ]}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, td],
  )

  return (
    <>
      <PageHeader
        title={t('orders.title')}
        description={t('orders.subtitle')}
        actions={
          <>
            <ChannelSettings />
            <Button render={<Link href="/orders/pos" />} nativeButton={false}>
              <PlusIcon data-icon="inline-start" />
              {t('orders.newOrder')}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChannelFilter channels={channels} value={shown} onChange={setShown} counts={counts} />
        {awaitingCount > 0 && (
          <span className="flex items-center gap-2 rounded-full bg-warning/20 px-3 py-1.5 text-sm font-medium text-warning-foreground dark:text-warning">
            <span className="size-2 animate-pulse rounded-full bg-current" aria-hidden />
            {awaitingCount} awaiting
          </span>
        )}
      </div>
      <DataTable
        cardLead="channel"
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="orders"
        exportRows={(r) =>
          r.map((o) => ({ order: o.number, date: o.createdAt, customer: o.customerName, type: o.type, status: o.status, total: o.total }))
        }
        onRowClick={setSelected}
        filters={
          <>
            <OptionSelect
              className="h-9 w-40"
              value={status}
              onValueChange={setStatus}
              aria-label={t('common.status')}
              options={[{ value: 'all', label: `${t('common.status')}: ${t('common.all')}` }, ...statuses.map((s) => ({ value: s, label: td(`status.${s}`) }))]}
            />
          </>
        }
      />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {t('orders.number')} {selected.number}
                </SheetTitle>
                <SheetDescription>
                  {formatDateTime(selected.createdAt)} · {branchName(selected.branchId)}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <ChannelIcon channel={channelOf(selected)} />
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.paymentStatus} />
                </div>
                {isAwaiting(selected) && selected.status !== 'cancelled' && (
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={busyId === selected.id} onClick={() => respond(selected, true)}>
                      <CheckIcon data-icon="inline-start" />
                      Accept
                    </Button>
                    <Button className="flex-1" variant="outline" disabled={busyId === selected.id} onClick={() => respond(selected, false)}>
                      <XIcon data-icon="inline-start" />
                      Reject
                    </Button>
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t('common.customer')}</dt>
                    <dd className="font-medium">{selected.customerName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('common.type')}</dt>
                    <dd className="font-medium">{td(`type.${selected.type}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('common.method')}</dt>
                    <dd className="font-medium">{td(`pay.${selected.paymentMethod}`)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="font-medium capitalize">{selected.source}</dd>
                  </div>
                </dl>
                <Separator />
                <ul className="flex flex-col gap-3">
                  {selected.items.map((i, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {i.quantity} x {i.name}
                        </p>
                        {!!i.options?.length && <p className="text-xs text-muted-foreground">{i.options.join(', ')}</p>}
                      </div>
                      <span className="tabular-nums">{formatCurrency(i.quantity * i.unitPrice)}</span>
                    </li>
                  ))}
                </ul>
                <Separator />
                <dl className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('common.subtotal')}</dt>
                    <dd className="tabular-nums">{formatCurrency(selected.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('common.discount')}</dt>
                    <dd className="tabular-nums">-{formatCurrency(selected.discount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t('common.tax')}</dt>
                    <dd className="tabular-nums">{formatCurrency(selected.tax)}</dd>
                  </div>
                  <div className="flex justify-between text-base font-semibold">
                    <dt>{t('common.total')}</dt>
                    <dd className="tabular-nums">{formatCurrency(selected.total)}</dd>
                  </div>
                </dl>
                {selected.foodpanda && (
                  <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
                    <p className="font-medium">Foodpanda {selected.foodpanda.externalId}</p>
                    {selected.foodpanda.rejectReason && <p className="text-muted-foreground">{selected.foodpanda.rejectReason}</p>}
                  </div>
                )}
                {selected.website && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                    <ChannelIcon channel="website" size="sm" />
                    <span className="capitalize">{selected.website.fulfillment}</span>
                    {selected.website.promoCode && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{selected.website.promoCode}</span>}
                  </div>
                )}
                {selected.delivery && (
                  <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
                    <p className="font-medium">Delivery</p>
                    <p className="text-muted-foreground">
                      {selected.delivery.address}, {selected.delivery.area}
                    </p>
                    <p className="text-muted-foreground">
                      {selected.delivery.riderName ?? 'No rider assigned'} · Fee {formatCurrency(selected.delivery.fee)}
                    </p>
                  </div>
                )}
                {selected.notes && (
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{selected.notes}</p>
                )}
                <OrderPayments order={selected} />
                {selected.status !== 'completed' && selected.status !== 'cancelled' && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">{t('orders.updateStatus')}</p>
                    <OptionSelect
                      value={selected.status}
                      disabled={busyId === selected.id}
                      onValueChange={(v) => setOrderStatus(selected, v as OrderStatus)}
                      options={statuses.map((s) => ({ value: s, label: td(`status.${s}`) }))}
                      aria-label={t('orders.updateStatus')}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Payments recorded against the order, with a full refund of what remains on each. */
function OrderPayments({ order }: { order: Order }) {
  const { payments, isLoading, busy, refund } = useOrderPayments(order)
  const [refunding, setRefunding] = useState<PaymentResponseDto | null>(null)
  if (isLoading) return <Skeleton className="h-12 w-full" />
  if (!payments?.length) return null
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      <p className="font-medium">Payments</p>
      <ul className="flex flex-col gap-2">
        {payments.map((p) => {
          const remaining = p.amount_minor - p.refunded_minor
          return (
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                {p.method_label} · <span className="text-muted-foreground">{p.status.replace(/_/g, ' ')}</span>
                {p.refunded_minor > 0 && <span className="block text-xs text-muted-foreground">Refunded {formatCurrency(p.refunded_minor / 100)}</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{formatCurrency(p.amount_minor / 100)}</span>
                {remaining > 0 && (p.status === 'captured' || p.status === 'partially_refunded') && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setRefunding(p)}>
                    Refund
                  </Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={!!refunding}
        onOpenChange={(o) => !o && setRefunding(null)}
        title="Refund payment"
        description={refunding ? `Refund ${formatCurrency((refunding.amount_minor - refunding.refunded_minor) / 100)} of this ${refunding.method_label} payment?` : ''}
        confirmLabel="Refund"
        onConfirm={async () => {
          if (refunding && (await refund(refunding))) toast.success('Refund recorded')
        }}
      />
    </div>
  )
}
