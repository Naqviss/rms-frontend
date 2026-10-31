'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangleIcon, ClipboardCheckIcon, PercentIcon, TrophyIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { RecipeEditor, type RecipeDraft } from '@/components/costing/recipe-editor'
import { useAccess } from '@/hooks/use-access'
import { useProducts, useRecipes } from '@/hooks/use-data'
import { useUnitCosts } from '@/hooks/use-unit-costs'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { recipeCost, suggestedPrice, type CostSource } from '@/lib/utils/costing'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/format'
import { categories } from '@/mocks/menu'
import { useCostingStore } from '@/stores/costing-store'
import type { Product } from '@/types'

interface CostRow {
  id: string
  name: string
  image: string
  category: string
  price: number
  cost: number
  source: CostSource
  costPct: number
  profit: number
  margin: number
  suggested: number
}

type Filter = 'all' | 'costed' | 'estimate' | 'over'

const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Menu item'

export default function CostingPage() {
  const { t } = useT()
  const { can } = useAccess()
  const { products, recipes, catalog, unitCosts, isLoading } = useUnitCosts()
  const { update: updateProduct } = useProducts()
  const { create: createRecipe, update: updateRecipe, remove: removeRecipe } = useRecipes()
  const targetCostPct = useCostingStore((s) => s.targetCostPct)
  const setTargetCostPct = useCostingStore((s) => s.setTargetCostPct)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Product | null>(null)

  const rows = useMemo<CostRow[]>(
    () =>
      products.map((p) => {
        const unit = unitCosts.get(p.id) ?? { cost: p.costPrice, source: 'menu' as const }
        const profit = p.basePrice - unit.cost
        return {
          id: p.id,
          name: p.name,
          image: p.image,
          category: categoryName(p.categoryId),
          price: p.basePrice,
          cost: unit.cost,
          source: unit.source,
          costPct: p.basePrice ? (unit.cost / p.basePrice) * 100 : 0,
          profit,
          margin: p.basePrice ? (profit / p.basePrice) * 100 : 0,
          suggested: suggestedPrice(unit.cost, targetCostPct),
        }
      }),
    [products, unitCosts, targetCostPct],
  )

  const visible = useMemo(
    () =>
      rows.filter((r) =>
        filter === 'costed' ? r.source === 'recipe' : filter === 'estimate' ? r.source === 'menu' : filter === 'over' ? r.costPct > targetCostPct : true,
      ),
    [rows, filter, targetCostPct],
  )

  const stats = useMemo(() => {
    const costed = rows.filter((r) => r.source === 'recipe')
    const avg = rows.length ? rows.reduce((s, r) => s + r.costPct, 0) / rows.length : 0
    const over = rows.filter((r) => r.costPct > targetCostPct)
    const best = [...rows].sort((a, b) => b.profit - a.profit)[0]
    return { costed: costed.length, avg, over, best }
  }, [rows, targetCostPct])

  const columns = useMemo<ColumnDef<CostRow, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Item',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image src={row.original.image} alt="" fill className="object-cover" sizes="32px" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.category}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: 'price', header: 'Price', cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.price)}</span> },
      {
        accessorKey: 'cost',
        header: 'Cost / serving',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums">{formatCurrency(row.original.cost)}</span>
            {row.original.source === 'recipe' ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                Costed
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                Estimate
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'costPct',
        header: 'Cost %',
        cell: ({ row }) => (
          <span className={cn('tabular-nums', row.original.costPct > targetCostPct ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            {formatPercent(row.original.costPct)}
          </span>
        ),
      },
      {
        accessorKey: 'profit',
        header: 'Profit / serving',
        cell: ({ row }) => <span className="font-medium text-success tabular-nums">{formatCurrency(row.original.profit)}</span>,
      },
      { accessorKey: 'margin', header: 'Margin', cell: ({ row }) => <span className="tabular-nums">{formatPercent(row.original.margin)}</span> },
      {
        accessorKey: 'suggested',
        header: `Price at ${formatPercent(targetCostPct)}`,
        cell: ({ row }) => {
          const gap = row.original.suggested - row.original.price
          return (
            <div className="tabular-nums">
              <p>{formatCurrency(row.original.suggested)}</p>
              {gap > 0 && <p className="text-[11px] text-destructive">+{formatCurrency(gap)} needed</p>}
            </div>
          )
        },
      },
      {
        id: 'actions',
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant={row.original.source === 'recipe' ? 'outline' : 'default'}
            onClick={(e) => {
              e.stopPropagation()
              setEditing(products.find((p) => p.id === row.original.id) ?? null)
            }}
          >
            {row.original.source === 'recipe' ? 'Edit costing' : 'Add costing'}
          </Button>
        ),
      },
    ],
    [t, targetCostPct, products],
  )

  const editingRecipe = editing ? (recipes.find((r) => r.productId === editing.id) ?? null) : null

  const save = async (draft: RecipeDraft) => {
    if (!editing) return
    const record = { ...draft, productId: editing.id, updatedAt: new Date().toISOString().slice(0, 19) }
    if (editingRecipe) await updateRecipe(editingRecipe.id, record)
    else await createRecipe({ ...record, id: editing.id })
    // Keep the menu's cost field in step so menu margins match the costing sheet.
    const total = recipeCost(draft, new Map(catalog.map((c) => [c.sku, c]))).total
    await updateProduct(editing.id, { costPrice: Math.round(total) })
    toast.success(`${editing.name} costed at ${formatCurrency(total)} per serving`)
    setEditing(null)
  }

  return (
    <>
      <PageHeader
        title={t('costing.title')}
        description={t('costing.subtitle')}
        actions={
          <>
            <InputGroup className="h-9 w-56">
              <InputGroupAddon>
                <InputGroupText>Target cost</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                type="number"
                min={10}
                max={80}
                step={1}
                aria-label="Target cost percent of price"
                value={targetCostPct}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) setTargetCostPct(Math.min(80, Math.max(10, v)))
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <Button variant="outline" render={<Link href="/finance/item-profit" />} nativeButton={false}>
              <TrophyIcon data-icon="inline-start" />
              {t('nav.itemProfit')}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Items costed"
              value={`${stats.costed} / ${rows.length}`}
              icon={ClipboardCheckIcon}
              tone="primary"
              hint={stats.costed < rows.length ? `${rows.length - stats.costed} still use the menu estimate` : 'Every item has a costing sheet'}
            />
            <StatCard label="Average cost %" value={formatPercent(stats.avg, 1)} icon={PercentIcon} tone="delivery" hint={`Target ${formatPercent(targetCostPct)}`} />
            <StatCard
              label="Over target"
              value={formatNumber(stats.over.length)}
              icon={AlertTriangleIcon}
              tone={stats.over.length ? 'danger' : 'success'}
              hint={stats.over[0] ? `Worst: ${[...stats.over].sort((a, b) => b.costPct - a.costPct)[0].name}` : 'All items within target'}
            />
            <StatCard
              label="Most profit per serving"
              value={stats.best ? formatCurrency(stats.best.profit) : '—'}
              icon={WalletIcon}
              tone="success"
              hint={stats.best?.name}
            />
          </div>

          <DataTable
            columns={columns}
            data={visible}
            exportName="item-costing"
            initialSort={[{ id: 'costPct', desc: true }]}
            onRowClick={(r) => setEditing(products.find((p) => p.id === r.id) ?? null)}
            exportRows={(r) =>
              r.map((x) => ({
                item: x.name,
                price: x.price,
                costPerServing: Math.round(x.cost),
                source: x.source,
                costPct: Math.round(x.costPct * 10) / 10,
                profitPerServing: Math.round(x.profit),
                suggestedPrice: x.suggested,
              }))
            }
            filters={
              <OptionSelect
                className="h-9 w-48"
                value={filter}
                onValueChange={(v) => setFilter(v as Filter)}
                aria-label="Filter items"
                options={[
                  { value: 'all', label: 'All items' },
                  { value: 'costed', label: 'Costed' },
                  { value: 'estimate', label: 'Not costed yet' },
                  { value: 'over', label: `Over ${formatPercent(targetCostPct)} target` },
                ]}
              />
            }
          />
        </div>
      )}

      <RecipeEditor
        product={editing}
        recipe={editingRecipe}
        catalog={catalog}
        targetCostPct={targetCostPct}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={save}
        maskSecrets={!can('recipes', 'edit')}
        onRemove={async () => {
          if (!editingRecipe || !editing) return
          if (editingRecipe.method?.length) {
            toast.error(`${editing.name} has a full recipe in the Recipe Book. Delete it there instead.`)
            return
          }
          await removeRecipe(editingRecipe.id)
          toast.success(`Costing removed; ${editing.name} uses the menu cost again`)
          setEditing(null)
        }}
        onApplyPrice={async (price) => {
          if (!editing) return
          const next = await updateProduct(editing.id, { basePrice: price })
          setEditing(next)
          toast.success(`${editing.name} menu price set to ${formatCurrency(price)}`)
        }}
      />
    </>
  )
}
