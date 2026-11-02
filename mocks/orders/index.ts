import type {
  DeliveryInfo,
  DeliveryStatus,
  FoodpandaInfo,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  Rider,
  SalesChannel,
  WebsiteInfo,
} from '@/types'
import { config } from '@/lib/config'
import { createRng, int, isoDaysAgo, pick } from '@/lib/utils/seed'
import { products } from '@/mocks/catalog'
import { customers } from '@/mocks/customers'

/** Shelf prices include GST; this is the share of a typical basket that is tax (18% inclusive on most lines, fresh produce exempt). */
export const TAX_SHARE = 0.13
export const FOODPANDA_COMMISSION_RATE = 18

export const riders: Rider[] = [
  { id: 'r1', name: 'Bilal Ahmed', phone: '+92 300 1100221', vehicle: 'bike', branchId: 'b1', status: 'available' },
  { id: 'r2', name: 'Usman Raza', phone: '+92 321 4455120', vehicle: 'bike', branchId: 'b1', status: 'on-delivery' },
  { id: 'r3', name: 'Hamza Sheikh', phone: '+92 333 7712090', vehicle: 'scooter', branchId: 'b2', status: 'available' },
  { id: 'r4', name: 'Farhan Ali', phone: '+92 345 6609811', vehicle: 'bike', branchId: 'b2', status: 'off-duty' },
  { id: 'r5', name: 'Zain Malik', phone: '+92 301 9983320', vehicle: 'bike', branchId: 'b3', status: 'on-delivery' },
  { id: 'r6', name: 'Saad Qureshi', phone: '+92 312 8841057', vehicle: 'car', branchId: 'b3', status: 'available' },
]

const AREAS = ['Gulshan-e-Iqbal', 'DHA Phase 5', 'Clifton Block 4', 'North Nazimabad', 'PECHS', 'Bahadurabad', 'Gulistan-e-Jauhar']
const STREETS = ['Street 12', 'Main Boulevard', 'Lane 7', 'Block C, House 42', 'Apartment 5B', 'Shahrah-e-Faisal']
const FOODPANDA_RIDERS = ['Imran K.', 'Adeel S.', 'Noman R.', 'Kashif M.', 'Tariq H.']

const channelFor = (type: OrderType, source: string): SalesChannel => {
  if (type === 'walk-in') return 'in-store'
  if (type === 'pickup') return 'pickup'
  if (type === 'online' && source === 'Foodpanda') return 'foodpanda'
  if (type === 'online' && source === 'Website') return 'website'
  return 'own-delivery'
}

const deliveryStatusFor = (status: OrderStatus, assigned: boolean): DeliveryStatus => {
  if (status === 'cancelled') return 'failed'
  if (status === 'completed') return 'delivered'
  if (status === 'out-for-delivery') return 'picked-up'
  return assigned ? 'assigned' : 'unassigned'
}

export const orders: Order[] = (() => {
  const rng = createRng(2026)
  const list: Order[] = []
  const available = products.filter((p) => p.available)
  for (let i = 0; i < 110; i++) {
    const dayAgo = i < 24 ? 0 : Math.floor((i - 24) / 6) + 1
    const hour = dayAgo === 0 ? int(rng, 9, 18) : int(rng, 8, 22)
    const type: OrderType = pick(rng, ['walk-in', 'walk-in', 'walk-in', 'pickup', 'delivery', 'delivery', 'online', 'online'] as const)
    // A basket holds several different products, never the same one twice.
    const basket = new Set<string>()
    const items: OrderItem[] = Array.from({ length: int(rng, 2, 7) }, () => pick(rng, available))
      .filter((p) => !basket.has(p.id) && basket.add(p.id))
      .map((p) => {
        if (p.soldBy === 'weight') {
          const kg = pick(rng, [0.5, 1, 1, 1.5, 2, 2.5] as const)
          return { productId: p.id, name: p.name, quantity: kg, unit: 'kg' as const, unitPrice: p.basePrice }
        }
        const chosen = p.optionGroups.flatMap((g) => (g.type === 'single' ? [pick(rng, g.options)] : rng() < 0.2 ? [pick(rng, g.options)] : []))
        return {
          productId: p.id,
          name: p.name,
          quantity: int(rng, 1, 4),
          unitPrice: p.basePrice + chosen.reduce((s, o) => s + o.price, 0),
          options: chosen.length ? chosen.map((o) => o.name) : undefined,
        }
      })
    const subtotal = Math.round(items.reduce((s, it) => s + it.quantity * it.unitPrice, 0))
    const discount = rng() < 0.15 ? Math.round(subtotal * 0.05) : 0
    const tax = Math.round((subtotal - discount) * TAX_SHARE)
    const customer = rng() < 0.6 ? pick(rng, customers) : null
    const status: OrderStatus =
      // Walk-in customers pay and leave with their bags, so those sales are complete at the till.
      type === 'walk-in'
        ? 'completed'
        : dayAgo === 0
          ? pick(rng, ['pending', 'confirmed', 'preparing', 'preparing', 'ready', 'out-for-delivery', 'completed', 'completed'] as const)
          : rng() < 0.07
          ? 'cancelled'
          : 'completed'
    const source =
      type === 'online'
        ? pick(rng, ['Foodpanda', 'Foodpanda', 'Foodpanda', 'Website', 'Website', 'Mobile app'] as const)
        : type === 'delivery'
          ? pick(rng, ['Phone call', 'WhatsApp'] as const)
          : type === 'pickup'
            ? 'WhatsApp'
            : 'POS'
    const channel = channelFor(type, source)
    const branchId = pick(rng, ['b1', 'b1', 'b2', 'b3'])
    const method: PaymentMethod =
      channel === 'foodpanda'
        ? 'online'
        : channel === 'website'
          ? pick(rng, ['online', 'online', 'cash'] as const)
          : pick(rng, ['cash', 'cash', 'card', 'online', 'split'] as const)
    // Tax is already inside shelf prices, so it does not add to the bill.
    const total = subtotal - discount

    let delivery: DeliveryInfo | undefined
    let foodpanda: FoodpandaInfo | undefined
    let website: WebsiteInfo | undefined
    const websiteDelivery = channel === 'website' && rng() < 0.7

    if (channel === 'website') {
      website = {
        fulfillment: websiteDelivery ? 'delivery' : 'pickup',
        acceptance: status === 'pending' ? 'awaiting' : status === 'cancelled' && rng() < 0.5 ? 'rejected' : 'accepted',
        device: pick(rng, ['mobile', 'mobile', 'desktop'] as const),
        promoCode: rng() < 0.25 ? pick(rng, ['WELCOME10', 'FREESHIP', 'EID15'] as const) : undefined,
      }
    }

    if (channel === 'own-delivery' || websiteDelivery) {
      const branchRiders = riders.filter((r) => r.branchId === branchId)
      const assigned = status !== 'pending' && status !== 'confirmed' && rng() < 0.85
      const rider = assigned ? pick(rng, branchRiders) : null
      const distanceKm = Math.round((1 + rng() * 7) * 10) / 10
      delivery = {
        address: `${pick(rng, STREETS)}, ${pick(rng, AREAS)}`,
        area: pick(rng, AREAS),
        phone: customer?.phone ?? `+92 3${int(rng, 0, 4)}${int(rng, 0, 9)} ${int(rng, 1000000, 9999999)}`,
        fee: subtotal >= 3000 ? 0 : distanceKm > 4 ? 150 : 100,
        distanceKm,
        etaMinutes: Math.round(15 + distanceKm * 5),
        status: deliveryStatusFor(status, assigned),
        riderId: rider?.id ?? null,
        riderName: rider?.name ?? null,
        durationMinutes: status === 'completed' ? Math.round(18 + distanceKm * 5 + rng() * 10) : undefined,
      }
    }

    if (channel === 'foodpanda') {
      const commission = Math.round(((subtotal - discount) * FOODPANDA_COMMISSION_RATE) / 100)
      const acceptance = status === 'pending' ? 'awaiting' : status === 'cancelled' && rng() < 0.5 ? 'rejected' : 'accepted'
      foodpanda = {
        externalId: `FP-${int(rng, 10, 99)}-${int(rng, 1000, 9999)}`,
        acceptance,
        prepMinutes: pick(rng, [10, 15, 20] as const),
        commissionRate: FOODPANDA_COMMISSION_RATE,
        commission,
        netPayout: total - commission,
        riderName: status === 'ready' || status === 'out-for-delivery' || status === 'completed' ? pick(rng, FOODPANDA_RIDERS) : null,
        rejectReason: acceptance === 'rejected' ? pick(rng, ['Item out of stock', 'Store too busy', 'Outside delivery hours'] as const) : undefined,
      }
    }

    list.push({
      id: `o${i + 1}`,
      number: `#${3200 - i}`,
      customerId: customer?.id ?? null,
      customerName:
        customer?.name ??
        (channel === 'foodpanda' ? 'Foodpanda customer' : channel === 'website' ? 'Website guest' : type === 'walk-in' ? 'Walk-in customer' : `${source} customer`),
      type,
      status,
      paymentStatus: status === 'cancelled' ? 'refunded' : status === 'completed' ? 'paid' : channel === 'foodpanda' ? 'paid' : rng() < 0.5 ? 'paid' : 'unpaid',
      paymentMethod: method,
      items,
      subtotal,
      discount,
      tax,
      total,
      branchId,
      createdAt: isoDaysAgo(config.referenceDate, dayAgo, hour, int(rng, 0, 59)),
      notes: rng() < 0.2 ? pick(rng, ['Call on arrival', 'Leave with the guard', 'Ripe bananas only', 'Replace if out of stock'] as const) : '',
      source,
      channel,
      delivery,
      foodpanda,
      website,
    })
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})()
