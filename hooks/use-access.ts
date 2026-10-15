'use client'

import { useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { roles } from '@/mocks/platform'
import { planRank, type NavItem } from '@/lib/navigation'
import type { PermissionAction, PermissionModule } from '@/types'

export type AccessState = 'allowed' | 'forbidden' | 'locked'

/** Resolves role permissions and subscription plan gating for the current demo session. */
export function useAccess() {
  const role = useAppStore((s) => s.role)
  const plan = useAppStore((s) => s.plan)

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction = 'view') => {
      const r = roles.find((x) => x.id === role)
      return !!r?.permissions[module]?.includes(action)
    },
    [role],
  )

  const stateFor = useCallback(
    (item: Pick<NavItem, 'module' | 'minPlan'>): AccessState => {
      if (item.module && !can(item.module)) return 'forbidden'
      if (item.minPlan && planRank[plan] < planRank[item.minPlan]) return 'locked'
      return 'allowed'
    },
    [can, plan],
  )

  return { role, plan, can, stateFor }
}
