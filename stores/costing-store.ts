'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'

interface CostingState {
  /** Target cost per serving (ingredients + packaging, gas, labour) as a percentage of the selling price; drives suggested prices. */
  targetCostPct: number
  setTargetCostPct: (pct: number) => void
}

export const useCostingStore = create<CostingState>()(
  persist(
    (set) => ({
      targetCostPct: 40,
      setTargetCostPct: (targetCostPct) => set({ targetCostPct }),
    }),
    { name: `${config.storagePrefix}costing:v2` },
  ),
)
