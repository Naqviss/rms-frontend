/**
 * Supabase Auth over its REST API (no SDK dependency). The backend only verifies the JWT
 * Supabase issues; it has no login route of its own.
 *
 * Tokens are kept in localStorage so a reload restores the session. They are short-lived and
 * refreshed ahead of expiry; the anon key is a public value by design.
 */
import { config } from '@/lib/config'

export interface AuthSession {
  access_token: string
  refresh_token: string | null
  /** Unix seconds. */
  expires_at: number
  email: string | null
}

const KEY = `${config.storagePrefix}session`
let current: AuthSession | null = null
let loaded = false
let refreshing: Promise<boolean> | null = null

function load(): AuthSession | null {
  if (loaded) return current
  loaded = true
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    current = raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    current = null
  }
  return current
}

function save(s: AuthSession | null) {
  current = s
  loaded = true
  if (typeof window === 'undefined') return
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s))
    else window.localStorage.removeItem(KEY)
  } catch {
    // storage unavailable: session lives for this tab only
  }
}

export const supabaseConfigured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey)

export class AuthError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'AuthError'
  }
}

async function tokenRequest(grant: 'password' | 'refresh_token', body: Record<string, string>) {
  if (!supabaseConfigured()) {
    throw new AuthError('Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)', 'AUTH_NOT_CONFIGURED')
  }
  const res = await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_at?: number
    expires_in?: number
    user?: { email?: string }
    error_description?: string
    msg?: string
    error_code?: string
  }
  if (!res.ok || !json.access_token) {
    throw new AuthError(json.error_description ?? json.msg ?? 'Sign-in failed', json.error_code ?? 'invalid_credentials')
  }
  const session: AuthSession = {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? null,
    expires_at: json.expires_at ?? Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
    email: json.user?.email ?? null,
  }
  save(session)
  return session
}

export function signInWithPassword(email: string, password: string) {
  return tokenRequest('password', { email, password })
}

/**
 * Development escape hatch: use an access token obtained elsewhere (e.g. from the backend team
 * or the Supabase dashboard). It cannot be refreshed, so the session ends when it expires.
 */
export function signInWithAccessToken(token: string): AuthSession {
  let exp = Math.floor(Date.now() / 1000) + 3600
  let email: string | null = null
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp === 'number') exp = payload.exp
    if (typeof payload.email === 'string') email = payload.email
  } catch {
    throw new AuthError('That is not a valid JWT access token', 'TOKEN_INVALID')
  }
  const session = { access_token: token.trim(), refresh_token: null, expires_at: exp, email }
  save(session)
  return session
}

export async function refreshSession(): Promise<boolean> {
  const s = load()
  if (!s?.refresh_token || !supabaseConfigured()) return false
  refreshing ??= tokenRequest('refresh_token', { refresh_token: s.refresh_token })
    .then(() => true)
    .catch(() => {
      save(null)
      return false
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

/** Current access token, refreshed when it is within a minute of expiring. */
export async function getAccessToken(): Promise<string | null> {
  const s = load()
  if (!s) return null
  if (s.expires_at - 60 < Date.now() / 1000 && s.refresh_token) {
    await refreshSession()
    return load()?.access_token ?? null
  }
  return s.access_token
}

export function hasSession() {
  return Boolean(load())
}

export async function signOut() {
  const s = load()
  save(null)
  if (s && supabaseConfigured()) {
    // Best effort: revoke the refresh token server-side.
    await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => undefined)
  }
}
