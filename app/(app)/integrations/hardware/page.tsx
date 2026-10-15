'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useDevices } from '@/hooks/use-data'
import { useScope } from '@/hooks/use-scope'
import { useT } from '@/lib/i18n/use-t'
import { formatRelative, titleCase } from '@/lib/utils/format'
import { branchName, currentBranchIds } from '@/mocks/branches'
import type { Device, DeviceType } from '@/types'

const deviceTypes: DeviceType[] = ['pos-terminal', 'receipt-printer', 'kitchen-printer', 'barcode-scanner', 'cash-drawer', 'customer-display', 'kitchen-display']

export default function HardwarePage() {
  const { t } = useT()
  const { data, isLoading, create, update, remove, removeMany } = useDevices()
  const { inBranch } = useScope()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Device | null>(null)
  const rows = useMemo(() => inBranch(data ?? []), [data, inBranch])

  const columns = useMemo<ColumnDef<Device, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.model}</p>
          </div>
        ),
      },
      { accessorKey: 'type', header: t('common.type'), cell: ({ row }) => titleCase(row.original.type) },
      { accessorKey: 'branchId', header: t('common.branch'), cell: ({ row }) => branchName(row.original.branchId) },
      { accessorKey: 'ipAddress', header: 'IP', cell: ({ row }) => <span className="font-mono text-xs">{row.original.ipAddress}</span> },
      { accessorKey: 'lastSync', header: t('common.lastSync'), cell: ({ row }) => formatRelative(row.original.lastSync) },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              {
                label: t('common.test'),
                onSelect: async () => {
                  await update(row.original.id, { status: 'connected', lastSync: new Date().toISOString().slice(0, 19) })
                  toast.success(t('integrations.testOk'))
                },
              },
              { label: t('common.delete'), destructive: true, onSelect: () => setDeleting(row.original) },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  const save = async (v: FormValues) => {
    await create({
      name: String(v.name),
      type: String(v.type) as DeviceType,
      branchId: String(v.branchId),
      model: String(v.model),
      ipAddress: String(v.ipAddress),
      status: 'disconnected',
      lastSync: new Date().toISOString().slice(0, 19),
    })
    toast.success(t('common.created'))
  }

  return (
    <>
      <PageHeader
        title={t('integrations.hardware')}
        description={t('integrations.hardwareSubtitle')}
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t('integrations.addDevice')}
          </Button>
        }
      />
      <DataTable columns={columns} data={rows} isLoading={isLoading} exportName="devices" onBulkDelete={(sel) => removeMany(sel.map((s) => s.id))} />
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t('integrations.addDevice')}
        fields={[
          { name: 'name', label: t('common.name'), required: true, wide: true },
          { name: 'type', label: t('common.type'), type: 'select', options: deviceTypes.map((d) => ({ value: d, label: titleCase(d) })) },
          { name: 'branchId', label: t('common.branch'), type: 'select', options: currentBranchIds.map((id) => ({ value: id, label: branchName(id) })) },
          { name: 'model', label: t('integrations.model') },
          { name: 'ipAddress', label: 'IP', placeholder: '192.168.1.20' },
        ]}
        initial={{ name: '', type: 'receipt-printer', branchId: currentBranchIds[0], model: '', ipAddress: '' }}
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
