'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowDownIcon, ArrowUpIcon, ClockIcon, EyeOffIcon, LockKeyholeIcon, PencilIcon, PlusIcon, PrinterIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { IngredientLines, newId, newIngredientLine } from '@/components/costing/ingredient-lines'
import { emptyDraft } from '@/components/costing/recipe-editor'
import { cn } from '@/lib/utils'
import type { CatalogItem } from '@/lib/utils/costing'
import { ALLERGENS, formatQuantity, ingredientName, secretCodes, visibilityLabel } from '@/lib/utils/recipes'
import type { Product, Recipe, RecipeVisibility } from '@/types'

export type RecipeBookDraft = Required<
  Pick<Recipe, 'ingredients' | 'extras' | 'wastagePct' | 'notes' | 'method' | 'prepMinutes' | 'cookMinutes' | 'batchServings' | 'allergens' | 'visibility'>
>

function toDraft(recipe: Recipe | undefined): RecipeBookDraft {
  const base = recipe ?? { ...emptyDraft(), method: undefined }
  return structuredClone({
    ingredients: base.ingredients,
    extras: base.extras,
    wastagePct: base.wastagePct,
    notes: base.notes,
    method: recipe?.method ?? [],
    prepMinutes: recipe?.prepMinutes ?? 0,
    cookMinutes: recipe?.cookMinutes ?? 0,
    batchServings: recipe?.batchServings ?? 1,
    allergens: recipe?.allergens ?? [],
    visibility: recipe?.visibility ?? 'owner',
  })
}

interface RecipeSheetProps {
  product: Product | null
  recipe: Recipe | undefined
  catalog: CatalogItem[]
  /** Can edit recipes and see secret ingredients; the vault is already open. */
  isOwner: boolean
  /** Name stamped across the card for staff and on prints. */
  viewerLabel: string
  onOpenChange: (open: boolean) => void
  onSave: (draft: RecipeBookDraft) => Promise<void>
  onRemoveMethod: () => Promise<void>
  onPrint: (servings: number) => void
}

export function RecipeSheet({ product, recipe, catalog, isOwner, viewerLabel, onOpenChange, onSave, onRemoveMethod, onPrint }: RecipeSheetProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RecipeBookDraft>(() => toDraft(undefined))
  const [servings, setServings] = useState(1)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const bySku = useMemo(() => new Map(catalog.map((c) => [c.sku, c])), [catalog])

  // Reset only when a different item opens, so saving does not throw the cook back to a fresh scale.
  useEffect(() => {
    if (!product) return
    setDraft(toDraft(recipe))
    setEditing(isOwner && !recipe?.method?.length)
    setServings(recipe?.batchServings ?? 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  const run = async (fn: () => Promise<void>) => {
    setSaving(true)
    try {
      await fn()
    } finally {
      setSaving(false)
    }
  }

  const canSave = draft.ingredients.length > 0 && !draft.ingredients.some((l) => !l.sku && !l.name.trim()) && draft.method.some((s) => s.text.trim())

  return (
    <Sheet open={!!product} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-2xl">
        {product && (
          <>
            <SheetHeader className="flex-row items-center gap-3 border-b pe-12">
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                <Image src={product.image} alt="" fill className="object-cover" sizes="48px" />
              </span>
              <div className="min-w-0">
                <SheetTitle className="truncate">{product.name}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-x-2">
                  {editing ? (recipe?.method?.length ? 'Editing recipe' : 'New recipe') : 'Kitchen card'}
                  {recipe?.version && <span>· v{recipe.version}</span>}
                  {recipe?.updatedBy && <span>· last edited by {recipe.updatedBy}</span>}
                </SheetDescription>
              </div>
            </SheetHeader>

            {editing ? (
              <RecipeForm draft={draft} setDraft={setDraft} catalog={catalog} productId={product.id} />
            ) : (
              <KitchenCard
                recipe={recipe}
                catalog={bySku}
                isOwner={isOwner}
                viewerLabel={viewerLabel}
                servings={servings}
                setServings={setServings}
              />
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 p-4">
              {editing ? (
                <>
                  {recipe?.method?.length ? (
                    <Button variant="ghost" className="me-auto text-destructive" disabled={saving} onClick={() => setConfirmRemove(true)}>
                      Remove recipe
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (recipe?.method?.length) {
                        setDraft(toDraft(recipe))
                        setEditing(false)
                      } else onOpenChange(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={saving || !canSave}
                    title={canSave ? undefined : 'Add at least one ingredient and one method step'}
                    onClick={() =>
                      run(async () => {
                        await onSave(draft)
                        setServings(draft.batchServings)
                        setEditing(false)
                      })
                    }
                  >
                    {saving && <Spinner data-icon="inline-start" />}
                    Save recipe
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="me-auto" disabled={!recipe?.method?.length} onClick={() => onPrint(servings)}>
                    <PrinterIcon data-icon="inline-start" />
                    Print kitchen card
                  </Button>
                  {isOwner && (
                    <Button onClick={() => setEditing(true)}>
                      <PencilIcon data-icon="inline-start" />
                      Edit recipe
                    </Button>
                  )}
                </>
              )}
            </div>

            <ConfirmDialog
              open={confirmRemove}
              onOpenChange={setConfirmRemove}
              title={`Remove the recipe for ${product.name}?`}
              description="The method, timings and allergens are deleted. The ingredients stay as the item's costing sheet."
              confirmLabel="Remove recipe"
              onConfirm={() => run(onRemoveMethod)}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

interface KitchenCardProps {
  recipe: Recipe | undefined
  catalog: Map<string, CatalogItem>
  isOwner: boolean
  viewerLabel: string
  servings: number
  setServings: (n: number) => void
}

/** Read-only card the kitchen cooks from. Staff never get secret ingredient names, and copying is blocked. */
function KitchenCard({ recipe, catalog, isOwner, viewerLabel, servings, setServings }: KitchenCardProps) {
  const codes = useMemo(() => secretCodes(recipe?.ingredients ?? []), [recipe])
  if (!recipe?.method?.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
        This item only has a costing sheet. The owner has not written the method yet.
      </div>
    )
  }
  const batch = recipe.batchServings ?? 1
  const block = (e: React.SyntheticEvent) => !isOwner && e.preventDefault()

  return (
    <div
      className={cn('relative min-h-0 flex-1 overflow-y-auto', !isOwner && 'select-none')}
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
    >
      {!isOwner && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-around overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="-rotate-[24deg] whitespace-nowrap text-2xl font-semibold text-foreground/[0.05]">
              {viewerLabel} · confidential
            </span>
          ))}
        </div>
      )}

      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b p-4 text-sm">
        <span className="flex items-center gap-1.5">
          <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
          Prep {recipe.prepMinutes ?? 0} min · cook {recipe.cookMinutes ?? 0} min
        </span>
        <span className="flex items-center gap-1.5">
          <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
          {visibilityLabel[recipe.visibility ?? 'owner']}
        </span>
        {(recipe.allergens ?? []).map((a) => (
          <Badge key={a} variant="outline" className="border-warning/60">
            {a}
          </Badge>
        ))}
      </section>

      <section className="flex flex-col gap-3 p-4" aria-labelledby="card-ingredients">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="card-ingredients" className="text-sm font-semibold">
            Ingredients
          </h3>
          <div className="flex items-center gap-1.5">
            <Label htmlFor="servings" className="text-xs text-muted-foreground">
              Cook for
            </Label>
            <InputGroup className="h-8 w-36">
              <InputGroupInput
                id="servings"
                type="number"
                min={1}
                step={1}
                value={servings || ''}
                onChange={(e) => setServings(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>servings</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {[1, batch, batch * 2].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
              <Button key={n} size="xs" variant={servings === n ? 'secondary' : 'ghost'} onClick={() => setServings(n)}>
                {n === batch && n !== 1 ? `Batch (${n})` : n}
              </Button>
            ))}
          </div>
        </div>
        <ul className="divide-y rounded-lg border">
          {recipe.ingredients.map((line) => {
            const masked = line.secret && !isOwner
            return (
              <li key={line.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                {line.secret && <LockKeyholeIcon className="size-3.5 text-primary" aria-label="Secret" />}
                <span className={cn(masked && 'italic')}>{masked ? codes.get(line.id) : ingredientName(line, catalog)}</span>
                {line.secret && isOwner && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    staff see “{codes.get(line.id)}”
                  </Badge>
                )}
                <span className="ms-auto font-medium tabular-nums">{formatQuantity(line.quantity * servings, line.unit)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3 p-4 pt-0" aria-labelledby="card-method">
        <h3 id="card-method" className="text-sm font-semibold">
          Method
        </h3>
        <ol className="flex flex-col gap-2">
          {recipe.method.map((step, i) => (
            <li key={step.id} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">{i + 1}</span>
              <p className="flex-1 text-sm">
                {step.text}
                {step.minutes > 0 && <span className="ms-1.5 text-xs text-muted-foreground">({step.minutes} min)</span>}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {isOwner && recipe.notes && (
        <section className="mx-4 mb-4 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Private notes (owners only)</p>
          {recipe.notes}
        </section>
      )}
    </div>
  )
}

interface RecipeFormProps {
  draft: RecipeBookDraft
  setDraft: React.Dispatch<React.SetStateAction<RecipeBookDraft>>
  catalog: CatalogItem[]
  productId: string
}

function RecipeForm({ draft, setDraft, catalog, productId }: RecipeFormProps) {
  const set = <K extends keyof RecipeBookDraft>(key: K, value: RecipeBookDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setStep = (id: string, patch: Partial<RecipeBookDraft['method'][number]>) =>
    setDraft((d) => ({ ...d, method: d.method.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const move = (from: number, to: number) =>
    setDraft((d) => {
      const method = [...d.method]
      const [step] = method.splice(from, 1)
      method.splice(to, 0, step)
      return { ...d, method }
    })
  const numberField = (key: 'batchServings' | 'prepMinutes' | 'cookMinutes', label: string, suffix: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={key}>{label}</Label>
      <InputGroup>
        <InputGroupInput
          id={key}
          type="number"
          min={key === 'batchServings' ? 1 : 0}
          step={1}
          value={draft[key] || ''}
          onChange={(e) => set(key, Math.max(0, Math.round(Number(e.target.value) || 0)))}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section className="grid grid-cols-3 gap-3 p-4">
        {numberField('batchServings', 'Usual batch', 'servings')}
        {numberField('prepMinutes', 'Prep time', 'min')}
        {numberField('cookMinutes', 'Cook time', 'min')}
      </section>

      <Separator />

      <section className="flex flex-col gap-3 p-4" aria-labelledby="recipe-ingredients">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 id="recipe-ingredients" className="text-sm font-semibold">
              Ingredients per serving
            </h3>
            <p className="text-xs text-muted-foreground">
              Tap <EyeOffIcon className="inline size-3" aria-label="the eye" /> to make an ingredient secret. Staff see only a code name and how much to add.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setDraft((d) => ({ ...d, ingredients: [...d.ingredients, newIngredientLine(catalog, d.ingredients)] }))}>
            <PlusIcon data-icon="inline-start" />
            Add
          </Button>
        </div>
        <IngredientLines lines={draft.ingredients} setLines={(update) => setDraft((d) => ({ ...d, ingredients: update(d.ingredients) }))} catalog={catalog} showSecret />
        <p className="text-xs text-muted-foreground">
          Wastage, packaging and pricing for this item are in{' '}
          <Link href="/finance/costing" className="text-primary underline-offset-4 hover:underline">
            Item Costing
          </Link>
          .
        </p>
      </section>

      <Separator />

      <section className="flex flex-col gap-3 p-4" aria-labelledby="recipe-method">
        <div className="flex items-center justify-between gap-2">
          <h3 id="recipe-method" className="text-sm font-semibold">
            Method
          </h3>
          <Button size="sm" variant="outline" onClick={() => set('method', [...draft.method, { id: newId(`${productId}-s`), text: '', minutes: 0 }])}>
            <PlusIcon data-icon="inline-start" />
            Add step
          </Button>
        </div>
        {draft.method.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Write the steps your kitchen follows, in order.</p>
        )}
        <ol className="flex flex-col gap-2">
          {draft.method.map((step, i) => (
            <li key={step.id} className="flex gap-2 rounded-lg border p-2.5">
              <span className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
              <div className="flex flex-1 flex-col gap-2">
                <Textarea
                  rows={2}
                  aria-label={`Step ${i + 1}`}
                  placeholder="e.g. Fry onions until deep golden brown"
                  value={step.text}
                  onChange={(e) => setStep(step.id, { text: e.target.value })}
                />
                <div className="flex items-center gap-1">
                  <InputGroup className="h-8 w-32">
                    <InputGroupInput
                      type="number"
                      min={0}
                      step={1}
                      aria-label={`Minutes for step ${i + 1}`}
                      value={step.minutes || ''}
                      placeholder="0"
                      onChange={(e) => setStep(step.id, { minutes: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>min</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <Button variant="ghost" size="icon-sm" className="ms-auto" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => move(i, i - 1)}>
                    <ArrowUpIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" disabled={i === draft.method.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => move(i, i + 1)}>
                    <ArrowDownIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove step ${i + 1}`} onClick={() => set('method', draft.method.filter((s) => s.id !== step.id))}>
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Separator />

      <section className="flex flex-col gap-3 p-4" aria-labelledby="recipe-allergens">
        <h3 id="recipe-allergens" className="text-sm font-semibold">
          Allergens
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => {
            const on = draft.allergens.includes(a)
            return (
              <Button
                key={a}
                size="xs"
                variant={on ? 'default' : 'outline'}
                aria-pressed={on}
                onClick={() => set('allergens', on ? draft.allergens.filter((x) => x !== a) : [...draft.allergens, a])}
              >
                {a}
              </Button>
            )
          })}
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-3 p-4" aria-labelledby="recipe-visibility">
        <div>
          <h3 id="recipe-visibility" className="text-sm font-semibold">
            Who can open the kitchen card
          </h3>
          <p className="text-xs text-muted-foreground">Secret ingredient names stay hidden from everyone except recipe owners, whatever you pick here.</p>
        </div>
        <RadioGroup value={draft.visibility} onValueChange={(v) => set('visibility', v as RecipeVisibility)}>
          {(
            [
              ['owner', 'Nobody else sees this recipe at all.'],
              ['managers', 'Administrators and branch managers can open it.'],
              ['kitchen', 'Managers and chefs can open it to cook from.'],
            ] as const
          ).map(([value, hint]) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-checked:border-primary has-data-checked:bg-primary/5">
              <RadioGroupItem value={value} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{visibilityLabel[value]}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </section>

      <Separator />

      <section className="flex flex-col gap-2 p-4">
        <Label htmlFor="recipe-book-notes">Private notes</Label>
        <Textarea
          id="recipe-book-notes"
          rows={2}
          placeholder="Supplier, brand, tricks you would rather not write in the method…"
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Shown only to recipe owners.</p>
      </section>
    </div>
  )
}
