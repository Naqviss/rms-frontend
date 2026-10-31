'use client'

import { MinusIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OptionSelect } from '@/components/common/option-select'
import { formatCurrency } from '@/lib/utils/format'
import type { DealItem, Product } from '@/types'

interface DealItemsEditorProps {
  items: DealItem[]
  products: Product[]
  onChange: (items: DealItem[]) => void
}

/** The menu items inside a deal, each with a quantity. */
export function DealItemsEditor({ items, products, onChange }: DealItemsEditorProps) {
  const setAt = (i: number, patch: Partial<DealItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  const unused = products.find((p) => !items.some((i) => i.productId === p.id))

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">What&apos;s in the deal</legend>
      {items.length === 0 && <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">Add at least one item.</p>}
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => {
          const p = products.find((x) => x.id === it.productId)
          return (
            <li key={`${it.productId}-${i}`} className="flex items-center gap-2">
              <OptionSelect
                className="h-9 min-w-0 flex-1"
                value={it.productId}
                onValueChange={(v) => setAt(i, { productId: v })}
                aria-label={`Item ${i + 1}`}
                options={products.map((x) => ({ value: x.id, label: `${x.name} · ${formatCurrency(x.basePrice)}` }))}
              />
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  onClick={() => (it.quantity > 1 ? setAt(i, { quantity: it.quantity - 1 }) : onChange(items.filter((_, j) => j !== i)))}
                  aria-label={`Fewer ${p?.name ?? 'items'}`}
                >
                  {it.quantity > 1 ? <MinusIcon /> : <Trash2Icon />}
                </Button>
                <span className="w-6 text-center text-sm tabular-nums">{it.quantity}</span>
                <Button type="button" variant="outline" size="icon-xs" onClick={() => setAt(i, { quantity: it.quantity + 1 })} aria-label={`More ${p?.name ?? 'items'}`}>
                  <PlusIcon />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {unused && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...items, { productId: unused.id, quantity: 1 }])}>
          <PlusIcon data-icon="inline-start" />
          Add item
        </Button>
      )}
    </fieldset>
  )
}
