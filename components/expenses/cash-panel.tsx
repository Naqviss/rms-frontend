'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownLeftIcon, ArrowUpRightIcon, ScaleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { useAccess } from '@/hooks/use-access'
import { adjustCash, recordCashMovement, useCashAccounts, useCashMovements } from '@/hooks/use-insights'
import { branchName } from '@/lib/directory'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDateTime, titleCase } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { fromMinor, toMinor } from '@/services/api/mappers'
import type { CashMovementResponseDto } from '@/services/api/generated/schemas'

type Dialog = 'in' | 'out' | 'adjust' | null

/**
 * Cash registers of the selected branches (`GET /api/finance/cash-accounts`), the selected one's
 * movement history (`GET …/{id}/movements`, newest 500), manual cash in/out (`POST …/movements`)
 * and set-to-counted adjustments (`POST …/adjustments`).
 */
export function CashPanel() {
  const { can } = useAccess()
  const accounts = useCashAccounts()
  const [selected, setSelected] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const account = (accounts.data ?? []).find((a) => a.id === selected) ?? (accounts.data ?? []).find((a) => a.is_default) ?? accounts.data?.[0]
  const movements = useCashMovements(account ? [account.id] : undefined)
  const rows = account ? movements.data?.[account.id] : undefined
  const canEdit = can('finance', 'edit') && account?.status === 'open'

  const columns = useMemo<ColumnDef<CashMovementResponseDto, unknown>[]>(
    () => [
      { accessorKey: 'occurred_at', header: 'When', cell: ({ row }) => formatDateTime(row.original.occurred_at) },
      { accessorKey: 'source', header: 'Source', cell: ({ row }) => <Badge variant="outline">{titleCase(row.original.source.replace(/_/g, '-'))}</Badge> },
      {
        id: 'reason',
        header: 'Reason',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.reason_code ? titleCase(row.original.reason_code.replace(/_/g, '-')) : '—'}</p>
            {row.original.note && <p className="max-w-64 truncate text-xs text-muted-foreground">{row.original.note}</p>}
          </div>
        ),
      },
      {
        accessorKey: 'amount_minor',
        header: 'Amount',
        cell: ({ row }) => (
          <span className={cn('font-medium tabular-nums', row.original.direction === 'in' ? 'text-success' : 'text-destructive')}>
            {row.original.direction === 'in' ? '+' : '-'}
            {formatCurrency(fromMinor(row.original.amount_minor))}
          </span>
        ),
      },
      { accessorKey: 'balance_after_minor', header: 'Balance', cell: ({ row }) => <span className="tabular-nums">{formatCurrency(fromMinor(row.original.balance_after_minor))}</span> },
    ],
    [],
  )

  const submit = async (v: FormValues) => {
    if (!account) return false
    try {
      if (dialog === 'adjust') {
        await adjustCash(account.id, { counted_balance_minor: toMinor(Number(v.amount)), reason_code: String(v.reason) || 'count', note: String(v.note) || undefined })
        toast.success('Register balance adjusted')
      } else if (dialog) {
        const res = await recordCashMovement(account.id, { direction: dialog, amount_minor: toMinor(Number(v.amount)), reason_code: String(v.reason) || 'manual', note: String(v.note) || undefined })
        toast.success(res.duplicate ? 'Already recorded' : dialog === 'in' ? 'Cash in recorded' : 'Cash out recorded')
      }
      await Promise.all([accounts.mutate(), movements.mutate()])
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  if (accounts.isLoading && !accounts.data) return <Skeleton className="h-64 w-full" />
  if (!accounts.data) return <p className="py-8 text-center text-sm text-muted-foreground">Cash registers are not available.</p>
  if (accounts.data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No cash registers in the selected branches.</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.data.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelected(a.id)}
            aria-pressed={a.id === account?.id}
            className={cn('rounded-xl border bg-card p-4 text-start transition-colors hover:bg-muted/60', a.id === account?.id && 'border-primary ring-1 ring-primary')}
          >
            <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="truncate">
                {a.name} · {branchName(a.branch_id)}
              </span>
              {a.is_default && <Badge variant="secondary">Default</Badge>}
              {a.status === 'closed' && <Badge variant="outline">Closed</Badge>}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(fromMinor(a.balance_minor))}</p>
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={movements.isLoading}
        exportName="cash-movements"
        initialSort={[{ id: 'occurred_at', desc: true }]}
        emptyTitle={rows ? 'No movements yet' : 'Movements not available'}
        exportRows={(r) => r.map((m) => ({ at: m.occurred_at, source: m.source, direction: m.direction, amount: fromMinor(m.amount_minor), balance: fromMinor(m.balance_after_minor), reason: m.reason_code ?? '', note: m.note ?? '' }))}
        toolbarActions={
          canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialog('in')}>
                <ArrowDownLeftIcon data-icon="inline-start" />
                Cash in
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog('out')}>
                <ArrowUpRightIcon data-icon="inline-start" />
                Cash out
              </Button>
              <Button size="sm" onClick={() => setDialog('adjust')}>
                <ScaleIcon data-icon="inline-start" />
                Adjust to count
              </Button>
            </div>
          )
        }
      />
      <FormDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'adjust' ? 'Adjust to counted cash' : dialog === 'in' ? 'Record cash in' : 'Record cash out'}
        description={
          dialog === 'adjust'
            ? `The balance (${account ? formatCurrency(fromMinor(account.balance_minor)) : ''}) is set to the counted amount; the difference is posted as an audited adjustment.`
            : 'Recorded once per submission and kept in the audit trail.'
        }
        fields={[
          { name: 'amount', label: dialog === 'adjust' ? 'Counted cash (Rs)' : 'Amount (Rs)', type: 'number', required: true },
          { name: 'reason', label: 'Reason code', required: true, placeholder: dialog === 'adjust' ? 'e.g. count' : 'e.g. float_top_up' },
          { name: 'note', label: 'Note', type: 'textarea', wide: true },
        ]}
        initial={{ amount: '', reason: dialog === 'adjust' ? 'count' : '', note: '' }}
        submitLabel={dialog === 'adjust' ? 'Adjust balance' : 'Record'}
        onSubmit={submit}
      />
    </div>
  )
}
