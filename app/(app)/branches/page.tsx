'use client'

import { useState } from 'react'
import { MapPinIcon, PhoneIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useBranches, useEmployees } from '@/hooks/use-data'
import { currentTenantBranches, directory } from '@/lib/directory'
import { useT } from '@/lib/i18n/use-t'
import type { Branch } from '@/types'


export default function BranchesPage() {
  const { t } = useT()
  const { data, isLoading, create, update, remove } = useBranches()
  const { data: employees } = useEmployees()
  const [editing, setEditing] = useState<Branch | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Branch | null>(null)

  const branches = data ?? []

  const initial: FormValues =
    editing && editing !== 'new'
      ? {
          name: editing.name,
          city: editing.city,
          address: editing.address,
          phone: editing.phone,
          status: editing.status,
        }
      : { name: '', city: '', address: '', phone: '', status: 'open' }

  const save = async (v: FormValues) => {
    const patch = {
      name: String(v.name),
      city: String(v.city),
      address: String(v.address),
      phone: String(v.phone),
      status: String(v.status) as Branch['status'],
    }
    if (editing && editing !== 'new') {
      await update(editing.id, patch)
      toast.success(t('common.updated'))
    } else {
      await create({ ...patch, tenantId: currentTenantBranches[0]?.tenantId ?? directory.tenantId })
      toast.success(t('common.created'))
    }
  }

  return (
    <>
      <PageHeader
        title={t('branches.title')}
        description={t('branches.subtitle')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('branches.add')}
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => {
            const staff = (employees ?? []).filter((e) => e.branchId === b.id).length
            return (
              <Card key={b.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{b.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusBadge status={b.status} />
                      <RowActions
                        actions={[
                          { label: t('common.edit'), onSelect: () => setEditing(b) },
                          {
                            label: b.status === 'open' ? t('branches.close') : t('branches.open'),
                            onSelect: async () => {
                              await update(b.id, { status: b.status === 'open' ? 'closed' : 'open' })
                              toast.success(t('common.updated'))
                            },
                          },
                          { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(b) },
                        ]}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    {[b.address, b.city].filter(Boolean).join(', ')}
                  </p>
                  <p className="flex items-center gap-2">
                    <PhoneIcon className="size-4 shrink-0" aria-hidden />
                    {b.phone}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="secondary">
                      <UsersIcon data-icon="inline-start" />
                      {staff} {t('nav.employees').toLowerCase()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('branches.add') : t('common.edit')}
        fields={[
          { name: 'name', label: t('common.name'), required: true, wide: true },
          { name: 'city', label: t('customers.city'), required: true },
          { name: 'address', label: t('common.address'), wide: true },
          { name: 'phone', label: t('common.phone'), type: 'tel' },
          {
            name: 'status',
            label: t('common.status'),
            type: 'select',
            options: [
              { value: 'open', label: t('status.open') },
              { value: 'closed', label: t('status.closed') },
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
