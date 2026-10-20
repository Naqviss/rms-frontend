'use client'

import { useMemo, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { RowActions } from '@/components/common/row-actions'
import { useBudgets, useRecurringExpenses } from '@/hooks/use-data'
import { cn } from '@/lib/utils'
import { budgetState, EXPENSE_CATEGORIES, monthEnd, monthProgress, scheduledUntil, type BudgetState } from '@/lib/utils/expenses'
import { formatCompactCurrency, formatCurrency, formatPercent } from '@/lib/utils/format'
import type { ExpenseBudget } from '@/types'

const stateStyle: Record<BudgetState, { bar: string; badge: string; label: string }> = {
  ok: { bar: 'bg-success', badge: 'bg-success/15 text-success', label: 'On track' },
  near: { bar: 'bg-warning', badge: 'bg-warning/25 text-warning-foreground dark:text-warning', label: 'At risk' },
  over: { bar: 'bg-destructive', badge: 'bg-destructive/12 text-destructive', label: 'Over budget' },
}

interface BudgetsPanelProps {
  /** Spend per category for the current calendar month. */
  monthSpend: Map<string, number>
  today: string
}

export function BudgetsPanel({ monthSpend, today }: BudgetsPanelProps) {
  const { data: budgets, create, update, remove } = useBudgets()
  const { data: recurring } = useRecurringExpenses()
  const [editing, setEditing] = useState<ExpenseBudget | 'new' | null>(null)
  const [prefill, setPrefill] = useState('')
  const [deleting, setDeleting] = useState<ExpenseBudget | null>(null)
  const month = monthProgress(today)
  const monthName = new Date(`${today}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const rows = useMemo(() => {
    const list = (budgets ?? []).map((b) => {
      const spent = monthSpend.get(b.category) ?? 0
      // Scheduled bills (rent, utilities...) land on known dates, so add what is still due this month;
      // categories without a schedule are projected at the month's pace so far.
      const schedules = (recurring ?? []).filter((r) => r.active && r.category === b.category)
      const projected = schedules.length
        ? spent + schedules.reduce((s, r) => s + scheduledUntil(r, monthEnd(today)), 0)
        : (spent / month.elapsed) * month.length
      const forecastOver = projected > b.monthly
      const current = budgetState(spent, b.monthly)
      // Still under the limit but on course to pass it counts as at risk, not on track.
      return { budget: b, spent, projected, state: current === 'ok' && forecastOver ? ('near' as const) : current, forecastOver }
    })
    return list.sort((a, b) => b.spent / (b.budget.monthly || 1) - a.spent / (a.budget.monthly || 1))
  }, [budgets, recurring, monthSpend, month.elapsed, month.length, today])

  const unbudgeted = [...monthSpend.entries()].filter(([c]) => !(budgets ?? []).some((b) => b.category === c))
  const totalBudget = rows.reduce((s, r) => s + r.budget.monthly, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const totalProjected = rows.reduce((s, r) => s + r.projected, 0)
  const usedCategories = new Set((budgets ?? []).map((b) => b.category))

  const save = async (v: FormValues) => {
    const monthly = Number(v.monthly)
    if (editing && editing !== 'new') {
      await update(editing.id, { monthly })
      toast.success(`${editing.category} budget updated`)
    } else {
      await create({ category: String(v.category), monthly })
      toast.success(`Budget set for ${String(v.category)}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly budgets · {monthName}</CardTitle>
        <CardDescription>
          Day {month.elapsed} of {month.length}. Spent {formatCompactCurrency(totalSpent)} of {formatCompactCurrency(totalBudget)}; at this pace the month ends near{' '}
          <span className={cn('font-medium', totalProjected > totalBudget ? 'text-destructive' : 'text-foreground')}>{formatCompactCurrency(totalProjected)}</span>.
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            onClick={() => {
              setPrefill('')
              setEditing('new')
            }}
          >
            <PlusIcon data-icon="inline-start" />
            Add budget
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <ul className="divide-y">
          {rows.map(({ budget, spent, projected, state, forecastOver }) => {
            const pct = budget.monthly ? (spent / budget.monthly) * 100 : 0
            const style = stateStyle[state]
            return (
              <li key={budget.id} className="flex items-center gap-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {budget.category}
                      <Badge className={cn('h-5 border-0 px-1.5 text-[10px]', style.badge)}>{style.label}</Badge>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{formatCurrency(spent)}</span> of {formatCurrency(budget.monthly)}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${formatPercent(pct)} of budget used`}>
                    <span className={cn('absolute inset-y-0 start-0 rounded-full', style.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
                    {/* Where today should be if spending were even across the month. */}
                    <span className="absolute inset-y-0 w-0.5 bg-foreground/40" style={{ insetInlineStart: `${(month.elapsed / month.length) * 100}%` }} aria-hidden />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {state === 'over'
                      ? `${formatCurrency(spent - budget.monthly)} over budget`
                      : `${formatCurrency(budget.monthly - spent)} left`}
                    {' · '}
                    <span className={cn(forecastOver && 'font-medium text-destructive')}>
                      {forecastOver ? 'heading for' : 'projected'} {formatCompactCurrency(projected)} by month end
                    </span>
                  </p>
                </div>
                <RowActions
                  actions={[
                    { label: 'Edit budget', onSelect: () => setEditing(budget) },
                    { label: 'Remove budget', destructive: true, onSelect: () => setDeleting(budget) },
                  ]}
                />
              </li>
            )
          })}
        </ul>
        {unbudgeted.length > 0 && (
          <div className="mt-2 rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs text-muted-foreground">Spending this month without a budget</p>
            <ul className="flex flex-wrap gap-2">
              {unbudgeted.map(([category, spent]) => (
                <li key={category}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPrefill(category)
                      setEditing('new')
                    }}
                  >
                    {category} · {formatCompactCurrency(spent)}
                    <PlusIcon data-icon="inline-end" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing && editing !== 'new' ? `${editing.category} budget` : 'Add budget'}
        description="The most you plan to spend on this category each month, across all branches."
        fields={[
          ...(editing === 'new'
            ? [
                {
                  name: 'category',
                  label: 'Category',
                  type: 'select' as const,
                  options: [...new Set([...EXPENSE_CATEGORIES, ...monthSpend.keys()])].filter((c) => !usedCategories.has(c)).map((c) => ({ value: c, label: c })),
                },
              ]
            : []),
          { name: 'monthly', label: 'Monthly budget (Rs)', type: 'number', required: true, wide: editing !== 'new' },
        ]}
        initial={
          editing && editing !== 'new'
            ? { monthly: editing.monthly }
            : { category: prefill || (EXPENSE_CATEGORIES.find((c) => !usedCategories.has(c)) ?? 'Other'), monthly: '' }
        }
        onSubmit={save}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Remove this budget?"
        description="Spending in this category stays in the log; it just won't be tracked against a limit."
        confirmLabel="Remove"
        onConfirm={async () => {
          if (deleting) await remove(deleting.id)
          toast.success('Budget removed')
        }}
      />
    </Card>
  )
}
