'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { OptionSelect } from '@/components/common/option-select'
import { formatCurrency } from '@/lib/utils/format'
import { priceRange } from '@/lib/utils/options'
import type { Product, ProductOption, ProductOptionGroup } from '@/types'

type DraftOption = ProductOption & { key: string }
type DraftGroup = Omit<ProductOptionGroup, 'options'> & { options: DraftOption[] }

let seq = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`

const option = (name = '', price = 0): DraftOption => ({ key: newId('o'), name, price })

/** Starting points for the most common groups; the owner renames and reprices from there. */
const PRESETS: { name: string; type: ProductOptionGroup['type']; options: [string, number][] }[] = [
  { name: 'Size', type: 'single', options: [['Regular', 0], ['Large', 250]] },
  { name: 'Patty', type: 'single', options: [['Single patty', 0], ['Double patty', 350]] },
  { name: 'Make it a meal', type: 'single', options: [['Item only', 0], ['With fries', 200], ['Meal: fries + drink', 350]] },
  { name: 'Extras', type: 'multiple', options: [['Extra cheese', 80]] },
  { name: 'Sauces', type: 'multiple', options: [['Garlic mayo', 40]] },
]

const TYPE_OPTIONS = [
  { value: 'single', label: 'Pick one (required)' },
  { value: 'multiple', label: 'Pick any (optional)' },
]

interface OptionGroupsEditorProps {
  product: Product | null
  onOpenChange: (open: boolean) => void
  onSave: (groups: ProductOptionGroup[]) => Promise<void>
}

export function OptionGroupsEditor({ product, onOpenChange, onSave }: OptionGroupsEditorProps) {
  const [groups, setGroups] = useState<DraftGroup[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!product) return
    setGroups(product.optionGroups.map((g) => ({ ...g, options: g.options.map((o) => option(o.name, o.price)) })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  const setGroup = (id: string, patch: Partial<DraftGroup>) => setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const setOption = (groupId: string, key: string, patch: Partial<DraftOption>) =>
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, options: g.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) } : g)))
  const move = (index: number, delta: number) =>
    setGroups((gs) => {
      const next = [...gs]
      const [g] = next.splice(index, 1)
      next.splice(index + delta, 0, g)
      return next
    })

  const addGroup = (preset?: (typeof PRESETS)[number]) =>
    setGroups((gs) => [
      ...gs,
      {
        id: newId('g'),
        name: preset?.name ?? '',
        type: preset?.type ?? 'single',
        options: preset ? preset.options.map(([n, p]) => option(n, p)) : [option(), option()],
      },
    ])

  const invalid = groups.some((g) => !g.name.trim() || g.options.length === 0 || g.options.some((o) => !o.name.trim()))
  const range = product ? priceRange(product.basePrice, groups) : { min: 0, max: 0 }

  const save = async () => {
    setSaving(true)
    try {
      await onSave(
        groups.map((g) => ({
          id: g.id,
          name: g.name.trim(),
          type: g.type,
          options: g.options.map((o) => ({ name: o.name.trim(), price: g.type === 'multiple' ? Math.max(0, o.price) : o.price })),
        })),
      )
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
                <SheetDescription>Variants and add-ons · base price {formatCurrency(product.basePrice)}</SheetDescription>
              </div>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <p className="text-xs text-muted-foreground">
                Customers choose from these when ordering at the POS or on the website. Prices are added to the base price; use a negative price for a
                cheaper choice like a smaller size.
              </p>
              {groups.length === 0 && (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No variants yet. This item is added to the order straight away.
                </p>
              )}
              <ul className="flex flex-col gap-3">
                {groups.map((g, gi) => (
                  <li key={g.id} className="flex flex-col gap-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="h-9 min-w-40 flex-1 font-medium"
                        aria-label={`Name of group ${gi + 1}`}
                        placeholder="Group name, e.g. Patty"
                        value={g.name}
                        onChange={(e) => setGroup(g.id, { name: e.target.value })}
                      />
                      <OptionSelect
                        className="h-9 w-48"
                        aria-label={`How customers choose in ${g.name || `group ${gi + 1}`}`}
                        value={g.type}
                        options={TYPE_OPTIONS}
                        onValueChange={(v) => setGroup(g.id, { type: v as ProductOptionGroup['type'] })}
                      />
                      <div className="flex">
                        <Button variant="ghost" size="icon-sm" aria-label={`Move ${g.name || `group ${gi + 1}`} up`} disabled={gi === 0} onClick={() => move(gi, -1)}>
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${g.name || `group ${gi + 1}`} down`}
                          disabled={gi === groups.length - 1}
                          onClick={() => move(gi, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${g.name || `group ${gi + 1}`}`}
                          onClick={() => setGroups((gs) => gs.filter((x) => x.id !== g.id))}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-2 ps-3">
                      {g.options.map((o, oi) => (
                        <li key={o.key} className="flex items-center gap-2">
                          <Input
                            className="h-8 flex-1"
                            aria-label={`Option ${oi + 1} in ${g.name || `group ${gi + 1}`}`}
                            placeholder={g.type === 'single' ? 'e.g. Double patty' : 'e.g. Extra cheese'}
                            value={o.name}
                            onChange={(e) => setOption(g.id, o.key, { name: e.target.value })}
                          />
                          <InputGroup className="h-8 w-36">
                            <InputGroupAddon>
                              <InputGroupText>+Rs</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                              type="number"
                              step="any"
                              min={g.type === 'multiple' ? 0 : undefined}
                              aria-label={`Extra price for ${o.name || `option ${oi + 1}`}`}
                              value={o.price || ''}
                              placeholder="0"
                              onChange={(e) => setOption(g.id, o.key, { price: Number(e.target.value) || 0 })}
                            />
                          </InputGroup>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${o.name || `option ${oi + 1}`}`}
                            onClick={() => setGroup(g.id, { options: g.options.filter((x) => x.key !== o.key) })}
                          >
                            <Trash2Icon />
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between gap-2 ps-3">
                      <Button size="xs" variant="ghost" onClick={() => setGroup(g.id, { options: [...g.options, option()] })}>
                        <PlusIcon data-icon="inline-start" />
                        Add option
                      </Button>
                      {g.type === 'single' && g.options[0] && (
                        <span className="text-[11px] text-muted-foreground">Preselected: {g.options[0].name || 'first option'}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.filter((p) => !groups.some((g) => g.name.trim().toLowerCase() === p.name.toLowerCase())).map((p) => (
                  <Button key={p.name} size="xs" variant="outline" onClick={() => addGroup(p)}>
                    <PlusIcon data-icon="inline-start" />
                    {p.name}
                  </Button>
                ))}
                <Button size="xs" variant="outline" onClick={() => addGroup()}>
                  <PlusIcon data-icon="inline-start" />
                  Custom group
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/40 p-4">
              <p className="me-auto text-sm">
                {range.min === range.max ? (
                  <>
                    Price <strong className="tabular-nums">{formatCurrency(range.min)}</strong>
                  </>
                ) : (
                  <>
                    Price range{' '}
                    <strong className="tabular-nums">
                      {formatCurrency(range.min)} – {formatCurrency(range.max)}
                    </strong>
                  </>
                )}
              </p>
              {invalid && <p className="w-full text-end text-xs text-destructive">Every group needs a name and at least one named option.</p>}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={saving || invalid} onClick={save}>
                {saving && <Spinner data-icon="inline-start" />}
                Save
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
