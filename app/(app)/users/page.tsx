'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useAppUsers, useRoles } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatRelative, initials } from '@/lib/utils/format'
import { currentBranchIds } from '@/mocks/branches'
import type { AppUser, PermissionAction, PermissionModule, Role, RoleId } from '@/types'

const modules: PermissionModule[] = ['dashboard', 'orders', 'delivery', 'website', 'inventory', 'menu', 'recipes', 'finance', 'reports', 'employees', 'customers', 'settings']
const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete']

export default function UsersPage() {
  const { t } = useT()
  const { data: users, isLoading, create, update, remove, removeMany } = useAppUsers()
  const { data: roles, update: updateRole } = useRoles()
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AppUser | null>(null)
  const [roleId, setRoleId] = useState<string>('')

  const roleName = (id: string) => roles?.find((r) => r.id === id)?.name ?? id
  const activeRole: Role | undefined = roles?.find((r) => r.id === (roleId || roles?.[0]?.id))

  const toggle = async (m: PermissionModule, a: PermissionAction, checked: boolean) => {
    if (!activeRole) return
    const current = activeRole.permissions[m] ?? []
    const next = checked ? [...new Set([...current, a])] : current.filter((x) => x !== a)
    await updateRole(activeRole.id, { permissions: { ...activeRole.permissions, [m]: next } })
    toast.success(t('common.saved'))
  }

  const columns = useMemo<ColumnDef<AppUser, unknown>[]>(
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
              <p className="text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      { id: 'role', header: t('common.role'), accessorFn: (r) => roleName(r.role) },
      { accessorKey: 'lastActive', header: t('users.lastActive'), cell: ({ row }) => formatRelative(row.original.lastActive) },
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
              {
                label: row.original.status === 'active' ? t('users.deactivate') : t('users.activate'),
                onSelect: async () => {
                  await update(row.original.id, { status: row.original.status === 'active' ? 'inactive' : 'active' })
                  toast.success(t('common.updated'))
                },
              },
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, roles],
  )

  const initial: FormValues =
    editing && editing !== 'new'
      ? { name: editing.name, email: editing.email, role: editing.role, status: editing.status }
      : { name: '', email: '', role: 'cashier', status: 'invited' }

  const save = async (v: FormValues) => {
    const patch = { name: String(v.name), email: String(v.email), role: String(v.role) as RoleId, status: String(v.status) as AppUser['status'] }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create({ ...patch, branchIds: currentBranchIds, lastActive: new Date().toISOString().slice(0, 19), color: 'oklch(0.55 0.12 40)' })
      toast.success(t('users.invited'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('users.invite')}
          </Button>
        }
      />
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">{t('nav.users')}</TabsTrigger>
          <TabsTrigger value="roles">{t('users.roles')}</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <DataTable columns={columns} data={users} isLoading={isLoading} exportName="users" onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))} />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          {!roles ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
              <nav aria-label={t('users.roles')} className="flex gap-2 overflow-x-auto lg:flex-col">
                {roles.map((r) => (
                  <Button
                    key={r.id}
                    variant={activeRole?.id === r.id ? 'secondary' : 'ghost'}
                    className="justify-start"
                    aria-current={activeRole?.id === r.id}
                    onClick={() => setRoleId(r.id)}
                  >
                    {r.name}
                  </Button>
                ))}
              </nav>
              {activeRole && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{activeRole.name}</CardTitle>
                    <CardDescription>{activeRole.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th scope="col" className="py-2 text-start font-medium">{t('users.module')}</th>
                          {actions.map((a) => (
                            <th key={a} scope="col" className="py-2 text-center font-medium capitalize">{a}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modules.map((m) => (
                          <tr key={m} className="border-t">
                            <th scope="row" className="py-2.5 text-start font-normal capitalize">{m}</th>
                            {actions.map((a) => {
                              const on = activeRole.permissions[m]?.includes(a) ?? false
                              return (
                                <td key={a} className="py-2.5 text-center">
                                  <Checkbox checked={on} onCheckedChange={(c) => toggle(m, a, c === true)} aria-label={`${m} ${a}`} />
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckIcon className="size-3" aria-hidden />
                      {t('users.permissionHint')}
                      <MinusIcon className="hidden" aria-hidden />
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('users.invite') : t('common.edit')}
        fields={[
          { name: 'name', label: t('common.name'), required: true, wide: true },
          { name: 'email', label: t('common.email'), type: 'email', required: true, wide: true },
          { name: 'role', label: t('common.role'), type: 'select', options: (roles ?? []).map((r) => ({ value: r.id, label: r.name })) },
          {
            name: 'status',
            label: t('common.status'),
            type: 'select',
            options: [
              { value: 'active', label: t('status.active') },
              { value: 'inactive', label: t('status.inactive') },
              { value: 'invited', label: t('status.invited') },
            ],
          },
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
