import type {
  DeliveryInfo,
  DeliveryStatus,
  DiningTable,
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
import { products } from '@/mocks/menu'
import { customers } from '@/mocks/customers'

export const TAX_RATE = 0.16
export const FOODPANDA_COMMISSION_RATE = 28

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
  if (type === 'dine-in') return 'dine-in'
  if (type === 'takeaway') return 'takeaway'
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
    const hour = dayAgo === 0 ? int(rng, 11, 18) : int(rng, 12, 23)
    const type: OrderType = pick(rng, ['dine-in', 'dine-in', 'takeaway', 'delivery', 'delivery', 'online', 'online'] as const)
    const items: OrderItem[] = Array.from({ length: int(rng, 1, 4) }, () => {
      const p = pick(rng, available)
      // Every pick-one group gets a random choice; about a third of orders add one extra.
      const chosen = p.optionGroups.flatMap((g) =>
        g.type === 'single' ? [pick(rng, g.options)] : rng() < 0.35 ? [pick(rng, g.options)] : [],
      )
      return {
        productId: p.id,
        name: p.name,
        quantity: int(rng, 1, 3),
        unitPrice: p.basePrice + chosen.reduce((s, o) => s + o.price, 0),
        options: chosen.length ? chosen.map((o) => o.name) : undefined,
      }
    })
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const discount = rng() < 0.15 ? Math.round(subtotal * 0.1) : 0
    const tax = Math.round((subtotal - discount) * TAX_RATE)
    const customer = rng() < 0.6 ? pick(rng, customers) : null
    const status: OrderStatus =
      dayAgo === 0
        ? pick(rng, ['pending', 'confirmed', 'preparing', 'preparing', 'ready', 'out-for-delivery', 'completed', 'completed'] as const)
        : rng() < 0.07
          ? 'cancelled'
          : 'completed'
    const source =
      type === 'online'
        ? pick(rng, ['Foodpanda', 'Foodpanda', 'Foodpanda', 'Website', 'Website', 'Mobile app'] as const)
        : type === 'delivery'
          ? 'Phone call'
          : 'POS'
    const channel = channelFor(type, source)
    const branchId = pick(rng, ['b1', 'b1', 'b2', 'b3'])
    const method: PaymentMethod =
      channel === 'foodpanda'
        ? 'online'
        : channel === 'website'
          ? pick(rng, ['online', 'online', 'cash'] as const)
          : pick(rng, ['cash', 'cash', 'card', 'online', 'split'] as const)
    const total = subtotal - discount + tax

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
        fee: distanceKm > 5 ? 250 : distanceKm > 2.5 ? 180 : 120,
        distanceKm,
        etaMinutes: Math.round(12 + distanceKm * 4),
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
        prepMinutes: pick(rng, [15, 20, 25, 30] as const),
        commissionRate: FOODPANDA_COMMISSION_RATE,
        commission,
        netPayout: total - commission,
        riderName: status === 'ready' || status === 'out-for-delivery' || status === 'completed' ? pick(rng, FOODPANDA_RIDERS) : null,
        rejectReason: acceptance === 'rejected' ? pick(rng, ['Item out of stock', 'Kitchen too busy', 'Outside delivery hours'] as const) : undefined,
      }
    }

    list.push({
      id: `o${i + 1}`,
      number: `#${3200 - i}`,
      customerId: customer?.id ?? null,
      customerName:
        customer?.name ??
        (channel === 'foodpanda' ? 'Foodpanda customer' : channel === 'website' ? 'Website guest' : 'Walk-in customer'),
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
      tableId: type === 'dine-in' ? `tb${int(rng, 1, 12)}` : null,
      createdAt: isoDaysAgo(config.referenceDate, dayAgo, hour, int(rng, 0, 59)),
      notes: rng() < 0.2 ? 'Less spicy please' : '',
      source,
      channel,
      delivery,
      foodpanda,
      website,
    })
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})()

export const tables: DiningTable[] = (() => {
  const rng = createRng(88)
  const layout: Array<[number, number, DiningTable['shape'], number]> = [
    [8, 10, 'round', 2], [30, 10, 'round', 2], [52, 10, 'square', 4], [74, 10, 'square', 4],
    [8, 40, 'square', 4], [30, 40, 'wide', 6], [58, 40, 'wide', 6], [84, 40, 'round', 2],
    [8, 72, 'round', 4], [30, 72, 'square', 4], [52, 72, 'wide', 8], [78, 72, 'wide', 8],
  ]
  return ['b1', 'b2', 'b3'].flatMap((branchId) =>
    layout.map(([x, y, shape, capacity], i) => {
      const status = pick(rng, ['available', 'available', 'occupied', 'occupied', 'reserved'] as const)
      return {
        id: `tb${i + 1}-${branchId}`,
        branchId,
        number: i + 1,
        capacity,
        status,
        x,
        y,
        shape,
        orderId: status === 'occupied' ? `o${int(rng, 1, 22)}` : null,
      }
    }),
  )
})()
