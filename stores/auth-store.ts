'use client'

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'

/** Prototype-only credentials. Replace with a real auth provider before going live. */
const DEMO_USERNAME = 'admin'
const DEMO_PASSWORD = 'admin'

interface AuthState {
  username: string | null
  signedInAt: string | null
  login: (username: string, password: string) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      username: null,
      signedInAt: null,
      login: (username, password) => {
        const ok = username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD
        if (ok) set({ username: DEMO_USERNAME, signedInAt: new Date().toISOString() })
        return ok
      },
      logout: () => set({ username: null, signedInAt: null }),
    }),
    {
      name: `${config.storagePrefix}auth`,
      partialize: (s) => ({ username: s.username, signedInAt: s.signedInAt }),
    },
  ),
)

/** True once the persisted session has been read from storage, so guards never redirect on the server render. */
export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) setHydrated(true)
    return useAuthStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])
  return hydrated
}
