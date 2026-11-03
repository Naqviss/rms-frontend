'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useTenants } from '@/hooks/use-data'
import { usePlatformPlans } from '@/hooks/use-platform'
import { useT } from '@/lib/i18n/use-t'
import { formatDate, initials } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { text } from '@/services/api/mappers'
import { activateTenantSubscription, cancelTenantSubscription, subscriptionOf, suspendTenantSubscription } from '@/services/api/modules/platform'
import type { Tenant } from '@/types'
import { AdminGuard } from '../admin-guard'

type Pending = { tenant: Tenant; action: 'suspend' | 'cancel' | 'archive' }

export default function TenantsPage() {
  return (
    <AdminGuard>
      <Tenants />
    </AdminGuard>
  )
}

/**
 * GET /api/platform/tenants with each tenant's subscription. Revenue, orders, users and branch
 * counts have no platform API, so they are not shown.
 */
function Tenants() {
  const { t } = useT()
  const { data, isLoading, update, remove, mutate } = useTenants()
  const { data: plans } = usePlatformPlans()
  const [status, setStatus] = useState('all')
  const [activating, setActivating] = useState<Tenant | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const rows = useMemo(() => (data ?? []).filter((x) => (status === 'all' ? true : x.status === status)), [data, status])

  const subAction = async (run: () => Promise<unknown>, ok: string) => {
    try {
      await run()
      toast.success(ok)
      await mutate()
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  const columns = useMemo<ColumnDef<Tenant, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: row.original.color }} className="text-xs text-white">
                {initials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{[row.original.email, row.original.phone].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'plan',
        header: t('admin.plan'),
        accessorFn: (r) => subscriptionOf(r.id)?.plan.code ?? '',
        cell: ({ row }) => {
          const sub = subscriptionOf(row.original.id)
          if (!sub) return <span className="text-muted-foreground">—</span>
          return (
            <span className="flex items-center gap-1.5">
              <Badge variant="outline">{text(sub.plan.name) || sub.plan.code}</Badge>
              <span className="text-xs text-muted-foreground">{sub.status}</span>
            </span>
          )
        },
      },
      {
        id: 'periodEnd',
        header: 'Period end',
        accessorFn: (r) => subscriptionOf(r.id)?.current_period_end ?? subscriptionOf(r.id)?.trial_ends_at ?? '',
        cell: ({ row }) => {
          const s = subscriptionOf(row.original.id)
          const end = s?.current_period_end ?? s?.trial_ends_at
          return end ? formatDate(end.slice(0, 10)) : '—'
        },
      },
      { accessorKey: 'registeredAt', header: t('admin.registered'), cell: ({ row }) => formatDate(row.original.registeredAt) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => {
          const sub = subscriptionOf(row.original.id)
          return (
            <RowActions
              actions={[
                row.original.status === 'suspended'
                  ? {
                      label: t('admin.activate'),
                      onSelect: async () => {
                        await update(row.original.id, { status: 'active' })
                        toast.success(t('common.updated'))
                      },
                    }
                  : { label: t('admin.suspend'), onSelect: () => setPending({ tenant: row.original, action: 'suspend' }) },
                { label: 'Activate / renew subscription', onSelect: () => setActivating(row.original) },
                ...(sub && sub.status !== 'suspended' && sub.status !== 'cancelled'
                  ? [{ label: 'Suspend subscription', onSelect: () => void subAction(() => suspendTenantSubscription(row.original.id), t('common.updated')) }]
                  : []),
                ...(sub && sub.status !== 'cancelled'
                  ? [{ label: 'Cancel subscription', destructive: true, onSelect: () => setPending({ tenant: row.original, action: 'cancel' }) }]
                  : []),
                { label: 'Archive tenant', destructive: true, onSelect: () => setPending({ tenant: row.original, action: 'archive' }) },
              ]}
            />
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, data],
  )

  const confirmText: Record<Pending['action'], { title: string; body: string; label: string }> = {
    suspend: { title: 'Suspend tenant?', body: 'Everyone in this business loses access until it is reactivated.', label: t('admin.suspend') },
    cancel: { title: 'Cancel subscription?', body: 'The tenant subscription is cancelled.', label: 'Cancel subscription' },
    archive: { title: 'Archive tenant?', body: 'Archiving is the final lifecycle state of a tenant.', label: 'Archive' },
  }

  return (
    <>
      <PageHeader title={t('admin.tenants')} description={t('admin.tenantsSubtitle')} />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="tenants"
        filters={
          <OptionSelect
            className="h-9 w-40"
            value={status}
            onValueChange={setStatus}
            aria-label={t('common.status')}
            options={[
              { value: 'all', label: `${t('common.status')}: ${t('common.all')}` },
              { value: 'active', label: t('status.active') },
              { value: 'trial', label: t('status.trial') },
              { value: 'suspended', label: t('status.suspended') },
            ]}
          />
        }
      />
      <FormDialog
        open={!!activating}
        onOpenChange={(o) => !o && setActivating(null)}
        title={`Activate subscription · ${activating?.name ?? ''}`}
        fields={[
          {
            name: 'plan_code',
            label: t('admin.plan'),
            type: 'select',
            required: true,
            options: (plans ?? []).filter((p) => p.status === 'active').map((p) => ({ value: p.code, label: text(p.name) || p.code })),
          },
          { name: 'period_end', label: 'Paid until', type: 'date', required: true },
          { name: 'external_reference', label: 'Billing reference (optional)' },
        ]}
        initial={{ plan_code: (activating && subscriptionOf(activating.id)?.plan.code) || plans?.[0]?.code || '', period_end: '', external_reference: '' }}
        onSubmit={(v) =>
          activating
            ? subAction(
                () =>
                  activateTenantSubscription(activating.id, {
                    plan_code: String(v.plan_code),
                    period_end: new Date(`${String(v.period_end)}T23:59:59Z`).toISOString(),
                    ...(String(v.external_reference).trim() ? { external_reference: String(v.external_reference).trim() } : {}),
                  }),
                t('common.updated'),
              )
            : false
        }
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? confirmText[pending.action].title : ''}
        description={pending ? confirmText[pending.action].body : ''}
        confirmLabel={pending ? confirmText[pending.action].label : ''}
        onConfirm={() => {
          if (!pending) return
          const { tenant, action } = pending
          if (action === 'suspend') void update(tenant.id, { status: 'suspended' }).then(() => toast.success(t('common.updated')), () => undefined)
          else if (action === 'cancel') void subAction(() => cancelTenantSubscription(tenant.id), t('common.updated'))
          else void remove(tenant.id).then(() => toast.success('Tenant archived'), () => undefined)
        }}
      />
    </>
  )
}
