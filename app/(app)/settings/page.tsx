'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { DataTable } from '@/components/common/data-table'
import { FormDialog } from '@/components/common/form-dialog'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { useAccess } from '@/hooks/use-access'
import {
  useNotificationCategories,
  useNotificationDispatches,
  useNotificationPreferences,
  useNotificationTemplates,
  useSettings,
} from '@/hooks/use-platform'
import { branchName } from '@/lib/directory'
import { languageMeta, type Language } from '@/lib/i18n/dictionary'
import { useT } from '@/lib/i18n/use-t'
import { formatDateTime } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { localized, text } from '@/services/api/mappers'
import {
  overrideNotificationTemplate,
  setNotificationCategory,
  setNotificationPreference,
  updateSetting,
  updateTenant,
} from '@/services/api/modules/platform'
import { useSession } from '@/services/api/session'
import type { DispatchResponseDto, SettingResponseDto, TemplateResponseDto, UpdateTenantDto } from '@/services/api/generated/schemas'
import { useAppStore } from '@/stores/app-store'

const when = (iso: string | null | undefined) => (iso ? formatDateTime(iso.slice(0, 19)) : '—')

async function attempt(run: () => Promise<unknown>, ok: string): Promise<boolean> {
  try {
    await run()
    toast.success(ok)
    return true
  } catch (err) {
    toast.error(errorMessage(err))
    return false
  }
}

export default function SettingsPage() {
  const { t } = useT()
  const { can } = useAccess()
  const admin = can('settings', 'edit')
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <Tabs defaultValue="business">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="business">{t('settings.business')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.notifications')}</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="business" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <BusinessProfile canEdit={admin} />
            <Preferences />
          </div>
        </TabsContent>
        <TabsContent value="notifications" className="mt-4 flex flex-col gap-4">
          <MyNotifications />
          {admin && (
            <>
              <CategorySwitches />
              <Templates />
              <Dispatches />
            </>
          )}
        </TabsContent>
        <TabsContent value="advanced" className="mt-4">
          <SettingsTable canEdit={admin} />
        </TabsContent>
      </Tabs>
    </>
  )
}

/** GET/PATCH /api/tenant. Currency is fixed after onboarding. */
function BusinessProfile({ canEdit }: { canEdit: boolean }) {
  const { t } = useT()
  const tenant = useSession((s) => s.tenant)
  const [form, setForm] = useState({ display_name: '', legal_name: '', contact_email: '', contact_phone: '', default_timezone: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenant) return
    setForm({
      display_name: tenant.display_name,
      legal_name: tenant.legal_name ?? '',
      contact_email: tenant.contact_email ?? '',
      contact_phone: tenant.contact_phone ?? '',
      default_timezone: tenant.default_timezone,
    })
  }, [tenant])

  if (!tenant) return <Skeleton className="h-80" />

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const patch: Omit<UpdateTenantDto, 'expected_version'> = {}
  if (form.display_name.trim() && form.display_name !== tenant.display_name) patch.display_name = form.display_name.trim()
  if (form.legal_name !== (tenant.legal_name ?? '')) patch.legal_name = form.legal_name.trim()
  if (form.contact_email !== (tenant.contact_email ?? '')) patch.contact_email = form.contact_email.trim()
  if (form.contact_phone !== (tenant.contact_phone ?? '')) patch.contact_phone = form.contact_phone.trim()
  if (form.default_timezone.trim() && form.default_timezone !== tenant.default_timezone) patch.default_timezone = form.default_timezone.trim()
  const dirty = Object.keys(patch).length > 0

  const save = async () => {
    setSaving(true)
    await attempt(() => updateTenant(patch), t('common.saved'))
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.business')}</CardTitle>
        <CardDescription>{t('settings.businessHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="s-name">{t('common.name')}</FieldLabel>
            <Input id="s-name" value={form.display_name} onChange={set('display_name')} disabled={!canEdit} />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-legal">Legal name</FieldLabel>
            <Input id="s-legal" value={form.legal_name} onChange={set('legal_name')} disabled={!canEdit} />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-email">{t('common.email')}</FieldLabel>
            <Input id="s-email" type="email" value={form.contact_email} onChange={set('contact_email')} disabled={!canEdit} />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-phone">{t('common.phone')}</FieldLabel>
            <Input id="s-phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} disabled={!canEdit} />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-tz">Timezone</FieldLabel>
            <Input id="s-tz" value={form.default_timezone} onChange={set('default_timezone')} disabled={!canEdit} placeholder="Asia/Karachi" />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-cur">{t('settings.currency')}</FieldLabel>
            <Input id="s-cur" value={tenant.default_currency} disabled readOnly />
          </Field>
        </FieldGroup>
      </CardContent>
      {canEdit && (
        <CardFooter>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving && <Spinner data-icon="inline-start" />}
            {t('common.saveChanges')}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

/** Browser-local display preferences. */
function Preferences() {
  const { t } = useT()
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const { theme, setTheme } = useTheme()
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">{t('settings.preferences')}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="s-lang">{t('shell.language')}</FieldLabel>
            <OptionSelect
              id="s-lang"
              value={language}
              onValueChange={(v) => setLanguage(v as Language)}
              options={(Object.keys(languageMeta) as Language[]).map((l) => ({ value: l, label: languageMeta[l].label }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="s-theme">{t('settings.theme')}</FieldLabel>
            <ToggleGroup id="s-theme" variant="outline" value={[theme ?? 'system']} onValueChange={(v) => v.length && setTheme(v[0])} className="w-fit">
              <ToggleGroupItem value="light">{t('settings.light')}</ToggleGroupItem>
              <ToggleGroupItem value="dark">{t('settings.dark')}</ToggleGroupItem>
              <ToggleGroupItem value="system">{t('settings.system')}</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

/** GET/PUT /api/notification-preferences — the signed-in user's own switches. */
function MyNotifications() {
  const { data, isLoading, mutate } = useNotificationPreferences()
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My notifications</CardTitle>
        <CardDescription>Which in-app notifications you receive.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && <Skeleton className="h-20 sm:col-span-2 lg:col-span-4" />}
        {data?.map((p) => (
          <label key={`${p.category}:${p.channel}`} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm capitalize">
            {p.category}
            <Switch
              checked={p.enabled}
              disabled={busy !== null}
              onCheckedChange={async (v) => {
                setBusy(p.category)
                await attempt(() => setNotificationPreference(p.category, v).then(() => mutate()), 'Preference saved')
                setBusy(null)
              }}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  )
}

/** GET/PUT /api/notification-categories — tenant-wide switches (audited). */
function CategorySwitches() {
  const { data, isLoading, mutate } = useNotificationCategories()
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification categories</CardTitle>
        <CardDescription>Turning a category off stops it for everyone in the business.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && <Skeleton className="h-20 sm:col-span-2 lg:col-span-4" />}
        {data
          ?.filter((c) => !c.branch_id)
          .map((c) => (
            <label key={`${c.category}:${c.channel}`} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm capitalize">
              {c.category}
              <Switch
                checked={c.enabled}
                disabled={busy !== null}
                onCheckedChange={async (v) => {
                  setBusy(c.category)
                  await attempt(() => setNotificationCategory(c.category, v).then(() => mutate()), 'Category updated')
                  setBusy(null)
                }}
              />
            </label>
          ))}
      </CardContent>
    </Card>
  )
}

/** GET/PUT /api/notification-templates — defaults merged with tenant overrides. */
function Templates() {
  const { t } = useT()
  const { data, isLoading, mutate } = useNotificationTemplates()
  const [editing, setEditing] = useState<TemplateResponseDto | null>(null)
  const columns = useMemo<ColumnDef<TemplateResponseDto & { id: string }, unknown>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Template',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{text(row.original.title)}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
          </div>
        ),
      },
      { accessorKey: 'category', header: 'Category', cell: ({ row }) => <span className="capitalize">{row.original.category}</span> },
      { id: 'vars', header: 'Variables', accessorFn: (r) => r.variables.map((v) => `{{${v}}}`).join(' ') },
      {
        id: 'state',
        header: t('common.status'),
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <StatusBadge status={row.original.is_active ? 'active' : 'inactive'} />
            {row.original.overridden && <Badge variant="outline">Customized</Badge>}
          </span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => <RowActions actions={[{ label: t('common.edit'), onSelect: () => setEditing(row.original) }]} />,
      },
    ],
    [t],
  )
  return (
    <>
      <DataTable
        cardTitle="Templates"
        columns={columns}
        data={data?.map((x) => ({ ...x, id: x.code }))}
        isLoading={isLoading}
        exportName="notification-templates"
      />
      <FormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Customize template"
        description={editing?.variables.length ? `Variables: ${editing.variables.map((v) => `{{${v}}}`).join(', ')}` : undefined}
        fields={[
          { name: 'title', label: 'Title (English)', required: true, wide: true },
          { name: 'body', label: 'Body (English)', type: 'textarea', required: true, wide: true },
          { name: 'is_active', label: t('common.active'), type: 'switch' },
        ]}
        initial={{ title: text(editing?.title), body: text(editing?.body), is_active: editing?.is_active ?? true }}
        onSubmit={(v) =>
          editing
            ? attempt(
                () =>
                  overrideNotificationTemplate(editing.code, {
                    // Only the English text is edited here; other languages are kept.
                    title: { ...editing.title, ...localized(String(v.title)) },
                    body: { ...editing.body, ...localized(String(v.body)) },
                    is_active: !!v.is_active,
                  }).then(() => mutate()),
                t('common.saved'),
              )
            : false
        }
      />
    </>
  )
}

/** GET /api/notification-dispatches — status, reason and counts exactly as the server reports them. */
function Dispatches() {
  const { t } = useT()
  const { data, isLoading } = useNotificationDispatches()
  const tone: Record<DispatchResponseDto['status'], string> = { pending: 'pending', delivered: 'completed', skipped: 'inactive', failed: 'failed' }
  const columns = useMemo<ColumnDef<DispatchResponseDto, unknown>[]>(
    () => [
      { accessorKey: 'created_at', header: t('common.date'), cell: ({ row }) => when(row.original.created_at) },
      { accessorKey: 'template_code', header: 'Template', cell: ({ row }) => <span className="font-mono text-xs">{row.original.template_code}</span> },
      { accessorKey: 'category', header: 'Category' },
      { id: 'branch', header: t('common.branch'), accessorFn: (r) => (r.branch_id ? branchName(r.branch_id) : '—') },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <StatusBadge status={tone[row.original.status]} label={row.original.status} /> },
      { id: 'reason', header: 'Reason', accessorFn: (r) => r.reason ?? '—', cell: ({ row }) => <span className="font-mono text-xs">{row.original.reason ?? '—'}</span> },
      { accessorKey: 'recipient_count', header: 'Recipients' },
      { accessorKey: 'delivered_count', header: 'Delivered' },
      { accessorKey: 'attempts', header: t('sync.attempts') },
      { id: 'error', header: 'Last error', accessorFn: (r) => r.last_error_code ?? '—' },
      { accessorKey: 'last_attempt_at', header: 'Last attempt', cell: ({ row }) => when(row.original.last_attempt_at) },
    ],
    [t], // eslint-disable-line react-hooks/exhaustive-deps
  )
  return <DataTable cardTitle="Dispatch history" columns={columns} data={data} isLoading={isLoading} exportName="notification-dispatches" emptyTitle="No dispatches yet" />
}

/** GET /api/settings, PUT /api/settings/{key} — effective values (default → tenant → branch). */
function SettingsTable({ canEdit }: { canEdit: boolean }) {
  const { t } = useT()
  const { data, isLoading, mutate } = useSettings()
  const [editing, setEditing] = useState<SettingResponseDto | null>(null)
  const columns = useMemo<ColumnDef<SettingResponseDto & { id: string }, unknown>[]>(
    () => [
      {
        accessorKey: 'key',
        header: 'Setting',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-mono text-xs font-medium">{row.original.key}</p>
            <p className="text-xs text-muted-foreground">{row.original.description}</p>
          </div>
        ),
      },
      { id: 'value', header: 'Value', accessorFn: (r) => JSON.stringify(r.value ?? null), cell: ({ row }) => <code className="break-all text-xs">{JSON.stringify(row.original.value ?? null)}</code> },
      { accessorKey: 'source', header: 'Source', cell: ({ row }) => <Badge variant={row.original.source === 'default' ? 'secondary' : 'outline'}>{row.original.source}</Badge> },
      { id: 'offline', header: 'Offline', accessorFn: (r) => (r.offline ? 'yes' : '') },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) => (canEdit ? <RowActions actions={[{ label: t('common.edit'), onSelect: () => setEditing(row.original) }]} /> : null),
      },
    ],
    [t, canEdit],
  )
  return (
    <>
      <DataTable columns={columns} data={data?.map((s) => ({ ...s, id: s.key }))} isLoading={isLoading} exportName="settings" />
      <FormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.key ?? ''}
        description={editing ? `${editing.description} — value as JSON; validated by the server.` : undefined}
        fields={[{ name: 'value', label: 'Value (JSON object)', type: 'textarea', required: true, wide: true }]}
        initial={{ value: JSON.stringify(editing?.value ?? {}, null, 2) }}
        onSubmit={(v) => {
          if (!editing) return false
          let value: Record<string, unknown>
          try {
            const parsed = JSON.parse(String(v.value))
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
            value = parsed
          } catch {
            toast.error('Enter a JSON object, e.g. {"enabled": true}')
            return false
          }
          return attempt(() => updateSetting(editing, value).then(() => mutate()), t('common.saved'))
        }}
      />
    </>
  )
}
