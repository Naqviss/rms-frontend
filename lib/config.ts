/**
 * Central runtime configuration. API URLs live here (never inside UI components)
 * so swapping mock repositories for real REST calls is a one-file change.
 */
export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api',
  useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? 'true') === 'true',
  mockLatencyMs: Number(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS ?? 180),
  referenceDate: '2026-10-15',
  currency: 'PKR',
  storagePrefix: 'rms:v1:',
} as const
