/**
 * Platform administration (operator console under /admin) — only for identities with
 * `is_platform_admin` (GET /api/me). The backend re-checks every call.
 *
 *   GET  /api/platform/tenants                                   tenants (newest first)
 *   POST /api/platform/tenants/{tenantId}/status                 suspend / reactivate / cancel / archive
 *   GET  /api/platform/tenants/{tenantId}/subscription           a tenant's subscription
 *   POST /api/platform/tenants/{tenantId}/subscription/activate  activate or renew on a plan
 *   POST /api/platform/tenants/{tenantId}/subscription/suspend
 *   POST /api/platform/tenants/{tenantId}/subscription/cancel
 *   GET/POST /api/platform/plans, PATCH /api/platform/plans/{planId}
 */
import { api } from '@/services/api/client'
import { apiRepository, UnsupportedOperationError } from '@/services/api/adapter'
import { colorFor, day } from '@/services/api/mappers'
import { planTier, useSession } from '@/services/api/session'
import type {
  ActivateSubscriptionDto,
  CreatePlanDto,
  PlanResponseDto,
  SubscriptionReasonDto,
  SubscriptionResponseDto,
  TenantResponseDto,
  TenantTransitionDto,
  UpdatePlanDto,
} from '@/services/api/generated/schemas'
import type { Tenant } from '@/types'

const noBranch = { branchId: null } as const

export const isPlatformAdmin = () => !!useSession.getState().me?.is_platform_admin

function requireAdmin() {
  if (!isPlatformAdmin()) throw new UnsupportedOperationError('Platform admin', 'this console (platform administrators only)')
}

/** Tenant row plus its subscription (fetched alongside, since the tenant list does not embed the plan). */
export type PlatformTenantRow = TenantResponseDto & { subscription: SubscriptionResponseDto | null }

const tenantSubscription = (tenantId: string) => api.get<SubscriptionResponseDto>(`/platform/tenants/${tenantId}/subscription`, noBranch)

/** Subscriptions seen while listing tenants, by tenant id (for per-plan subscriber counts). */
const subscriptions = new Map<string, SubscriptionResponseDto | null>()
export const subscriptionOf = (tenantId: string) => subscriptions.get(tenantId) ?? null

async function withSubscriptions(rows: TenantResponseDto[]): Promise<PlatformTenantRow[]> {
  const out: PlatformTenantRow[] = []
  // Small batches so a large tenant list does not open hundreds of requests at once.
  for (let i = 0; i < rows.length; i += 8) {
    const batch = rows.slice(i, i + 8)
    const subs = await Promise.allSettled(batch.map((t) => tenantSubscription(t.id)))
    batch.forEach((t, j) => {
      const s = subs[j]
      const subscription = s.status === 'fulfilled' ? s.value : null
      subscriptions.set(t.id, subscription)
      out.push({ ...t, subscription })
    })
  }
  return out
}

function tenantStatus(d: PlatformTenantRow): Tenant['status'] {
  if (d.status === 'suspended' || d.status === 'cancelled' || d.status === 'archived') return 'suspended'
  if (d.subscription?.status === 'trialing') return 'trial'
  return 'active'
}

const toTenant = (d: PlatformTenantRow): Tenant => ({
  id: d.id,
  name: d.display_name,
  // The platform tenant list has no owner, city or usage figures.
  owner: '',
  email: d.contact_email ?? '',
  phone: d.contact_phone ?? '',
  city: '',
  branches: 0,
  plan: planTier(d.subscription),
  status: tenantStatus(d),
  registeredAt: day(d.created_at),
  monthlyRevenue: 0,
  usersCount: 0,
  ordersThisMonth: 0,
  color: colorFor(d.id),
})

async function transitionTenant(id: string, status: TenantTransitionDto['status'], reason_code: string, prev?: PlatformTenantRow) {
  const dto = await api.post<TenantResponseDto>(`/platform/tenants/${id}/status`, { status, reason_code } satisfies TenantTransitionDto, noBranch)
  return { ...dto, subscription: prev?.subscription ?? subscriptions.get(id) ?? null }
}

export const platformTenants = apiRepository<Tenant, PlatformTenantRow>({
  name: 'Tenants',
  toUi: toTenant,
  list: async () => {
    requireAdmin()
    return withSubscriptions(await api.listAll<TenantResponseDto>('/platform/tenants', noBranch))
  },
  // Only the lifecycle status can be changed from the console.
  update: (id, patch, current) => {
    if (patch.status === undefined || Object.keys(patch).some((k) => k !== 'status')) {
      return Promise.reject(new UnsupportedOperationError('Tenants', 'edit tenant details'))
    }
    if (patch.status === 'trial') return Promise.reject(new UnsupportedOperationError('Tenants', 'set trial (activate a subscription instead)'))
    return transitionTenant(id, patch.status, patch.status === 'suspended' ? 'suspended_by_platform' : 'reactivated_by_platform', current?.dto)
  },
  // Tenants are never deleted; archiving is the terminal lifecycle state.
  remove: async (id, current) => {
    await transitionTenant(id, 'archived', 'archived_by_platform', current?.dto)
  },
})

export async function activateTenantSubscription(tenantId: string, body: ActivateSubscriptionDto) {
  const s = await api.post<SubscriptionResponseDto>(`/platform/tenants/${tenantId}/subscription/activate`, body, noBranch)
  subscriptions.set(tenantId, s)
  return s
}

export async function suspendTenantSubscription(tenantId: string, reason_code = 'suspended_by_platform') {
  const s = await api.post<SubscriptionResponseDto>(`/platform/tenants/${tenantId}/subscription/suspend`, { reason_code } satisfies SubscriptionReasonDto, noBranch)
  subscriptions.set(tenantId, s)
  return s
}

export async function cancelTenantSubscription(tenantId: string, reason_code = 'cancelled_by_platform') {
  const s = await api.post<SubscriptionResponseDto>(`/platform/tenants/${tenantId}/subscription/cancel`, { reason_code } satisfies SubscriptionReasonDto, noBranch)
  subscriptions.set(tenantId, s)
  return s
}

export const getTenantSubscription = tenantSubscription

// ─── Plans ─────────────────────────────────────────────────────────────────────────────────────

export function listPlatformPlans() {
  requireAdmin()
  return api.listAll<PlanResponseDto>('/platform/plans', noBranch)
}

export const createPlatformPlan = (body: CreatePlanDto) => api.post<PlanResponseDto>('/platform/plans', body, noBranch)

export function updatePlatformPlan(plan: PlanResponseDto, patch: Omit<UpdatePlanDto, 'expected_version'>) {
  return api.patch<PlanResponseDto>(`/platform/plans/${plan.id}`, { expected_version: plan.version, ...patch } satisfies UpdatePlanDto, noBranch)
}
