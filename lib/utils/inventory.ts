import type { InventoryItem, StockStatus } from '@/types'

export function stockStatus(item: InventoryItem): StockStatus {
  if (item.quantity <= 0) return 'out'
  if (item.quantity <= item.minStock) return 'low'
  return 'in-stock'
}

export function stockValue(item: InventoryItem) {
  return item.quantity * item.costPerUnit
}
