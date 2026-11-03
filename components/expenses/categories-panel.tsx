'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { RowActions } from '@/components/common/row-actions'
import { useAccess } from '@/hooks/use-access'
import { createExpenseCategory, updateExpenseCategory, useExpenseCategories } from '@/hooks/use-insights'
import { errorMessage } from '@/services/api/client'
import { localized, text } from '@/services/api/mappers'
import type { ExpenseCategoryResponseDto } from '@/services/api/generated/schemas'

const labelOf = (c: ExpenseCategoryResponseDto) => c.name || text(c.name_i18n) || c.code
const codeFrom = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)

/** Tenant expense categories: `GET/POST /api/finance/expense-categories`, `PATCH /{id}` (rename, activate). */
export function CategoriesPanel() {
  const { can } = useAccess()
  const { data, isLoading, mutate } = useExpenseCategories()
  const [editing, setEditing] = useState<ExpenseCategoryResponseDto | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const canCreate = can('finance', 'create')
  const canEdit = can('finance', 'edit')

  const toggle = async (c: ExpenseCategoryResponseDto, active: boolean) => {
    setBusy(c.id)
    try {
      const next = await updateExpenseCategory(c, { is_active: active })
      await mutate((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)), { revalidate: false })
      toast.success(active ? `${labelOf(c)} activated` : `${labelOf(c)} deactivated`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const columns = useMemo<ColumnDef<ExpenseCategoryResponseDto, unknown>[]>(
    () => [
      { id: 'name', accessorFn: labelOf, header: 'Category', cell: ({ row }) => <span className="font-medium">{labelOf(row.original)}</span> },
      { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
      {
        accessorKey: 'is_active',
        header: 'Active',
        cell: ({ row }) => (
          <Switch
            checked={row.original.is_active}
            disabled={!canEdit || busy === row.original.id}
            aria-label={`${row.original.is_active ? 'Deactivate' : 'Activate'} ${labelOf(row.original)}`}
            onCheckedChange={(v) => toggle(row.original, v)}
          />
        ),
      },
      {
        id: 'actions',
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (canEdit ? <RowActions actions={[{ label: 'Rename', onSelect: () => setEditing(row.original) }]} /> : null),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, busy],
  )

  const save = async (v: FormValues) => {
    const name = String(v.name).trim()
    try {
      if (editing && editing !== 'new') {
        const next = await updateExpenseCategory(editing, { name: localized(name) })
        await mutate((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)), { revalidate: false })
        toast.success('Category renamed')
      } else {
        const created = await createExpenseCategory({ code: String(v.code).trim() || codeFrom(name), name: localized(name) })
        await mutate((prev) => [...(prev ?? []), created], { revalidate: false })
        toast.success('Category added')
      }
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        exportName="expense-categories"
        emptyTitle={data ? 'No expense categories' : 'Categories not available'}
        emptyDescription={data ? 'Categories are also created automatically the first time an expense uses them.' : 'You may not have access to finance settings.'}
        toolbarActions={
          canCreate && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <PlusIcon data-icon="inline-start" />
              Add category
            </Button>
          )
        }
      />
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing && editing !== 'new' ? 'Rename category' : 'Add category'}
        fields={[
          { name: 'name', label: 'Name', required: true, placeholder: 'e.g. Utilities' },
          ...(editing === 'new' ? [{ name: 'code', label: 'Code', placeholder: 'Generated from the name' }] : []),
        ]}
        initial={editing && editing !== 'new' ? { name: labelOf(editing) } : { name: '', code: '' }}
        onSubmit={save}
      />
    </>
  )
}
