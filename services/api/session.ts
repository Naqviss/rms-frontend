/**
 * Live-mode session bootstrap: resolves who the signed-in identity is, which tenant and branches
 * they may use, their server-side permissions and the tenant's subscription.
 *
 *   GET /api/me            identity + memberships (provisioned=false → needs onboarding/invite)
 *   GET /api/tenant        selected tenant profile
 *   GET /api/branches      branches the caller can access
 *   GET /api/me/access     effective permission codes for the tenant
 *   GET /api/subscription  plan, status and whether writes are allowed
 */
import { create } from 'zustand'
import { api, apiScope } from '@/services/api/client'
import { setDirectory } from '@/lib/directory'
import { day, text } from '@/services/api/mappers'
import type {
  AccessResponseDto,
  BranchResponseDto,
  MeResponseDto,
  SubscriptionResponseDto,
  TenantResponseDto,
} from '@/services/api/generated/schemas'
import type { Branch } from '@/types'

export type SessionStatus = 'idle' | 'loading' | 'ready' | 'unprovisioned' | 'no-tenant' | 'error'

interface SessionState {
  status: SessionStatus
  error: string | null
  me: MeResponseDto | null
  tenant: TenantResponseDto | null
  access: AccessResponseDto | null
  subscription: SubscriptionResponseDto | null
  /** Permission codes as a set, for O(1) checks. */
  permissions: Set<string>
}

export const useSession = create<SessionState>(() => ({
  status: 'idle',
  error: null,
  me: null,
  tenant: null,
  access: null,
  subscription: null,
  permissions: new Set(),
}))

export function toBranch(b: BranchResponseDto, tenantId: string): Branch {
  return {
    id: b.id,
    tenantId,
    name: b.name,
    city: b.city ?? '',
    address: [b.address_line1, b.address_line2].filter(Boolean).join(', '),
    phone: b.phone ?? '',
    email: '',
    manager: '',
    opensAt: '',
    closesAt: '',
    status: b.status === 'active' && b.is_open ? 'open' : 'closed',
    seats: 0,
  }
}

const TENANT_KEY = 'rms:v1:tenant'

/** Load the whole session. Safe to call again (e.g. after switching tenant). */
export async function bootstrapSession(): Promise<SessionStatus> {
  useSession.setState({ status: 'loading', error: null })
  try {
    const me = await api.get<MeResponseDto>('/me', { branchId: null })
    if (!me.provisioned) {
      useSession.setState({ status: 'unprovisioned', me })
      return 'unprovisioned'
    }
    const active = me.memberships.filter((m) => m.status === 'active')
    if (!active.length) {
      useSession.setState({ status: 'no-tenant', me })
      return 'no-tenant'
    }
    let remembered: string | null = null
    try {
      remembered = window.localStorage.getItem(TENANT_KEY)
    } catch {
      // ignore
    }
    const membership = active.find((m) => m.tenant_id === remembered) ?? active[0]
    apiScope.tenantId = membership.tenant_id
    apiScope.branchId = null

    const [tenant, branchRows, access, subscription] = await Promise.all([
      api.get<TenantResponseDto>('/tenant', { branchId: null }),
      api.listAll<BranchResponseDto>('/branches', { branchId: null }),
      api.get<AccessResponseDto>('/me/access', { branchId: null }),
      api.get<SubscriptionResponseDto>('/subscription', { branchId: null }).catch(() => null),
    ])

    const branches = branchRows.map((b) => toBranch(b, tenant.id))
    setDirectory(tenant.id, tenant.display_name, branches)
    apiScope.branchId = branches[0]?.id ?? null

    useSession.setState({
      status: 'ready',
      me,
      tenant,
      access,
      subscription,
      permissions: new Set(access.permissions),
    })
    return 'ready'
  } catch (err) {
    useSession.setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    return 'error'
  }
}

export function rememberTenant(tenantId: string) {
  try {
    window.localStorage.setItem(TENANT_KEY, tenantId)
  } catch {
    // ignore
  }
}

export function clearSession() {
  apiScope.tenantId = null
  apiScope.branchId = null
  setDirectory('', '', [])
  useSession.setState({ status: 'idle', error: null, me: null, tenant: null, access: null, subscription: null, permissions: new Set() })
}

/** Plan code → the prototype's three plan tiers used for nav gating. */
export function planTier(sub: SubscriptionResponseDto | null): 'starter' | 'professional' | 'enterprise' {
  const code = `${sub?.plan.code ?? ''} ${text(sub?.plan.name)}`.toLowerCase()
  if (code.includes('enterprise')) return 'enterprise'
  if (code.includes('pro') || code.includes('growth') || code.includes('business')) return 'professional'
  if (code.includes('starter') || code.includes('basic') || code.includes('trial')) return 'starter'
  return 'enterprise'
}

export const subscriptionEnds = (sub: SubscriptionResponseDto | null) =>
  day(sub?.trial_ends_at ?? sub?.current_period_end ?? sub?.grace_ends_at ?? null)
