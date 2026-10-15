'use client'

import { CheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/common/page-header'
import { useBranches, useAppUsers, useProducts } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { currentTenantBranches } from '@/mocks/branches'
import { plans } from '@/mocks/platform'
import { useAppStore } from '@/stores/app-store'

export default function SubscriptionPage() {
  const { t } = useT()
  const plan = useAppStore((s) => s.plan)
  const setPlan = useAppStore((s) => s.setPlan)
  const cancelledAt = useAppStore((s) => s.cancelledAt)
  const setCancelled = useAppStore((s) => s.setCancelled)
  const { data: users } = useAppUsers()
  const { data: products } = useProducts()
  useBranches()

  const current = plans.find((p) => p.planId === plan) ?? plans[0]
  const usage = [
    { label: t('nav.branches'), used: currentTenantBranches.length, limit: current.limits.branches },
    { label: t('nav.users'), used: users?.length ?? 0, limit: current.limits.users },
    { label: t('nav.menu'), used: products?.length ?? 0, limit: current.limits.products },
  ]
  const renewal = new Date()
  renewal.setMonth(renewal.getMonth() + 1)

  return (
    <>
      <PageHeader title={t('subscription.title')} description={t('subscription.subtitle')} />
      {cancelledAt && (
        <Alert variant="destructive">
          <AlertTitle>{t('subscription.cancelledTitle')}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {t('subscription.cancelledBody')}
            <Button size="sm" variant="outline" onClick={() => setCancelled(null)}>
              {t('subscription.resume')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {current.name} <Badge variant="secondary">{t('common.active')}</Badge>
          </CardTitle>
          <CardDescription>
            {formatCurrency(current.priceMonthly)} / {t('subscription.month')} · {t('subscription.renews')} {formatDate(renewal.toISOString().slice(0, 10))}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {usage.map((u) => {
            const pct = Math.min(100, (u.used / u.limit) * 100)
            return (
              <div key={u.label} className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{u.label}</span>
                  <span className="tabular-nums">
                    {u.used} / {u.limit}
                  </span>
                </div>
                <Progress value={pct} aria-label={u.label} />
              </div>
            )
          })}
        </CardContent>
        {!cancelledAt && (
          <CardFooter>
            <Button variant="ghost" className="text-destructive" onClick={() => setCancelled(new Date().toISOString().slice(0, 10))}>
              {t('subscription.cancel')}
            </Button>
          </CardFooter>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.planId === plan
          return (
            <Card key={p.id} className={cn(p.highlight && 'ring-2 ring-primary')}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
                <p className="pt-2 text-2xl font-semibold tabular-nums">
                  {formatCurrency(p.priceMonthly)}
                  <span className="text-sm font-normal text-muted-foreground"> / {t('subscription.month')}</span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckIcon className="size-4 text-primary" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent}
                  onClick={() => {
                    setPlan(p.planId)
                    toast.success(t('subscription.changed'))
                  }}
                >
                  {isCurrent ? t('subscription.current') : t('subscription.choose')}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </>
  )
}
