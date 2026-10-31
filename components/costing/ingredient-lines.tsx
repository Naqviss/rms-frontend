'use client'

import { useMemo } from 'react'
import { EyeOffIcon, LockKeyholeIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Toggle } from '@/components/ui/toggle'
import { OptionSelect } from '@/components/common/option-select'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { ingredientLineCost, pricePerUnit, unitsFor, type CatalogItem } from '@/lib/utils/costing'
import { secretCodes } from '@/lib/utils/recipes'
import type { RecipeIngredient } from '@/types'

const CUSTOM = '__custom'

/** Gram- and ml-level prices are fractions of a rupee, so show paisa below Rs 10. */
const formatUnitPrice = (v: number) => (v < 10 ? `Rs ${v.toFixed(2)}` : formatCurrency(v))

let seq = 0
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

/** A blank line preset to the first stock item not already used. */
export function newIngredientLine(catalog: CatalogItem[], lines: RecipeIngredient[]): RecipeIngredient {
  const first = catalog.find((c) => !lines.some((l) => l.sku === c.sku)) ?? catalog[0]
  return { id: newId('i'), sku: first?.sku ?? null, name: '', quantity: 0, unit: first ? unitsFor(first.unit)[0] : 'g', costPerUnit: 0 }
}

interface IngredientLinesProps {
  lines: RecipeIngredient[]
  setLines: (update: (lines: RecipeIngredient[]) => RecipeIngredient[]) => void
  catalog: CatalogItem[]
  /** Offer the secret toggle; only recipe owners should get it. */
  showSecret?: boolean
  /** Hide what secret lines are. They stay in the total but cannot be read or changed. */
  maskSecrets?: boolean
}

export function IngredientLines({ lines, setLines, catalog, showSecret, maskSecrets }: IngredientLinesProps) {
  const bySku = useMemo(() => new Map(catalog.map((c) => [c.sku, c])), [catalog])
  const codes = useMemo(() => secretCodes(lines), [lines])

  const setLine = (id: string, patch: Partial<RecipeIngredient>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const ingredientOptions = useMemo(
    () => [
      ...catalog.map((c) => ({ value: c.sku, label: `${c.name} · ${formatCurrency(c.costPerUnit)}/${c.unit}` })),
      { value: CUSTOM, label: 'Custom ingredient (not in stock)…' },
    ],
    [catalog],
  )

  if (lines.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No ingredients yet. Add what goes into one serving.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {lines.map((line, i) => {
        const lineCost = ingredientLineCost(line, bySku)
        if (maskSecrets && line.secret) {
          return (
            <li key={line.id} className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-2.5 text-sm">
              <LockKeyholeIcon className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-medium">{codes.get(line.id)}</span>
              <span className="text-xs text-muted-foreground">Secret ingredient, visible to recipe owners only</span>
              <span className="ms-auto w-24 text-end font-medium tabular-nums">{formatCurrency(lineCost)}</span>
              <span className="size-7" aria-hidden />
            </li>
          )
        }
        const stock = line.sku ? bySku.get(line.sku) : undefined
        const unitPrice = stock ? pricePerUnit(stock.unit, stock.costPerUnit, line.unit) : line.costPerUnit
        return (
          <li key={line.id} className={cn('flex flex-col gap-2 rounded-lg border p-2.5', line.secret && 'border-primary/40 bg-primary/5')}>
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
              {showSecret && (
                <Toggle
                  size="sm"
                  variant="outline"
                  pressed={!!line.secret}
                  onPressedChange={(secret) => setLine(line.id, { secret })}
                  aria-label={`Keep ingredient ${i + 1} secret from staff`}
                  title="Secret: staff see only a code name and the quantity"
                  className="data-[pressed]:border-primary data-[pressed]:text-primary"
                >
                  <EyeOffIcon />
                </Toggle>
              )}
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ingredient ${i + 1}`} onClick={() => setLines((ls) => ls.filter((l) => l.id !== line.id))}>
                <Trash2Icon />
              </Button>
            </div>
            {stock ? (
              <p className="text-[11px] text-muted-foreground">
                {formatUnitPrice(unitPrice)} per {line.unit} · {stock.category}
                {line.secret && <span className="font-medium text-primary"> · shown to staff as {codes.get(line.id)}</span>}
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
  )
}
