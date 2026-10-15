import { config } from '@/lib/config'
import type { InventoryItem, StockStatus } from '@/types'

const EXPIRY_WINDOW_DAYS = 7

export function stockStatus(item: InventoryItem): StockStatus {
  if (item.quantity <= 0) return 'out'
  if (item.expiryDate) {
    const days = (new Date(item.expiryDate).getTime() - new Date(`${config.referenceDate}T00:00:00`).getTime()) / 86_400_000
    if (days <= EXPIRY_WINDOW_DAYS) return 'expiring'
  }
  if (item.quantity <= item.minStock) return 'low'
  return 'in-stock'
}

export function stockValue(item: InventoryItem) {
  return item.quantity * item.costPerUnit
}
