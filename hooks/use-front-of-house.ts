'use client'

/**
 * Live-mode front-of-house data that is not a plain repository: kitchen tickets, the POS
 * checkout (order → payment → receipt with retry-safe keys), receipts, payments and customer
 * statistics. SWR keys carry the tenant and branch selection like hooks/use-resource.ts.
 */
import useSWR from 'swr'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'
import { useSession } from '@/services/api/session'
import { ApiError, errorMessage, NetworkError, operationId } from '@/services/api/client'
import { scopeBranchIds } from '@/services/api/adapter'
import { createDeliveryTask, deliverySettings, deliverySummary, deliveryZones } from '@/services/api/modules/delivery'
import {
  advanceKitchenOrder,
  issueReceipt,
  kitchenTickets,
  newCheckoutKeys,
  payOrder,
  paymentsForOrder,
  placeOrder,
  receiptsForOrder,
  refundPayment,
  reprintReceipt,
  setLineKitchenStatus,
  totalsOf,
  type CheckoutKeys,
  type KitchenOrder,
  type OrderDraft,
  type ServerTotals,
} from '@/services/api/modules/orders'
import {
  addAddress,
  customerAddresses,
  customerDetail,
  removeAddress,
  updateAddress,
  type AddressInput,
} from '@/services/api/modules/customers'
import type {
  CustomerAddressResponseDto,
  DeliverySettingsResponseDto,
  DeliveryZoneResponseDto,
  OrderResponseDto,
  PaymentResponseDto,
  ReceiptResponseDto,
} from '@/services/api/generated/schemas'
import type { Order, OrderStatus, PaymentMethod } from '@/types'

/** Shown whenever a request's outcome is unknown (offline, timeout). */
export const UNKNOWN_OUTCOME = 'Connection lost: the status is unknown. Check the order before retrying; retrying this same sale reuses its keys and will not charge twice.'

function useLiveKey(name: string, ...parts: (string | null | undefined)[]) {
  const branchIds = useAppStore((s) => s.branchIds)
  const tenantId = useSession((s) => s.tenant?.id)
  if (!tenantId || parts.some((p) => p === null)) return null
  return `foh:${name}:${tenantId}:${branchIds.join(',')}:${parts.join(':')}`
}

const report = (err: unknown) => toast.error(err instanceof NetworkError ? UNKNOWN_OUTCOME : errorMessage(err))

/* -------------------------------------------------------------- kitchen */

export function useKitchenTickets() {
  const key = useLiveKey('kitchen')
  const { data, error, isLoading, mutate } = useSWR<KitchenOrder[]>(key, kitchenTickets, { revalidateOnFocus: true, refreshInterval: 20_000 })

  const advance = useCallback(
    async (o: KitchenOrder, next: OrderStatus) => {
      try {
        await advanceKitchenOrder(o, next)
      } catch (err) {
        report(err)
        throw err
      } finally {
        await mutate()
      }
    },
    [mutate],
  )

  const setLine = useCallback(
    async (o: KitchenOrder, lineId: string, status: KitchenOrder['lines'][number]['status']) => {
      try {
        await setLineKitchenStatus(o, lineId, status)
      } catch (err) {
        report(err)
      } finally {
        await mutate()
      }
    },
    [mutate],
  )

  return { data, error, isLoading, advance, setLine }
}

/* ------------------------------------------------------------------ POS */

export interface PendingSale {
  order: OrderResponseDto
  totals: ServerTotals
  keys: CheckoutKeys
}

/**
 * Two-step live checkout. `place(draft)` creates the server-priced order; `pay(method)` records
 * the payment for the server's due amount and issues the receipt. Keys are generated once per
 * sale and reused on every retry; a lost response is reported as "status unknown", never as a
 * failure, and the same keys are retried so nothing is created or charged twice.
 */
export function usePosCheckout() {
  const attempt = useRef<{ signature: string; keys: CheckoutKeys } | null>(null)
  const [pending, setPending] = useState<PendingSale | null>(null)
  const [busy, setBusy] = useState(false)
  const [unknown, setUnknown] = useState(false)

  const place = useCallback(async (draft: OrderDraft): Promise<PendingSale | null> => {
    const signature = JSON.stringify(draft)
    // Same sale as an unfinished attempt → same keys (the server returns the original order).
    if (!attempt.current || attempt.current.signature !== signature) attempt.current = { signature, keys: newCheckoutKeys() }
    const keys = attempt.current.keys
    setBusy(true)
    try {
      const order = await placeOrder(draft, keys)
      setUnknown(false)
      const sale = { order, totals: totalsOf(order), keys }
      setPending(sale)
      return sale
    } catch (err) {
      setUnknown(err instanceof NetworkError)
      report(err)
      return null
    } finally {
      setBusy(false)
    }
  }, [])

  const pay = useCallback(
    async (method: Exclude<PaymentMethod, 'split' | 'unknown'>): Promise<{ receipt: ReceiptResponseDto | null; order: OrderResponseDto } | null> => {
      if (!pending) return null
      setBusy(true)
      try {
        const { order } = await payOrder(pending.order, method, pending.keys)
        setUnknown(false)
        setPending({ ...pending, order, totals: totalsOf(order) })
        let receipt: ReceiptResponseDto | null = null
        if (order.due_minor <= 0) {
          try {
            receipt = await issueReceipt(order.id, order.branch_id, pending.keys.receiptOperationId)
          } catch (err) {
            toast.warning(
              err instanceof NetworkError
                ? 'Paid. The receipt status is unknown; check Receipts before issuing it again.'
                : `Paid, but the receipt was not issued: ${errorMessage(err)}`,
            )
          }
        }
        return { receipt, order }
      } catch (err) {
        setUnknown(err instanceof NetworkError)
        toast.error(
          err instanceof NetworkError
            ? `Payment status unknown for order ${pending.order.number}. Check the order before retrying; retrying reuses the same payment key and will not charge twice.`
            : `Order ${pending.order.number} is placed but the payment was not recorded: ${errorMessage(err)}`,
        )
        return null
      } finally {
        setBusy(false)
      }
    },
    [pending],
  )

  /** Finish the sale (paid, or left unpaid to settle later). */
  const reset = useCallback(() => {
    attempt.current = null
    setPending(null)
    setUnknown(false)
  }, [])

  return { pending, busy, unknown, place, pay, reset }
}

/* ------------------------------------------------------------- receipts */

export function useOrderReceipts(order: Pick<Order, 'id' | 'branchId'> | null | undefined) {
  const key = useLiveKey('receipts', order?.id ?? null)
  const { data, isLoading, mutate } = useSWR<ReceiptResponseDto[]>(key, () => receiptsForOrder(order!.id, order!.branchId), { revalidateOnFocus: false })
  // One operation id per order for this screen, reused if the user retries after a lost response.
  const ops = useRef(new Map<string, string>())
  const [busy, setBusy] = useState(false)

  const issue = useCallback(async () => {
    if (!order) return null
    const op = ops.current.get(order.id) ?? operationId()
    ops.current.set(order.id, op)
    setBusy(true)
    try {
      const r = await issueReceipt(order.id, order.branchId, op)
      await mutate()
      return r
    } catch (err) {
      report(err)
      return null
    } finally {
      setBusy(false)
    }
  }, [order, mutate])

  const reprint = useCallback(
    async (r: ReceiptResponseDto) => {
      setBusy(true)
      try {
        const out = await reprintReceipt(r)
        await mutate()
        return out
      } catch (err) {
        toast.error(err instanceof NetworkError ? 'Reprint status unknown; check the print count before reprinting again.' : errorMessage(err))
        return null
      } finally {
        setBusy(false)
      }
    },
    [mutate],
  )

  return { receipts: data, isLoading, busy, issue, reprint }
}

/* ------------------------------------------------------------- payments */

export function useOrderPayments(order: Pick<Order, 'id' | 'branchId'> | null | undefined) {
  const key = useLiveKey('payments', order?.id ?? null)
  const { data, isLoading, mutate } = useSWR<PaymentResponseDto[]>(key, () => paymentsForOrder(order!.id, order!.branchId), { revalidateOnFocus: false })
  // Refund key per payment, kept until the refund is confirmed so a retry cannot refund twice.
  const keys = useRef(new Map<string, string>())
  const [busy, setBusy] = useState(false)

  const refund = useCallback(
    async (p: PaymentResponseDto) => {
      const remaining = (p.amount_minor - p.refunded_minor) / 100
      if (remaining <= 0) return false
      const k = keys.current.get(p.id) ?? operationId()
      keys.current.set(p.id, k)
      setBusy(true)
      try {
        await refundPayment(p, remaining, k)
        keys.current.delete(p.id)
        await mutate()
        return true
      } catch (err) {
        toast.error(err instanceof NetworkError ? 'Refund status unknown. Check the payment before retrying; a retry reuses the same key.' : errorMessage(err))
        return false
      } finally {
        setBusy(false)
      }
    },
    [mutate],
  )

  return { payments: data, isLoading, busy, refund }
}

/* ------------------------------------------------------------ customers */

export function useCustomerStats(customerId: string | null | undefined) {
  const key = useLiveKey('customer', customerId ?? null)
  const { data, isLoading, mutate } = useSWR(key, () => customerDetail(customerId!), { revalidateOnFocus: false })
  return { stats: data, isLoading, refresh: mutate }
}

/* ------------------------------------------------------------- delivery */

const DELIVERY_CODES: Record<string, string> = {
  DELIVERY_NOT_SERVICEABLE: 'No delivery zone serves this address (or the chosen zone does not cover it).',
  DELIVERY_ADDRESS_REQUIRED: 'This order has no delivery address.',
  DELIVERY_DISABLED: 'Delivery is turned off for this branch.',
  DELIVERY_CLOSED: 'Delivery is closed at this hour for this branch.',
  DELIVERY_MIN_ORDER_NOT_MET: "The order is below the zone's minimum for delivery.",
  ORDER_DELIVERY_FEE_LOCKED: 'The order is already (partly) paid, so a delivery fee can no longer be added.',
}

/** Server message for a delivery error, with the reason spelled out for known codes. */
export function deliveryError(err: unknown) {
  if (err instanceof NetworkError) return 'Connection lost: the delivery status is unknown. Refresh the board before trying again.'
  const code = err instanceof ApiError ? err.code : ''
  return DELIVERY_CODES[code] ? `${DELIVERY_CODES[code]} (${errorMessage(err)})` : errorMessage(err)
}

export interface BranchDelivery {
  branchId: string
  settings: DeliverySettingsResponseDto
  zones: DeliveryZoneResponseDto[]
}

/** Delivery settings and zones of every branch in scope. */
export function useDeliveryConfig() {
  const key = useLiveKey('delivery-config')
  const { data, error, isLoading, mutate } = useSWR<BranchDelivery[]>(
    key,
    () =>
      Promise.all(
        scopeBranchIds().map(async (branchId) => {
          const [settings, zones] = await Promise.all([deliverySettings(branchId), deliveryZones(branchId)])
          return { branchId, settings, zones }
        }),
      ),
    { revalidateOnFocus: false },
  )
  const [busy, setBusy] = useState(false)

  /** Runs one config write; errors (incl. version conflicts) are shown and the data refetched. */
  const write = useCallback(
    async <R,>(run: () => Promise<R>): Promise<R | null> => {
      setBusy(true)
      try {
        return await run()
      } catch (err) {
        toast.error(deliveryError(err))
        return null
      } finally {
        setBusy(false)
        await mutate()
      }
    },
    [mutate],
  )

  return { data, error, isLoading, busy, write }
}

/** Delivered-task figures (fees, average minutes) across the branches in scope. */
export function useDeliverySummary() {
  const key = useLiveKey('delivery-summary')
  const { data } = useSWR(
    key,
    async () => {
      const rows = (await Promise.all(scopeBranchIds().map((b) => deliverySummary(b).catch(() => ({ rows: [] }))))).flatMap((r) => r.rows)
      const delivered = rows.filter((r) => r.status === 'delivered')
      const count = delivered.reduce((s, r) => s + r.task_count, 0)
      const weighted = delivered.reduce((s, r) => s + (r.average_delivery_minutes ?? 0) * r.task_count, 0)
      return {
        delivered: count,
        fees: delivered.reduce((s, r) => s + r.fee_minor, 0) / 100,
        avgMinutes: count ? Math.round(weighted / count) : 0,
      }
    },
    { revalidateOnFocus: false },
  )
  return data
}

/** Create the delivery task of a delivery order (idempotent per order; key kept for retries). */
export function useCreateDeliveryTask(onDone: () => unknown) {
  const keys = useRef(new Map<string, string>())
  const [busyId, setBusyId] = useState<string | null>(null)
  const create = useCallback(
    async (o: Pick<Order, 'id' | 'branchId' | 'number'>, zoneId?: string) => {
      const id = keys.current.get(o.id) ?? operationId()
      keys.current.set(o.id, id)
      setBusyId(o.id)
      try {
        const task = await createDeliveryTask(o.branchId, { id, order_id: o.id, ...(zoneId ? { zone_id: zoneId } : {}) })
        keys.current.delete(o.id)
        toast.success(task.duplicate ? `Delivery for ${o.number} already existed` : `Delivery created for ${o.number}`)
        await onDone()
        return task
      } catch (err) {
        toast.error(deliveryError(err))
        return null
      } finally {
        setBusyId(null)
      }
    },
    [onDone],
  )
  return { create, busyId }
}

export function useCustomerAddresses(customerId: string | null | undefined) {
  const key = useLiveKey('customer-addresses', customerId ?? null)
  const { data, isLoading, mutate } = useSWR<CustomerAddressResponseDto[]>(key, () => customerAddresses(customerId!), { revalidateOnFocus: false })
  const [busy, setBusy] = useState(false)
  /** One address write; the error is shown and `false` returned so a form can stay open. */
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true)
      try {
        await fn()
        return true
      } catch (err) {
        report(err)
        return false
      } finally {
        setBusy(false)
        await mutate()
      }
    },
    [mutate],
  )
  return {
    addresses: data,
    isLoading,
    busy,
    add: (a: AddressInput) => run(() => addAddress(customerId!, a)),
    edit: (current: CustomerAddressResponseDto, a: AddressInput) => run(() => updateAddress(current, a)),
    remove: (a: CustomerAddressResponseDto) => run(() => removeAddress(a)),
  }
}
