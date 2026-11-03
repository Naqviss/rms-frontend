'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { BanknoteIcon, MinusIcon, PlusIcon, SearchIcon, ShoppingBagIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { ProductOptionsDialog } from '@/components/menu/product-options-dialog'
import { useCustomers, useCategories, useDiscounts, useOrders, useProducts, useTables } from '@/hooks/use-data'
import { usePosCheckout, UNKNOWN_OUTCOME } from '@/hooks/use-front-of-house'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { hasOptions } from '@/lib/utils/options'
import { promoStatus } from '@/lib/utils/promotions'
import type { OrderItem, OrderType, PaymentMethod, Product } from '@/types'

type TillMethod = Exclude<PaymentMethod, 'split' | 'unknown'>

interface CartLine extends OrderItem {
  key: string
}

/**
 * Live POS. The server prices every order (menu prices, tax, promotions, coupon, delivery fee), so
 * the till places the order first, shows the server's total, then records the payment for what is
 * due and issues the receipt. Keys for each step are created once per sale and reused on retry.
 */
export default function PosPage() {
  const { t, td } = useT()
  // An order is rung up at one branch: the first of those picked in the top bar.
  const { primaryBranch: activeBranch } = useScope()
  const { data: products } = useProducts()
  const { data: categories } = useCategories()
  const { data: customers } = useCustomers()
  const { data: tables, mutate: refreshTables } = useTables()
  const { mutate: refreshOrders } = useOrders()
  const { data: discounts } = useDiscounts()
  const checkout = usePosCheckout()

  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [tableId, setTableId] = useState('')
  const [customerId, setCustomerId] = useState('walk-in')
  /** 'none' or a discount id; only coupon-code discounts can be sent (promotions apply server-side). */
  const [couponChoice, setCouponChoice] = useState('none')
  const [method, setMethod] = useState<TillMethod>('cash')
  const [customizing, setCustomizing] = useState<Product | null>(null)

  const visible = useMemo(
    () =>
      (products ?? [])
        .filter((p) => p.branchIds.includes(activeBranch) || p.branchIds.length === 0)
        .filter((p) => (category === 'all' ? true : p.categoryId === category))
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [products, activeBranch, category, query],
  )

  const freeTables = (tables ?? []).filter((x) => x.branchId === activeBranch && x.status === 'available')
  const coupons = (discounts ?? []).filter((d) => d.code && promoStatus(d) === 'live')
  const coupon = coupons.find((d) => d.id === couponChoice)

  // Menu prices only: an estimate until the server prices the order.
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  const openItem = (p: Product) => {
    if (!p.available) return
    if (hasOptions(p)) setCustomizing(p)
    else addToCart(p, [], p.basePrice)
  }

  const addToCart = (p: Product, options: string[], unitPrice: number) => {
    const key = [p.id, ...options].join('|')
    setCart((prev) => {
      const found = prev.find((l) => l.key === key)
      if (found) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
      return [...prev, { key, productId: p.id, name: p.name, quantity: 1, unitPrice, options: options.length ? options : undefined }]
    })
  }

  const changeQty = (key: string, delta: number) =>
    setCart((prev) => prev.flatMap((l) => (l.key !== key ? [l] : l.quantity + delta <= 0 ? [] : [{ ...l, quantity: l.quantity + delta }])))

  const placeOrder = async () => {
    if (cart.length === 0 || checkout.busy) return
    if (orderType === 'dine-in' && !tableId) {
      toast.error(t('orders.selectTable'))
      return
    }
    if (orderType === 'delivery' && customerId === 'walk-in') {
      toast.error('Delivery orders need a customer with a saved address')
      return
    }
    const sale = await checkout.place({
      branchId: activeBranch,
      type: orderType,
      tableId: orderType === 'dine-in' ? tableId : null,
      customerId: customerId === 'walk-in' ? null : customerId,
      items: cart.map(({ key: _key, ...i }) => i),
      couponCode: coupon?.code,
    })
    if (!sale) return
    toast.success(
      sale.order.duplicate
        ? `${t('orders.orderPlaced')} (${sale.order.number}): already recorded, showing the original`
        : `${t('orders.orderPlaced')} (${sale.order.number})`,
    )
    setCart([])
    setTableId('')
    setCouponChoice('none')
    void refreshOrders()
    if (orderType === 'dine-in') void refreshTables()
  }

  const collect = async () => {
    if (checkout.busy) return
    const out = await checkout.pay(method)
    if (!out) return
    toast.success(out.receipt ? `Paid ${formatCurrency(out.order.total_minor / 100)} · receipt ${out.receipt.number}` : `Paid ${formatCurrency(out.order.total_minor / 100)}`)
    checkout.reset()
    void refreshOrders()
  }

  const payLater = () => {
    checkout.reset()
    void refreshOrders()
  }

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
                        {l.options?.join(', ') || formatCurrency(l.unitPrice)}
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
            <div className="flex items-center gap-2">
              <Label htmlFor="pos-coupon" className="shrink-0 text-sm">
                {t('orders.applyDiscount')}
              </Label>
              <OptionSelect
                id="pos-coupon"
                className="h-8 min-w-0 flex-1"
                value={couponChoice}
                onValueChange={setCouponChoice}
                options={[{ value: 'none', label: t('promo.noDiscount') }, ...coupons.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))]}
              />
            </div>
            <ToggleGroup
              value={[method]}
              onValueChange={(v) => v.length && setMethod(v[0] as TillMethod)}
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
                <dt className="text-muted-foreground">{t('common.subtotal')} (menu prices)</dt>
                <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">Tax, promotions, coupon and delivery fee are calculated by the server when the order is placed.</p>
            </dl>
            {checkout.unknown && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>Outcome unknown</AlertTitle>
                <AlertDescription>{UNKNOWN_OUTCOME}</AlertDescription>
              </Alert>
            )}
            {checkout.pending && (
              <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm" aria-live="polite">
                <p className="font-medium">
                  {t('orders.number')} {checkout.pending.order.number} · {checkout.pending.order.status_label}
                </p>
                <dl className="flex flex-col gap-1">
                  {(
                    [
                      [t('common.subtotal'), checkout.pending.totals.subtotal],
                      [t('common.discount'), -checkout.pending.totals.discount],
                      [t('common.tax'), checkout.pending.totals.tax],
                      ['Delivery fee', checkout.pending.totals.deliveryFee],
                      ['Service charge', checkout.pending.totals.serviceCharge],
                    ] as const
                  )
                    .filter(([, v]) => v !== 0)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="tabular-nums">{formatCurrency(v)}</dd>
                      </div>
                    ))}
                  <div className="flex justify-between font-semibold">
                    <dt>{t('common.total')}</dt>
                    <dd className="tabular-nums">{formatCurrency(checkout.pending.totals.total)}</dd>
                  </div>
                  {checkout.pending.totals.paid > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Due</dt>
                      <dd className="tabular-nums">{formatCurrency(checkout.pending.totals.due)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            {checkout.pending ? (
              <>
                <Button className="w-full" size="lg" disabled={checkout.busy || checkout.pending.totals.due <= 0} onClick={collect}>
                  {checkout.busy ? <Spinner data-icon="inline-start" /> : <BanknoteIcon data-icon="inline-start" />}
                  {checkout.busy ? 'Recording payment…' : `${t('orders.charge')} ${td(`pay.${method}`)} ${formatCurrency(checkout.pending.totals.due)}`}
                </Button>
                <Button variant="ghost" size="sm" className="w-full" disabled={checkout.busy} onClick={payLater}>
                  Pay later
                </Button>
              </>
            ) : (
              <>
                <Button className="w-full" size="lg" disabled={cart.length === 0 || checkout.busy} onClick={placeOrder}>
                  {checkout.busy && <Spinner data-icon="inline-start" />}
                  {checkout.busy ? 'Placing order…' : checkout.unknown ? 'Retry this order (same keys)' : 'Place order'}
                </Button>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full" disabled={checkout.busy} onClick={() => setCart([])}>
                    {t('common.clear')}
                  </Button>
                )}
              </>
            )}
          </CardFooter>
        </Card>
      </div>

      <ProductOptionsDialog product={customizing} onOpenChange={(o) => !o && setCustomizing(null)} onAdd={addToCart} />
    </>
  )
}
