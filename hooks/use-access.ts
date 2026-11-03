'use client'

import { useCallback } from 'react'
import { useAccount } from '@/stores/auth-store'
import { planRank, type NavItem } from '@/lib/navigation'
import { planTier, useSession } from '@/services/api/session'
import { grants } from '@/services/api/permissions'
import type { PermissionAction, PermissionModule } from '@/types'

export type AccessState = 'allowed' | 'forbidden' | 'locked'

/**
 * What the current user may see, from the server's effective permission codes
 * (GET /api/me/access) and the tenant's subscription plan. This only shapes the UI —
 * the backend enforces every request.
 */
export function useAccess() {
  const { account } = useAccount()
  const role = account?.role ?? 'branch-manager'
  const permissions = useSession((s) => s.permissions)
  const subscription = useSession((s) => s.subscription)
  const plan = planTier(subscription)

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction = 'view') => grants(permissions, module, action),
    [permissions],
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
