'use client'

import { useMemo, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/common/page-header'
import { useTenants } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency } from '@/lib/utils/format'
import { plans } from '@/mocks/platform'

export default function AdminPlansPage() {
  const { t } = useT()
  const { data: tenants } = useTenants()
  const [prices, setPrices] = useState<Record<string, number>>(() => Object.fromEntries(plans.map((p) => [p.id, p.priceMonthly])))

  const subscribers = useMemo(() => {
    const m: Record<string, number> = {}
    for (const x of tenants ?? []) m[x.plan] = (m[x.plan] ?? 0) + 1
    return m
  }, [tenants])

  return (
    <>
      <PageHeader title={t('admin.plans')} description={t('admin.plansSubtitle')} />
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {p.name}
                {p.highlight && <Badge>{t('admin.popular')}</Badge>}
              </CardTitle>
              <CardDescription>
                {subscribers[p.planId] ?? 0} {t('admin.subscribers')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor={`price-${p.id}`}>{t('admin.monthlyPrice')}</FieldLabel>
                <Input
                  id={`price-${p.id}`}
                  type="number"
                  inputMode="decimal"
                  value={prices[p.id]}
                  onChange={(e) => setPrices((s) => ({ ...s, [p.id]: Number(e.target.value) }))}
                />
              </Field>
              <ul className="flex flex-col gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckIcon className="size-4 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {p.modules.map((m) => (
                  <Badge key={m} variant="secondary">{m}</Badge>
                ))}
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="text-sm text-muted-foreground tabular-nums">{formatCurrency(prices[p.id])}</span>
              <Button size="sm" onClick={() => toast.success(t('common.saved'))}>
                {t('common.save')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  )
}
