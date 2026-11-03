'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'

export type WidgetSize = 'sm' | 'md' | 'lg' | 'full'

/** Every widget the dashboard can render; `widgetRegistry` in components/dashboard/widgets.tsx has one entry per id. */
export const WIDGET_IDS = [
  'sales',
  'orders',
  'aov',
  'profit',
  'expenses',
  'pending',
  'lowstock',
  'revenueTrend',
  'orderTrend',
  'salesPayment',
  'branchPerformance',
  'recentTransactions',
  'recentActivity',
  'inventoryAlerts',
] as const

export type WidgetId = (typeof WIDGET_IDS)[number]

export interface WidgetInstance {
  id: WidgetId
  size: WidgetSize
}

export const defaultLayout: WidgetInstance[] = [
  { id: 'sales', size: 'sm' },
  { id: 'orders', size: 'sm' },
  { id: 'aov', size: 'sm' },
  { id: 'profit', size: 'sm' },
  { id: 'revenueTrend', size: 'full' },
  { id: 'salesPayment', size: 'md' },
  { id: 'branchPerformance', size: 'md' },
  { id: 'inventoryAlerts', size: 'md' },
  { id: 'recentActivity', size: 'md' },
  { id: 'recentTransactions', size: 'md' },
  { id: 'orderTrend', size: 'md' },
]

const KNOWN_IDS = new Set<string>(WIDGET_IDS)
const SIZES = new Set<string>(['sm', 'md', 'lg', 'full'])

/**
 * Keep only widgets that still exist (saved layouts may reference removed ones such as
 * heroItems, bestSellers or salesCategory), once each, with a valid size.
 */
export function sanitizeLayout(layout: unknown): WidgetInstance[] {
  if (!Array.isArray(layout)) return defaultLayout
  const seen = new Set<string>()
  const out: WidgetInstance[] = []
  for (const w of layout as { id?: unknown; size?: unknown }[]) {
    if (!w || typeof w.id !== 'string' || !KNOWN_IDS.has(w.id) || seen.has(w.id)) continue
    seen.add(w.id)
    out.push({ id: w.id as WidgetId, size: typeof w.size === 'string' && SIZES.has(w.size) ? (w.size as WidgetSize) : 'md' })
  }
  return out
}

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
    {
      name: `${config.storagePrefix}dashboard`,
      skipHydration: true,
      // v2 removed the client-computed widgets (hero items, best sellers, sales by category, ...)
      // and the hero metric; `merge` drops unknown ids on every load.
      version: 2,
      partialize: (s) => ({ layout: s.layout }),
      migrate: (persisted) => ({ layout: (persisted as { layout?: unknown } | null)?.layout }) as unknown as DashboardState,
      merge: (persisted, current) => {
        const layout = (persisted as { layout?: unknown } | null)?.layout
        return { ...current, layout: layout === undefined ? current.layout : sanitizeLayout(layout) }
      },
    },
  ),
)
