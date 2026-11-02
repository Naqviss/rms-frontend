'use client'

import { useMemo } from 'react'
import { useInventory, useProducts } from '@/hooks/use-data'
import { unitCostMap } from '@/lib/utils/costing'

/** Products plus the cost of one unit of each, from stock purchase prices where the product is stocked. */
export function useUnitCosts() {
  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: inventory, isLoading: inventoryLoading } = useInventory()

  return useMemo(
    () => ({
      products: products ?? [],
      unitCosts: unitCostMap(products ?? [], inventory ?? []),
      isLoading: productsLoading || inventoryLoading,
    }),
    [products, inventory, productsLoading, inventoryLoading],
  )
}
