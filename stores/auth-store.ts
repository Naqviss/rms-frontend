'use client'

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'
import { appUsers } from '@/mocks/platform'
import { useAppStore } from '@/stores/app-store'
import { useRecipeVault } from '@/stores/recipe-vault-store'
import type { RoleId } from '@/types'

export interface DemoAccount {
  username: string
  password: string
  /** Staff member from the users list this account signs in as. */
  userId: string
  role: RoleId
  /** Screen the account lands on after signing in. */
  home: string
}

/** Prototype-only credentials. Replace with a real auth provider before going live. */
export const demoAccounts: DemoAccount[] = [
  { username: 'admin', password: 'admin', userId: 'u1', role: 'tenant-owner', home: '/dashboard' },
  { username: 'kitchen', password: 'kitchen', userId: 'u8', role: 'chef', home: '/orders/kitchen' },
  { username: 'waiter', password: 'waiter', userId: 'u10', role: 'waiter', home: '/orders/tables' },
  { username: 'counter', password: 'counter', userId: 'u6', role: 'cashier', home: '/orders/pos' },
]

export function accountFor(username: string | null) {
  return demoAccounts.find((a) => a.username === username) ?? null
}

/** The owner sees every branch and can preview other roles; staff accounts are locked to their role and branch. */
export function isOwner(account: DemoAccount | null) {
  return account?.role === 'tenant-owner'
}

interface AuthState {
  username: string | null
  signedInAt: string | null
  login: (username: string, password: string) => DemoAccount | null
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      username: null,
      signedInAt: null,
      login: (username, password) => {
        const account = accountFor(username.trim().toLowerCase())
        if (!account || account.password !== password) return null
        const user = appUsers.find((u) => u.id === account.userId)
        const app = useAppStore.getState()
        app.setRole(account.role)
        app.setBranches(isOwner(account) ? [] : (user?.branchIds ?? []))
        set({ username: account.username, signedInAt: new Date().toISOString() })
        return account
      },
      logout: () => {
        useRecipeVault.getState().lock()
        set({ username: null, signedInAt: null })
      },
    }),
    {
      name: `${config.storagePrefix}auth`,
      partialize: (s) => ({ username: s.username, signedInAt: s.signedInAt }),
    },
  ),
)

/** The signed-in demo account and the staff member behind it. */
export function useAccount() {
  const username = useAuthStore((s) => s.username)
  const account = accountFor(username)
  const user = appUsers.find((u) => u.id === account?.userId) ?? appUsers[0]
  return { account, user, owner: isOwner(account), home: account?.home ?? '/dashboard' }
}

/** True once the persisted session has been read from storage, so guards never redirect on the server render. */
export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setHydrated(true)
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
