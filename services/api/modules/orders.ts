/**
 * Front of house — orders, kitchen, tables, payments and receipts.
 *
 *   Orders    GET/POST /api/orders, GET /api/orders/{id}, POST /api/orders/{id}/transitions,
 *             PUT /api/orders/{id}/lines/{lineId}/kitchen-status
 *   Kitchen   GET /api/kitchen/tickets
 *   Tables    GET/POST /api/dining-tables, PUT /api/dining-tables/{id}/status
 *   Payments  GET/POST /api/payments, POST /api/payments/{id}/refunds
 *   Receipts  GET/POST /api/receipts, POST /api/receipts/{id}/reprints
 *
 * Every one of these needs exactly one X-Branch-Id: lists fan out over the branches in scope,
 * writes go to the record's own branch. Money, tax and discounts always come from the server's
 * order snapshot — the client never prices a live order. Foodpanda and website orders arrive
 * through the backend's adapters and are told apart by `source`; the provider webhooks under
 * /api/integrations/foodpanda are never called from here.
 */
import { api, operationId } from '@/services/api/client'
import { acrossBranches, apiRepository, scopeBranchIds, UnsupportedOperationError, type Cached } from '@/services/api/adapter'
import { compact, fromMinor, text } from '@/services/api/mappers'
import { customerAddresses } from '@/services/api/modules/customers'
import { advanceTask, assignDriver, createDeliveryTask, listDeliveryTasks, taskStatusToUi, toDeliveryInfo } from '@/services/api/modules/delivery'
import type {
  CatalogItemDto,
  CatalogResponseDto,
  CreateDiningTableDto,
  CreateOrderDto,
  DeliveryTaskResponseDto,
  DiningTableResponseDto,
  IssueReceiptDto,
  KitchenTicketResponseDto,
  LineKitchenStatusDto,
  OrderLineInputDto,
  OrderLineResponseDto,
  OrderResponseDto,
  PaymentResponseDto,
  ReceiptResponseDto,
  RecordPaymentDto,
  RefundPaymentDto,
  RefundResponseDto,
  TableStatusDto,
  TransitionOrderDto,
} from '@/services/api/generated/schemas'
import type {
  DiningTable,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  SalesChannel,
  TableStatus,
} from '@/types'

type BackendStatus = OrderResponseDto['status']
type KitchenStatus = OrderLineResponseDto['kitchen_status']
type WireMethod = PaymentResponseDto['method']

/* ------------------------------------------------------------ mappings */

/** Backend lifecycle → the UI's simpler one. `served` (food at the table, bill still open) shows as ready. */
const statusToUi: Record<BackendStatus, OrderStatus> = {
  draft: 'pending',
  placed: 'pending',
  accepted: 'confirmed',
  preparing: 'preparing',
  ready: 'ready',
  served: 'ready',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled',
}

/**
 * UI status → backend target. `out-for-delivery` has no order status in the API: it is the
 * delivery task's stage (derived on read, written through the delivery board).
 */
const statusFromUi: Partial<Record<OrderStatus, BackendStatus>> = {
  pending: 'placed',
  confirmed: 'accepted',
  preparing: 'preparing',
  ready: 'ready',
  completed: 'completed',
  cancelled: 'cancelled',
}

/** Forward path used to step through intermediate states (e.g. placed → accepted → preparing). */
const lifecycle: BackendStatus[] = ['draft', 'placed', 'accepted', 'preparing', 'ready', 'served', 'completed']

const serviceToType: Record<OrderResponseDto['service_type'], OrderType> = { dine_in: 'dine-in', takeaway: 'takeaway', delivery: 'delivery' }
const typeToService: Record<Exclude<OrderType, 'online'>, CreateOrderDto['service_type']> = { 'dine-in': 'dine_in', takeaway: 'takeaway', delivery: 'delivery' }
const sourceLabel: Record<OrderResponseDto['source'], string> = { pos: 'POS', website: 'Website', foodpanda: 'Foodpanda', other: 'Other' }

const methodToUi: Record<WireMethod, PaymentMethod> = { cash: 'cash', card: 'card', bank_transfer: 'online', external_platform: 'online', other: 'online' }
export const methodFromUi: Record<Exclude<PaymentMethod, 'split' | 'unknown'>, WireMethod> = { cash: 'cash', card: 'card', online: 'other' }

function channelOf(d: OrderResponseDto): SalesChannel {
  if (d.source === 'foodpanda') return 'foodpanda'
  if (d.source === 'website') return 'website'
  return d.service_type === 'dine_in' ? 'dine-in' : d.service_type === 'takeaway' ? 'takeaway' : 'own-delivery'
}

function paymentStatusOf(d: Pick<OrderResponseDto, 'total_minor' | 'paid_minor' | 'refunded_minor' | 'due_minor'>): PaymentStatus {
  if (d.refunded_minor > 0 && d.refunded_minor >= d.paid_minor) return 'refunded'
  if (d.total_minor > 0 && d.due_minor <= 0) return 'paid'
  if (d.paid_minor > 0) return 'partial'
  return 'unpaid'
}

const lineToItem = (l: OrderLineResponseDto): OrderItem => {
  const options = [l.variant_name, ...l.modifiers.map((m) => m.name)].filter((x): x is string => !!x)
  return {
    productId: l.menu_item_id ?? '',
    name: l.name || text(l.name_i18n),
    quantity: l.quantity,
    unitPrice: fromMinor(l.unit_price_minor + l.modifiers.reduce((s, m) => s + m.price_minor, 0)),
    ...(options.length ? { options } : {}),
  }
}

/** Order DTO plus what the list joined onto it (its delivery task and payment methods). */
interface OrderRow {
  order: OrderResponseDto
  task?: DeliveryTaskResponseDto
  methods?: WireMethod[]
}

const awaitingAcceptance = (d: OrderResponseDto) => d.status === 'draft' || d.status === 'placed'

function toUi({ order: d, task, methods }: OrderRow): Order {
  const channel = channelOf(d)
  const closed = d.status === 'completed' || d.status === 'cancelled' || d.status === 'rejected'
  const onTheWay = !closed && task && taskStatusToUi[task.status] === 'picked-up'
  const acceptance = d.status === 'rejected' ? 'rejected' : awaitingAcceptance(d) ? 'awaiting' : 'accepted'
  const distinct = [...new Set(methods ?? [])]
  const coupon = d.discounts.find((x) => x.source === 'coupon')
  return {
    id: d.id,
    number: d.number,
    customerId: d.customer_id ?? null,
    customerName: d.customer_name || (d.source === 'pos' ? 'Walk-in customer' : ''),
    type: d.source === 'foodpanda' || d.source === 'website' ? 'online' : serviceToType[d.service_type],
    status: onTheWay ? 'out-for-delivery' : statusToUi[d.status],
    paymentStatus: paymentStatusOf(d),
    // No payment recorded yet → the neutral first method.
    paymentMethod: distinct.length > 1 ? 'split' : distinct.length ? methodToUi[distinct[0]] : d.source === 'foodpanda' ? 'online' : 'cash',
    items: d.lines.map(lineToItem),
    subtotal: fromMinor(d.subtotal_minor),
    discount: fromMinor(d.discount_minor),
    // All tax in the order: added (exclusive) plus contained in prices (inclusive).
    tax: fromMinor(d.tax_minor + d.inclusive_tax_minor),
    total: fromMinor(d.total_minor),
    branchId: d.branch_id,
    tableId: d.table_id ?? null,
    createdAt: d.placed_at ?? d.created_at,
    notes: d.notes || d.kitchen_notes || '',
    source: sourceLabel[d.source],
    channel,
    ...(task ? { delivery: toDeliveryInfo(task) } : {}),
    ...(d.source === 'foodpanda'
      ? {
          foodpanda: {
            externalId: d.external_reference || d.external_order_id || '',
            acceptance,
            ...(d.status === 'rejected' && d.status_reason_code ? { rejectReason: d.status_reason_code } : {}),
          },
        }
      : {}),
    ...(d.source === 'website'
      ? {
          website: {
            fulfillment: d.service_type === 'delivery' ? 'delivery' : 'pickup',
            acceptance,
            device: 'desktop' as const,
            ...(coupon ? { promoCode: coupon.code } : {}),
          },
        }
      : {}),
    ...(d.discounts[0] ? { discountId: d.discounts[0].discount_id } : {}),
  }
}

/* -------------------------------------------------- fresh-state tracking */

/** Newest order DTO seen per id (lists, gets, transitions), so versions never go stale mid-chain. */
const latest = new Map<string, OrderResponseDto>()
/** Delivery task per order id. */
const tasks = new Map<string, DeliveryTaskResponseDto>()

function seen(d: OrderResponseDto) {
  const prev = latest.get(d.id)
  if (!prev || prev.version <= d.version) latest.set(d.id, d)
  return latest.get(d.id)!
}

/** Branch an order lives in: from what we have seen, else probe the branches in scope. */
async function fetchOrder(id: string, branchId?: string): Promise<OrderResponseDto> {
  const known = branchId ?? latest.get(id)?.branch_id
  if (known) return seen(await api.get<OrderResponseDto>(`/orders/${id}`, { branchId: known }))
  let lastErr: unknown
  for (const b of scopeBranchIds()) {
    try {
      return seen(await api.get<OrderResponseDto>(`/orders/${id}`, { branchId: b }))
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('Order not found in the selected branches')
}

/* ------------------------------------------------------------- reading */

async function listOrders(): Promise<OrderRow[]> {
  const perBranch = await acrossBranches(async (b) => {
    const [rows, branchTasks, payments] = await Promise.all([
      api.listAll<OrderResponseDto>('/orders', { branchId: b }),
      // Side data is best-effort: a role without delivery or payment access still sees orders.
      listDeliveryTasks(b).catch(() => [] as DeliveryTaskResponseDto[]),
      api.listAll<PaymentResponseDto>('/payments', { branchId: b }).catch(() => [] as PaymentResponseDto[]),
    ])
    return [{ rows, branchTasks, payments }]
  })
  const out: OrderRow[] = []
  for (const { rows, branchTasks, payments } of perBranch) {
    const taskOf = new Map<string, DeliveryTaskResponseDto>()
    for (const t of branchTasks) {
      // Keep the newest task per order (a failed one may have been replaced).
      const prev = taskOf.get(t.order_id)
      if (!prev || prev.created_at < t.created_at) taskOf.set(t.order_id, t)
    }
    const methodsOf = new Map<string, WireMethod[]>()
    for (const p of payments) {
      if (p.status !== 'captured' && p.status !== 'partially_refunded' && p.status !== 'refunded') continue
      methodsOf.set(p.order_id, [...(methodsOf.get(p.order_id) ?? []), p.method])
    }
    for (const o of rows) {
      const task = taskOf.get(o.id)
      if (task) tasks.set(o.id, task)
      else tasks.delete(o.id)
      out.push({ order: seen(o), task, methods: methodsOf.get(o.id) })
    }
  }
  return out
}

/* ---------------------------------------------------------- transitions */

const REASON = { cancelled: 'cancelled_by_staff', rejected: 'rejected_by_restaurant' } as const

function transition(d: OrderResponseDto, to: BackendStatus): Promise<OrderResponseDto> {
  const body: TransitionOrderDto = {
    to_status: to,
    expected_version: d.version,
    ...(to === 'cancelled' || to === 'rejected' ? { reason_code: REASON[to] } : {}),
  }
  return api.post<OrderResponseDto>(`/orders/${d.id}/transitions`, body, { branchId: d.branch_id }).then(seen)
}

/**
 * Move an order to `target`, stepping forward through intermediate lifecycle states the server
 * offers in `next_statuses`. Anything the server does not allow is rejected with its reason.
 */
async function moveTo(start: OrderResponseDto, target: BackendStatus): Promise<OrderResponseDto> {
  let d = start
  for (let guard = 0; guard < lifecycle.length; guard++) {
    if (d.status === target) return d
    if (d.next_statuses.includes(target)) return transition(d, target)
    const at = lifecycle.indexOf(d.status)
    const goal = lifecycle.indexOf(target)
    const step = at >= 0 && goal > at ? [...lifecycle.slice(at + 1, goal)].reverse().find((s) => d.next_statuses.includes(s)) : undefined
    if (!step) {
      const allowed = d.next_statuses.length ? d.next_statuses.join(', ') : 'none'
      throw new Error(`Order ${d.number} is "${d.status_label}" and cannot move to "${target}" (allowed next: ${allowed})`)
    }
    d = await transition(d, step)
  }
  return d
}

/** Apply a delivery-board change (rider assignment, stage) to the order's delivery task. */
async function applyDelivery(d: OrderResponseDto, next: NonNullable<Order['delivery']>) {
  let task = tasks.get(d.id)
  if (!task) throw new Error(`Order ${d.number} has no delivery task yet`)
  const current = toDeliveryInfo(task)
  if (next.riderId && next.riderId !== current.riderId) {
    task = await assignDriver(task, next.riderId)
  }
  if (next.status !== taskStatusToUi[task.status] && next.status !== 'assigned') {
    task = await advanceTask(task, next.status)
  }
  tasks.set(d.id, task)
  return task
}

/** Fields the UI may send along with a status change that are derived on read (ignored). */
const DERIVED: (keyof Order)[] = ['status', 'paymentStatus', 'foodpanda', 'website', 'delivery']

async function updateOrder(id: string, patch: Partial<Order>, current: Cached<Order, OrderRow> | undefined): Promise<OrderRow> {
  const unsupported = (Object.keys(patch) as (keyof Order)[]).filter((k) => !DERIVED.includes(k))
  if (unsupported.length) throw new UnsupportedOperationError('Orders', `edit ${unsupported.join(', ')}`)

  let d = latest.get(id) ?? current?.dto.order ?? (await fetchOrder(id))

  if (patch.delivery) {
    await applyDelivery(d, patch.delivery)
    d = await fetchOrder(id, d.branch_id)
    // "On the way" is the task's stage; a delivered task completes the order when the server allows it.
    if (patch.status === 'completed' && d.next_statuses.includes('completed')) d = await transition(d, 'completed')
  } else if (patch.status && patch.status !== statusToUi[d.status]) {
    const rejecting = patch.status === 'cancelled' && (patch.foodpanda?.acceptance === 'rejected' || patch.website?.acceptance === 'rejected')
    const target: BackendStatus | undefined = rejecting && d.next_statuses.includes('rejected') ? 'rejected' : statusFromUi[patch.status]
    if (!target) {
      throw new Error(
        patch.status === 'out-for-delivery'
          ? 'Orders go out for delivery from the delivery board (the rider picks up the delivery task)'
          : `Status "${patch.status}" is not available in the RMS API`,
      )
    }
    d = await moveTo(d, target)
  }
  return { order: d, task: tasks.get(id), methods: current?.dto.methods }
}

/* ---------------------------------------------------------- menu lines */

const optionNames = (x: { name?: string | null; short_name?: string | null; name_i18n: Record<string, unknown> }) =>
  [x.name, x.short_name, text(x.name_i18n)].filter((v): v is string => !!v).map((v) => v.trim().toLowerCase())

/**
 * Cart lines → order lines. Prices are never sent (the server prices from the menu); option names
 * from the cart are resolved to the branch catalog's variant / modifier ids.
 */
async function toOrderLines(branchId: string, items: OrderItem[]): Promise<OrderLineInputDto[]> {
  const deal = items.find((i) => i.dealId)
  if (deal) throw new Error(`"${deal.name}" is a deal; deals cannot be sold through the RMS API yet`)
  let catalog: Map<string, CatalogItemDto> | null = null
  const loadCatalog = async () => {
    if (catalog) return catalog
    const c = await api.get<CatalogResponseDto>('/menu/catalog', { branchId, query: { channel: 'pos' } })
    catalog = new Map(c.menus.flatMap((m) => m.categories.flatMap((cat) => cat.items.map((it) => [it.id, it] as const))))
    return catalog
  }
  const lines: OrderLineInputDto[] = []
  for (const item of items) {
    const line: OrderLineInputDto = { menu_item_id: item.productId, quantity: item.quantity }
    if (item.options?.length) {
      const entry = (await loadCatalog()).get(item.productId)
      if (!entry) throw new Error(`"${item.name}" is not on this branch's menu`)
      const modifiers = entry.modifier_groups.flatMap((g) => g.modifiers)
      const modifierIds: string[] = []
      for (const opt of item.options) {
        const key = opt.trim().toLowerCase()
        const variant = entry.variants.find((v) => optionNames(v).includes(key))
        if (variant) {
          line.variant_id = variant.id
          continue
        }
        const modifier = modifiers.find((m) => optionNames(m).includes(key))
        if (!modifier) throw new Error(`Option "${opt}" of "${item.name}" is not on this branch's menu`)
        modifierIds.push(modifier.id)
      }
      if (modifierIds.length) line.modifier_ids = modifierIds
    }
    lines.push(line)
  }
  return lines
}

/* --------------------------------------------------------------- orders */

export const orders = apiRepository<Order, OrderRow>({
  name: 'Orders',
  list: listOrders,
  toUi,
  get: async (id) => {
    const order = await fetchOrder(id)
    return { order, task: tasks.get(id) }
  },
  create: async (input) => {
    if (input.type === 'online' || input.channel === 'website' || input.channel === 'foodpanda') {
      throw new UnsupportedOperationError('Orders', 'place website / marketplace orders (they arrive through the backend)')
    }
    const order = await placeOrder(
      { branchId: input.branchId, type: input.type, tableId: input.tableId, customerId: input.customerId, customerName: input.customerName, items: input.items, notes: input.notes },
      newCheckoutKeys(),
    )
    return { order, task: tasks.get(order.id) }
  },
  update: updateOrder,
  // Orders are never deleted; cancel them instead.
})

/* --------------------------------------------------------------- POS */

/** What the POS sends to place an order. Prices, tax and discounts are decided by the server. */
export interface OrderDraft {
  branchId: string
  type: OrderType
  tableId: string | null
  customerId: string | null
  customerName?: string
  items: OrderItem[]
  notes?: string
  couponCode?: string
}

/**
 * Idempotency keys for one checkout. Created ONCE per user action and reused on every retry, so
 * a retry after a lost response returns the original order / payment / receipt instead of
 * creating another. `payment` freezes the first payment body: a retry must repeat it exactly.
 */
export interface CheckoutKeys {
  orderId: string
  orderOperationId: string
  deliveryTaskId: string
  paymentId: string
  paymentKey: string
  receiptOperationId: string
  payment?: RecordPaymentDto
}

export const newCheckoutKeys = (): CheckoutKeys => ({
  orderId: operationId(),
  orderOperationId: operationId(),
  deliveryTaskId: operationId(),
  paymentId: operationId(),
  paymentKey: operationId(),
  receiptOperationId: operationId(),
})

/** Live order totals as the server computed them (rupees). */
export interface ServerTotals {
  subtotal: number
  discount: number
  tax: number
  deliveryFee: number
  serviceCharge: number
  total: number
  paid: number
  due: number
}

export const totalsOf = (d: OrderResponseDto): ServerTotals => ({
  subtotal: fromMinor(d.subtotal_minor),
  discount: fromMinor(d.discount_minor),
  tax: fromMinor(d.tax_minor + d.inclusive_tax_minor),
  deliveryFee: fromMinor(d.delivery_fee_minor),
  serviceCharge: fromMinor(d.service_charge_minor),
  total: fromMinor(d.total_minor),
  paid: fromMinor(d.paid_minor),
  due: fromMinor(d.due_minor),
})

/** Live order mapped to the UI type (with its delivery task, if any). */
export const orderToUi = (d: OrderResponseDto) => toUi({ order: d, task: tasks.get(d.id) })

/**
 * Create a server-priced order (plus its delivery task for delivery orders) under `keys`.
 * Delivery needs a customer with a saved address — the POS does not collect one.
 */
export async function placeOrder(draft: OrderDraft, keys: CheckoutKeys): Promise<OrderResponseDto> {
  if (draft.type === 'online') throw new Error('Online orders cannot be placed from the POS')
  if (!draft.items.length) throw new Error('The cart is empty')
  const lines = await toOrderLines(draft.branchId, draft.items)

  let address: Record<string, unknown> | undefined
  if (draft.type === 'delivery') {
    if (!draft.customerId) throw new Error('Delivery orders need a customer with a saved address')
    const saved = (await customerAddresses(draft.customerId))[0]
    if (!saved) throw new Error('This customer has no saved address for delivery')
    address = compact({
      line1: saved.line1,
      line2: saved.line2 ?? undefined,
      area: saved.area ?? undefined,
      city: saved.city ?? undefined,
      postal_code: saved.postal_code ?? undefined,
    })
  }

  const body: CreateOrderDto = {
    id: keys.orderId,
    operation_id: keys.orderOperationId,
    source: 'pos',
    service_type: typeToService[draft.type],
    lines,
    ...compact({
      table_id: draft.type === 'dine-in' ? draft.tableId ?? undefined : undefined,
      customer_id: draft.customerId ?? undefined,
      customer_name: !draft.customerId && draft.customerName ? draft.customerName : undefined,
      delivery_address: address,
      coupon_code: draft.couponCode || undefined,
      notes: draft.notes || undefined,
    }),
  }
  let order = seen(await api.post<OrderResponseDto>('/orders', body, { branchId: draft.branchId }))

  if (draft.type === 'delivery') {
    // Idempotent per order; the zone fee is added to the (still unpaid) order, so re-read it.
    const task = await createDeliveryTask(order.branch_id, { id: keys.deliveryTaskId, order_id: order.id })
    tasks.set(order.id, task)
    order = await fetchOrder(order.id, order.branch_id)
  }
  return order
}

/**
 * Record a captured payment for what the server says is due. The body is frozen into `keys` on the
 * first attempt, so a retry with the same idempotency key is byte-identical (never a second charge).
 */
export async function payOrder(order: OrderResponseDto, method: Exclude<PaymentMethod, 'split' | 'unknown'>, keys: CheckoutKeys) {
  if (!keys.payment) {
    if (order.due_minor <= 0) return { order, payment: null }
    keys.payment = {
      id: keys.paymentId,
      order_id: order.id,
      method: methodFromUi[method],
      amount_minor: order.due_minor,
      currency: order.currency,
      idempotency_key: keys.paymentKey,
    }
  }
  const payment = await api.post<PaymentResponseDto>('/payments', keys.payment, { branchId: order.branch_id })
  const fresh = await fetchOrder(order.id, order.branch_id)
  return { order: fresh, payment }
}

/** Issue (or re-fetch — the server returns the same one) the receipt of a fully paid order. */
export function issueReceipt(orderId: string, branchId: string, opId: string) {
  const body: IssueReceiptDto = { order_id: orderId, operation_id: opId }
  return api.post<ReceiptResponseDto>('/receipts', body, { branchId })
}

export const receiptsForOrder = (orderId: string, branchId: string) =>
  api.listAll<ReceiptResponseDto>('/receipts', { branchId, query: { order_id: orderId } })

/** Counted and audited server-side; not idempotent. */
export const reprintReceipt = (r: ReceiptResponseDto) => api.post<ReceiptResponseDto>(`/receipts/${r.id}/reprints`, undefined, { branchId: r.branch_id })

export const paymentsForOrder = (orderId: string, branchId: string) =>
  api.listAll<PaymentResponseDto>('/payments', { branchId, query: { order_id: orderId } })

/** Refund `amount` (rupees) of a payment. `key` must be generated once per user action. */
export function refundPayment(p: PaymentResponseDto, amount: number, key: string, reason = 'staff_refund') {
  const body: RefundPaymentDto = { amount_minor: Math.round(amount * 100), reason_code: reason, idempotency_key: key }
  return api.post<RefundResponseDto>(`/payments/${p.id}/refunds`, body, { branchId: p.branch_id })
}

export { fetchOrder }

/* ------------------------------------------------------------- kitchen */

/** A kitchen ticket shaped as an Order for the board, plus each line's id and kitchen state. */
export interface KitchenOrder extends Order {
  lines: { id: string; status: KitchenStatus }[]
  version: number
}

const ticketToUi = (t: KitchenTicketResponseDto, branchId: string): KitchenOrder => ({
  id: t.id,
  number: t.number,
  customerId: null,
  customerName: '',
  type: serviceToType[t.service_type],
  status: statusToUi[t.status],
  paymentStatus: 'unpaid',
  paymentMethod: 'cash',
  items: t.lines.map(lineToItem),
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  branchId,
  tableId: t.table_id ?? null,
  createdAt: t.accepted_at ?? t.created_at,
  notes: t.kitchen_notes ?? '',
  source: '',
  lines: t.lines.map((l) => ({ id: l.id, status: l.kitchen_status })),
  version: t.version,
})

/** Kitchen board: accepted, preparing and ready orders of every branch in scope (oldest first). */
export async function kitchenTickets(): Promise<KitchenOrder[]> {
  const rows = await acrossBranches(async (b) =>
    (await api.listAll<KitchenTicketResponseDto>('/kitchen/tickets', { branchId: b })).map((t) => ticketToUi(t, b)),
  )
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Move a ticket's order to a UI status (same rules as the orders list). */
export async function advanceKitchenOrder(o: KitchenOrder, next: OrderStatus) {
  // Tickets carry no transition data; read the order from its own branch first.
  await fetchOrder(o.id, o.branchId)
  await updateOrder(o.id, { status: next }, undefined)
}

export function setLineKitchenStatus(o: KitchenOrder, lineId: string, status: KitchenStatus) {
  const body: LineKitchenStatusDto = { status }
  return api.put<KitchenTicketResponseDto>(`/orders/${o.id}/lines/${lineId}/kitchen-status`, body, { branchId: o.branchId })
}

/* -------------------------------------------------------------- tables */

const tableStatusToUi: Record<DiningTableResponseDto['status'], TableStatus> = {
  available: 'available',
  occupied: 'occupied',
  reserved: 'reserved',
  // The floor plan has no "out of service" state; it is not seatable, like a reservation.
  out_of_service: 'reserved',
}

/** Position of a table within its branch, for codes that carry no number. */
const ordinal = new Map<string, number>()

const tableNumber = (d: DiningTableResponseDto) => {
  const digits = d.code.match(/\d+/)
  return digits ? Number(digits[0]) : (ordinal.get(d.id) ?? 0)
}

export const tables = apiRepository<DiningTable, DiningTableResponseDto>({
  name: 'Tables',
  list: () =>
    acrossBranches(async (b) => {
      const rows = await api.listAll<DiningTableResponseDto>('/dining-tables', { branchId: b })
      rows.forEach((r, i) => ordinal.set(r.id, i + 1))
      return rows
    }),
  toUi: (d) => ({
    id: d.id,
    branchId: d.branch_id,
    number: tableNumber(d),
    capacity: d.seats,
    status: tableStatusToUi[d.status],
    orderId: d.current_order_id ?? null,
  }),
  create: (input) => {
    const body: CreateDiningTableDto = { code: String(input.number), seats: input.capacity }
    return api.post<DiningTableResponseDto>('/dining-tables', body, { branchId: input.branchId })
  },
  update: async (id, patch, current) => {
    if (!current) throw new Error('Table not loaded; refresh and try again')
    const unsupported = Object.keys(patch).filter((k) => k !== 'status' && k !== 'orderId')
    if (unsupported.length) throw new UnsupportedOperationError('Tables', `edit ${unsupported.join(', ')}`)
    const status = patch.status
    if (!status || status === tableStatusToUi[current.dto.status]) return current.dto
    if (status === 'occupied') throw new Error('A table becomes occupied when an order is placed on it')
    const body: TableStatusDto = { status, expected_version: current.dto.version }
    return api.put<DiningTableResponseDto>(`/dining-tables/${id}/status`, body, { branchId: current.dto.branch_id })
  },
})
