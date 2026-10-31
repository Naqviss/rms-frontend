'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/utils/format'
import { chosenOptions, defaultSelection, formatOptionPrice, selectionPrice, type OptionSelection } from '@/lib/utils/options'
import type { Product } from '@/types'

interface ProductOptionsDialogProps {
  product: Product | null
  onOpenChange: (open: boolean) => void
  /** Called with the chosen option names and the resulting unit price. */
  onAdd: (product: Product, options: string[], unitPrice: number) => void
}

export function ProductOptionsDialog({ product, onOpenChange, onAdd }: ProductOptionsDialogProps) {
  const { t } = useT()
  const [selection, setSelection] = useState<OptionSelection>({})

  useEffect(() => {
    if (product) setSelection(defaultSelection(product.optionGroups))
  }, [product])

  const groups = product?.optionGroups.filter((g) => g.options.length > 0) ?? []
  const price = product ? selectionPrice(product.basePrice, groups, selection) : 0

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>{product.name}</DialogTitle>
              <DialogDescription>{t('orders.customizeItem')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <fieldset key={g.id} className="flex flex-col gap-2">
                  <legend className="mb-1 flex w-full items-baseline justify-between gap-2 text-sm font-medium">
                    {g.name}
                    <span className="text-xs font-normal text-muted-foreground">{g.type === 'single' ? t('orders.pickOne') : t('orders.optional')}</span>
                  </legend>
                  {g.type === 'single' ? (
                    <RadioGroup value={String(selection[g.id]?.[0] ?? 0)} onValueChange={(v) => setSelection((s) => ({ ...s, [g.id]: [Number(v)] }))}>
                      {g.options.map((o, i) => (
                        <Label key={`${o.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 font-normal">
                          <span className="flex items-center gap-2">
                            <RadioGroupItem value={String(i)} />
                            {o.name}
                          </span>
                          <span className="text-muted-foreground tabular-nums">{formatOptionPrice(o.price)}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  ) : (
                    g.options.map((o, i) => (
                      <Label key={`${o.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 font-normal">
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={selection[g.id]?.includes(i) ?? false}
                            onCheckedChange={(v) =>
                              setSelection((s) => {
                                const current = s[g.id] ?? []
                                return { ...s, [g.id]: v ? [...current, i].sort((a, b) => a - b) : current.filter((x) => x !== i) }
                              })
                            }
                          />
                          {o.name}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{formatOptionPrice(o.price)}</span>
                      </Label>
                    ))
                  )}
                </fieldset>
              ))}
            </div>
            <DialogFooter>
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  onAdd(
                    product,
                    chosenOptions(groups, selection).map((o) => o.name),
                    price,
                  )
                  onOpenChange(false)
                }}
              >
                {t('orders.addToOrder')} · {formatCurrency(price)}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
