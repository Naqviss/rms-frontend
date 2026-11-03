'use client'

import useSWR, { type SWRConfiguration } from 'swr'
import { useAppStore } from '@/stores/app-store'
import { useSession } from '@/services/api/session'
import * as p from '@/services/api/modules/platform'

/**
 * Live-mode SWR hooks for platform data that is not a `Repository<T>` list (subscription detail,
 * plans, settings, notifications, audit, CMS, POS config, device diagnostics…).
 *
 * Keys carry the tenant and branch selection like hooks/use-resource.ts, so switching either
 * refetches. Nothing is fetched before the session has resolved a tenant (`data` stays undefined).
 */
function useScopedKey(name: string, ...parts: (string | number | boolean | null | undefined)[]) {
  const branchIds = useAppStore((s) => s.branchIds)
  const tenantId = useSession((s) => s.tenant?.id)
  if (!tenantId) return null
  return `platform:${name}:${tenantId}:${branchIds.join(',')}:${parts.map((x) => x ?? '').join(':')}`
}

const opts: SWRConfiguration = { revalidateOnFocus: false }

function useLive<T>(name: string, fetcher: () => Promise<T>, parts: (string | number | boolean | null | undefined)[] = [], enabled = true, config?: SWRConfiguration) {
  const key = useScopedKey(name, ...parts)
  return useSWR<T>(enabled ? key : null, fetcher, { ...opts, ...config })
}

// Tenant & subscription -------------------------------------------------------------------------

export const useTenantProfile = () => useLive('tenant', p.getTenant)
export const useSettings = (branchId?: string) => useLive('settings', () => p.listSettings(branchId), [branchId])
export const useAuditLogs = (query?: Parameters<typeof p.listAuditLogs>[0]) =>
  useLive('audit-logs', () => p.listAuditLogs(query), [JSON.stringify(query ?? {})])
export const useBrands = () => useLive('brands', p.listBrands)
export const useExperience = () => useLive('experience', p.getExperience)
export const useLocales = () => useLive('locales', p.listLocales)
export const useLabelBundle = (locale: string | null) => useLive('bundle', () => p.getLabelBundle(locale!), [locale], !!locale)

// Platform admin --------------------------------------------------------------------------------

export function usePlatformPlans() {
  const admin = useSession((s) => !!s.me?.is_platform_admin)
  return useLive('platform-plans', p.listPlatformPlans, [], admin)
}

// Notifications ---------------------------------------------------------------------------------

export const useNotifications = () => useLive('notifications', () => p.listNotifications(), [], true, { refreshInterval: 60_000 })
export const useUnreadCount = () => useLive('notifications-unread', p.getUnreadCount, [], true, { refreshInterval: 30_000 })
export const useNotificationPreferences = () => useLive('notification-preferences', p.listNotificationPreferences)
export const useNotificationCategories = (branchId?: string) => useLive('notification-categories', () => p.listNotificationCategories(branchId), [branchId])
export const useNotificationTemplates = () => useLive('notification-templates', p.listNotificationTemplates)
export const useNotificationDispatches = (status?: Parameters<typeof p.listNotificationDispatches>[0]) =>
  useLive('notification-dispatches', () => p.listNotificationDispatches(status), [JSON.stringify(status ?? {})])

// POS & offline ---------------------------------------------------------------------------------

export const usePosStations = () => useLive('pos-stations', p.listPosStations)
export const usePosPrinters = () => useLive('pos-printers', p.listPosPrinters)
export const useKitchenTargets = () => useLive('kitchen-targets', p.listKitchenTargets)
export const usePosStationConfig = (stationId: string | null) => useLive('pos-station-config', () => p.getPosStationConfig(stationId!), [stationId], !!stationId)
export const useOfflineDevices = () => useLive('offline-devices', p.listOfflineDevices)
export const useDeviceSyncStatus = (deviceId: string | null) => useLive('device-sync-status', () => p.getDeviceSyncStatus(deviceId!), [deviceId], !!deviceId)
export const useDeviceDiagnostics = (deviceId: string | null) => useLive('device-diagnostics', () => p.getDeviceDiagnostics(deviceId!), [deviceId], !!deviceId)
export const useDeviceSyncHistory = (deviceId: string | null) => useLive('device-sync-history', () => p.listDeviceSyncHistory(deviceId!), [deviceId], !!deviceId)
export const useDeviceBackups = (deviceId: string | null) => useLive('device-backups', () => p.listDeviceBackups(deviceId!), [deviceId], !!deviceId)

// Integrations ----------------------------------------------------------------------------------

export const useIntegrationInbox = (reconciliation?: 'required' | 'resolved') =>
  useLive('integration-inbox', () => p.listIntegrationInbox(reconciliation), [reconciliation])
export const useIntegrationLogs = () => useLive('integration-logs', p.listIntegrationLogs)

// CMS -------------------------------------------------------------------------------------------

export const useSiteConfig = (branchId?: string) => useLive('site-config', () => p.getSiteConfig(branchId), [branchId])
export const useCmsPages = () => useLive('cms-pages', () => p.listCmsPages())
export const useNavigations = () => useLive('cms-navigations', p.listNavigations)

/** Published site for the public storefront — anonymous, keyed by tenant id only (no session needed). */
export function usePublicSite(tenantId: string | null, branchId?: string) {
  return useSWR(tenantId ? `public-site:${tenantId}:${branchId ?? ''}` : null, () => p.getPublicSite(tenantId!, branchId), opts)
}
export function usePublicPages(tenantId: string | null) {
  return useSWR(tenantId ? `public-pages:${tenantId}` : null, () => p.listPublicPages(tenantId!), opts)
}
