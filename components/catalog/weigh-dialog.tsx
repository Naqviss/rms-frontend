'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/utils/format'
import type { Product } from '@/types'

const PRESETS = [0.25, 0.5, 1, 2, 5]

interface WeighDialogProps {
  product: Product | null
  onOpenChange: (open: boolean) => void
  /** Called with the weight in kg. */
  onAdd: (product: Product, kg: number) => void
}

/** Weight entry for loose goods priced per kg. A connected scale would fill the field; staff can also type it or tap a preset. */
export function WeighDialog({ product, onOpenChange, onAdd }: WeighDialogProps) {
  const { t } = useT()
  const [kg, setKg] = useState('1')

  useEffect(() => {
    if (product) setKg('1')
  }, [product])

  const weight = Math.max(0, Number(kg) || 0)
  const add = () => {
    if (!product || weight <= 0) return
    onAdd(product, Math.round(weight * 1000) / 1000)
    onOpenChange(false)
  }

  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>{product.name}</DialogTitle>
              <DialogDescription>
                {t('orders.weighItem')} · {formatCurrency(product.basePrice)}
                {t('catalog.perKg')}
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                add()
              }}
            >
              <Label htmlFor="weigh-kg">{t('orders.weightKg')}</Label>
              <Input
                id="weigh-kg"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.005}
                autoFocus
                className="h-12 text-center text-2xl font-semibold tabular-nums"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
              <ToggleGroup value={[kg]} onValueChange={(v) => v.length && setKg(v[0])} variant="outline" size="sm" className="w-full">
                {PRESETS.map((p) => (
                  <ToggleGroupItem key={p} value={String(p)} className="flex-1 tabular-nums">
                    {p}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <DialogFooter>
                <Button type="submit" className="w-full sm:w-auto" disabled={weight <= 0}>
                  {t('orders.addToOrder')} · {formatCurrency(Math.round(product.basePrice * weight))}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
