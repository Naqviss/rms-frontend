'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FieldDef, type FormValues } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useEmployees } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useAppStore } from '@/stores/app-store'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate, initials, titleCase } from '@/lib/utils/format'
import { branchName, currentTenantBranches } from '@/mocks/branches'
import type { Employee, EmployeeRole } from '@/types'

const employeeRoles: EmployeeRole[] = ['admin', 'manager', 'cashier', 'waiter', 'chef', 'kitchen-staff', 'rider', 'accountant']

export default function EmployeesPage() {
  const { t } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useEmployees()
  const { inBranch } = useScope()
  const globalBranch = useAppStore((s) => s.branchId)
  const [role, setRole] = useState('all')
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)

  const rows = useMemo(() => inBranch(data ?? []).filter((e) => (role === 'all' ? true : e.role === role)), [data, inBranch, role])

  const fields: FieldDef[] = [
    { name: 'name', label: t('common.name'), required: true, wide: true },
    { name: 'role', label: t('common.role'), type: 'select', options: employeeRoles.map((r) => ({ value: r, label: titleCase(r) })) },
    { name: 'branchId', label: t('common.branch'), type: 'select', options: currentTenantBranches.map((b) => ({ value: b.id, label: b.name })) },
    { name: 'phone', label: t('common.phone'), type: 'tel', required: true },
    { name: 'email', label: t('common.email'), type: 'email' },
    {
      name: 'payType',
      label: t('employees.payType'),
      type: 'select',
      options: [
        { value: 'monthly', label: t('employees.monthly') },
        { value: 'daily', label: t('employees.daily') },
        { value: 'hourly', label: t('employees.hourly') },
      ],
    },
    { name: 'payRate', label: t('employees.payRate'), type: 'number', required: true },
    {
      name: 'commissionType',
      label: t('employees.commission'),
      type: 'select',
      options: [
        { value: 'none', label: t('employees.none') },
        { value: 'per-order', label: t('employees.perOrder') },
        { value: 'percentage', label: t('employees.percentage') },
      ],
    },
    { name: 'commissionRate', label: t('employees.commissionRate'), type: 'number' },
    {
      name: 'shift',
      label: t('employees.shift'),
      type: 'select',
      options: [
        { value: 'morning', label: t('employees.morning') },
        { value: 'evening', label: t('employees.evening') },
        { value: 'night', label: t('employees.night') },
      ],
    },
    {
      name: 'status',
      label: t('common.status'),
      type: 'select',
      options: [
        { value: 'active', label: t('status.active') },
        { value: 'on-leave', label: t('status.on-leave') },
        { value: 'inactive', label: t('status.inactive') },
      ],
    },
  ]

  const columns = useMemo<ColumnDef<Employee, unknown>[]>(
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
              <p className="text-xs text-muted-foreground">{row.original.code}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: 'role', header: t('common.role'), cell: ({ row }) => titleCase(row.original.role) },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      { accessorKey: 'shift', header: t('employees.shift'), cell: ({ row }) => <span className="capitalize">{row.original.shift}</span> },
      { accessorKey: 'joinedAt', header: t('employees.joined'), cell: ({ row }) => formatDate(row.original.joinedAt) },
      {
        accessorKey: 'performance',
        header: t('employees.performance'),
        cell: ({ row }) => (
          <div className="flex w-28 items-center gap-2">
            <Progress value={row.original.performance} className="h-1.5" aria-label={t('employees.performance')} />
            <span className="text-xs tabular-nums text-muted-foreground">{row.original.performance}</span>
          </div>
        ),
      },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
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
    [t],
  )

  const initial: FormValues =
    editing && editing !== 'new'
      ? {
          name: editing.name,
          role: editing.role,
          branchId: editing.branchId,
          phone: editing.phone,
          email: editing.email,
          payType: editing.payType,
          payRate: editing.payRate,
          commissionType: editing.commissionType,
          commissionRate: editing.commissionRate,
          shift: editing.shift,
          status: editing.status,
        }
      : {
          name: '',
          role: 'waiter',
          branchId: globalBranch === 'all' ? currentTenantBranches[0].id : globalBranch,
          phone: '',
          email: '',
          payType: 'monthly',
          payRate: 0,
          commissionType: 'none',
          commissionRate: 0,
          shift: 'morning',
          status: 'active',
        }

  const save = async (v: FormValues) => {
    const patch = {
      name: String(v.name),
      role: String(v.role) as Employee['role'],
      branchId: String(v.branchId),
      phone: String(v.phone),
      email: String(v.email),
      payType: String(v.payType) as Employee['payType'],
      payRate: Number(v.payRate),
      commissionType: String(v.commissionType) as Employee['commissionType'],
      commissionRate: Number(v.commissionRate),
      shift: String(v.shift) as Employee['shift'],
      status: String(v.status) as Employee['status'],
    }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create({
        ...patch,
        code: `EMP-${String((data?.length ?? 0) + 1).padStart(3, '0')}`,
        joinedAt: new Date().toISOString().slice(0, 10),
        attendanceRate: 100,
        performance: 70,
        ordersHandled: 0,
        color: 'oklch(0.55 0.12 40)',
      })
      toast.success(t('common.created'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('employees.title')}
        description={t('employees.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('employees.add')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="employees"
        exportRows={(r) => r.map((e) => ({ code: e.code, name: e.name, role: e.role, branch: branchName(e.branchId), phone: e.phone, pay: formatCurrency(e.payRate) }))}
        onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))}
        filters={
          <OptionSelect
            className="h-9 w-44"
            value={role}
            onValueChange={setRole}
            aria-label={t('common.role')}
            options={[{ value: 'all', label: `${t('common.role')}: ${t('common.all')}` }, ...employeeRoles.map((r) => ({ value: r, label: titleCase(r) }))]}
          />
        }
      />
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('employees.add') : t('common.edit')}
        fields={fields}
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
