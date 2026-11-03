/**
 * Platform, access & settings — repository adapters for the prototype's platform screens.
 *
 *   tenants       GET /api/platform/tenants (+ GET …/{id}/subscription), POST …/{id}/status   (platform admins only)
 *   branches      GET/POST /api/branches, PATCH /api/branches/{id}
 *   users         GET /api/users, POST /api/users/invitations, PUT …/{id}/roles, PUT …/{id}/branches,
 *                 POST …/{id}/activate | deactivate
 *   roles         GET /api/roles (read-only: the API has no role editing)
 *   integrations  GET /api/integrations/connections, PATCH …/{id} (enable / disable)
 *   devices       GET /api/offline/devices + GET /api/pos/printers + GET /api/pos/kitchen-targets (display kind)
 *   syncRecords   GET /api/offline/conflicts (per branch), POST /api/offline/conflicts/{id}/resolve
 *
 * Non-repository reads/actions live beside this file (platform-admin, workspace, notifications, cms)
 * and are re-exported here; hooks/use-platform.ts wraps them in SWR.
 */
import { api, apiScope } from '@/services/api/client'
import { acrossBranches, apiRepository, UnsupportedOperationError, versionOf, type Cached } from '@/services/api/adapter'
import { colorFor, compact, initialsOf, stamp, text } from '@/services/api/mappers'
import { grants } from '@/services/api/permissions'
import { toBranch } from '@/services/api/session'
import { branchName, currentBranchIds, currentTenantBranches, directory, setDirectory } from '@/lib/directory'
import { platformTenants } from '@/services/api/modules/platform-admin'
import type {
  BranchResponseDto,
  ConflictResponseDto,
  ConnectionResponseDto,
  CreateBranchDto,
  CreatePosPrinterDto,
  DeviceResponseDto,
  InviteUserDto,
  KitchenTargetResponseDto,
  MemberResponseDto,
  PosPrinterResponseDto,
  ReplaceBranchesDto,
  ReplaceRolesDto,
  RevokeDeviceDto,
  RoleResponseDto,
  UpdateBranchDto,
  UpdateConnectionDto,
  UpdateDeviceDto,
  UpdateKitchenTargetDto,
  UpdatePosPrinterDto,
} from '@/services/api/generated/schemas'
import type {
  AppUser,
  Branch,
  Device,
  DeviceType,
  Integration,
  PermissionAction,
  PermissionMatrix,
  PermissionModule,
  Role,
  RoleId,
  SyncRecord,
} from '@/types'

export * from '@/services/api/modules/platform-admin'
export * from '@/services/api/modules/workspace'
export * from '@/services/api/modules/notifications'
export * from '@/services/api/modules/cms'

const tenantScope = { branchId: null } as const

/** Value of `patch[k]` only when it differs from what the UI currently shows (avoids lossy no-op writes). */
function changed<T, K extends keyof T>(patch: Partial<T>, current: T | undefined, k: K): T[K] | undefined {
  const v = patch[k]
  return v !== undefined && (!current || v !== current[k]) ? (v as T[K]) : undefined
}

/** Run several independent lists; a forbidden one is skipped unless every one fails. */
async function settledFlat<D>(runs: Promise<D[]>[]): Promise<D[]> {
  const settled = await Promise.allSettled(runs)
  const ok = settled.filter((s): s is PromiseFulfilledResult<D[]> => s.status === 'fulfilled')
  if (!ok.length && settled.length) throw (settled[0] as PromiseRejectedResult).reason
  return ok.flatMap((s) => s.value)
}

const codeFrom = (name: string, max = 24) =>
  `${name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'X'}-${Date.now().toString(36).slice(-4).toUpperCase()}`

// ─── Tenants (platform admin) ──────────────────────────────────────────────────────────────────

export const tenants = platformTenants

// ─── Branches ──────────────────────────────────────────────────────────────────────────────────

const tenantIdOf = () => apiScope.tenantId ?? directory.tenantId

/** Keep the shared branch directory (top-bar picker, branchName()) in step with a write. */
function refreshDirectory(b: Branch) {
  const next = [...currentTenantBranches]
  const i = next.findIndex((x) => x.id === b.id)
  if (i >= 0) next[i] = b
  else next.push(b)
  setDirectory(directory.tenantId, directory.tenantName, next)
}

export const branches = apiRepository<Branch, BranchResponseDto>({
  name: 'Branches',
  toUi: (d) => toBranch(d, tenantIdOf()),
  list: () => api.listAll<BranchResponseDto>('/branches', tenantScope),
  get: (id) => api.get<BranchResponseDto>(`/branches/${id}`, tenantScope),
  create: async (input) => {
    const body: CreateBranchDto = {
      name: input.name,
      ...compact({
        phone: input.phone || undefined,
        address_line1: input.address || undefined,
        city: input.city || undefined,
      }),
    }
    const dto = await api.post<BranchResponseDto>('/branches', body, tenantScope)
    refreshDirectory(toBranch(dto, tenantIdOf()))
    return dto
  },
  update: async (id, patch, current) => {
    const ui = current?.ui
    const status = changed(patch, ui, 'status')
    const body: UpdateBranchDto = {
      expected_version: versionOf(current),
      ...compact({
        name: changed(patch, ui, 'name'),
        phone: changed(patch, ui, 'phone'),
        city: changed(patch, ui, 'city'),
        // The UI joins both address lines; only an edited value is written back (to line 1).
        address_line1: changed(patch, ui, 'address'),
        is_open: status !== undefined ? status === 'open' : undefined,
        // Opening an inactive/closed branch also reactivates it.
        status: status === 'open' && current && current.dto.status !== 'active' ? ('active' as const) : undefined,
      }),
    }
    const dto = await api.patch<BranchResponseDto>(`/branches/${id}`, body, tenantScope)
    refreshDirectory(toBranch(dto, tenantIdOf()))
    return dto
  },
  // No DELETE: deactivating is the API's way to retire a branch (it can be reactivated later).
  remove: async (id, current) => {
    const dto = await api.patch<BranchResponseDto>(
      `/branches/${id}`,
      { expected_version: versionOf(current), status: 'inactive', is_open: false } satisfies UpdateBranchDto,
      tenantScope,
    )
    refreshDirectory(toBranch(dto, tenantIdOf()))
  },
})

// ─── Users (tenant members) ────────────────────────────────────────────────────────────────────

const memberStatus: Record<MemberResponseDto['status'], AppUser['status']> = { active: 'active', invited: 'invited', disabled: 'inactive' }

/** Primary role code: the tenant-wide grant when there is one. */
const primaryRole = (d: MemberResponseDto) => (d.roles.find((r) => !r.branch_id) ?? d.roles[0])?.role_code ?? ''

const toUser = (d: MemberResponseDto): AppUser => ({
  id: d.user_id,
  name: d.display_name || d.email,
  email: d.email,
  // Live mode carries the server role *code* (matches Role.id from GET /api/roles), not the demo RoleId.
  role: primaryRole(d) as RoleId,
  branchIds: d.all_branches ? [...currentBranchIds] : d.branch_ids,
  status: memberStatus[d.status],
  // The API has no last-activity timestamp.
  lastActive: '',
  color: colorFor(d.user_id),
})

const branchAccess = (ids: string[]): ReplaceBranchesDto => {
  const all = currentBranchIds.length > 0 && currentBranchIds.every((b) => ids.includes(b))
  return { all_branches: all, branch_ids: all ? [] : ids }
}

export const users = apiRepository<AppUser, MemberResponseDto>({
  name: 'Users',
  toUi: toUser,
  list: () => api.listAll<MemberResponseDto>('/users', tenantScope),
  get: (id) => api.get<MemberResponseDto>(`/users/${id}`, tenantScope),
  create: (input) => {
    const body: InviteUserDto = {
      email: input.email,
      display_name: input.name,
      roles: input.role ? [{ role_code: input.role }] : [],
      ...branchAccess(input.branchIds ?? []),
    }
    return api.post<MemberResponseDto>('/users/invitations', body, tenantScope)
  },
  // Each change goes to its dedicated endpoint; profile fields (name, e-mail) belong to the user, not the tenant.
  update: async (id, patch, current) => {
    const ui = current?.ui
    if (changed(patch, ui, 'name') !== undefined || changed(patch, ui, 'email') !== undefined) {
      throw new UnsupportedOperationError('Users', 'edit name or e-mail')
    }
    let dto = current?.dto
    const role = changed(patch, ui, 'role')
    if (role !== undefined) {
      dto = await api.put<MemberResponseDto>(`/users/${id}/roles`, { roles: [{ role_code: role }] } satisfies ReplaceRolesDto, tenantScope)
    }
    if (patch.branchIds && (!ui || patch.branchIds.join() !== ui.branchIds.join())) {
      dto = await api.put<MemberResponseDto>(`/users/${id}/branches`, branchAccess(patch.branchIds), tenantScope)
    }
    const status = changed(patch, ui, 'status')
    if (status === 'active') dto = await api.post<MemberResponseDto>(`/users/${id}/activate`, undefined, tenantScope)
    else if (status === 'inactive') dto = await api.post<MemberResponseDto>(`/users/${id}/deactivate`, undefined, tenantScope)
    else if (status === 'invited') throw new UnsupportedOperationError('Users', 'set status to invited')
    return dto ?? api.get<MemberResponseDto>(`/users/${id}`, tenantScope)
  },
  // Members are never deleted; deactivation frees the seat and blocks access.
  remove: async (id) => {
    await api.post(`/users/${id}/deactivate`, undefined, tenantScope)
  },
})

// ─── Roles ─────────────────────────────────────────────────────────────────────────────────────

const modules: PermissionModule[] = ['dashboard', 'orders', 'delivery', 'website', 'inventory', 'menu', 'recipes', 'finance', 'reports', 'employees', 'customers', 'settings']
const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete']

function matrixOf(codes: string[]): PermissionMatrix {
  const set = new Set(codes)
  return Object.fromEntries(modules.map((m) => [m, actions.filter((a) => grants(set, m, a))])) as PermissionMatrix
}

const toRole = (d: RoleResponseDto): Role => ({
  id: d.code,
  name: text(d.name) || d.code,
  description: `${d.is_system ? 'System role' : 'Custom role'} · ${d.permissions.length} permissions`,
  permissions: matrixOf(d.permissions),
})

export const roles = apiRepository<Role, RoleResponseDto & { id?: string }>({
  name: 'Roles',
  toUi: toRole,
  list: () => api.listAll<RoleResponseDto>('/roles', tenantScope),
  // Roles and their permission sets are defined server-side; there is no create/update/delete.
})

// ─── Integrations (provider connections) ──────────────────────────────────────────────────────

const latest = (...isos: (string | null | undefined)[]) => isos.filter((x): x is string => !!x).sort().pop() ?? null

const toIntegration = (d: ConnectionResponseDto): Integration => {
  const provider = d.provider.charAt(0).toUpperCase() + d.provider.slice(1)
  const parts = [
    `Remote ID ${d.remote_id}`,
    d.credential_mode ? `${d.credential_mode} credentials${d.credential_mode === 'branch' ? (d.has_credentials ? ' stored' : ' missing') : ''}` : 'credential mode not set',
    d.last_error_code ? `last error ${d.last_error_code}` : null,
  ]
  return {
    id: d.id,
    name: `${provider} · ${branchName(d.branch_id)}`,
    // Connections are delivery-aggregator links (Foodpanda / Delivery Hero) — the only provider family the API has.
    category: 'delivery',
    description: parts.filter(Boolean).join(' · '),
    connected: d.status === 'active',
    lastSync: stamp(latest(d.last_inbound_at, d.last_outbound_at)) || null,
    color: colorFor(d.provider),
    initials: initialsOf(provider) || provider.slice(0, 2).toUpperCase(),
  }
}

export const integrations = apiRepository<Integration, ConnectionResponseDto>({
  name: 'Integrations',
  toUi: toIntegration,
  list: () => api.listAll<ConnectionResponseDto>('/integrations/connections', tenantScope),
  get: (id) => api.get<ConnectionResponseDto>(`/integrations/connections/${id}`, tenantScope),
  update: (id, patch, current) => {
    const connected = changed(patch, current?.ui, 'connected')
    if (connected === undefined) return Promise.resolve(current?.dto ?? api.get<ConnectionResponseDto>(`/integrations/connections/${id}`, tenantScope))
    const body: UpdateConnectionDto = { expected_version: versionOf(current), status: connected ? 'active' : 'disabled' }
    return api.patch<ConnectionResponseDto>(`/integrations/connections/${id}`, body, tenantScope)
  },
})

// ─── Devices (hardware page) ───────────────────────────────────────────────────────────────────
//
// The UI's single "Device" list combines three backend resources, told apart by an id prefix:
//   device:<id>   registered offline POS devices  → type pos-terminal
//   printer:<id>  POS printer configurations     → receipt-printer / kitchen-printer
//   display:<id>  kitchen targets of kind display → kitchen-display
// POS stations (logical tills linked to a device) and printer-kind kitchen targets are exposed via
// hooks/use-platform.ts rather than duplicated here.

type Hardware =
  | { kind: 'device'; id: string; version: number; dto: DeviceResponseDto }
  | { kind: 'printer'; id: string; version: number; dto: PosPrinterResponseDto }
  | { kind: 'display'; id: string; version: number; dto: KitchenTargetResponseDto }

const wrap = <K extends Hardware['kind']>(kind: K, dto: Extract<Hardware, { kind: K }>['dto']) =>
  ({ kind, id: `${kind}:${dto.id}`, version: dto.version, dto }) as Hardware

function toDevice(h: Hardware): Device {
  switch (h.kind) {
    case 'device': {
      const d = h.dto
      return {
        id: h.id,
        name: d.name,
        type: 'pos-terminal',
        branchId: d.branch_id,
        // `active` = licensed to sync; `revoked` = cut off. Live connectivity is not reported.
        status: d.status === 'active' ? 'connected' : 'disconnected',
        lastSync: stamp(latest(d.last_push_at, d.last_pull_at)),
        model: [d.platform, d.app_version && `v${d.app_version}`, d.code].filter(Boolean).join(' · '),
        ipAddress: '',
      }
    }
    case 'printer': {
      const p = h.dto
      return {
        id: h.id,
        name: p.name,
        type: p.kind === 'kitchen' ? 'kitchen-printer' : 'receipt-printer',
        branchId: p.branch_id,
        status: p.is_active ? 'connected' : 'disconnected',
        lastSync: '',
        model: [`${p.kind} printer`, p.connection, p.paper_width_mm ? `${p.paper_width_mm}mm` : null, p.code].filter(Boolean).join(' · '),
        ipAddress: p.address ?? '',
      }
    }
    case 'display': {
      const k = h.dto
      return {
        id: h.id,
        name: k.name,
        type: 'kitchen-display',
        branchId: k.branch_id,
        status: k.is_active ? 'connected' : 'disconnected',
        lastSync: '',
        model: [`kitchen display`, k.menu_category_ids.length ? `${k.menu_category_ids.length} categories` : 'all categories', k.code].join(' · '),
        ipAddress: '',
      }
    }
  }
}

const rawId = (id: string) => id.slice(id.indexOf(':') + 1)

async function getHardware(id: string): Promise<Hardware> {
  const kind = id.split(':')[0]
  if (kind === 'device') return wrap('device', await api.get<DeviceResponseDto>(`/offline/devices/${rawId(id)}`, tenantScope))
  if (kind === 'printer') return wrap('printer', await api.get<PosPrinterResponseDto>(`/pos/printers/${rawId(id)}`, tenantScope))
  return wrap('display', await api.get<KitchenTargetResponseDto>(`/pos/kitchen-targets/${rawId(id)}`, tenantScope))
}

const printerKind: Partial<Record<DeviceType, CreatePosPrinterDto['kind']>> = { 'receipt-printer': 'receipt', 'kitchen-printer': 'kitchen' }

export const devices = apiRepository<Device, Hardware>({
  name: 'Devices',
  toUi: toDevice,
  list: () =>
    settledFlat<Hardware>([
      api.listAll<DeviceResponseDto>('/offline/devices', tenantScope).then((r) => r.map((d) => wrap('device', d))),
      api.listAll<PosPrinterResponseDto>('/pos/printers', tenantScope).then((r) => r.map((d) => wrap('printer', d))),
      api
        .listAll<KitchenTargetResponseDto>('/pos/kitchen-targets', tenantScope)
        .then((r) => r.filter((k) => k.kind === 'display').map((d) => wrap('display', d))),
    ]),
  get: getHardware,
  // Only printers can be added here; POS devices register themselves from the desktop app.
  create: async (input) => {
    const kind = printerKind[input.type]
    if (!kind) throw new UnsupportedOperationError('Devices', `add a ${input.type.replace(/-/g, ' ')} (register it from the POS app)`)
    const body: CreatePosPrinterDto = {
      branch_id: input.branchId,
      code: codeFrom(input.name),
      name: input.name,
      kind,
      connection: input.ipAddress ? 'network' : 'system',
      ...(input.ipAddress ? { address: input.ipAddress } : {}),
    }
    return wrap('printer', await api.post<PosPrinterResponseDto>('/pos/printers', body, { branchId: input.branchId }))
  },
  update: async (id, patch, current) => {
    const h = current?.dto ?? (await getHardware(id))
    const name = changed(patch, current?.ui, 'name')
    const status = changed(patch, current?.ui, 'status')
    const expected_version = h.version
    if (h.kind === 'device') {
      if (status !== undefined) throw new UnsupportedOperationError('Devices', 'change a POS device status (use revoke)')
      if (name === undefined) return h
      const body: UpdateDeviceDto = { expected_version, name }
      return wrap('device', await api.patch<DeviceResponseDto>(`/offline/devices/${h.dto.id}`, body, tenantScope))
    }
    const is_active = status !== undefined ? status === 'connected' : undefined
    if (name === undefined && is_active === undefined) return h
    if (h.kind === 'printer') {
      const body: UpdatePosPrinterDto = { expected_version, ...compact({ name, is_active }) }
      return wrap('printer', await api.patch<PosPrinterResponseDto>(`/pos/printers/${h.dto.id}`, body, tenantScope))
    }
    const body: UpdateKitchenTargetDto = { expected_version, ...compact({ name, is_active }) }
    return wrap('display', await api.patch<KitchenTargetResponseDto>(`/pos/kitchen-targets/${h.dto.id}`, body, tenantScope))
  },
  // Devices are revoked; printers and displays are deactivated (none of them has a DELETE).
  remove: async (id, current) => {
    const h = current?.dto ?? (await getHardware(id))
    if (h.kind === 'device') {
      await api.post(`/offline/devices/${h.dto.id}/revoke`, { reason_code: 'revoked_by_admin' } satisfies RevokeDeviceDto, tenantScope)
    } else if (h.kind === 'printer') {
      await api.patch(`/pos/printers/${h.dto.id}`, { expected_version: h.version, is_active: false } satisfies UpdatePosPrinterDto, tenantScope)
    } else {
      await api.patch(`/pos/kitchen-targets/${h.dto.id}`, { expected_version: h.version, is_active: false } satisfies UpdateKitchenTargetDto, tenantScope)
    }
  },
})

// ─── Sync records (offline conflicts & rejections) ────────────────────────────────────────────

/** Conflict row tagged with the branch it was listed under (resolve needs that X-Branch-Id). */
type ConflictRow = ConflictResponseDto & { branch_id: string; resolved?: boolean }

const verbAction = (type: string): SyncRecord['action'] => {
  const verb = type.split('.').pop() ?? ''
  if (/^(create|record|open|add|register|issue)/.test(verb)) return 'create'
  if (/^(delete|remove|void|cancel|archive)/.test(verb)) return 'delete'
  return 'update'
}

const outcomeText = (o: Record<string, unknown>) => {
  const s = JSON.stringify(o ?? {})
  return s === '{}' ? undefined : s.length > 200 ? `${s.slice(0, 200)}…` : s
}

const toSyncRecord = (c: ConflictRow): SyncRecord => ({
  id: c.id,
  entity: c.type.split('.')[0] ?? c.type,
  action: verbAction(c.type),
  description: [c.type, c.entity_id].filter(Boolean).join(' · '),
  status: c.resolved ? 'synced' : c.status === 'conflict' ? 'conflict' : 'failed',
  createdAt: stamp(c.received_at),
  // Retry counts are kept on the device, not reported to the server.
  attempts: 0,
  error: outcomeText(c.outcome),
})

export const syncRecords = apiRepository<SyncRecord, ConflictRow>({
  name: 'Sync records',
  toUi: toSyncRecord,
  list: () =>
    acrossBranches((branchId) =>
      api.listAll<ConflictResponseDto>('/offline/conflicts', { branchId }).then((rows) => rows.map((r) => ({ ...r, branch_id: branchId }))),
    ),
  // "Retry" / "Keep local" both mean "handled": the fix itself is made through the normal APIs.
  update: async (id, patch, current: Cached<SyncRecord, ConflictRow> | undefined) => {
    if (!current) throw new UnsupportedOperationError('Sync records', 'update an unlisted record')
    if (patch.status !== 'synced') throw new UnsupportedOperationError('Sync records', `mark as ${patch.status ?? 'changed'}`)
    await api.post(`/offline/conflicts/${id}/resolve`, undefined, { branchId: current.dto.branch_id })
    return { ...current.dto, resolved: true }
  },
})
