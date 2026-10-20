'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { OptionSelect } from '@/components/common/option-select'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { ingredientLineCost, pricePerUnit, recipeCost, suggestedPrice, unitsFor, type CatalogItem } from '@/lib/utils/costing'
import type { Product, Recipe, RecipeExtra, RecipeIngredient } from '@/types'

export type RecipeDraft = Pick<Recipe, 'ingredients' | 'extras' | 'wastagePct' | 'notes'>

const CUSTOM = '__custom'

/** Gram- and ml-level prices are fractions of a rupee, so show paisa below Rs 10. */
const formatUnitPrice = (v: number) => (v < 10 ? `Rs ${v.toFixed(2)}` : formatCurrency(v))
const EXTRA_PRESETS = ['Packaging & condiments', 'Gas & electricity', 'Kitchen labour', 'Delivery bag', 'Cleaning & washing']

let seq = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

const emptyDraft = (): RecipeDraft => ({
  ingredients: [],
  extras: [
    { id: newId('x'), label: 'Packaging & condiments', amount: 15 },
    { id: newId('x'), label: 'Gas & electricity', amount: 15 },
    { id: newId('x'), label: 'Kitchen labour', amount: 20 },
  ],
  wastagePct: 5,
  notes: '',
})

interface RecipeEditorProps {
  product: Product | null
  recipe: Recipe | null
  catalog: CatalogItem[]
  targetCostPct: number
  onOpenChange: (open: boolean) => void
  onSave: (draft: RecipeDraft) => Promise<void>
  onRemove: () => Promise<void>
  onApplyPrice: (price: number) => Promise<void>
}

export function RecipeEditor({ product, recipe, catalog, targetCostPct, onOpenChange, onSave, onRemove, onApplyPrice }: RecipeEditorProps) {
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const bySku = useMemo(() => new Map(catalog.map((c) => [c.sku, c])), [catalog])

  // Load the saved sheet (or a starter one) only when a different item is opened, so a price change
  // made from inside the editor does not wipe unsaved edits.
  useEffect(() => {
    if (!product) return
    setDraft(recipe ? structuredClone({ ingredients: recipe.ingredients, extras: recipe.extras, wastagePct: recipe.wastagePct, notes: recipe.notes }) : emptyDraft())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, recipe?.id])

  const cost = recipeCost(draft, bySku)
  const price = product?.basePrice ?? 0
  const profit = price - cost.total
  const costPct = price ? (cost.total / price) * 100 : 0
  const suggested = suggestedPrice(cost.total, targetCostPct)

  const setLine = (id: string, patch: Partial<RecipeIngredient>) =>
    setDraft((d) => ({ ...d, ingredients: d.ingredients.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  const setExtra = (id: string, patch: Partial<RecipeExtra>) => setDraft((d) => ({ ...d, extras: d.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))

  const addLine = () => {
    const first = catalog.find((c) => !draft.ingredients.some((l) => l.sku === c.sku)) ?? catalog[0]
    setDraft((d) => ({
      ...d,
      ingredients: [...d.ingredients, { id: newId('i'), sku: first?.sku ?? null, name: '', quantity: 0, unit: first ? unitsFor(first.unit)[0] : 'g', costPerUnit: 0 }],
    }))
  }

  const ingredientOptions = useMemo(
    () => [
      ...catalog.map((c) => ({ value: c.sku, label: `${c.name} · ${formatCurrency(c.costPerUnit)}/${c.unit}` })),
      { value: CUSTOM, label: 'Custom ingredient (not in stock)…' },
    ],
    [catalog],
  )

  const run = async (fn: () => Promise<void>) => {
    setSaving(true)
    try {
      await fn()
    } finally {
      setSaving(false)
    }
  }

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
                <SheetDescription>
                  Cost of one serving · selling at {formatCurrency(price)}
                  {!recipe && ' · not costed yet'}
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <section className="flex flex-col gap-3 p-4" aria-labelledby="ingredients-heading">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 id="ingredients-heading" className="text-sm font-semibold">
                      Ingredients per serving
                    </h3>
                    <p className="text-xs text-muted-foreground">Stock items use today&apos;s inventory price. Use grams or ml for small amounts.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={addLine}>
                    <PlusIcon data-icon="inline-start" />
                    Add
                  </Button>
                </div>
                {draft.ingredients.length === 0 && (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No ingredients yet. Add what goes into one serving.</p>
                )}
                <ul className="flex flex-col gap-2">
                  {draft.ingredients.map((line, i) => {
                    const stock = line.sku ? bySku.get(line.sku) : undefined
                    const lineCost = ingredientLineCost(line, bySku)
                    const unitPrice = stock ? pricePerUnit(stock.unit, stock.costPerUnit, line.unit) : line.costPerUnit
                    return (
                      <li key={line.id} className="flex flex-col gap-2 rounded-lg border p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <OptionSelect
                            className="h-9 min-w-48 flex-1"
                            aria-label={`Ingredient ${i + 1}`}
                            value={line.sku ?? CUSTOM}
                            options={ingredientOptions}
                            onValueChange={(v) => {
                              if (v === CUSTOM) setLine(line.id, { sku: null, name: line.name || stock?.name || '', unit: line.unit || 'g' })
                              else {
                                const next = bySku.get(v)
                                setLine(line.id, { sku: v, name: '', unit: next ? unitsFor(next.unit)[0] : line.unit })
                              }
                            }}
                          />
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            className="h-9 w-24"
                            aria-label={`Quantity of ingredient ${i + 1}`}
                            value={line.quantity || ''}
                            placeholder="Qty"
                            onChange={(e) => setLine(line.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                          />
                          {stock ? (
                            <OptionSelect
                              className="h-9 w-24"
                              aria-label={`Unit of ingredient ${i + 1}`}
                              value={line.unit}
                              options={unitsFor(stock.unit).map((u) => ({ value: u, label: u }))}
                              onValueChange={(u) => setLine(line.id, { unit: u })}
                            />
                          ) : (
                            <Input
                              className="h-9 w-24"
                              aria-label={`Unit of ingredient ${i + 1}`}
                              value={line.unit}
                              placeholder="g"
                              onChange={(e) => setLine(line.id, { unit: e.target.value })}
                            />
                          )}
                          <span className="ms-auto w-24 text-end text-sm font-medium tabular-nums">{formatCurrency(lineCost)}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ingredient ${i + 1}`}
                            onClick={() => setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((l) => l.id !== line.id) }))}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                        {stock ? (
                          <p className="text-[11px] text-muted-foreground">
                            {formatUnitPrice(unitPrice)} per {line.unit} · {stock.category}
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <Input
                              className="h-8 min-w-40 flex-1"
                              aria-label={`Name of custom ingredient ${i + 1}`}
                              placeholder="Ingredient name, e.g. Mayonnaise"
                              value={line.name}
                              onChange={(e) => setLine(line.id, { name: e.target.value })}
                            />
                            <InputGroup className="h-8 w-48">
                              <InputGroupAddon>
                                <InputGroupText>Rs</InputGroupText>
                              </InputGroupAddon>
                              <InputGroupInput
                                type="number"
                                min={0}
                                step="any"
                                aria-label={`Price per ${line.unit || 'unit'} for custom ingredient ${i + 1}`}
                                value={line.costPerUnit || ''}
                                onChange={(e) => setLine(line.id, { costPerUnit: Math.max(0, Number(e.target.value) || 0) })}
                              />
                              <InputGroupAddon align="inline-end">
                                <InputGroupText>/{line.unit || 'unit'}</InputGroupText>
                              </InputGroupAddon>
                            </InputGroup>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                  <Label htmlFor="wastage" className="flex-col items-start gap-0.5">
                    <span>Wastage buffer</span>
                    <span className="text-xs font-normal text-muted-foreground">Trimming, spillage, spoilage</span>
                  </Label>
                  <InputGroup className="w-32">
                    <InputGroupInput
                      id="wastage"
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={draft.wastagePct}
                      onChange={(e) => setDraft((d) => ({ ...d, wastagePct: Math.min(50, Math.max(0, Number(e.target.value) || 0)) }))}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>%</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3 p-4" aria-labelledby="extras-heading">
                <div>
                  <h3 id="extras-heading" className="text-sm font-semibold">
                    Other costs per serving
                  </h3>
                  <p className="text-xs text-muted-foreground">Approximate usage spent on each serving that isn&apos;t an ingredient.</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {draft.extras.map((extra, i) => (
                    <li key={extra.id} className="flex items-center gap-2">
                      <Input
                        className="h-9 flex-1"
                        aria-label={`Cost name ${i + 1}`}
                        value={extra.label}
                        placeholder="e.g. Gas & electricity"
                        onChange={(e) => setExtra(extra.id, { label: e.target.value })}
                      />
                      <InputGroup className="h-9 w-36">
                        <InputGroupAddon>
                          <InputGroupText>Rs</InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                          type="number"
                          min={0}
                          step="any"
                          aria-label={`Amount for ${extra.label || `cost ${i + 1}`}`}
                          value={extra.amount || ''}
                          onChange={(e) => setExtra(extra.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </InputGroup>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${extra.label || `cost ${i + 1}`}`}
                        onClick={() => setDraft((d) => ({ ...d, extras: d.extras.filter((e) => e.id !== extra.id) }))}
                      >
                        <Trash2Icon />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  {[...EXTRA_PRESETS.filter((p) => !draft.extras.some((e) => e.label === p)), 'Other'].map((label) => (
                    <Button
                      key={label}
                      size="xs"
                      variant="outline"
                      onClick={() => setDraft((d) => ({ ...d, extras: [...d.extras, { id: newId('x'), label: label === 'Other' ? '' : label, amount: 0 }] }))}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {label}
                    </Button>
                  ))}
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-2 p-4">
                <Label htmlFor="recipe-notes">Notes</Label>
                <Textarea
                  id="recipe-notes"
                  rows={2}
                  placeholder="Portion size, batch yield, supplier notes…"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </section>
            </div>

            <div className="border-t bg-muted/40 p-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                {[
                  { label: 'Ingredients', value: formatCurrency(cost.ingredients) },
                  { label: `Wastage ${formatPercent(draft.wastagePct, 1)}`, value: formatCurrency(cost.wastage) },
                  { label: 'Other costs', value: formatCurrency(cost.extras) },
                  { label: 'Cost / serving', value: formatCurrency(cost.total), strong: true },
                ].map((r) => (
                  <div key={r.label} className="flex flex-col">
                    <dt className="text-[11px] text-muted-foreground">{r.label}</dt>
                    <dd className={cn('tabular-nums', r.strong && 'text-base font-semibold')}>{r.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>
                  Profit / serving <strong className={cn('tabular-nums', profit >= 0 ? 'text-success' : 'text-destructive')}>{formatCurrency(profit)}</strong>
                </span>
                <span>
                  Margin <strong className="tabular-nums">{formatPercent(price ? (profit / price) * 100 : 0)}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  Cost <strong className="tabular-nums">{formatPercent(costPct)}</strong> of price
                  <Badge variant={costPct > targetCostPct ? 'destructive' : 'secondary'} className="h-5 px-1.5 text-[10px]">
                    target {formatPercent(targetCostPct)}
                  </Badge>
                </span>
              </div>
              {cost.total > 0 && suggested !== price && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Price for a {formatPercent(targetCostPct)} cost: <strong className="text-foreground tabular-nums">{formatCurrency(suggested)}</strong>
                  <Button size="xs" variant="outline" disabled={saving} onClick={() => run(() => onApplyPrice(suggested))}>
                    Use as menu price
                  </Button>
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {recipe && (
                  <Button variant="ghost" className="me-auto text-destructive" disabled={saving} onClick={() => run(onRemove)}>
                    Remove costing
                  </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={saving || draft.ingredients.length === 0 || draft.ingredients.some((l) => !l.sku && !l.name.trim())}
                  onClick={() => run(() => onSave(draft))}
                >
                  {saving && <Spinner data-icon="inline-start" />}
                  Save costing
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
