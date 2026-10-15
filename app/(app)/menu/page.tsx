'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FieldDef, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { useCategories, useMenuGroups, useProducts } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/utils/format'
import { currentBranchIds } from '@/mocks/branches'
import type { Product } from '@/types'

export default function MenuPage() {
  const { t } = useT()
  const { data: products, isLoading, create, update, remove, removeMany } = useProducts()
  const { data: categories } = useCategories()
  const { data: groups, update: updateGroup } = useMenuGroups()
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [category, setCategory] = useState('all')

  const catName = (id: string) => categories?.find((c) => c.id === id)?.name ?? '-'
  const rows = useMemo(() => (products ?? []).filter((p) => (category === 'all' ? true : p.categoryId === category)), [products, category])

  const fields: FieldDef[] = [
    { name: 'name', label: t('common.name'), required: true, wide: true },
    { name: 'sku', label: 'SKU', required: true },
    { name: 'categoryId', label: t('common.category'), type: 'select', required: true, options: (categories ?? []).map((c) => ({ value: c.id, label: c.name })) },
    { name: 'basePrice', label: t('menu.price'), type: 'number', required: true },
    { name: 'costPrice', label: t('menu.cost'), type: 'number', required: true },
    { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
    { name: 'available', label: t('menu.available'), type: 'switch' },
    { name: 'featured', label: t('menu.featured'), type: 'switch' },
  ]

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
              <Image src={row.original.image} alt="" fill sizes="40px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.sku}</p>
            </div>
          </div>
        ),
      },
      { id: 'category', header: t('common.category'), accessorFn: (r) => catName(r.categoryId) },
      { accessorKey: 'basePrice', header: t('menu.price'), cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.basePrice)}</span> },
      {
        id: 'margin',
        header: t('menu.margin'),
        accessorFn: (r) => Math.round(((r.basePrice - r.costPrice) / r.basePrice) * 100),
        cell: ({ row }) => <span className="tabular-nums">{Math.round(((row.original.basePrice - row.original.costPrice) / row.original.basePrice) * 100)}%</span>,
      },
      {
        id: 'dietary',
        header: t('menu.dietary'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.dietary.map((d) => (
              <Badge key={d} variant="outline" className="capitalize">
                {d}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'available',
        header: t('menu.available'),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={row.original.available}
              aria-label={`${t('menu.available')}: ${row.original.name}`}
              onCheckedChange={(v) => update(row.original.id, { available: v })}
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
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, categories],
  )

  const initial: FormValues =
    editing && editing !== 'new'
      ? {
          name: editing.name,
          sku: editing.sku,
          categoryId: editing.categoryId,
          basePrice: editing.basePrice,
          costPrice: editing.costPrice,
          description: editing.description,
          available: editing.available,
          featured: editing.featured,
        }
      : { name: '', sku: '', categoryId: categories?.[0]?.id ?? '', basePrice: 0, costPrice: 0, description: '', available: true, featured: false }

  const save = async (v: FormValues) => {
    const patch = {
      name: String(v.name),
      sku: String(v.sku),
      categoryId: String(v.categoryId),
      basePrice: Number(v.basePrice),
      costPrice: Number(v.costPrice),
      description: String(v.description),
      available: !!v.available,
      featured: !!v.featured,
    }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      const cat = categories?.find((c) => c.id === patch.categoryId)
      await create({
        ...patch,
        image: cat?.image ?? '/food/burgers.jpg',
        taxClass: 'standard',
        dietary: [],
        variants: [],
        addons: [],
        ingredients: [],
        branchIds: currentBranchIds,
        menuId: groups?.[0]?.id ?? '',
        schedule: 'all-day',
      })
      toast.success(t('common.created'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('menu.title')}
        description={t('menu.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('menu.addProduct')}
          </Button>
        }
      />
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">{t('menu.products')}</TabsTrigger>
          <TabsTrigger value="categories">{t('menu.categories')}</TabsTrigger>
          <TabsTrigger value="menus">{t('menu.menus')}</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            exportName="menu"
            exportRows={(r) => r.map((p) => ({ name: p.name, sku: p.sku, category: catName(p.categoryId), price: p.basePrice, cost: p.costPrice, available: p.available }))}
            onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
            filters={
              <OptionSelect
                className="h-9 w-44"
                value={category}
                onValueChange={setCategory}
                aria-label={t('common.category')}
                options={[{ value: 'all', label: `${t('common.category')}: ${t('common.all')}` }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
              />
            }
          />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(categories ?? []).map((c) => {
              const count = (products ?? []).filter((p) => p.categoryId === c.id).length
              return (
                <Card key={c.id} className="overflow-hidden pt-0">
                  <div className="relative aspect-[16/7] bg-muted">
                    <Image src={c.image} alt="" fill sizes="(min-width:1024px) 30vw, 90vw" className="object-cover" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <CardDescription>
                      {count} {t('menu.products').toLowerCase()}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </TabsContent>
        <TabsContent value="menus" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(groups ?? []).map((g) => (
              <Card key={g.id}>
                <CardHeader>
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  <CardDescription>{g.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(products ?? []).filter((p) => p.menuId === g.id).length} {t('menu.products').toLowerCase()}
                  </span>
                  <Switch
                    checked={g.active}
                    aria-label={`${g.name} ${t('menu.available')}`}
                    onCheckedChange={(v) => updateGroup(g.id, { active: v })}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('menu.addProduct') : t('common.edit')}
        fields={fields}
        initial={initial}
        onSubmit={save}
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
