'use client'

import { useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MapPinIcon, PlusIcon, UserCheckIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DataTable } from '@/components/common/data-table'
import { FormDialog, type FieldDef, type FormValues } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatCard } from '@/components/common/stat-card'
import { StatusBadge } from '@/components/common/status-badge'
import { useCustomers } from '@/hooks/use-data'
import { useCustomerAddresses, useCustomerStats } from '@/hooks/use-front-of-house'
import { useT } from '@/lib/i18n/use-t'
import { branchName } from '@/lib/directory'
import { formatCurrency, formatDate, formatNumber, initials } from '@/lib/utils/format'
import { ApiError, errorMessage, operationId } from '@/services/api/client'
import { registerCustomer, setMarketingConsent, type AddressInput } from '@/services/api/modules/customers'
import type { CustomerAddressResponseDto } from '@/services/api/generated/schemas'
import type { Customer } from '@/types'

const DUPLICATE = 'CUSTOMER_POSSIBLE_DUPLICATE'

export default function CustomersPage() {
  const { t } = useT()
  const { data, isLoading, update, mutate } = useCustomers()
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [viewing, setViewing] = useState<Customer | null>(null)
  /** Server error shown on the form; the dialog stays open with what was typed. */
  const [formError, setFormError] = useState<{ code: string; message: string } | null>(null)
  /** Client id for the customer being registered: a retry replays (duplicate: true) instead of creating twice. */
  const registerId = useRef<string | null>(null)

  const rows = data ?? []
  const totals = useMemo(() => {
    const list = data ?? []
    return { count: list.length, active: list.filter((c) => c.accountStatus === 'active').length }
  }, [data])

  const openForm = (c: Customer | 'new') => {
    setFormError(null)
    registerId.current = c === 'new' ? operationId() : null
    setEditing(c)
  }

  const columns = useMemo<ColumnDef<Customer, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <button type="button" className="flex items-center gap-3 text-start" onClick={() => setViewing(row.original)}>
            <Avatar className="size-8">
              <AvatarFallback style={{ backgroundColor: row.original.color }} className="text-xs text-white">
                {initials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.phone}</p>
            </div>
          </button>
        ),
      },
      { accessorKey: 'email', header: t('common.email'), cell: ({ row }) => row.original.email || '-' },
      { accessorKey: 'registeredAt', header: 'Registered', cell: ({ row }) => (row.original.registeredAt ? formatDate(row.original.registeredAt) : '-') },
      { accessorKey: 'accountStatus', header: t('common.status'), cell: ({ row }) => <StatusBadge status={row.original.accountStatus} /> },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (
          <RowActions
            actions={[
              { label: t('common.view'), onSelect: () => setViewing(row.original) },
              { label: t('common.edit'), onSelect: () => openForm(row.original) },
              {
                label: row.original.accountStatus === 'active' ? t('customers.block') : t('customers.unblock'),
                onSelect: async () => {
                  try {
                    await update(row.original.id, { accountStatus: row.original.accountStatus === 'active' ? 'blocked' : 'active' })
                    toast.success(t('common.updated'))
                  } catch {
                    // reported by useResource
                  }
                },
              },
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
      ? { name: editing.name, phone: editing.phone, email: editing.email, notes: editing.notes }
      : { name: '', phone: '', email: '', notes: '', marketingConsent: false }

  const save = async (v: FormValues) => {
    const input = { name: String(v.name), phone: String(v.phone), email: String(v.email), notes: String(v.notes) }
    setFormError(null)
    try {
      if (editing && editing !== 'new') {
        await update(editing.id, input)
        toast.success(t('common.updated'))
      } else {
        const created = await registerCustomer(
          { ...input, marketingConsent: !!v.marketingConsent },
          registerId.current ?? operationId(),
          !!v.allowDuplicate,
        )
        await mutate()
        toast.success(created.duplicate ? 'Already registered: showing the saved customer' : t('common.created'))
      }
    } catch (err) {
      // Keep the dialog open with the typed values and show the server's reason on the form.
      setFormError({ code: err instanceof ApiError ? err.code : '', message: errorMessage(err) })
      return false
    }
  }

  const fields: FieldDef[] = [
    { name: 'name', label: t('common.name'), required: true, wide: true },
    { name: 'phone', label: t('common.phone'), type: 'tel' },
    { name: 'email', label: t('common.email'), type: 'email' },
    { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
    ...(editing === 'new' ? [{ name: 'marketingConsent', label: 'Agrees to marketing messages', type: 'switch' as const, wide: true }] : []),
    ...(editing === 'new' && formError?.code === DUPLICATE
      ? [{ name: 'allowDuplicate', label: 'Register anyway (a customer with this phone or e-mail exists)', type: 'switch' as const, wide: true }]
      : []),
  ]

  return (
    <>
      <PageHeader
        title={t('customers.title')}
        description={t('customers.subtitle')}
        actions={
          <Button onClick={() => openForm('new')}>
            <PlusIcon data-icon="inline-start" />
            {t('customers.add')}
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label={t('common.customers')} value={formatNumber(totals.count)} icon={UsersIcon} />
        <StatCard label={t('common.active')} value={formatNumber(totals.active)} icon={UserCheckIcon} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        exportName="customers"
        exportRows={(r) => r.map((c) => ({ name: c.name, phone: c.phone, email: c.email, status: c.accountStatus }))}
      />
      <Sheet open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {viewing && (
            <>
              <SheetHeader>
                <SheetTitle>{viewing.name}</SheetTitle>
                <SheetDescription>{viewing.phone || viewing.email || '-'}</SheetDescription>
              </SheetHeader>
              <CustomerProfile customer={viewing} />
            </>
          )}
        </SheetContent>
      </Sheet>
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? t('customers.add') : t('common.edit')}
        fields={fields}
        initial={initial}
        onSubmit={save}
        preview={() =>
          formError && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError.message}
            </p>
          )
        }
      />
    </>
  )
}

/** Profile: completed-order figures, consent, saved addresses and recent orders. */
function CustomerProfile({ customer }: { customer: Customer }) {
  const { t } = useT()
  const { stats, isLoading, refresh } = useCustomerStats(customer.id)
  const [savingConsent, setSavingConsent] = useState(false)
  const dto = stats?.customer

  const toggleConsent = async (v: boolean) => {
    if (!dto) return
    setSavingConsent(true)
    try {
      await setMarketingConsent(dto, v)
      toast.success(t('common.updated'))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSavingConsent(false)
      await refresh()
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
      {isLoading || !stats ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <dl className="grid grid-cols-2 gap-3">
          {[
            [t('common.email'), customer.email || '-'],
            [t('common.orders'), formatNumber(stats.totalOrders)],
            [t('customers.totalSpent'), formatCurrency(stats.totalSpent)],
            [t('customers.lastVisit'), stats.lastOrderAt ? formatDate(stats.lastOrderAt) : '-'],
            ['Source', dto?.source ?? '-'],
            ['Language', dto?.preferred_locale ?? '-'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-medium capitalize">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {dto && (
        <label className="flex items-center justify-between gap-3">
          <span>
            Marketing consent
            {dto.marketing_consent_updated_at && (
              <span className="block text-xs text-muted-foreground">Changed {formatDate(dto.marketing_consent_updated_at)}</span>
            )}
          </span>
          <Switch checked={dto.marketing_consent} disabled={savingConsent} onCheckedChange={toggleConsent} />
        </label>
      )}
      {customer.notes && <p className="text-muted-foreground">{customer.notes}</p>}
      <Separator />
      <CustomerAddresses customerId={customer.id} />
      <Separator />
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Recent completed orders</p>
        {stats?.recent.length ? (
          <ul className="flex flex-col gap-1.5">
            {stats.recent.map((o) => (
              <li key={o.orderId} className="flex justify-between gap-2">
                <span>
                  {o.number} <span className="text-xs text-muted-foreground">· {branchName(o.branchId)} · {formatDate(o.completedAt)}</span>
                </span>
                <span className="tabular-nums">{formatCurrency(o.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </div>
    </div>
  )
}

const addressLine = (a: CustomerAddressResponseDto) => [a.line1, a.line2, a.area, a.city, a.postal_code].filter(Boolean).join(', ')

function CustomerAddresses({ customerId }: { customerId: string }) {
  const { addresses, isLoading, busy, add, edit, remove } = useCustomerAddresses(customerId)
  const [editing, setEditing] = useState<CustomerAddressResponseDto | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CustomerAddressResponseDto | null>(null)

  const initial: FormValues =
    editing && editing !== 'new'
      ? {
          label: editing.label ?? '',
          line1: editing.line1,
          line2: editing.line2 ?? '',
          area: editing.area ?? '',
          city: editing.city ?? '',
          postalCode: editing.postal_code ?? '',
          instructions: editing.instructions ?? '',
          isDefault: editing.is_default,
        }
      : { label: '', line1: '', line2: '', area: '', city: '', postalCode: '', instructions: '', isDefault: false }

  const save = async (v: FormValues) => {
    const input: AddressInput = {
      label: String(v.label),
      line1: String(v.line1),
      line2: String(v.line2),
      area: String(v.area),
      city: String(v.city),
      postalCode: String(v.postalCode),
      instructions: String(v.instructions),
      isDefault: !!v.isDefault,
    }
    const ok = editing && editing !== 'new' ? await edit(editing, input) : await add(input)
    return ok
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Addresses</p>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing('new')}>
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : addresses?.length ? (
        <ul className="flex flex-col gap-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2">
              <span className="flex min-w-0 gap-2">
                <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  {a.label && <span className="font-medium">{a.label} · </span>}
                  {addressLine(a)}
                  {a.is_default && (
                    <Badge variant="secondary" className="ms-1.5">
                      Default
                    </Badge>
                  )}
                </span>
              </span>
              <RowActions
                actions={[
                  { label: 'Edit', onSelect: () => setEditing(a) },
                  { label: 'Delete', destructive: true, onSelect: () => setDeleting(a) },
                ]}
              />
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-muted-foreground">No saved addresses.</span>
      )}
      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Add address' : 'Edit address'}
        fields={[
          { name: 'label', label: 'Label (e.g. Home)' },
          { name: 'line1', label: 'Address line 1', required: true, wide: true },
          { name: 'line2', label: 'Address line 2', wide: true },
          { name: 'area', label: 'Area' },
          { name: 'city', label: 'City' },
          { name: 'postalCode', label: 'Postal code' },
          { name: 'instructions', label: 'Delivery instructions', type: 'textarea', wide: true },
          { name: 'isDefault', label: 'Default address', type: 'switch', wide: true },
        ]}
        initial={initial}
        onSubmit={save}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete address"
        description="Past orders keep their own copy of the address."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting && (await remove(deleting))) toast.success('Address deleted')
        }}
      />
    </div>
  )
}
