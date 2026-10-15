'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'

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
  setLayout: (layout: WidgetInstance[]) => void
  reset: () => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      layout: defaultLayout,
      setLayout: (layout) => set({ layout }),
      reset: () => set({ layout: defaultLayout }),
    }),
    { name: `${config.storagePrefix}dashboard`, skipHydration: true },
  ),
)
