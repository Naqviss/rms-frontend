/**
 * Tenant workspace reads and actions that do not fit the `Repository<T>` shape.
 *
 *   GET/PATCH /api/tenant                         tenant profile
 *   GET /api/subscription                         current plan, status, limits
 *   GET /api/settings, PUT /api/settings/{key}     effective settings (default → tenant → branch)
 *   GET /api/audit-logs                           audit trail
 *   GET /api/brands                               brands
 *   GET /api/experience                           STANDARD / SIMPLE mode
 *   GET /api/localization/locales, /bundles/{l}   locales and label bundles (public)
 *   GET /api/pos/stations, /api/pos/kitchen-targets
 *   GET /api/offline/devices/{id}/sync-status | sync-history | diagnostics | backups
 *   Integrations: POST connections, PUT/DELETE credentials, GET inbox (+ reconcile), GET logs
 *
 * Provider credentials are write-only: they are sent once to PUT …/credentials and never stored,
 * cached or echoed by this client (the API only reports `has_credentials`).
 */
import { api } from '@/services/api/client'
import { useSession } from '@/services/api/session'
import type {
  AuditLogResponseDto,
  CreateKitchenTargetDto,
  CreatePosPrinterDto,
  CreatePosStationDto,
  DeviceResponseDto,
  PosConfigResponseDto,
  PosPrinterResponseDto,
  RevokeDeviceDto,
  UpdateDeviceDto,
  UpdateKitchenTargetDto,
  UpdatePosPrinterDto,
  UpdatePosStationDto,
  BackupResponseDto,
  BrandResponseDto,
  ConnectionCredentialsDto,
  ConnectionResponseDto,
  CreateConnectionDto,
  DeviceDiagnosticsResponseDto,
  DeviceSyncStatusResponseDto,
  ExperienceResponseDto,
  InboxEntryResponseDto,
  IntegrationLogResponseDto,
  KitchenTargetResponseDto,
  LabelBundleResponseDto,
  LocaleListResponseDto,
  PosStationResponseDto,
  SettingResponseDto,
  SubscriptionResponseDto,
  SyncEventResponseDto,
  TenantResponseDto,
  UpdateConnectionDto,
  UpdateSettingDto,
  UpdateTenantDto,
} from '@/services/api/generated/schemas'

const noBranch = { branchId: null } as const

// ─── Tenant profile & subscription ─────────────────────────────────────────────────────────────

export const getTenant = () => api.get<TenantResponseDto>('/tenant', noBranch)

/** PATCH the tenant profile and publish the result to the session (top bar, settings). */
export async function updateTenant(patch: Omit<UpdateTenantDto, 'expected_version'>) {
  const current = useSession.getState().tenant
  const body: UpdateTenantDto = { expected_version: current?.version ?? 0, ...patch }
  const tenant = await api.patch<TenantResponseDto>('/tenant', body, noBranch)
  useSession.setState({ tenant })
  return tenant
}

export async function refreshSubscription() {
  const subscription = await api.get<SubscriptionResponseDto>('/subscription', noBranch)
  useSession.setState({ subscription })
  return subscription
}

// ─── Settings ──────────────────────────────────────────────────────────────────────────────────

export const listSettings = (branchId?: string) =>
  api.listAll<SettingResponseDto>('/settings', { ...noBranch, query: branchId ? { branch_id: branchId } : undefined })

export function updateSetting(setting: Pick<SettingResponseDto, 'key' | 'version' | 'source'>, value: Record<string, unknown>, branchId?: string) {
  // A default has no stored row yet: version 0 creates the tenant (or branch) value.
  const replacing = branchId ? setting.source === 'branch' : setting.source !== 'default'
  const body: UpdateSettingDto = { value, expected_version: replacing ? setting.version : 0, ...(branchId ? { branch_id: branchId } : {}) }
  return api.put<SettingResponseDto>(`/settings/${encodeURIComponent(setting.key)}`, body, noBranch)
}

// ─── Audit, brands, experience, localization ───────────────────────────────────────────────────

export const listAuditLogs = (query?: { action?: string; resource_type?: string; from?: string; to?: string }) =>
  api.page<AuditLogResponseDto>('/audit-logs', { ...noBranch, query: { page_size: 100, ...query } }).then((p) => p.data)

export const listBrands = () => api.listAll<BrandResponseDto>('/brands', noBranch)

export const getExperience = () => api.get<ExperienceResponseDto>('/experience')

export const listLocales = () => api.get<LocaleListResponseDto>('/localization/locales', { ...noBranch, anonymous: true })
export const getLabelBundle = (locale: string) =>
  api.get<LabelBundleResponseDto>(`/localization/bundles/${encodeURIComponent(locale)}`, { ...noBranch, anonymous: true })

// ─── POS configuration ─────────────────────────────────────────────────────────────────────────

export const listPosStations = () => api.listAll<PosStationResponseDto>('/pos/stations', noBranch)
export const createPosStation = (body: CreatePosStationDto) => api.post<PosStationResponseDto>('/pos/stations', body, { branchId: body.branch_id })
export const updatePosStation = (s: Pick<PosStationResponseDto, 'id' | 'version'>, patch: Omit<UpdatePosStationDto, 'expected_version'>) =>
  api.patch<PosStationResponseDto>(`/pos/stations/${s.id}`, { expected_version: s.version, ...patch } satisfies UpdatePosStationDto, noBranch)
/** Resolved station configuration (receipt printer, kitchen targets and their printers). */
export const getPosStationConfig = (stationId: string) => api.get<PosConfigResponseDto>(`/pos/stations/${stationId}/config`, noBranch)
/**
 * Configuration of the station run by the *calling device* (needs X-Branch-Id and a device
 * session). Exposed for completeness; the admin browser is not a registered device, so the
 * hardware page uses getPosStationConfig instead.
 */
export const getPosDeviceConfig = (branchId: string) => api.get<PosConfigResponseDto>('/pos/device-config', { branchId })

export const listPosPrinters = () => api.listAll<PosPrinterResponseDto>('/pos/printers', noBranch)
export const createPosPrinter = (body: CreatePosPrinterDto) => api.post<PosPrinterResponseDto>('/pos/printers', body, { branchId: body.branch_id })
export const updatePosPrinter = (p: Pick<PosPrinterResponseDto, 'id' | 'version'>, patch: Omit<UpdatePosPrinterDto, 'expected_version'>) =>
  api.patch<PosPrinterResponseDto>(`/pos/printers/${p.id}`, { expected_version: p.version, ...patch } satisfies UpdatePosPrinterDto, noBranch)

export const listKitchenTargets = () => api.listAll<KitchenTargetResponseDto>('/pos/kitchen-targets', noBranch)
export const createKitchenTarget = (body: CreateKitchenTargetDto) =>
  api.post<KitchenTargetResponseDto>('/pos/kitchen-targets', body, { branchId: body.branch_id })
export const updateKitchenTarget = (k: Pick<KitchenTargetResponseDto, 'id' | 'version'>, patch: Omit<UpdateKitchenTargetDto, 'expected_version'>) =>
  api.patch<KitchenTargetResponseDto>(`/pos/kitchen-targets/${k.id}`, { expected_version: k.version, ...patch } satisfies UpdateKitchenTargetDto, noBranch)

// ─── Offline device detail ─────────────────────────────────────────────────────────────────────

const rawDeviceId = (id: string) => (id.startsWith('device:') ? id.slice(7) : id)

export const getDeviceSyncStatus = (deviceId: string) =>
  api.get<DeviceSyncStatusResponseDto>(`/offline/devices/${rawDeviceId(deviceId)}/sync-status`, noBranch)
export const getDeviceDiagnostics = (deviceId: string) =>
  api.get<DeviceDiagnosticsResponseDto>(`/offline/devices/${rawDeviceId(deviceId)}/diagnostics`, noBranch)
export const listDeviceSyncHistory = (deviceId: string, kind?: SyncEventResponseDto['kind']) =>
  api.page<SyncEventResponseDto>(`/offline/devices/${rawDeviceId(deviceId)}/sync-history`, { ...noBranch, query: { page_size: 50, kind } }).then((p) => p.data)
export const listDeviceBackups = (deviceId: string) =>
  api.listAll<BackupResponseDto>(`/offline/devices/${rawDeviceId(deviceId)}/backups`, noBranch)
export const listOfflineDevices = () => api.listAll<DeviceResponseDto>('/offline/devices', noBranch)
export const renameOfflineDevice = (d: Pick<DeviceResponseDto, 'id' | 'version'>, name: string) =>
  api.patch<DeviceResponseDto>(`/offline/devices/${d.id}`, { expected_version: d.version, name } satisfies UpdateDeviceDto, noBranch)
export const revokeOfflineDevice = (deviceId: string, reason_code = 'revoked_by_admin') =>
  api.post<DeviceResponseDto>(`/offline/devices/${rawDeviceId(deviceId)}/revoke`, { reason_code } satisfies RevokeDeviceDto, noBranch)

// ─── Integrations: connections, credentials, inbox, logs ──────────────────────────────────────

export const createConnection = (body: CreateConnectionDto) => api.post<ConnectionResponseDto>('/integrations/connections', body, noBranch)

/** Store branch middleware credentials. The values go to this one request and nowhere else. */
export function setConnectionCredentials(connection: Pick<ConnectionResponseDto, 'id' | 'version'>, username: string, password: string) {
  const body: ConnectionCredentialsDto = { expected_version: connection.version, username, password }
  return api.put<ConnectionResponseDto>(`/integrations/connections/${connection.id}/credentials`, body, noBranch)
}

/** Remove the stored branch credentials (this also disconnects the branch). */
export const clearConnectionCredentials = (connection: Pick<ConnectionResponseDto, 'id' | 'version'>) =>
  api.delete(`/integrations/connections/${connection.id}/credentials`, { ...noBranch, query: { expected_version: connection.version } })

/** Enable or disable a connection (enabling is verified server-side: credentials, provider login, plan slot). */
export const setConnectionStatus = (connection: Pick<ConnectionResponseDto, 'id' | 'version'>, status: 'active' | 'disabled') =>
  api.patch<ConnectionResponseDto>(`/integrations/connections/${connection.id}`, { expected_version: connection.version, status } satisfies UpdateConnectionDto, noBranch)

export const listConnections = () => api.listAll<ConnectionResponseDto>('/integrations/connections', noBranch)

export const getConnection = (id: string) => api.get<ConnectionResponseDto>(`/integrations/connections/${id}`, noBranch)

export const listIntegrationInbox = (reconciliation_status?: 'required' | 'resolved') =>
  api.page<InboxEntryResponseDto>('/integrations/inbox', { ...noBranch, query: { page_size: 100, reconciliation_status } }).then((p) => p.data)

export const reconcileInboxEntry = (inboxId: string) => api.post<InboxEntryResponseDto>(`/integrations/inbox/${inboxId}/reconcile`, undefined, noBranch)

export const listIntegrationLogs = () =>
  api.page<IntegrationLogResponseDto>('/integrations/logs', { ...noBranch, query: { page_size: 100 } }).then((p) => p.data)
