'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { BadgePercentIcon, GiftIcon, PlusIcon, TicketIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { NEW_SCHEDULE, scheduleFields, scheduleFromValues, scheduleValues } from '@/components/promotions/schedule-fields'
import { useCategories, useDiscounts, useOrders, useProducts } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatCompactCurrency, formatCurrency, formatNumber } from '@/lib/utils/format'
import { describeDiscount, describeSchedule, PROMO_STATUS, promoStatus, type PromoStatus } from '@/lib/utils/promotions'
import { branchName } from '@/mocks/branches'
import type { Discount, DiscountScope } from '@/types'

const NEW_DISCOUNT: Omit<Discount, 'id'> = {
  ...NEW_SCHEDULE,
  name: '',
  code: '',
  kind: 'percent',
  value: 10,
  maxAmount: 0,
  minOrder: 0,
  scope: 'order',
  targetId: null,
  usageLimit: 0,
  used: 0,
}

export default function DiscountsPage() {
  const { t, td } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useDiscounts()
  const { data: categories } = useCategories()
  const { data: products } = useProducts()
  const { data: orders } = useOrders()
  const { inBranch, inRange } = useScope()
  const [editing, setEditing] = useState<Discount | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Discount | null>(null)
  const [status, setStatus] = useState<PromoStatus | 'all'>('all')

  const targetName = (d: Pick<Discount, 'scope' | 'targetId'>) =>
    d.scope === 'order'
      ? 'Whole order'
      : d.scope === 'category'
        ? (categories?.find((c) => c.id === d.targetId)?.name ?? 'Removed category')
        : (products?.find((p) => p.id === d.targetId)?.name ?? 'Removed item')

  const rows = useMemo(() => (data ?? []).filter((d) => status === 'all' || promoStatus(d) === status), [data, status])

  const stats = useMemo(() => {
    const list = data ?? []
    const discounted = inRange(inBranch(orders ?? []), (o) => o.createdAt).filter((o) => o.status !== 'cancelled' && o.discount > 0)
    return {
      live: list.filter((d) => promoStatus(d) === 'live').length,
      codes: list.filter((d) => d.code && promoStatus(d) === 'live').length,
      redemptions: list.reduce((s, d) => s + d.used, 0),
      given: discounted.reduce((s, o) => s + o.discount, 0),
      orders: discounted.length,
    }
  }, [data, orders, inBranch, inRange])

  const columns = useMemo<ColumnDef<Discount, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            {row.original.code ? (
              <Badge variant="outline" className="mt-1 font-mono text-[11px] tracking-wide">
                {row.original.code}
              </Badge>
            ) : (
              <p className="text-xs text-muted-foreground">Applied by staff at the POS</p>
            )}
          </div>
        ),
      },
      {
        id: 'offer',
        header: 'Offer',
        accessorFn: (d) => describeDiscount(d),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-primary">{describeDiscount(row.original)}</p>
            {row.original.minOrder > 0 && <p className="text-xs text-muted-foreground">Min. spend {formatCurrency(row.original.minOrder)}</p>}
          </div>
        ),
      },
      { id: 'appliesTo', header: 'Applies to', accessorFn: (d) => targetName(d), cell: ({ row }) => targetName(row.original) },
      {
        id: 'when',
        header: 'When',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-sm">
            <p>{describeSchedule(row.original)}</p>
            <p className="text-xs text-muted-foreground">
              {td(`channel.${row.original.channel}`)} · {row.original.branchId === 'all' ? t('shell.allBranches') : branchName(row.original.branchId)}
            </p>
          </div>
        ),
      },
      {
        id: 'usage',
        header: 'Used',
        accessorFn: (d) => d.used,
        cell: ({ row }) => {
          const { used, usageLimit } = row.original
          return (
            <div className="w-28">
              <p className="text-sm tabular-nums">
                {formatNumber(used)}
                <span className="text-muted-foreground"> / {usageLimit ? formatNumber(usageLimit) : '∞'}</span>
              </p>
              {usageLimit > 0 && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (used / usageLimit) * 100)}%` }} />
                </div>
              )}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: t('common.status'),
        accessorFn: (d) => promoStatus(d),
        cell: ({ row }) => {
          const s = PROMO_STATUS[promoStatus(row.original)]
          return <StatusBadge status={promoStatus(row.original)} label={s.label} tone={s.tone} />
        },
      },
      {
        accessorKey: 'active',
        header: t('common.active'),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={row.original.active}
              aria-label={`${t('common.active')}: ${row.original.name}`}
              onCheckedChange={(v) => update(row.original.id, { active: v })}
            />
          </div>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: t('common.edit'), onSelect: () => setEditing(row.original) },
              {
                label: 'Duplicate',
                onSelect: async () => {
                  const { id: _id, ...copy } = row.original
                  await create({ ...copy, name: `${copy.name} (copy)`, code: copy.code ? `${copy.code}2` : '', used: 0, active: false })
                  toast.success(t('common.created'))
                },
              },
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, categories, products],
  )

  const current = editing && editing !== 'new' ? editing : NEW_DISCOUNT
  const target = (d: Pick<Discount, 'scope' | 'targetId'>) => (d.scope === 'order' ? 'order' : `${d.scope}:${d.targetId}`)

  const initial: FormValues = {
    name: current.name,
    code: current.code,
    kind: current.kind,
    value: current.value,
    maxAmount: current.maxAmount,
    minOrder: current.minOrder,
    target: target(current),
    usageLimit: current.usageLimit,
    ...scheduleValues(current),
  }

  const parse = (v: FormValues) => {
    const [scope, targetId] = String(v.target).split(':') as [DiscountScope, string | undefined]
    const kind = v.kind === 'fixed' ? 'fixed' : 'percent'
    return {
      name: String(v.name).trim(),
      code: String(v.code).trim().toUpperCase().replace(/\s+/g, ''),
      kind,
      value: Math.max(0, kind === 'percent' ? Math.min(100, Number(v.value)) : Number(v.value)),
      maxAmount: Math.max(0, Number(v.maxAmount) || 0),
      minOrder: Math.max(0, Number(v.minOrder) || 0),
      scope,
      targetId: targetId ?? null,
      usageLimit: Math.max(0, Math.round(Number(v.usageLimit) || 0)),
      ...scheduleFromValues(v, current.days),
    } satisfies Omit<Discount, 'id' | 'used'>
  }

  const save = async (v: FormValues) => {
    const patch = parse(v)
    if (patch.code && (data ?? []).some((d) => d.code === patch.code && d.id !== (editing !== 'new' ? editing?.id : undefined))) {
      toast.error(`Promo code ${patch.code} is already used by another discount`)
      return false
    }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create({ ...patch, used: 0 })
      toast.success(t('common.created'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('promo.discountsTitle')}
        description={t('promo.discountsSubtitle')}
        actions={
          <>
            <Button variant="outline" render={<Link href="/promotions/deals" />} nativeButton={false}>
              <GiftIcon data-icon="inline-start" />
              {t('nav.deals')}
            </Button>
            <Button onClick={() => setEditing('new')}>
              <PlusIcon data-icon="inline-start" />
              {t('promo.addDiscount')}
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Live now" value={formatNumber(stats.live)} icon={BadgePercentIcon} tone="success" />
        <StatCard label="Active promo codes" value={formatNumber(stats.codes)} icon={TicketIcon} />
        <StatCard label="Times redeemed" value={formatNumber(stats.redemptions)} icon={GiftIcon} hint="All time, across all discounts" />
        <StatCard
          label="Discount given"
          value={formatCompactCurrency(stats.given)}
          icon={WalletIcon}
          tone="warning"
          hint={`${formatNumber(stats.orders)} discounted orders in this period`}
        />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="discounts"
        exportRows={(r) =>
          r.map((d) => ({
            name: d.name,
            code: d.code,
            offer: describeDiscount(d),
            minSpend: d.minOrder,
            appliesTo: targetName(d),
            schedule: describeSchedule(d),
            channel: d.channel,
            used: d.used,
            limit: d.usageLimit,
            status: PROMO_STATUS[promoStatus(d)].label,
          }))
        }
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
        filters={
          <OptionSelect
            className="h-9 w-40"
            value={status}
            onValueChange={(v) => setStatus(v as PromoStatus | 'all')}
            aria-label={t('common.status')}
            options={[
              { value: 'all', label: `${t('common.status')}: ${t('common.all')}` },
              ...Object.entries(PROMO_STATUS).map(([value, s]) => ({ value, label: s.label })),
            ]}
          />
        }
      />
      </div>
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('promo.addDiscount') : t('common.edit')}
        fields={[
          { name: 'name', label: t('common.name'), required: true, wide: true, placeholder: 'e.g. Burger happy hour' },
          {
            name: 'kind',
            label: 'Type',
            type: 'select',
            options: [
              { value: 'percent', label: 'Percentage off' },
              { value: 'fixed', label: 'Fixed amount off (Rs)' },
            ],
          },
          { name: 'value', label: 'Amount (% or Rs)', type: 'number', required: true },
          {
            name: 'target',
            label: 'Applies to',
            type: 'select',
            wide: true,
            options: [
              { value: 'order', label: 'Whole order' },
              ...(categories ?? []).map((c) => ({ value: `category:${c.id}`, label: `Category: ${c.name}` })),
              ...(products ?? []).map((p) => ({ value: `product:${p.id}`, label: `Item: ${p.name}` })),
            ],
          },
          { name: 'minOrder', label: 'Minimum spend (Rs)', type: 'number' },
          { name: 'maxAmount', label: 'Max discount, % only (0 = no cap)', type: 'number' },
          { name: 'code', label: 'Promo code (optional)', placeholder: 'e.g. WELCOME10' },
          { name: 'usageLimit', label: 'Usage limit (0 = unlimited)', type: 'number' },
          ...scheduleFields(td, current.days),
        ]}
        initial={initial}
        onSubmit={save}
        preview={(v) => {
          const d = parse(v)
          return (
            <div className="rounded-lg bg-muted/60 p-3 text-sm">
              <p className="font-medium">
                {describeDiscount(d)} · {targetName(d)}
                {d.minOrder > 0 && ` · min. spend ${formatCurrency(d.minOrder)}`}
              </p>
              <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
                {describeSchedule(d)} · {td(`channel.${d.channel}`)}
                {d.code ? ` · code ${d.code}` : ' · applied by staff at the POS'}. Deals are never discounted again.
              </p>
            </div>
          )
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.deleteTitle')}
        description={t('common.deleteBody')}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          if (deleting) await remove(deleting.id)
          toast.success(t('common.deleted'))
        }}
      />
    </>
  )
}
