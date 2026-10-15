'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { useTaxRates } from '@/hooks/use-data'
import { currentTenantBranches } from '@/mocks/branches'
import { useT } from '@/lib/i18n/use-t'
import type { TaxRate } from '@/types'

export default function TaxesPage() {
  const { t } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useTaxRates()
  const [editing, setEditing] = useState<TaxRate | 'new' | null>(null)
  const [deleting, setDeleting] = useState<TaxRate | null>(null)

  const columns = useMemo<ColumnDef<TaxRate, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('common.name'), cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: 'rate', header: t('taxes.rate'), cell: ({ row }) => <span className="tabular-nums">{row.original.rate}%</span> },
      { accessorKey: 'category', header: t('common.category') },
      { accessorKey: 'appliesTo', header: t('taxes.appliesTo') },
      {
        accessorKey: 'inclusive',
        header: t('taxes.mode'),
        cell: ({ row }) => <Badge variant="outline">{row.original.inclusive ? t('taxes.inclusive') : t('taxes.exclusive')}</Badge>,
      },
      {
        accessorKey: 'active',
        header: t('common.active'),
        cell: ({ row }) => (
          <Switch checked={row.original.active} aria-label={`${t('common.active')}: ${row.original.name}`} onCheckedChange={(v) => update(row.original.id, { active: v })} />
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: t('common.edit'), onSelect: () => setEditing(row.original) },
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const initial: FormValues =
    editing && editing !== 'new'
      ? { name: editing.name, rate: editing.rate, category: editing.category, appliesTo: editing.appliesTo, inclusive: editing.inclusive, branchId: editing.branchId, active: editing.active }
      : { name: '', rate: 0, category: 'Sales', appliesTo: 'All items', inclusive: false, branchId: 'all', active: true }

  const save = async (v: FormValues) => {
    const patch = {
      name: String(v.name),
      rate: Number(v.rate),
      category: String(v.category),
      appliesTo: String(v.appliesTo),
      inclusive: !!v.inclusive,
      branchId: String(v.branchId),
      active: !!v.active,
    }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create(patch)
      toast.success(t('common.created'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('taxes.title')}
        description={t('taxes.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('taxes.add')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        exportName="tax-rates"
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
      />
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('taxes.add') : t('common.edit')}
        fields={[
          { name: 'name', label: t('common.name'), required: true, wide: true },
          { name: 'rate', label: t('taxes.rate'), type: 'number', required: true },
          { name: 'category', label: t('common.category') },
          { name: 'appliesTo', label: t('taxes.appliesTo'), wide: true },
          {
            name: 'branchId',
            label: t('common.branch'),
            type: 'select',
            options: [{ value: 'all', label: t('shell.allBranches') }, ...currentTenantBranches.map((b) => ({ value: b.id, label: b.name }))],
          },
          { name: 'inclusive', label: t('taxes.inclusive'), type: 'switch' },
          { name: 'active', label: t('common.active'), type: 'switch' },
        ]}
        initial={initial}
        onSubmit={save}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('common.deleteTitle')}
        description={t('common.deleteBody')}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          if (deleting) await remove(deleting.id)
          toast.success(t('common.deleted'))
        }}
      />
    </>
  )
}
