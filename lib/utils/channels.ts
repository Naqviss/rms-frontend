import type { Order, SalesChannel } from '@/types'

export const channels: SalesChannel[] = ['dine-in', 'takeaway', 'own-delivery', 'foodpanda', 'website']

/** Channels whose orders can be dispatched and tracked on the delivery board. */
export const deliveryChannels: SalesChannel[] = ['own-delivery', 'website', 'foodpanda']

export const isRejected = (o: Order) => o.foodpanda?.acceptance === 'rejected' || o.website?.acceptance === 'rejected'

export const channelOf = (o: Order): SalesChannel => o.channel ?? 'dine-in'
