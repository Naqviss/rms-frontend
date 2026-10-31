'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** PBKDF2 so the stored value cannot be reversed into the PIN without brute force. */
async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 150_000 }, key, 256)
  return toHex(bits)
}

export type UnlockResult = { ok: true } | { ok: false; attemptsLeft: number; lockedUntil: number | null }

interface VaultState {
  /** Set once the owner has seen the welcome screen. */
  welcomed: boolean
  pinHash: string | null
  salt: string | null
  autoLockMinutes: number
  failedAttempts: number
  lockoutUntil: number | null
  /** Session only: the vault closes on reload, sign-out or after `autoLockMinutes` without activity. */
  unlockedUntil: number | null
  setWelcomed: () => void
  setPin: (pin: string) => Promise<void>
  unlock: (pin: string) => Promise<UnlockResult>
  lock: () => void
  /** Pushes the auto-lock deadline back while the owner is working. */
  touch: () => void
  setAutoLockMinutes: (minutes: number) => void
}

export const useRecipeVault = create<VaultState>()(
  persist(
    (set, get) => ({
      welcomed: false,
      pinHash: null,
      salt: null,
      autoLockMinutes: 5,
      failedAttempts: 0,
      lockoutUntil: null,
      unlockedUntil: null,
      setWelcomed: () => set({ welcomed: true }),
      setPin: async (pin) => {
        const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
        const pinHash = await hashPin(pin, salt)
        set({ pinHash, salt, failedAttempts: 0, lockoutUntil: null, unlockedUntil: Date.now() + get().autoLockMinutes * 60_000 })
      },
      unlock: async (pin) => {
        const { pinHash, salt, lockoutUntil, failedAttempts, autoLockMinutes } = get()
        if (lockoutUntil && lockoutUntil > Date.now()) return { ok: false, attemptsLeft: 0, lockedUntil: lockoutUntil }
        if (!pinHash || !salt) return { ok: true }
        if ((await hashPin(pin, salt)) === pinHash) {
          set({ failedAttempts: 0, lockoutUntil: null, unlockedUntil: Date.now() + autoLockMinutes * 60_000 })
          return { ok: true }
        }
        const attempts = failedAttempts + 1
        if (attempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS
          set({ failedAttempts: 0, lockoutUntil: until })
          return { ok: false, attemptsLeft: 0, lockedUntil: until }
        }
        set({ failedAttempts: attempts, lockoutUntil: null })
        return { ok: false, attemptsLeft: MAX_ATTEMPTS - attempts, lockedUntil: null }
      },
      lock: () => set({ unlockedUntil: null }),
      touch: () => {
        const { unlockedUntil, autoLockMinutes } = get()
        if (unlockedUntil && unlockedUntil > Date.now()) set({ unlockedUntil: Date.now() + autoLockMinutes * 60_000 })
      },
      setAutoLockMinutes: (autoLockMinutes) => set((s) => ({ autoLockMinutes, unlockedUntil: s.unlockedUntil && Date.now() + autoLockMinutes * 60_000 })),
    }),
    {
      name: `${config.storagePrefix}recipe-vault`,
      partialize: (s) => ({
        welcomed: s.welcomed,
        pinHash: s.pinHash,
        salt: s.salt,
        autoLockMinutes: s.autoLockMinutes,
        failedAttempts: s.failedAttempts,
        lockoutUntil: s.lockoutUntil,
      }),
    },
  ),
)

/** Open when unlocked and not yet timed out. A vault without a PIN is always open. */
export const isVaultOpen = (s: Pick<VaultState, 'pinHash' | 'unlockedUntil'>, now = Date.now()) => !s.pinHash || (!!s.unlockedUntil && s.unlockedUntil > now)
