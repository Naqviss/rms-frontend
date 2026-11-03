'use client'

import { CheckIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/common/page-header'
import { useAppUsers, useDevices, useIntegrations } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { currentTenantBranches } from '@/lib/directory'
import { StatusBadge } from '@/components/common/status-badge'
import { fromMinor, text } from '@/services/api/mappers'
import { useSession } from '@/services/api/session'
import type { SubscriptionResponseDto } from '@/services/api/generated/schemas'

const money = (minor: number | null | undefined, currency: string | null | undefined) => {
  if (minor == null) return null
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: currency || 'PKR', maximumFractionDigits: 2 }).format(fromMinor(minor))
  } catch {
    return formatCurrency(fromMinor(minor))
  }
}

const statusView: Record<SubscriptionResponseDto['status'], { status: string; label: string; tone?: 'warning' }> = {
  trialing: { status: 'trial', label: 'Trial' },
  active: { status: 'active', label: 'Active' },
  grace: { status: 'grace', label: 'Grace period', tone: 'warning' },
  suspended: { status: 'suspended', label: 'Suspended' },
  cancelled: { status: 'cancelled', label: 'Cancelled' },
}

/**
 * The tenant's real subscription from GET /api/subscription (loaded with the session).
 * Plans are assigned by the platform operator; the tenant API has no plan switching or cancel.
 */
export default function SubscriptionPage() {
  const { t } = useT()
  const sub = useSession((s) => s.subscription)
  const { data: users } = useAppUsers()
  const { data: devices } = useDevices()
  const { data: integrations } = useIntegrations()

  if (!sub) {
    return (
      <>
        <PageHeader title={t('subscription.title')} description={t('subscription.subtitle')} />
        <Alert>
          <AlertTitle>No subscription found</AlertTitle>
          <AlertDescription>The server returned no subscription for this tenant. Contact the platform operator.</AlertDescription>
        </Alert>
      </>
    )
  }

  const plan = sub.plan
  const view = statusView[sub.status]
  const price = money(plan.price_minor, plan.currency)
  const until = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : null)
  const limits = plan.limits
  const usage: { label: string; used: number | null; limit: number | null | undefined }[] = [
    { label: t('nav.branches'), used: currentTenantBranches.length, limit: limits.max_branches },
    { label: t('nav.users'), used: users ? users.filter((u) => u.status !== 'inactive').length : null, limit: limits.max_users },
    { label: 'Offline devices', used: devices ? devices.filter((d) => d.type === 'pos-terminal' && d.status === 'connected').length : null, limit: limits.max_offline_devices },
    { label: 'Integrations', used: integrations ? integrations.filter((i) => i.connected).length : null, limit: limits.max_integrations },
    { label: 'Storage (MB)', used: null, limit: limits.max_storage_mb },
  ]

  return (
    <>
      <PageHeader title={t('subscription.title')} description={t('subscription.subtitle')} />
      {sub.status === 'trialing' && (
        <Alert>
          <AlertTitle>Trial</AlertTitle>
          <AlertDescription>{sub.trial_ends_at ? `Your trial ends on ${until(sub.trial_ends_at)}.` : 'You are on a trial subscription.'}</AlertDescription>
        </Alert>
      )}
      {sub.status === 'grace' && (
        <Alert variant="destructive">
          <AlertTitle>Grace period</AlertTitle>
          <AlertDescription>
            {sub.grace_ends_at ? `Renew before ${until(sub.grace_ends_at)} to avoid suspension.` : 'Renew soon to avoid suspension.'}
          </AlertDescription>
        </Alert>
      )}
      {(sub.status === 'suspended' || sub.status === 'cancelled') && (
        <Alert variant="destructive">
          <AlertTitle>{sub.status === 'suspended' ? 'Subscription suspended' : t('subscription.cancelledTitle')}</AlertTitle>
          <AlertDescription>Contact the platform operator to reactivate your subscription.</AlertDescription>
        </Alert>
      )}
      {!sub.operational && sub.status !== 'suspended' && sub.status !== 'cancelled' && (
        <Alert variant="destructive">
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>Changes are blocked until the subscription is reactivated.</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {text(plan.name) || plan.code}
            <StatusBadge status={view.status} label={view.label} tone={view.tone} />
            {!sub.operational && <Badge variant="destructive">Read-only</Badge>}
          </CardTitle>
          <CardDescription>
            {[
              price ? `${price} / ${plan.billing_interval}` : plan.billing_interval,
              sub.current_period_end && `${t('subscription.renews')} ${until(sub.current_period_end)}`,
              sub.trial_ends_at && sub.status === 'trialing' && `Trial ends ${until(sub.trial_ends_at)}`,
              sub.grace_ends_at && sub.status === 'grace' && `Grace ends ${until(sub.grace_ends_at)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {usage.map((u) => {
            const unlimited = u.limit == null
            const pct = !unlimited && u.used != null && u.limit! > 0 ? Math.min(100, (u.used / u.limit!) * 100) : 0
            return (
              <div key={u.label} className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{u.label}</span>
                  <span className="tabular-nums">
                    {u.used != null ? `${u.used} / ` : ''}
                    {unlimited ? 'Unlimited' : u.limit}
                  </span>
                </div>
                {!unlimited && u.used != null && <Progress value={pct} aria-label={u.label} />}
              </div>
            )
          })}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">Plan changes and renewals are handled by the platform operator.</CardFooter>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Included features</CardTitle>
          </CardHeader>
          <CardContent>
            {plan.features.length ? (
              <ul className="flex flex-col gap-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckIcon className="size-4 text-primary" aria-hidden />
                    <span className="font-mono text-xs">{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No feature flags listed for this plan.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offline policy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="flex justify-between"><span className="text-muted-foreground">Offline lease</span><span className="tabular-nums">{plan.offline_lease_days} days</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Sync grace</span><span className="tabular-nums">{plan.sync_grace_hours} h</span></p>
            <p className="flex justify-between"><span className="text-muted-foreground">Backups kept</span><span className="tabular-nums">{plan.backup_retention_count}</span></p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
