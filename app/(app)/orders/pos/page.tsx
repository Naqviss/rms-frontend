'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { MinusIcon, PlusIcon, SearchIcon, ShoppingBagIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { useCustomers, useCategories, useOrders, useProducts, useTables } from '@/hooks/use-data'
import { useAppStore } from '@/stores/app-store'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { currentBranchIds } from '@/mocks/branches'
import { TAX_RATE } from '@/mocks/orders'
import type { OrderItem, OrderType, PaymentMethod, Product } from '@/types'

interface CartLine extends OrderItem {
  key: string
}

export default function PosPage() {
  const { t, td } = useT()
  const branchId = useAppStore((s) => s.branchId)
  const activeBranch = branchId === 'all' ? currentBranchIds[0] : branchId
  const { data: products } = useProducts()
  const { data: categories } = useCategories()
  const { data: customers } = useCustomers()
  const { data: tables, update: updateTable } = useTables()
  const { create: createOrder, data: orders } = useOrders()

  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [tableId, setTableId] = useState('')
  const [customerId, setCustomerId] = useState('walk-in')
  const [discountPct, setDiscountPct] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [customizing, setCustomizing] = useState<Product | null>(null)
  const [variantIdx, setVariantIdx] = useState('0')
  const [addonIdx, setAddonIdx] = useState<number[]>([])

  const visible = useMemo(
    () =>
      (products ?? [])
        .filter((p) => p.branchIds.includes(activeBranch) || p.branchIds.length === 0)
        .filter((p) => (category === 'all' ? true : p.categoryId === category))
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [products, activeBranch, category, query],
  )

  const freeTables = (tables ?? []).filter((x) => x.branchId === activeBranch && x.status === 'available')

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const discount = Math.round((subtotal * discountPct) / 100)
  const tax = Math.round((subtotal - discount) * TAX_RATE)
  const total = subtotal - discount + tax

  const openItem = (p: Product) => {
    if (!p.available) return
    if (p.variants.length === 0 && p.addons.length === 0) {
      addToCart(p, 0, [])
      return
    }
    setCustomizing(p)
    setVariantIdx('0')
    setAddonIdx([])
  }

  const addToCart = (p: Product, vIdx: number, aIdx: number[]) => {
    const variant = p.variants[vIdx]
    const addons = aIdx.map((i) => p.addons[i])
    const unitPrice = p.basePrice + (variant?.priceDelta ?? 0) + addons.reduce((s, a) => s + a.price, 0)
    const key = [p.id, variant?.name ?? '', addons.map((a) => a.name).join('+')].join('|')
    setCart((prev) => {
      const found = prev.find((l) => l.key === key)
      if (found) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
      return [
        ...prev,
        { key, productId: p.id, name: p.name, quantity: 1, unitPrice, variant: variant?.name, addons: addons.map((a) => a.name) },
      ]
    })
  }

  const changeQty = (key: string, delta: number) =>
    setCart((prev) => prev.flatMap((l) => (l.key !== key ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }])))

  const placeOrder = async () => {
    if (cart.length === 0) return
    if (orderType === 'dine-in' && !tableId) {
      toast.error(t('orders.selectTable'))
      return
    }
    const customer = customers?.find((c) => c.id === customerId)
    const number = `#${1000 + (orders?.length ?? 0) + 1}`
    const order = await createOrder({
      number,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? t('orders.walkIn'),
      type: orderType,
      status: 'pending',
      paymentStatus: 'paid',
      paymentMethod: method,
      items: cart.map(({ key: _key, ...i }) => i),
      subtotal,
      discount,
      tax,
      total,
      branchId: activeBranch,
      tableId: orderType === 'dine-in' ? tableId : null,
      createdAt: new Date().toISOString().slice(0, 19),
      notes: '',
      source: 'pos',
    })
    if (orderType === 'dine-in' && tableId) await updateTable(tableId, { status: 'occupied', orderId: order.id })
    toast.success(`${t('orders.orderPlaced')} (${number})`)
    setCart([])
    setTableId('')
    setDiscountPct(0)
  }

  const customizingPrice = customizing
    ? customizing.basePrice +
      (customizing.variants[Number(variantIdx)]?.priceDelta ?? 0) +
      addonIdx.reduce((s, i) => s + customizing.addons[i].price, 0)
    : 0

  return (
    <>
      <PageHeader title={t('orders.pos')} description={t('orders.posSubtitle')} />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="flex min-w-0 flex-col gap-4" aria-label={t('menu.products')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <InputGroup className="h-9 sm:max-w-xs">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('orders.searchProducts')} aria-label={t('orders.searchProducts')} />
            </InputGroup>
            <ScrollArea className="w-full min-w-0 sm:flex-1">
              <ToggleGroup
                value={[category]}
                onValueChange={(v) => v.length && setCategory(v[0])}
                variant="outline"
                size="sm"
                className="w-max"
              >
                <ToggleGroupItem value="all">{t('common.all')}</ToggleGroupItem>
                {(categories ?? []).map((c) => (
                  <ToggleGroupItem key={c.id} value={c.id}>
                    {c.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </ScrollArea>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
            {visible.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openItem(p)}
                disabled={!p.available}
                className={cn(
                  'group flex flex-col overflow-hidden rounded-xl border bg-card text-start transition hover:border-primary/60 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  !p.available && 'opacity-50',
                )}
              >
                <div className="relative aspect-[4/3] w-full bg-muted">
                  <Image src={p.image} alt="" fill sizes="(min-width:1280px) 200px, 45vw" className="object-cover" />
                  {!p.available && (
                    <span className="absolute start-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium">{t('menu.unavailable')}</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-3">
                  <span className="line-clamp-1 text-sm font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{formatCurrency(p.basePrice)}</span>
                </div>
              </button>
            ))}
            {visible.length === 0 && (
              <div className="col-span-full">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('common.noResults')}</EmptyTitle>
                    <EmptyDescription>{t('common.noResultsHint')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </div>
            )}
          </div>
        </section>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBagIcon className="size-4" aria-hidden />
              {t('orders.cart')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleGroup
              value={[orderType]}
              onValueChange={(v) => v.length && setOrderType(v[0] as OrderType)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {(['dine-in', 'takeaway', 'delivery'] as const).map((o) => (
                <ToggleGroupItem key={o} value={o} className="flex-1">
                  {td(`type.${o}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {orderType === 'dine-in' && (
              <OptionSelect
                value={tableId}
                onValueChange={setTableId}
                placeholder={t('orders.selectTable')}
                aria-label={t('orders.table')}
                options={freeTables.map((x) => ({ value: x.id, label: `${t('orders.table')} ${x.number} · ${x.capacity} ${t('orders.seats')}` }))}
              />
            )}
            <OptionSelect
              value={customerId}
              onValueChange={setCustomerId}
              aria-label={t('orders.selectCustomer')}
              options={[{ value: 'walk-in', label: t('orders.walkIn') }, ...(customers ?? []).slice(0, 40).map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Separator />
            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t('orders.emptyCart')}</p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
                {cart.map((l) => (
                  <li key={l.key} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[l.variant, ...(l.addons ?? [])].filter(Boolean).join(', ') || formatCurrency(l.unitPrice)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="icon-xs" onClick={() => changeQty(l.key, -1)} aria-label={`Decrease ${l.name}`}>
                        {l.quantity === 1 ? <Trash2Icon /> : <MinusIcon />}
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                      <Button variant="outline" size="icon-xs" onClick={() => changeQty(l.key, 1)} aria-label={`Increase ${l.name}`}>
                        <PlusIcon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pos-discount" className="text-sm">
                {t('orders.applyDiscount')} (%)
              </Label>
              <Input
                id="pos-discount"
                type="number"
                min={0}
                max={50}
                inputMode="numeric"
                className="h-8 w-20 text-end"
                value={discountPct}
                onChange={(e) => setDiscountPct(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
              />
            </div>
            <ToggleGroup
              value={[method]}
              onValueChange={(v) => v.length && setMethod(v[0] as PaymentMethod)}
              variant="outline"
              size="sm"
              className="w-full"
              aria-label={t('orders.payment')}
            >
              {(['cash', 'card', 'online'] as const).map((m) => (
                <ToggleGroupItem key={m} value={m} className="flex-1">
                  {td(`pay.${m}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('common.subtotal')}</dt>
                <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('common.discount')}</dt>
                <dd className="tabular-nums">-{formatCurrency(discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('common.tax')} (16%)</dt>
                <dd className="tabular-nums">{formatCurrency(tax)}</dd>
              </div>
            </dl>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" size="lg" disabled={cart.length === 0} onClick={placeOrder}>
              {t('orders.charge')} {formatCurrency(total)}
            </Button>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setCart([])}>
                {t('common.clear')}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <Dialog open={!!customizing} onOpenChange={(o) => !o && setCustomizing(null)}>
        <DialogContent className="sm:max-w-md">
          {customizing && (
            <>
              <DialogHeader>
                <DialogTitle>{customizing.name}</DialogTitle>
                <DialogDescription>{t('orders.customizeItem')}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                {customizing.variants.length > 0 && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium">{t('orders.variant')}</legend>
                    <RadioGroup value={variantIdx} onValueChange={setVariantIdx}>
                      {customizing.variants.map((v, i) => (
                        <Label key={v.name} className="flex items-center justify-between gap-3 rounded-lg border p-3 font-normal">
                          <span className="flex items-center gap-2">
                            <RadioGroupItem value={String(i)} />
                            {v.name}
                          </span>
                          <span className="text-muted-foreground tabular-nums">{v.priceDelta ? `+${formatCurrency(v.priceDelta)}` : formatCurrency(0)}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                )}
                {customizing.addons.length > 0 && (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium">{t('orders.addons')}</legend>
                    {customizing.addons.map((a, i) => (
                      <Label key={a.name} className="flex items-center justify-between gap-3 rounded-lg border p-3 font-normal">
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={addonIdx.includes(i)}
                            onCheckedChange={(v) => setAddonIdx((p) => (v ? [...p, i] : p.filter((x) => x !== i)))}
                          />
                          {a.name}
                        </span>
                        <span className="text-muted-foreground tabular-nums">+{formatCurrency(a.price)}</span>
                      </Label>
                    ))}
                  </fieldset>
                )}
              </div>
              <DialogFooter>
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => {
                    addToCart(customizing, Number(variantIdx), addonIdx)
                    setCustomizing(null)
                  }}
                >
                  {t('orders.addToOrder')} · {formatCurrency(customizingPrice)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
