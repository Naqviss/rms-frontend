'use client'

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'
import { currentBranchIds } from '@/lib/directory'
import { useAppStore } from '@/stores/app-store'
import { signInWithAccessToken, signInWithPassword, signOut } from '@/services/api/auth'
import { bootstrapSession, clearSession, useSession } from '@/services/api/session'
import { homeFor, roleIdOf } from '@/services/api/permissions'
import { colorFor } from '@/services/api/mappers'
import type { AppUser, RoleId } from '@/types'

/** The signed-in identity as the shell sees it. */
export interface Account {
  /** The identity's email (or a placeholder for token sign-ins without one). */
  username: string
  userId: string
  role: RoleId
  /** Screen the account lands on after signing in. */
  home: string
}

interface AuthState {
  username: string | null
  signedInAt: string | null
  /** Sign in through Supabase Auth, then load the RMS session. Throws on failure. */
  login: (email: string, password: string) => Promise<void>
  /** Sign in with a pre-issued JWT (development only). */
  loginWithToken: (token: string) => Promise<void>
  logout: () => void
}

async function finishLogin(email: string | null, set: (s: Partial<AuthState>) => void) {
  set({ username: email ?? 'signed-in', signedInAt: new Date().toISOString() })
  useAppStore.getState().setBranches([])
  await bootstrapSession()
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      username: null,
      signedInAt: null,
      login: async (email, password) => {
        const session = await signInWithPassword(email.trim(), password)
        await finishLogin(session.email ?? email.trim(), set)
      },
      loginWithToken: async (token) => {
        const session = signInWithAccessToken(token)
        await finishLogin(session.email, set)
      },
      logout: () => {
        void signOut()
        clearSession()
        set({ username: null, signedInAt: null })
      },
    }),
    {
      name: `${config.storagePrefix}auth`,
      partialize: (s) => ({ username: s.username, signedInAt: s.signedInAt }),
    },
  ),
)

/** Landing screen for the session's role (after GET /api/me/access has resolved). */
export function homeScreen() {
  return homeFor[roleIdOf(useSession.getState().access?.role_codes ?? [])]
}

/** The signed-in account, derived from GET /api/me + /api/me/access. */
export function useAccount() {
  const username = useAuthStore((s) => s.username)
  const me = useSession((s) => s.me)
  const access = useSession((s) => s.access)
  const role = roleIdOf(access?.role_codes ?? [])
  // Tenant-wide members get the cross-branch view; branch staff are locked to their branches.
  const owner = Boolean(access?.all_branches)
  const branchIds = access?.all_branches ? [...currentBranchIds] : (access?.branch_ids ?? [])
  const account: Account | null = username ? { username, userId: me?.user_id ?? '', role, home: homeFor[role] } : null
  const user: AppUser = {
    id: me?.user_id ?? '',
    name: me?.display_name || me?.email || username || '',
    email: me?.email ?? username ?? '',
    role,
    branchIds,
    status: 'active',
    color: colorFor(me?.user_id ?? username ?? 'x'),
  }
  return { account, user, owner, home: account?.home ?? '/dashboard', isPlatformAdmin: Boolean(me?.is_platform_admin) }
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
