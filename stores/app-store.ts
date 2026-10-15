'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DateRange, PlanId, RoleId } from '@/types'
import type { Language } from '@/lib/i18n/dictionary'
import { config } from '@/lib/config'

export type SyncState = 'online' | 'offline' | 'syncing' | 'sync-failed'
export type DatePreset = DateRange['preset']

export const PRESET_DAYS: Record<DatePreset, number> = { today: 1, '7d': 7, '30d': 30, month: 15 }

interface AppState {
  branchId: string
  language: Language
  sidebarCollapsed: boolean
  datePreset: DatePreset
  role: RoleId
  plan: PlanId
  syncState: SyncState
  lastSyncAt: string
  cancelledAt: string | null
  setBranch: (id: string) => void
  setLanguage: (lang: Language) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  setDatePreset: (p: DatePreset) => void
  setRole: (r: RoleId) => void
  setPlan: (p: PlanId) => void
  setSyncState: (s: SyncState) => void
  markSynced: () => void
  setCancelled: (v: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      branchId: 'all',
      language: 'en',
      sidebarCollapsed: false,
      datePreset: '30d',
      role: 'tenant-owner',
      plan: 'enterprise',
      syncState: 'online',
      lastSyncAt: `${config.referenceDate}T17:58:00`,
      cancelledAt: null,
      setBranch: (branchId) => set({ branchId }),
      setLanguage: (language) => set({ language }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setDatePreset: (datePreset) => set({ datePreset }),
      setRole: (role) => set({ role }),
      setPlan: (plan) => set({ plan, cancelledAt: null }),
      setSyncState: (syncState) => set({ syncState }),
      markSynced: () => set({ syncState: 'online', lastSyncAt: new Date().toISOString().slice(0, 19) }),
      setCancelled: (cancelledAt) => set({ cancelledAt }),
    }),
    {
      name: `${config.storagePrefix}app`,
      partialize: (s) => ({
        branchId: s.branchId,
        language: s.language,
        sidebarCollapsed: s.sidebarCollapsed,
        datePreset: s.datePreset,
        role: s.role,
        plan: s.plan,
        cancelledAt: s.cancelledAt,
      }),
      skipHydration: true,
    },
  ),
)
