'use client'

import { useMemo, useState } from 'react'
import { LockIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/page-header'
import { useOrders } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { config } from '@/lib/config'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'

const OPENING_FLOAT = 10000

export default function DailyClosingPage() {
  const { t } = useT()
  const { data, isLoading } = useOrders()
  const { inBranch } = useScope()
  const [date, setDate] = useState<string>(config.referenceDate)
  const [counted, setCounted] = useState('')
  const [closed, setClosed] = useState<Record<string, number>>({})

  const summary = useMemo(() => {
    const day = inBranch(data ?? []).filter((o) => o.createdAt.startsWith(date) && o.status !== 'cancelled' && o.paymentStatus !== 'unpaid')
    const by = { cash: 0, card: 0, online: 0, split: 0 }
    let discounts = 0
    let tax = 0
    for (const o of day) {
      by[o.paymentMethod] += o.total
      discounts += o.discount
      tax += o.tax
    }
    return { orders: day.length, by, discounts, tax, total: day.reduce((s, o) => s + o.total, 0) }
  }, [data, inBranch, date])

  const expectedCash = OPENING_FLOAT + summary.by.cash
  const variance = counted === '' ? null : Number(counted) - expectedCash
  const isClosed = date in closed

  return (
    <>
      <PageHeader title={t('finance.closing')} description={t('finance.closingSubtitle')} />
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('finance.daySummary')}</CardTitle>
              <CardDescription>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 w-44" aria-label={t('common.date')} />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {[
                [t('common.orders'), String(summary.orders)],
                [t('pay.cash'), formatCurrency(summary.by.cash)],
                [t('pay.card'), formatCurrency(summary.by.card)],
                [t('pay.online'), formatCurrency(summary.by.online + summary.by.split)],
                [t('common.discount'), `-${formatCurrency(summary.discounts)}`],
                [t('common.tax'), formatCurrency(summary.tax)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium tabular-nums">{v}</span>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>{t('common.total')}</span>
                <span className="tabular-nums">{formatCurrency(summary.total)}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('finance.cashDrawer')}</CardTitle>
              <CardDescription>{t('finance.cashDrawerHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('finance.openingFloat')}</span>
                <span className="font-medium tabular-nums">{formatCurrency(OPENING_FLOAT)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('finance.expectedCash')}</span>
                <span className="font-medium tabular-nums">{formatCurrency(expectedCash)}</span>
              </div>
              <Field>
                <FieldLabel htmlFor="counted">{t('finance.countedCash')}</FieldLabel>
                <Input id="counted" type="number" inputMode="decimal" value={isClosed ? String(closed[date]) : counted} disabled={isClosed} onChange={(e) => setCounted(e.target.value)} />
                <FieldDescription>{t('finance.countedHint')}</FieldDescription>
              </Field>
              {variance !== null && !isClosed && (
                <div className={cn('flex items-center justify-between rounded-md px-3 py-2 font-medium', variance === 0 ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive')}>
                  <span>{t('finance.variance')}</span>
                  <span className="tabular-nums">{variance > 0 ? '+' : ''}{formatCurrency(variance)}</span>
                </div>
              )}
              {isClosed && (
                <Alert>
                  <LockIcon />
                  <AlertTitle>{t('finance.dayClosed')}</AlertTitle>
                  <AlertDescription>{date}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button
                disabled={isClosed || counted === ''}
                onClick={() => {
                  setClosed((c) => ({ ...c, [date]: Number(counted) }))
                  toast.success(t('finance.dayClosed'))
                }}
              >
                {t('finance.closeDay')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  )
}
