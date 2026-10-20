'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'
import type { RankMetric } from '@/lib/utils/profitability'

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full'

export interface WidgetInstance {
  id: string
  size: WidgetSize
}

export const defaultLayout: WidgetInstance[] = [
  { id: 'sales', size: 'sm' },
  { id: 'orders', size: 'sm' },
  { id: 'aov', size: 'sm' },
  { id: 'profit', size: 'sm' },
  { id: 'heroItems', size: 'full' },
  { id: 'revenueTrend', size: 'full' },
  { id: 'salesCategory', size: 'md' },
  { id: 'bestSellers', size: 'md' },
  { id: 'branchPerformance', size: 'md' },
  { id: 'inventoryAlerts', size: 'md' },
  { id: 'recentTransactions', size: 'md' },
  { id: 'recentActivity', size: 'md' },
]

interface DashboardState {
  layout: WidgetInstance[]
  /** What the hero items widget ranks by. */
  heroMetric: RankMetric
  setLayout: (layout: WidgetInstance[]) => void
  setHeroMetric: (metric: RankMetric) => void
  reset: () => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      layout: defaultLayout,
      heroMetric: 'profit',
      setLayout: (layout) => set({ layout }),
      setHeroMetric: (heroMetric) => set({ heroMetric }),
      reset: () => set({ layout: defaultLayout }),
    }),
    {
      name: `${config.storagePrefix}dashboard`,
      skipHydration: true,
      version: 1,
      // v1 added the hero items widget; slot it in after the KPI row for layouts saved before it existed.
      migrate: (persisted, version) => {
        const state = persisted as Pick<DashboardState, 'layout' | 'heroMetric'>
        if (version < 1 && state?.layout && !state.layout.some((w) => w.id === 'heroItems')) {
          const lastKpi = state.layout.findLastIndex((w) => w.size === 'sm')
          state.layout.splice(lastKpi + 1, 0, { id: 'heroItems', size: 'full' })
        }
        return state as DashboardState
      },
    },
  ),
)
