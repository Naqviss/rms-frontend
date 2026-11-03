import { localToday } from '@/lib/utils/dates'

/**
 * Central runtime configuration. API URLs live here (never inside UI components).
 * The app always talks to the RMS backend; there is no mock mode.
 */
export const config = {
  /**
   * Browser-facing API base. Defaults to the same-origin `/api` path, which next.config.mjs
   * rewrites to RMS_API_ORIGIN, so the Worker's CORS allow-list does not have to include every
   * dev/preview origin. Set to an absolute URL to call the backend directly.
   */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api',
  /** Backend wire contract version, sent as `X-API-Version`. */
  apiVersion: process.env.NEXT_PUBLIC_API_VERSION ?? '1',
  /** Supabase project that issues the JWTs the backend verifies (public values only). */
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** "Today" for date-range presets and relative times — the real local date. */
  referenceDate: localToday(),
  currency: 'PKR',
  storagePrefix: 'rms:v1:',
} as const

