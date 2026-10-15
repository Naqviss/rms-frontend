import type { Order, SalesChannel } from '@/types'

export const channels: SalesChannel[] = ['dine-in', 'takeaway', 'own-delivery', 'foodpanda', 'website']

/** Channels whose orders can be dispatched and tracked on the delivery board. */
export const deliveryChannels: SalesChannel[] = ['own-delivery', 'website', 'foodpanda']

export const isRejected = (o: Order) => o.foodpanda?.acceptance === 'rejected' || o.website?.acceptance === 'rejected'

export const channelOf = (o: Order): SalesChannel => o.channel ?? 'dine-in'

export interface ChannelSummary {
  channel: SalesChannel
  orders: number
  gross: number
  deliveryFees: number
  commission: number
  net: number
  avgOrder: number
  cancelled: number
}

/** Revenue per sales channel. Cancelled orders are counted but earn nothing. */
export function summarizeChannels(orders: Order[]): ChannelSummary[] {
  return channels.map((channel) => {
    const mine = orders.filter((o) => channelOf(o) === channel)
    const valid = mine.filter((o) => o.status !== 'cancelled')
    const gross = valid.reduce((s, o) => s + o.total, 0)
    const deliveryFees = valid.reduce((s, o) => s + (o.delivery?.fee ?? 0), 0)
    const commission = valid.reduce((s, o) => s + (o.foodpanda?.acceptance === 'rejected' ? 0 : (o.foodpanda?.commission ?? 0)), 0)
    return {
      channel,
      orders: valid.length,
      gross,
      deliveryFees,
      commission,
      net: gross - commission,
      avgOrder: valid.length ? Math.round(gross / valid.length) : 0,
      cancelled: mine.length - valid.length,
    }
  })
}
