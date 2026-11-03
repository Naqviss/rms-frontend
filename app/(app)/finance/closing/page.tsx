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
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { useAccess } from '@/hooks/use-access'
import { adjustCash, sumMinor, todayIso, useCashAccounts, useCashMovements, useInsightsReport } from '@/hooks/use-insights'
import { branchName } from '@/lib/directory'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { fromMinor } from '@/services/api/mappers'

/**
 * Daily closing. The day summary comes from the server's sales and payments reports for the date;
 * the drawer from the selected cash register's movement history (opening = balance after the last
 * movement before the day, expected = balance after the day's last movement). Closing today posts
 * the counted cash as an audited adjustment (POST /finance/cash-accounts/{id}/adjustments).
 */
export default function DailyClosingPage() {
  const { t } = useT()
  const { can } = useAccess()
  const today = todayIso()
  const [date, setDate] = useState<string>(today)
  const [counted, setCounted] = useState('')
  const [accountId, setAccountId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const day = useMemo(() => ({ from: date, to: date }), [date])
  const sales = useInsightsReport('sales', day)
  const payments = useInsightsReport('payments', day)
  const accounts = useCashAccounts()
  const open = useMemo(() => (accounts.data ?? []).filter((a) => a.status === 'open'), [accounts.data])
  const account = open.find((a) => a.id === accountId) ?? open.find((a) => a.is_default) ?? open[0]
  const movements = useCashMovements(account ? [account.id] : undefined)
  const cur = sales.currency

  const summary = useMemo(() => {
    const rows = (sales.data?.rows ?? []).filter((r) => !cur || r.currency === cur)
    const pay = (payments.data?.payments ?? []).filter((r) => !cur || r.currency === cur)
    const byMethod = (m: (method: string) => boolean) => sumMinor(pay.filter((r) => m(r.method)), (r) => r.amount_minor)
    return {
      orders: rows.reduce((n, r) => n + r.order_count, 0),
      cash: byMethod((m) => m === 'cash'),
      card: byMethod((m) => m === 'card'),
      online: byMethod((m) => m !== 'cash' && m !== 'card'),
      discounts: sumMinor(rows, (r) => r.discount_minor),
      tax: sumMinor(rows, (r) => r.tax_minor + r.inclusive_tax_minor),
      total: sumMinor(rows, (r) => r.total_minor),
    }
  }, [sales.data, payments.data, cur])

  const drawer = useMemo(() => {
    if (!account) return null
    const list = movements.data?.[account.id]
    if (!list) return null
    // Newest first. Movement days are compared on their UTC date.
    const before = list.find((m) => m.occurred_at.slice(0, 10) < date)
    const upTo = list.find((m) => m.occurred_at.slice(0, 10) <= date)
    // Nothing older than the day and the oldest row is not the register's opening: history was cut off.
    const truncated = list.length > 0 && !before && list[list.length - 1].source !== 'opening'
    return {
      opening: before ? fromMinor(before.balance_after_minor) : truncated ? null : 0,
      expected: date >= today ? fromMinor(account.balance_minor) : upTo ? fromMinor(upTo.balance_after_minor) : truncated ? null : 0,
    }
  }, [account, movements.data, date, today])

  const expected = drawer?.expected ?? null
  const variance = counted === '' || expected === null ? null : Number(counted) - expected
  const canClose = can('finance', 'edit') && !!account && date === today

  const closeDay = async () => {
    if (!account) return
    setBusy(true)
    try {
      await adjustCash(account.id, { counted_balance_minor: Math.round(Number(counted) * 100), reason_code: 'day_close', note: `Daily closing ${date}` })
      await Promise.all([accounts.mutate(), movements.mutate()])
      setCounted('')
      toast.success(t('finance.dayClosed'))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const NA = '—'
  const loading = (sales.isLoading && !sales.data) || (accounts.isLoading && !accounts.data)

  return (
    <>
      <PageHeader title={t('finance.closing')} description={t('finance.closingSubtitle')} />
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('finance.daySummary')}</CardTitle>
              <CardDescription>
                <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="mt-2 w-44" aria-label={t('common.date')} />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {[
                [t('common.orders'), sales.data ? String(summary.orders) : NA],
                [t('pay.cash'), payments.data ? formatCurrency(summary.cash) : NA],
                [t('pay.card'), payments.data ? formatCurrency(summary.card) : NA],
                [t('pay.online'), payments.data ? formatCurrency(summary.online) : NA],
                [t('common.discount'), sales.data ? `-${formatCurrency(summary.discounts)}` : NA],
                [t('common.tax'), sales.data ? formatCurrency(summary.tax) : NA],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium tabular-nums">{v}</span>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>{t('common.total')}</span>
                <span className="tabular-nums">{sales.data ? formatCurrency(summary.total) : NA}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('finance.cashDrawer')}</CardTitle>
              <CardDescription>{t('finance.cashDrawerHint')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {!accounts.data ? (
                <p className="text-muted-foreground">Cash registers are not available.</p>
              ) : open.length === 0 ? (
                <p className="text-muted-foreground">No open cash register in the selected branches.</p>
              ) : (
                <>
                  {open.length > 1 && (
                    <OptionSelect
                      className="h-9 w-full"
                      value={account?.id ?? ''}
                      onValueChange={setAccountId}
                      aria-label="Cash register"
                      options={open.map((a) => ({ value: a.id, label: `${a.name} · ${branchName(a.branch_id)}` }))}
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('finance.openingFloat')}</span>
                    <span className="font-medium tabular-nums">{drawer?.opening == null ? NA : formatCurrency(drawer.opening)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('finance.expectedCash')}</span>
                    <span className="font-medium tabular-nums">{expected === null ? NA : formatCurrency(expected)}</span>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="counted">{t('finance.countedCash')}</FieldLabel>
                    <Input id="counted" type="number" inputMode="decimal" value={counted} disabled={!canClose || busy} onChange={(e) => setCounted(e.target.value)} />
                    <FieldDescription>{date === today ? t('finance.countedHint') : 'Past days can be reviewed but only today can be closed.'}</FieldDescription>
                  </Field>
                  {variance !== null && (
                    <div className={cn('flex items-center justify-between rounded-md px-3 py-2 font-medium', variance === 0 ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive')}>
                      <span>{t('finance.variance')}</span>
                      <span className="tabular-nums">
                        {variance > 0 ? '+' : ''}
                        {formatCurrency(variance)}
                      </span>
                    </div>
                  )}
                  {drawer && drawer.opening === null && (
                    <Alert>
                      <LockIcon />
                      <AlertTitle>Older history not loaded</AlertTitle>
                      <AlertDescription>Only the latest register movements are read; this day is older than that.</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button disabled={!canClose || counted === '' || busy} onClick={() => setConfirming(true)}>
                {t('finance.closeDay')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        destructive={false}
        title={t('finance.closeDay')}
        description={`The register balance will be set to ${formatCurrency(Number(counted || 0))}${variance ? ` (an adjustment of ${formatCurrency(variance)})` : ''}. This is recorded in the audit trail.`}
        confirmLabel={t('finance.closeDay')}
        onConfirm={closeDay}
      />
    </>
  )
}
