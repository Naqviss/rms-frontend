'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { ColumnDef } from '@tanstack/react-table'
import { BookOpenCheckIcon, ClockIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon, LockKeyholeOpenIcon, PlusIcon, SearchIcon, SettingsIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/common/data-table'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { StatCard } from '@/components/common/stat-card'
import { RecipeSheet, type RecipeBookDraft } from '@/components/recipes/recipe-sheet'
import { VaultSettingsDialog, VaultUnlockDialog, VaultWelcome } from '@/components/recipes/vault-dialogs'
import { useAccess } from '@/hooks/use-access'
import { useProducts, useRecipeAccess, useRecipes } from '@/hooks/use-data'
import { useUnitCosts } from '@/hooks/use-unit-costs'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { recipeCost } from '@/lib/utils/costing'
import { formatDateTime, formatNumber } from '@/lib/utils/format'
import { canOpenRecipe, formatQuantity, ingredientName, kitchenCardHtml, recipeStatus, secretCodes, visibilityLabel, type RecipeStatus } from '@/lib/utils/recipes'
import { categories } from '@/mocks/menu'
import { appUsers } from '@/mocks/platform'
import { isVaultOpen, useRecipeVault } from '@/stores/recipe-vault-store'
import type { Product, RecipeAccessAction, RecipeAccessEvent } from '@/types'

const statusLabel: Record<RecipeStatus, string> = { complete: 'Full recipe', costing: 'Costing only', none: 'No recipe' }

const actionLabel: Record<RecipeAccessAction, { label: string; tone: string }> = {
  viewed: { label: 'Opened', tone: 'bg-primary/10 text-primary' },
  edited: { label: 'Edited', tone: 'bg-success/15 text-success' },
  printed: { label: 'Printed', tone: 'bg-warning/20 text-warning-foreground dark:text-warning' },
  unlocked: { label: 'Unlocked vault', tone: 'bg-muted text-muted-foreground' },
  'unlock-failed': { label: 'Wrong PIN', tone: 'bg-destructive/10 text-destructive' },
}

export default function RecipeBookPage() {
  const { t, td } = useT()
  const { role, can } = useAccess()
  const isOwner = can('recipes', 'edit')
  const { products, recipes, catalog, isLoading } = useUnitCosts()
  const { update: updateProduct } = useProducts()
  const { create: createRecipe, update: updateRecipe } = useRecipes()
  const { data: accessLog, create: createAccessEvent } = useRecipeAccess()

  const welcomed = useRecipeVault((s) => s.welcomed)
  const pinHash = useRecipeVault((s) => s.pinHash)
  const unlockedUntil = useRecipeVault((s) => s.unlockedUntil)
  const autoLockMinutes = useRecipeVault((s) => s.autoLockMinutes)
  const lockVault = useRecipeVault((s) => s.lock)
  const touch = useRecipeVault((s) => s.touch)

  const [now, setNow] = useState(() => Date.now())
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [welcomeDone, setWelcomeDone] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | RecipeStatus>('all')
  const [category, setCategory] = useState('all')

  const vaultOpen = isVaultOpen({ pinHash, unlockedUntil }, now)
  const userName = appUsers.find((u) => u.role === role)?.name ?? td(`role.${role}`)
  const viewerLabel = `${userName} (${td(`role.${role}`)})`

  // Re-check the auto-lock deadline so the vault closes on its own while the page sits open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (isOwner && openId && !vaultOpen) {
      setOpenId(null)
      toast.info(`Recipe vault locked after ${autoLockMinutes} min without activity`)
    }
  }, [isOwner, openId, vaultOpen, autoLockMinutes])

  const log = useCallback(
    (action: RecipeAccessAction, product: Pick<Product, 'id' | 'name'> | null) =>
      void createAccessEvent({
        recipeId: product?.id ?? null,
        itemName: product?.name ?? 'Recipe vault',
        userName,
        role,
        action,
        at: new Date().toISOString().slice(0, 19),
      }),
    [createAccessEvent, userName, role],
  )

  const recipeByProduct = useMemo(() => new Map(recipes.map((r) => [r.productId, r])), [recipes])
  const bySku = useMemo(() => new Map(catalog.map((c) => [c.sku, c])), [catalog])

  // Staff only ever see finished recipes the owner shared with their role.
  const allowed = useMemo(
    () =>
      products.filter((p) => {
        if (isOwner) return true
        const r = recipeByProduct.get(p.id)
        return recipeStatus(r) === 'complete' && canOpenRecipe(r!, role, false)
      }),
    [products, recipeByProduct, isOwner, role],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allowed.filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (category === 'all' || p.categoryId === category) &&
        (status === 'all' || recipeStatus(recipeByProduct.get(p.id)) === status),
    )
  }, [allowed, query, category, status, recipeByProduct])

  const stats = useMemo(() => {
    const complete = recipes.filter((r) => r.method?.length)
    const secrets = recipes.reduce((s, r) => s + r.ingredients.filter((l) => l.secret).length, 0)
    const weekAgo = new Date(now - 7 * 86_400_000).toISOString().slice(0, 19)
    const staffViews = (accessLog ?? []).filter((e) => e.role !== 'tenant-owner' && e.at >= weekAgo && (e.action === 'viewed' || e.action === 'printed'))
    const failed = (accessLog ?? []).filter((e) => e.action === 'unlock-failed' && e.at >= weekAgo)
    return { complete: complete.length, secrets, staffViews: staffViews.length, failed: failed.length }
  }, [recipes, accessLog, now])

  const openRecipe = (product: Product) => {
    if (isOwner && !vaultOpen) {
      setPendingId(product.id)
      setUnlockOpen(true)
      return
    }
    setOpenId(product.id)
    if (recipeByProduct.get(product.id)?.method?.length) log('viewed', product)
  }

  const openProduct = products.find((p) => p.id === openId) ?? null
  const openRecipeRecord = openId ? recipeByProduct.get(openId) : undefined

  const save = async (draft: RecipeBookDraft) => {
    if (!openProduct) return
    const record = {
      ...draft,
      productId: openProduct.id,
      updatedAt: new Date().toISOString().slice(0, 19),
      updatedBy: userName,
      version: (openRecipeRecord?.version ?? 0) + 1,
    }
    if (openRecipeRecord) await updateRecipe(openRecipeRecord.id, record)
    else await createRecipe({ ...record, id: openProduct.id })
    // Ingredients are shared with Item Costing, so keep the menu cost in step the same way it does.
    await updateProduct(openProduct.id, { costPrice: Math.round(recipeCost(draft, bySku).total) })
    log('edited', openProduct)
    toast.success(`${openProduct.name} recipe saved and locked in your vault`)
  }

  const print = (servings: number) => {
    if (!openProduct || !openRecipeRecord?.method) return
    const codes = secretCodes(openRecipeRecord.ingredients)
    const html = kitchenCardHtml({
      title: openProduct.name,
      servings,
      prepMinutes: openRecipeRecord.prepMinutes ?? 0,
      cookMinutes: openRecipeRecord.cookMinutes ?? 0,
      // Paper leaves the building, so secret names are masked even when the owner prints.
      ingredients: openRecipeRecord.ingredients.map((l) => ({
        name: l.secret ? codes.get(l.id)! : ingredientName(l, bySku),
        quantity: formatQuantity(l.quantity * servings, l.unit),
        secret: !!l.secret,
      })),
      method: openRecipeRecord.method,
      allergens: openRecipeRecord.allergens ?? [],
      watermark: `Printed by ${viewerLabel} on ${formatDateTime(new Date().toISOString())}`,
    })
    const win = window.open('', '_blank', 'width=760,height=900')
    if (!win) {
      toast.error('Allow pop-ups for this site to print the kitchen card')
      return
    }
    win.document.write(html)
    win.document.close()
    log('printed', openProduct)
  }

  const logColumns = useMemo<ColumnDef<RecipeAccessEvent, unknown>[]>(
    () => [
      { accessorKey: 'at', header: 'When', cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.original.at)}</span> },
      {
        accessorKey: 'userName',
        header: 'Who',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.userName}</p>
            <p className="text-xs text-muted-foreground">{td(`role.${row.original.role}`)}</p>
          </div>
        ),
      },
      {
        accessorKey: 'action',
        header: 'Did',
        cell: ({ row }) => {
          const a = actionLabel[row.original.action]
          return <Badge className={cn('border-transparent', a.tone)}>{a.label}</Badge>
        },
      },
      { accessorKey: 'itemName', header: 'Recipe' },
    ],
    [td],
  )

  const showWelcome = isOwner && !welcomed && !welcomeDone && !isLoading

  return (
    <div onPointerDown={touch} onKeyDown={touch}>
      <PageHeader
        title={t('recipes.title')}
        description={t('recipes.subtitle')}
        actions={
          isOwner && (
            <>
              {pinHash &&
                (vaultOpen ? (
                  <Button variant="outline" onClick={lockVault}>
                    <LockKeyholeIcon data-icon="inline-start" />
                    Lock now
                  </Button>
                ) : (
                  <Button onClick={() => setUnlockOpen(true)}>
                    <LockKeyholeOpenIcon data-icon="inline-start" />
                    Unlock vault
                  </Button>
                ))}
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <SettingsIcon data-icon="inline-start" />
                Vault settings
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                Add recipe
              </Button>
            </>
          )
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {isOwner ? (
            <>
              {!pinHash && (
                <Alert className="border-warning/60">
                  <ShieldAlertIcon />
                  <AlertTitle>Your recipes are not locked yet</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center gap-2">
                    Anyone who signs in on this device as an owner can open them. Set a vault PIN to lock them.
                    <Button size="xs" onClick={() => setSettingsOpen(true)}>
                      Set PIN
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Recipes written"
                  value={`${stats.complete} / ${products.length}`}
                  icon={BookOpenCheckIcon}
                  tone="primary"
                  hint={stats.complete < products.length ? `${products.length - stats.complete} items still need a method` : 'Every item has a recipe'}
                />
                <StatCard label="Secret ingredients" value={formatNumber(stats.secrets)} icon={EyeOffIcon} tone="delivery" hint="Hidden from staff, costing and prints" />
                <StatCard label="Staff opens · 7 days" value={formatNumber(stats.staffViews)} icon={EyeIcon} tone="takeaway" hint="Kitchen cards opened or printed" />
                <StatCard
                  label="Vault"
                  value={!pinHash ? 'No PIN' : vaultOpen ? 'Unlocked' : 'Locked'}
                  icon={vaultOpen && pinHash ? LockKeyholeOpenIcon : ShieldCheckIcon}
                  tone={!pinHash || stats.failed ? 'danger' : 'success'}
                  hint={stats.failed ? `${stats.failed} wrong PIN ${stats.failed === 1 ? 'attempt' : 'attempts'} this week` : pinHash ? `Locks after ${autoLockMinutes} min idle` : 'Set a PIN to lock'}
                />
              </div>
            </>
          ) : (
            <Alert>
              <LockKeyholeIcon />
              <AlertTitle>Recipes shared with you by the owner</AlertTitle>
              <AlertDescription>Secret ingredients show as code names such as “Secret mix A”. Use the quantity shown; the owner prepares those mixes. Every open and print is logged.</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="recipes">
            {isOwner && (
              <TabsList>
                <TabsTrigger value="recipes">Recipes</TabsTrigger>
                <TabsTrigger value="log">Access log</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="recipes" className={cn(isOwner && 'mt-4')}>
              <div className="mb-4 flex flex-wrap gap-2">
                <InputGroup className="h-9 w-full sm:w-64">
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="Search recipes" aria-label="Search recipes" value={query} onChange={(e) => setQuery(e.target.value)} />
                </InputGroup>
                <OptionSelect
                  className="h-9 w-44"
                  aria-label="Filter by category"
                  value={category}
                  onValueChange={setCategory}
                  options={[{ value: 'all', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                />
                {isOwner && (
                  <OptionSelect
                    className="h-9 w-44"
                    aria-label="Filter by recipe status"
                    value={status}
                    onValueChange={(v) => setStatus(v as typeof status)}
                    options={[{ value: 'all', label: 'Any status' }, ...(['complete', 'costing', 'none'] as const).map((s) => ({ value: s, label: statusLabel[s] }))]}
                  />
                )}
              </div>

              {visible.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <LockKeyholeIcon />
                    </EmptyMedia>
                    <EmptyTitle>{isOwner ? 'No recipes match' : 'No recipes shared with you'}</EmptyTitle>
                    <EmptyDescription>
                      {isOwner ? 'Try a different search or filter.' : 'The owner decides which recipes each role can open. Ask them if you need one.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((p) => {
                    const r = recipeByProduct.get(p.id)
                    const st = recipeStatus(r)
                    const secrets = r?.ingredients.filter((l) => l.secret).length ?? 0
                    return (
                      <li key={p.id}>
                        <Card className="h-full gap-0 py-0 transition-colors hover:border-primary/50">
                          <button type="button" className="flex h-full w-full items-start gap-3 p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openRecipe(p)}>
                            <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                              <Image src={p.image} alt="" fill className={cn('object-cover', isOwner && pinHash && !vaultOpen && 'blur-[2px]')} sizes="64px" />
                            </span>
                            <CardContent className="flex min-w-0 flex-1 flex-col gap-1.5 p-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate font-medium">{p.name}</p>
                                {isOwner && pinHash && !vaultOpen && <LockKeyholeIcon className="size-4 shrink-0 text-muted-foreground" aria-label="Locked" />}
                              </div>
                              <p className="text-xs text-muted-foreground">{categories.find((c) => c.id === p.categoryId)?.name}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isOwner && (
                                  <Badge variant={st === 'complete' ? 'secondary' : 'outline'} className={cn('h-5 px-1.5 text-[10px]', st === 'none' && 'text-muted-foreground')}>
                                    {statusLabel[st]}
                                  </Badge>
                                )}
                                {secrets > 0 && (
                                  <Badge variant="outline" className="h-5 gap-1 border-primary/40 px-1.5 text-[10px] text-primary">
                                    <EyeOffIcon className="size-3" aria-hidden />
                                    {secrets} secret
                                  </Badge>
                                )}
                                {st === 'complete' && (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <ClockIcon className="size-3" aria-hidden />
                                    {(r?.prepMinutes ?? 0) + (r?.cookMinutes ?? 0)} min
                                  </span>
                                )}
                              </div>
                              {isOwner && st === 'complete' && <p className="text-[11px] text-muted-foreground">{visibilityLabel[r?.visibility ?? 'owner']}</p>}
                              {isOwner && st !== 'complete' && (
                                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                                  <PlusIcon className="size-3.5" aria-hidden />
                                  Add recipe
                                </span>
                              )}
                            </CardContent>
                          </button>
                        </Card>
                      </li>
                    )
                  })}
                </ul>
              )}
            </TabsContent>
            {isOwner && (
              <TabsContent value="log" className="mt-4">
                <DataTable
                  columns={logColumns}
                  data={accessLog}
                  exportName="recipe-access-log"
                  initialSort={[{ id: 'at', desc: true }]}
                  exportRows={(rows) => rows.map((e) => ({ at: e.at, user: e.userName, role: e.role, action: e.action, recipe: e.itemName }))}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      <RecipeSheet
        product={openProduct}
        recipe={openRecipeRecord}
        catalog={catalog}
        isOwner={isOwner}
        viewerLabel={viewerLabel}
        onOpenChange={(o) => !o && setOpenId(null)}
        onSave={save}
        onRemoveMethod={async () => {
          if (!openRecipeRecord || !openProduct) return
          await updateRecipe(openRecipeRecord.id, { method: [], version: (openRecipeRecord.version ?? 0) + 1, updatedBy: userName })
          log('edited', openProduct)
          toast.success(`Recipe removed; ${openProduct.name} keeps its costing sheet`)
          setOpenId(null)
        }}
        onPrint={print}
      />

      <VaultWelcome open={showWelcome} onDone={() => setWelcomeDone(true)} />
      <VaultUnlockDialog
        open={unlockOpen}
        onOpenChange={(o) => {
          setUnlockOpen(o)
          if (!o) setPendingId(null)
        }}
        onResult={(ok) => {
          setNow(Date.now())
          log(ok ? 'unlocked' : 'unlock-failed', null)
          if (ok && pendingId) {
            const product = products.find((p) => p.id === pendingId)
            setOpenId(pendingId)
            if (product && recipeByProduct.get(product.id)?.method?.length) log('viewed', product)
          }
        }}
      />
      <VaultSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o)
          if (!o) setAddQuery('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a recipe</DialogTitle>
            <DialogDescription>Pick the menu item to write a recipe for. Items that already have a full recipe are not listed.</DialogDescription>
          </DialogHeader>
          <InputGroup className="h-9">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput autoFocus placeholder="Search menu items" aria-label="Search menu items" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} />
          </InputGroup>
          <ul className="-mx-1 flex max-h-80 flex-col overflow-y-auto">
            {products
              .filter((p) => recipeStatus(recipeByProduct.get(p.id)) !== 'complete' && p.name.toLowerCase().includes(addQuery.trim().toLowerCase()))
              .map((p) => {
                const st = recipeStatus(recipeByProduct.get(p.id))
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-start outline-none hover:bg-muted focus-visible:bg-muted"
                      onClick={() => {
                        setAddOpen(false)
                        setAddQuery('')
                        openRecipe(p)
                      }}
                    >
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image src={p.image} alt="" fill className="object-cover" sizes="36px" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{categories.find((c) => c.id === p.categoryId)?.name}</span>
                      </span>
                      <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px]', st === 'none' && 'text-muted-foreground')}>
                        {st === 'costing' ? 'Has costing' : 'New'}
                      </Badge>
                    </button>
                  </li>
                )
              })}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}
