'use client'

import { useMemo, useState } from 'react'
import { CheckIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { useTenants } from '@/hooks/use-data'
import { usePlatformPlans } from '@/hooks/use-platform'
import { useT } from '@/lib/i18n/use-t'
import { errorMessage } from '@/services/api/client'
import { fromMinor, localized, text, toMinor } from '@/services/api/mappers'
import { createPlatformPlan, subscriptionOf, updatePlatformPlan } from '@/services/api/modules/platform'
import type { CreatePlanDto, PlanResponseDto } from '@/services/api/generated/schemas'
import { AdminGuard } from '../admin-guard'

const money = (p: PlanResponseDto) => {
  if (p.price_minor == null) return 'Custom pricing'
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: p.currency || 'PKR', maximumFractionDigits: 2 }).format(fromMinor(p.price_minor))
  } catch {
    return `${fromMinor(p.price_minor)} ${p.currency ?? ''}`
  }
}

const limitLabel = (n: number | null | undefined) => (n == null ? 'Unlimited' : String(n))

export default function AdminPlansPage() {
  return (
    <AdminGuard>
      <Plans />
    </AdminGuard>
  )
}

/**
 * GET/POST /api/platform/plans, PATCH …/{planId}. Price and billing interval are fixed once a plan
 * exists (UpdatePlanDto has no price); a new price means a new plan.
 */
function Plans() {
  const { t } = useT()
  const { data: plans, isLoading, mutate } = usePlatformPlans()
  const { data: tenants } = useTenants()
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Subscriptions are loaded with the tenant list; count by plan code.
  const subscribers = useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of tenants ?? []) {
      const code = subscriptionOf(x.id)?.plan.code
      if (code) m[code] = (m[code] ?? 0) + 1
    }
    return m
  }, [tenants])

  const toggle = async (p: PlanResponseDto) => {
    setBusy(p.id)
    try {
      await updatePlatformPlan(p, { status: p.status === 'active' ? 'retired' : 'active' })
      toast.success(t('common.saved'))
      await mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const create = async (v: FormValues) => {
    const num = (k: string) => Number(v[k]) || 0
    const limit = (k: string) => (num(k) > 0 ? num(k) : undefined)
    const body: CreatePlanDto = {
      code: String(v.code).trim(),
      name: localized(String(v.name).trim()),
      billing_interval: String(v.billing_interval) as CreatePlanDto['billing_interval'],
      price_minor: toMinor(Number(v.price)),
      currency: String(v.currency).trim() || null,
      features: String(v.features)
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean),
      limits: Object.fromEntries(
        Object.entries({
          max_branches: limit('max_branches'),
          max_users: limit('max_users'),
          max_offline_devices: limit('max_offline_devices'),
          max_integrations: limit('max_integrations'),
        }).filter(([, x]) => x !== undefined),
      ),
      offline_lease_days: num('offline_lease_days'),
      sync_grace_hours: num('sync_grace_hours'),
      backup_retention_count: num('backup_retention_count'),
      trial_days: num('trial_days'),
      grace_days: num('grace_days'),
    }
    try {
      await createPlatformPlan(body)
      toast.success(t('common.created'))
      await mutate()
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  return (
    <>
      <PageHeader
        title={t('admin.plans')}
        description="Plan catalog: limits, features and offline policy of each subscription plan."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon data-icon="inline-start" />
            New plan
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(plans ?? []).map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {text(p.name) || p.code}
                  <StatusBadge status={p.status === 'active' ? 'active' : 'inactive'} label={p.status} />
                </CardTitle>
                <CardDescription>
                  <span className="font-mono">{p.code}</span> · {subscribers[p.code] ?? 0} {t('admin.subscribers')}
                </CardDescription>
                <p className="pt-2 text-2xl font-semibold tabular-nums">
                  {money(p)}
                  <span className="text-sm font-normal text-muted-foreground"> / {p.billing_interval}</span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                <div className="grid grid-cols-2 gap-1.5">
                  <span className="text-muted-foreground">Branches</span>
                  <span className="text-end tabular-nums">{limitLabel(p.limits.max_branches)}</span>
                  <span className="text-muted-foreground">Users</span>
                  <span className="text-end tabular-nums">{limitLabel(p.limits.max_users)}</span>
                  <span className="text-muted-foreground">Offline devices</span>
                  <span className="text-end tabular-nums">{limitLabel(p.limits.max_offline_devices)}</span>
                  <span className="text-muted-foreground">Integrations</span>
                  <span className="text-end tabular-nums">{limitLabel(p.limits.max_integrations)}</span>
                  <span className="text-muted-foreground">Storage (MB)</span>
                  <span className="text-end tabular-nums">{limitLabel(p.limits.max_storage_mb)}</span>
                  <span className="text-muted-foreground">Offline lease</span>
                  <span className="text-end tabular-nums">{p.offline_lease_days} d</span>
                  <span className="text-muted-foreground">Sync grace</span>
                  <span className="text-end tabular-nums">{p.sync_grace_hours} h</span>
                  <span className="text-muted-foreground">Trial / grace</span>
                  <span className="text-end tabular-nums">
                    {p.trial_days} d / {p.grace_days} d
                  </span>
                </div>
                {p.features.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckIcon className="size-4 text-primary" aria-hidden />
                        <span className="font-mono text-xs">{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
              <CardFooter className="justify-end">
                <Button size="sm" variant={p.status === 'active' ? 'outline' : 'default'} disabled={busy === p.id} onClick={() => void toggle(p)}>
                  {busy === p.id && <Spinner data-icon="inline-start" />}
                  {p.status === 'active' ? 'Retire' : 'Reactivate'}
                </Button>
              </CardFooter>
            </Card>
          ))}
          {plans?.length === 0 && <Badge variant="secondary">No plans</Badge>}
        </div>
      )}
      <FormDialog
        open={creating}
        onOpenChange={setCreating}
        title="New plan"
        description="Leave a limit at 0 for unlimited. Price is in major units of the currency."
        fields={[
          { name: 'code', label: 'Code', required: true, placeholder: 'pro_monthly' },
          { name: 'name', label: t('common.name'), required: true },
          {
            name: 'billing_interval',
            label: 'Billing interval',
            type: 'select',
            options: ['monthly', 'yearly', 'trial', 'custom'].map((x) => ({ value: x, label: x })),
          },
          { name: 'price', label: 'Price', type: 'number' },
          { name: 'currency', label: 'Currency', placeholder: 'PKR' },
          { name: 'features', label: 'Feature codes (comma separated)', wide: true },
          { name: 'max_branches', label: 'Max branches', type: 'number' },
          { name: 'max_users', label: 'Max users', type: 'number' },
          { name: 'max_offline_devices', label: 'Max offline devices', type: 'number' },
          { name: 'max_integrations', label: 'Max integrations', type: 'number' },
          { name: 'offline_lease_days', label: 'Offline lease (days)', type: 'number', required: true },
          { name: 'sync_grace_hours', label: 'Sync grace (hours)', type: 'number', required: true },
          { name: 'backup_retention_count', label: 'Backups kept', type: 'number', required: true },
          { name: 'trial_days', label: 'Trial days', type: 'number' },
          { name: 'grace_days', label: 'Grace days', type: 'number' },
        ]}
        initial={{
          code: '',
          name: '',
          billing_interval: 'monthly',
          price: 0,
          currency: 'PKR',
          features: '',
          max_branches: 0,
          max_users: 0,
          max_offline_devices: 0,
          max_integrations: 0,
          offline_lease_days: '',
          sync_grace_hours: '',
          backup_retention_count: '',
          trial_days: 0,
          grace_days: 0,
        }}
        onSubmit={create}
      />
    </>
  )
}
