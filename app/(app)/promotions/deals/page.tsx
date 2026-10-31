'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BadgePercentIcon, GiftIcon, PlusIcon, SearchIcon, ShoppingBagIcon, StarIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { DealItemsEditor } from '@/components/promotions/deal-items-editor'
import { NEW_SCHEDULE, scheduleFields, scheduleFromValues, scheduleValues } from '@/components/promotions/schedule-fields'
import { useCategories, useDeals, useProducts } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format'
import { dealValue, describeSchedule, PROMO_STATUS, promoStatus, type PromoStatus } from '@/lib/utils/promotions'
import type { Deal, DealItem, Product } from '@/types'

/** Margin below this share of the deal price is flagged, since combos are already discounted. */
const THIN_MARGIN = 45

const NEW_DEAL: Omit<Deal, 'id'> = {
  ...NEW_SCHEDULE,
  name: '',
  description: '',
  image: '/food/burgers.png',
  items: [],
  price: 0,
  featured: false,
  sold: 0,
}

function DealCard({
  deal,
  products,
  onToggle,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  deal: Deal
  products: Product[]
  onToggle: (active: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const v = dealValue(deal, products)
  const status = promoStatus(deal)
  return (
    <Card className={cn('overflow-hidden pt-0', status !== 'live' && 'opacity-80')}>
      <div className="relative aspect-[16/8] bg-muted">
        <Image src={deal.image} alt="" fill sizes="(min-width:1280px) 30vw, (min-width:640px) 45vw, 90vw" className="object-cover" />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <StatusBadge status={status} label={PROMO_STATUS[status].label} tone={PROMO_STATUS[status].tone} className="bg-background/90 backdrop-blur" />
          {deal.featured && (
            <Badge className="gap-1">
              <StarIcon data-icon="inline-start" />
              Featured
            </Badge>
          )}
        </div>
        {v.saving > 0 && (
          <span className="absolute end-2 bottom-2 rounded-md bg-success px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
            Save {formatPercent(v.savingPct)}
          </span>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{deal.name}</h3>
            {deal.description && <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">{deal.description}</p>}
          </div>
          <div className="-me-2 -mt-1 shrink-0">
            <RowActions
              actions={[
                { label: 'Edit', onSelect: onEdit },
                { label: 'Duplicate', onSelect: onDuplicate },
                { label: 'Delete', destructive: true, onSelect: onDelete },
              ]}
            />
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {deal.items.map((i) => (
            <li key={i.productId} className="rounded-md bg-muted px-2 py-0.5 text-xs">
              <span className="font-semibold tabular-nums">{i.quantity}×</span> {products.find((p) => p.id === i.productId)?.name ?? 'Removed item'}
            </li>
          ))}
        </ul>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums">{formatCurrency(deal.price)}</span>
          {v.regular > deal.price && <span className="text-sm text-muted-foreground tabular-nums line-through">{formatCurrency(v.regular)}</span>}
        </div>
        <dl className="mt-auto grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
          <div>
            <dt className="text-[11px] text-muted-foreground">Margin</dt>
            <dd className={cn('text-sm font-semibold tabular-nums', v.margin < THIN_MARGIN ? 'text-warning-foreground dark:text-warning' : 'text-success')}>
              {formatPercent(v.margin)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Sold</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatNumber(deal.sold)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground">Revenue</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatCompactCurrency(deal.sold * deal.price)}</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3 border-t text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{describeSchedule(deal)}</span>
        <Switch checked={deal.active} onCheckedChange={onToggle} aria-label={`Active: ${deal.name}`} />
      </CardFooter>
    </Card>
  )
}

export default function DealsPage() {
  const { t, td } = useT()
  const { data, isLoading, create, update, remove } = useDeals()
  const { data: productData } = useProducts()
  const { data: categories } = useCategories()
  const products = useMemo(() => productData ?? [], [productData])
  const [editing, setEditing] = useState<Deal | 'new' | null>(null)
  const [items, setItems] = useState<DealItem[]>([])
  const [deleting, setDeleting] = useState<Deal | null>(null)
  const [status, setStatus] = useState<PromoStatus | 'all'>('all')
  const [query, setQuery] = useState('')

  const deals = useMemo(
    () =>
      (data ?? [])
        .filter((d) => status === 'all' || promoStatus(d) === status)
        .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(b.featured) - Number(a.featured) || b.sold - a.sold),
    [data, status, query],
  )

  const stats = useMemo(() => {
    const list = data ?? []
    const live = list.filter((d) => promoStatus(d) === 'live')
    const savings = live.map((d) => dealValue(d, products).savingPct)
    return {
      live: live.length,
      sold: list.reduce((s, d) => s + d.sold, 0),
      revenue: list.reduce((s, d) => s + d.sold * d.price, 0),
      avgSaving: savings.length ? savings.reduce((s, x) => s + x, 0) / savings.length : 0,
    }
  }, [data, products])

  const open = (d: Deal | 'new') => {
    setItems(d === 'new' ? [] : d.items)
    setEditing(d)
  }

  const current = editing && editing !== 'new' ? editing : NEW_DEAL
  const initial: FormValues = {
    name: current.name,
    description: current.description,
    price: current.price,
    image: current.image,
    featured: current.featured,
    ...scheduleValues(current),
  }

  const save = async (v: FormValues) => {
    if (items.length === 0) {
      toast.error('Add at least one item to the deal')
      return false
    }
    const patch = {
      name: String(v.name).trim(),
      description: String(v.description).trim(),
      price: Math.max(0, Number(v.price) || 0),
      image: String(v.image),
      featured: !!v.featured,
      items,
      ...scheduleFromValues(v, current.days),
    }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create({ ...patch, sold: 0 })
      toast.success(t('common.created'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('promo.dealsTitle')}
        description={t('promo.dealsSubtitle')}
        actions={
          <>
            <Button variant="outline" render={<Link href="/promotions" />} nativeButton={false}>
              <BadgePercentIcon data-icon="inline-start" />
              {t('nav.discounts')}
            </Button>
            <Button onClick={() => open('new')}>
              <PlusIcon data-icon="inline-start" />
              {t('promo.addDeal')}
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Live deals" value={formatNumber(stats.live)} icon={GiftIcon} tone="success" />
        <StatCard label="Deals sold" value={formatNumber(stats.sold)} icon={ShoppingBagIcon} hint="All time" />
        <StatCard label="Deal revenue" value={formatCompactCurrency(stats.revenue)} icon={WalletIcon} />
        <StatCard label="Avg. customer saving" value={formatPercent(stats.avgSaving)} icon={BadgePercentIcon} hint="Across live deals vs. menu prices" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.searchPlaceholder')} aria-label={t('common.search')} />
        </InputGroup>
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
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GiftIcon />
            </EmptyMedia>
            <EmptyTitle>{t('common.noResults')}</EmptyTitle>
            <EmptyDescription>{t('common.noResultsHint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              products={products}
              onToggle={(active) => update(d.id, { active })}
              onEdit={() => open(d)}
              onDuplicate={async () => {
                const { id: _id, ...copy } = d
                await create({ ...copy, name: `${copy.name} (copy)`, sold: 0, active: false, featured: false })
                toast.success(t('common.created'))
              }}
              onDelete={() => setDeleting(d)}
            />
          ))}
        </div>
      )}
      </div>

      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('promo.addDeal') : t('common.edit')}
        fields={[
          { name: 'name', label: t('common.name'), required: true, placeholder: 'e.g. Family Feast' },
          { name: 'price', label: 'Deal price (Rs)', type: 'number', required: true },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
          {
            name: 'image',
            label: 'Picture',
            type: 'select',
            options: (categories ?? []).map((c) => ({ value: c.image, label: c.name })),
          },
          { name: 'featured', label: 'Featured', type: 'switch' },
          ...scheduleFields(td, current.days),
        ]}
        initial={initial}
        onSubmit={save}
        preview={(v) => {
          const value = dealValue({ items, price: Number(v.price) || 0 }, products)
          return (
            <div className="flex flex-col gap-4">
              <DealItemsEditor items={items} products={products} onChange={setItems} />
              <dl className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-3 text-sm sm:grid-cols-4">
                {[
                  { label: 'Menu price', value: formatCurrency(value.regular) },
                  { label: 'Customer saves', value: `${formatCurrency(Math.max(0, value.saving))} (${formatPercent(Math.max(0, value.savingPct))})` },
                  { label: 'Item cost', value: formatCurrency(value.cost) },
                  { label: 'Margin', value: formatPercent(value.margin), warn: value.margin < THIN_MARGIN },
                ].map((r) => (
                  <div key={r.label}>
                    <dt className="text-[11px] text-muted-foreground">{r.label}</dt>
                    <dd className={cn('font-semibold tabular-nums', r.warn && 'text-warning-foreground dark:text-warning')}>{r.value}</dd>
                  </div>
                ))}
              </dl>
              {value.saving < 0 && <p className="text-xs text-destructive">The deal costs more than buying the items separately.</p>}
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
