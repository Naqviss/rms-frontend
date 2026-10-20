'use client'

import { useMemo } from 'react'
import { useInventory, useProducts, useRecipes } from '@/hooks/use-data'
import { ingredientCatalog, unitCostMap } from '@/lib/utils/costing'

/** Ingredient catalogue plus the cost of one serving of every menu item, from costing sheets where they exist. */
export function useUnitCosts() {
  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: recipes, isLoading: recipesLoading } = useRecipes()
  const { data: inventory, isLoading: inventoryLoading } = useInventory()

  return useMemo(() => {
    const catalog = ingredientCatalog(inventory ?? [])
    return {
      products: products ?? [],
      recipes: recipes ?? [],
      catalog,
      unitCosts: unitCostMap(products ?? [], recipes ?? [], catalog),
      isLoading: productsLoading || recipesLoading || inventoryLoading,
    }
  }, [products, recipes, inventory, productsLoading, recipesLoading, inventoryLoading])
}
