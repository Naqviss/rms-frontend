'use client'

import { useMemo, useState } from 'react'
import { BanknoteIcon, BikeIcon, CheckCircle2Icon, CreditCardIcon, MinusIcon, PlusIcon, ShoppingBagIcon, StoreIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SiteView, type SiteItem } from '@/components/cms/site-view'
import { ProductOptionsDialog } from '@/components/menu/product-options-dialog'
import { useBranches, useOrders, useProducts } from '@/hooks/use-data'
import { templateById } from '@/lib/cms/templates'
import { formatCurrency } from '@/lib/utils/format'
import { hasOptions } from '@/lib/utils/options'
import { useChannelStore } from '@/stores/channel-store'
import { useSiteStore } from '@/stores/site-store'
import type { Order, Product } from '@/types'

/** One cart row per item and option combination; `price` already includes the options. */
type Line = { key: string; item: SiteItem; qty: number; options: string[]; price: number }
type Fulfillment = 'delivery' | 'pickup'
type Payment = 'cash' | 'online'

export function Storefront() {
  const { templateId, accent, content, sections } = useSiteStore()
  const { websiteOrderingEnabled, website } = useChannelStore()
  const { data: products } = useProducts()
  const { data: branches } = useBranches()
  const { create } = useOrders()

  const [cart, setCart] = useState<Line[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [placed, setPlaced] = useState<string | null>(null)
  const [fulfillment, setFulfillment] = useState<Fulfillment>(website.acceptDelivery ? 'delivery' : 'pickup')
  const [payment, setPayment] = useState<Payment>(website.paymentCash ? 'cash' : 'online')
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [customizing, setCustomizing] = useState<{ item: SiteItem; product: Product } | null>(null)

  const items: SiteItem[] = useMemo(() => {
    const live = (products ?? []).filter((p) => p.available)
    const sorted = [...live].sort((a, b) => Number(b.featured) - Number(a.featured))
    return sorted.slice(0, 12).map((p) => ({ id: p.id, name: p.name, description: p.description, price: p.basePrice, image: p.image }))
  }, [products])

  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const count = cart.reduce((s, l) => s + l.qty, 0)
  const fee = fulfillment === 'delivery' && subtotal < website.freeDeliveryOver ? website.deliveryFee : 0
  const total = subtotal + fee
  const belowMinimum = subtotal < website.minOrder
  const needsAddress = fulfillment === 'delivery'
  const valid = form.name.trim() && form.phone.trim() && (!needsAddress || form.address.trim()) && !belowMinimum

  const add = (item: SiteItem) => {
    if (!websiteOrderingEnabled) return toast.error('Online ordering is paused right now')
    const product = products?.find((p) => p.id === item.id)
    if (product && hasOptions(product)) return setCustomizing({ item, product })
    addLine(item, [], item.price)
  }
  const addLine = (item: SiteItem, options: string[], price: number) => {
    const key = [item.id, ...options].join('|')
    setCart((c) => (c.some((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) : [...c, { key, item, qty: 1, options, price }]))
    toast.success(`${item.name} added`)
  }
  const changeQty = (key: string, delta: number) =>
    setCart((c) => c.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }])))

  const place = async () => {
    setBusy(true)
    const number = `WEB-${Date.now().toString().slice(-6)}`
    const order: Omit<Order, 'id'> = {
      number,
      customerId: null,
      customerName: form.name.trim(),
      type: 'online',
      status: 'pending',
      paymentStatus: payment === 'online' ? 'paid' : 'unpaid',
      paymentMethod: payment,
      items: cart.map((l) => ({
        productId: l.item.id,
        name: l.item.name,
        quantity: l.qty,
        unitPrice: l.price,
        options: l.options.length ? l.options : undefined,
      })),
      subtotal,
      discount: 0,
      tax: 0,
      total,
      branchId: branches?.[0]?.id ?? 'b1',
      tableId: null,
      createdAt: new Date().toISOString(),
      notes: form.notes,
      source: 'Website',
      channel: 'website',
      website: { fulfillment, acceptance: 'awaiting', device: 'desktop' },
      delivery:
        fulfillment === 'delivery'
          ? { address: form.address.trim(), area: '', phone: form.phone.trim(), fee, distanceKm: 3, etaMinutes: website.prepMinutes + 20, status: 'unassigned', riderId: null, riderName: null }
          : undefined,
    }
    await create(order)
    setBusy(false)
    setCart([])
    setPlaced(number)
  }

  return (
    <>
      {!websiteOrderingEnabled && (
        <Alert className="rounded-none">
          <StoreIcon />
          <AlertTitle>Ordering is paused</AlertTitle>
          <AlertDescription>We are not taking online orders right now. Please check back soon.</AlertDescription>
        </Alert>
      )}
      <SiteView
        template={templateById(templateId)}
        accent={accent}
        content={content}
        sections={sections}
        items={items}
        onAdd={add}
        cartCount={count}
        onCart={() => {
          setPlaced(null)
          setOpen(true)
        }}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{placed ? 'Order placed' : 'Your order'}</SheetTitle>
            <SheetDescription>{placed ? 'The restaurant has been notified.' : `${count} item${count === 1 ? '' : 's'}`}</SheetDescription>
          </SheetHeader>

          {placed ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <CheckCircle2Icon className="size-14 text-success" aria-hidden />
              <p className="text-xl font-bold">{placed}</p>
              <p className="text-sm text-muted-foreground">Estimated {website.prepMinutes + (fulfillment === 'delivery' ? 20 : 0)} minutes.</p>
              <Button onClick={() => setOpen(false)}>Continue browsing</Button>
            </div>
          ) : cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <ShoppingBagIcon className="size-10" aria-hidden />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <ul className="flex flex-col gap-2">
                {cart.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 rounded-lg border p-2">
                    <img src={l.item.image} alt="" className="size-12 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.item.name}</p>
                      {l.options.length > 0 && <p className="truncate text-xs text-muted-foreground">{l.options.join(', ')}</p>}
                      <p className="text-xs text-muted-foreground">{formatCurrency(l.price * l.qty)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon-xs" variant="outline" aria-label={`Remove one ${l.item.name}`} onClick={() => changeQty(l.key, -1)}>
                        {l.qty === 1 ? <Trash2Icon /> : <MinusIcon />}
                      </Button>
                      <span className="w-5 text-center text-sm tabular-nums">{l.qty}</span>
                      <Button size="icon-xs" variant="outline" aria-label={`Add one ${l.item.name}`} onClick={() => changeQty(l.key, 1)}>
                        <PlusIcon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <ToggleGroup
                value={[fulfillment]}
                onValueChange={(v) => v[0] && setFulfillment(v[0] as Fulfillment)}
                variant="outline"
                className="w-full"
                aria-label="Fulfilment"
              >
                {website.acceptDelivery && (
                  <ToggleGroupItem value="delivery" className="flex-1" aria-label="Delivery">
                    <BikeIcon /> Delivery
                  </ToggleGroupItem>
                )}
                {website.acceptPickup && (
                  <ToggleGroupItem value="pickup" className="flex-1" aria-label="Pickup">
                    <ShoppingBagIcon /> Pickup
                  </ToggleGroupItem>
                )}
              </ToggleGroup>

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="s-name">Name</FieldLabel>
                  <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="s-phone">Phone</FieldLabel>
                  <Input id="s-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
                </Field>
                {needsAddress && (
                  <Field>
                    <FieldLabel htmlFor="s-address">Delivery address</FieldLabel>
                    <Textarea id="s-address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="s-notes">Notes</FieldLabel>
                  <Input id="s-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </FieldGroup>

              <ToggleGroup value={[payment]} onValueChange={(v) => v[0] && setPayment(v[0] as Payment)} variant="outline" className="w-full" aria-label="Payment">
                {website.paymentCash && (
                  <ToggleGroupItem value="cash" className="flex-1" aria-label="Cash">
                    <BanknoteIcon /> Cash
                  </ToggleGroupItem>
                )}
                {website.paymentOnline && (
                  <ToggleGroupItem value="online" className="flex-1" aria-label="Card online">
                    <CreditCardIcon /> Card
                  </ToggleGroupItem>
                )}
              </ToggleGroup>
            </div>
          )}

          {!placed && cart.length > 0 && (
            <SheetFooter className="border-t">
              <dl className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
                </div>
                {fulfillment === 'delivery' && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="tabular-nums">{fee === 0 ? 'Free' : formatCurrency(fee)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatCurrency(total)}</dd>
                </div>
              </dl>
              {belowMinimum && <p className="text-xs text-destructive">Minimum order is {formatCurrency(website.minOrder)}.</p>}
              <Button size="lg" disabled={!valid || busy || !websiteOrderingEnabled} onClick={place}>
                {busy && <Spinner data-icon="inline-start" />}
                Place order
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <ProductOptionsDialog
        product={customizing?.product ?? null}
        onOpenChange={(o) => !o && setCustomizing(null)}
        onAdd={(_product, options, price) => customizing && addLine(customizing.item, options, price)}
      />
    </>
  )
}
