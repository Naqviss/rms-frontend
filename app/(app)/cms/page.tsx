'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CheckIcon, ExternalLinkIcon, EyeIcon, FileTextIcon, LayoutTemplateIcon, MenuIcon, PaletteIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon, TypeIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DataTable } from '@/components/common/data-table'
import { FormDialog } from '@/components/common/form-dialog'
import { PageHeader } from '@/components/common/page-header'
import { RowActions } from '@/components/common/row-actions'
import { StatusBadge } from '@/components/common/status-badge'
import { ScaledFrame, SiteView } from '@/components/cms/site-view'
import { TemplatePreviewDialog } from '@/components/cms/template-preview-dialog'
import { useCmsPages, useNavigations, useSiteConfig, useSiteItems } from '@/hooks/use-platform'
import { useAccess } from '@/hooks/use-access'
import { accentChoices, sampleMenu, siteTemplates, templateById, type SiteTemplate } from '@/lib/cms/templates'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils/format'
import { errorMessage } from '@/services/api/client'
import { localized, text } from '@/services/api/mappers'
import {
  archiveCmsPage,
  archiveNavigation,
  createCmsPage,
  publishCmsPage,
  publishNavigation,
  publishSiteConfig,
  putSiteConfig,
  siteConfigBody,
  siteContentFrom,
} from '@/services/api/modules/platform'
import { useSession } from '@/services/api/session'
import type { CmsPageResponseDto, NavigationResponseDto, SiteConfigResponseDto } from '@/services/api/generated/schemas'
import { emptyContent, useSiteStore, type SiteContent, type SiteSections } from '@/stores/site-store'

/** Sections that render real data (menu items); the template's sample blocks only appear in previews. */
const editableSections: (keyof SiteSections)[] = ['menu', 'gallery']

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

function DraftBadge({ doc }: { doc: Pick<SiteConfigResponseDto, 'status' | 'has_unpublished_changes'> | null | undefined }) {
  if (!doc) return <StatusBadge status="draft" label="Not created" tone="neutral" />
  return (
    <span className="flex items-center gap-1.5">
      <StatusBadge status={doc.status === 'published' ? 'active' : doc.status} label={doc.status} />
      {doc.has_unpublished_changes && <Badge variant="outline">Unpublished changes</Badge>}
    </span>
  )
}

export default function CmsPage() {
  const { t } = useT()
  const { can } = useAccess()
  const tenantId = useSession((s) => s.tenant?.id)
  const { templateId, accent, content, sections, setTemplate, setAccent, setContent, setSections } = useSiteStore()
  const template = templateById(templateId)
  const items = useSiteItems()
  const site = useSiteConfig()
  const pages = useCmsPages()
  const navigations = useNavigations()
  const [previewing, setPreviewing] = useState<SiteTemplate | null>(null)
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null)
  const [creatingPage, setCreatingPage] = useState(false)
  const canEdit = can('website', 'edit')
  const cfg = site.data ?? null

  // Load the stored draft into the editor whenever a new version arrives.
  useEffect(() => {
    if (site.data === undefined) return
    const loaded = site.data ? siteContentFrom(site.data) : { content: {}, accent: null }
    setContent({ ...emptyContent, ...loaded.content })
    setAccent(loaded.accent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.data?.id, site.data?.version, site.data === null])

  const set = (k: keyof SiteContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContent({ [k]: e.target.value })

  const save = async () => {
    setBusy('save')
    await attempt(async () => {
      const next = await putSiteConfig(siteConfigBody(cfg, content, accent))
      await site.mutate(next, { revalidate: false })
    }, t('common.saved'))
    setBusy(null)
  }

  const publish = async () => {
    if (!cfg) return
    setBusy('publish')
    await attempt(async () => {
      const r = await publishSiteConfig(cfg.version)
      await site.mutate(r.site_config, { revalidate: false })
    }, 'Website published')
    setBusy(null)
  }

  const pageColumns = useMemo<ColumnDef<CmsPageResponseDto, unknown>[]>(
    () => [
      {
        id: 'title',
        header: t('cms.pageTitle'),
        accessorFn: (p) => p.title ?? text(p.title_i18n),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.title ?? text(row.original.title_i18n)}</p>
            <p className="font-mono text-xs text-muted-foreground">/{row.original.slug}</p>
          </div>
        ),
      },
      { accessorKey: 'kind', header: t('common.type'), cell: ({ row }) => <span className="capitalize">{row.original.kind}</span> },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <DraftBadge doc={row.original} /> },
      { accessorKey: 'updated_at', header: t('common.date'), cell: ({ row }) => formatDateTime(row.original.updated_at.slice(0, 19)) },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          canEdit ? (
            <RowActions
              actions={[
                ...(row.original.status !== 'archived'
                  ? [{ label: 'Publish', onSelect: () => void attempt(() => publishCmsPage(row.original).then(() => pages.mutate()), 'Page published') }]
                  : []),
                ...(row.original.status !== 'archived'
                  ? [{ label: 'Archive', destructive: true, onSelect: () => void attempt(() => archiveCmsPage(row.original).then(() => pages.mutate()), 'Page archived') }]
                  : []),
              ]}
            />
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit],
  )

  const navColumns = useMemo<ColumnDef<NavigationResponseDto, unknown>[]>(
    () => [
      { accessorKey: 'location', header: 'Location', cell: ({ row }) => <span className="capitalize">{row.original.location}</span> },
      { id: 'items', header: 'Items', accessorFn: (n) => n.items.length },
      { accessorKey: 'status', header: t('common.status'), cell: ({ row }) => <DraftBadge doc={row.original} /> },
      {
        id: 'published',
        header: 'Published',
        accessorFn: (n) => n.published_at ?? '',
        cell: ({ row }) => (row.original.published_at ? `v${row.original.published_version_no} · ${formatDateTime(row.original.published_at.slice(0, 19))}` : '—'),
      },
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row }) =>
          canEdit && row.original.status !== 'archived' ? (
            <RowActions
              actions={[
                { label: 'Publish', onSelect: () => void attempt(() => publishNavigation(row.original.location, row.original.version).then(() => navigations.mutate()), 'Navigation published') },
                {
                  label: 'Archive',
                  destructive: true,
                  onSelect: () => void attempt(() => archiveNavigation(row.original.location, row.original.version).then(() => navigations.mutate()), 'Navigation archived'),
                },
              ]}
            />
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit],
  )

  return (
    <>
      <PageHeader
        title={t('cms.title')}
        description={t('cms.subtitle')}
        actions={
          <>
            <DraftBadge doc={cfg} />
            <Button variant="outline" render={<Link href={tenantId ? `/store?tenant=${tenantId}` : '/store'} target="_blank" />} nativeButton={false}>
              <ExternalLinkIcon data-icon="inline-start" />
              Live site
            </Button>
            {canEdit && (
              <>
                <Button variant="outline" onClick={save} disabled={busy !== null || site.isLoading}>
                  {busy === 'save' && <Spinner data-icon="inline-start" />}
                  Save draft
                </Button>
                <Button onClick={publish} disabled={busy !== null || !cfg || (cfg.status === 'published' && !cfg.has_unpublished_changes)}>
                  {busy === 'publish' && <Spinner data-icon="inline-start" />}
                  Publish
                </Button>
              </>
            )}
          </>
        }
      />
      {site.data === null && (
        <Alert>
          <AlertTitle>No website yet</AlertTitle>
          <AlertDescription>Fill in your details and save a draft, then publish it to make the website public.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Tabs defaultValue="content" className="min-w-0">
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="content">
              <TypeIcon />
              Content
            </TabsTrigger>
            <TabsTrigger value="templates">
              <LayoutTemplateIcon />
              Templates
            </TabsTrigger>
            <TabsTrigger value="sections">
              <SlidersHorizontalIcon />
              {t('cms.sections')}
            </TabsTrigger>
            <TabsTrigger value="seo">
              <SearchIcon />
              SEO
            </TabsTrigger>
            <TabsTrigger value="pages">
              <FileTextIcon />
              Pages
            </TabsTrigger>
            <TabsTrigger value="navigation">
              <MenuIcon />
              Navigation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="mt-4 flex flex-col gap-4">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PaletteIcon className="size-4" aria-hidden />
                </span>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
                  {[null, ...accentChoices].map((hex) => {
                    const value = hex ?? template.colors.accent
                    const active = (accent ?? null) === hex
                    return (
                      <Tooltip key={hex ?? 'default'}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              role="radio"
                              aria-checked={active}
                              aria-label={hex ? `Accent ${hex}` : 'Template default accent'}
                              onClick={() => setAccent(hex)}
                              className={cn('flex size-8 items-center justify-center rounded-full border-2 transition-transform hover:scale-110', active ? 'border-foreground' : 'border-transparent')}
                              style={{ background: value }}
                            />
                          }
                        >
                          {active && <CheckIcon className="size-4 text-white drop-shadow" aria-hidden />}
                        </TooltipTrigger>
                        <TooltipContent>{hex ?? 'Template default'}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">The accent is saved as the site's primary colour. The template layout is a preference of this browser.</p>
              </CardContent>
            </Card>

            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {siteTemplates.map((tpl) => {
                const active = tpl.id === templateId
                return (
                  <li
                    key={tpl.id}
                    className={cn(
                      'group relative overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md',
                      active && 'border-primary ring-2 ring-primary',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewing(tpl)}
                      aria-label={`Preview ${tpl.name}`}
                      className="relative block w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                    >
                      <ScaledFrame height={640}>
                        <SiteView template={tpl} accent={active ? accent : null} content={content} sections={sections} items={sampleMenu} preview />
                      </ScaledFrame>
                      <span className="absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow">Preview · sample dishes</span>
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100 group-focus-within:bg-black/35 group-focus-within:opacity-100">
                        <span className="flex items-center gap-1.5 rounded-full bg-background px-3.5 py-1.5 text-sm font-medium text-foreground shadow">
                          <EyeIcon className="size-4" aria-hidden />
                          Full preview
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center justify-between gap-2 border-t p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{tpl.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{tpl.cuisine}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="flex items-center gap-1" aria-hidden>
                          {[tpl.colors.bg, tpl.colors.accent, tpl.colors.text].map((col) => (
                            <span key={col} className="size-4 rounded-full border" style={{ background: col }} />
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant={active ? 'secondary' : 'outline'}
                          disabled={active}
                          onClick={() => {
                            setTemplate(tpl.id)
                            toast.success(`${tpl.name} applied`)
                          }}
                        >
                          {active ? 'Applied' : 'Use'}
                        </Button>
                      </div>
                    </div>
                    {active && (
                      <span className="pointer-events-none absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                        <CheckIcon className="size-4" aria-hidden />
                        <span className="sr-only">Selected</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </TabsContent>

          <TabsContent value="content" className="mt-4 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('cms.hero')}</CardTitle>
                <CardDescription>{t('cms.heroHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="brandName">Site title</FieldLabel>
                    <Input id="brandName" value={content.brandName} onChange={set('brandName')} maxLength={120} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="heroTitle">{t('cms.headline')}</FieldLabel>
                    <Input id="heroTitle" value={content.heroTitle} onChange={set('heroTitle')} maxLength={200} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="heroSubtitle">{t('common.description')}</FieldLabel>
                    <Textarea id="heroSubtitle" rows={3} value={content.heroSubtitle} onChange={set('heroSubtitle')} maxLength={1000} />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('cms.contact')}</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="phone">{t('common.phone')}</FieldLabel>
                    <Input id="phone" type="tel" value={content.phone} onChange={set('phone')} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="email">{t('common.email')}</FieldLabel>
                    <Input id="email" type="email" value={content.email} onChange={set('email')} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="address">{t('common.address')}</FieldLabel>
                    <Input id="address" value={content.address} onChange={set('address')} />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sections" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('cms.sections')}</CardTitle>
                <CardDescription>{t('cms.sectionsHint')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {editableSections.map((k) => (
                  <label key={k} className="flex items-center justify-between text-sm capitalize">
                    {k}
                    <Switch checked={sections[k]} onCheckedChange={(v) => setSections({ [k]: v })} />
                  </label>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seo" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SEO</CardTitle>
                <CardDescription>{t('cms.seoHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="seoTitle">{t('cms.pageTitle')}</FieldLabel>
                    <Input id="seoTitle" value={content.seoTitle} onChange={set('seoTitle')} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="seoDescription">{t('common.description')}</FieldLabel>
                    <Textarea id="seoDescription" rows={3} value={content.seoDescription} onChange={set('seoDescription')} />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pages" className="mt-4">
            <DataTable
              columns={pageColumns}
              data={pages.data}
              isLoading={pages.isLoading}
              exportName="cms-pages"
              emptyTitle="No pages"
              toolbarActions={
                canEdit ? (
                  <Button size="sm" onClick={() => setCreatingPage(true)}>
                    <PlusIcon data-icon="inline-start" />
                    New page
                  </Button>
                ) : undefined
              }
            />
          </TabsContent>

          <TabsContent value="navigation" className="mt-4">
            <DataTable columns={navColumns} data={navigations.data} isLoading={navigations.isLoading} exportName="cms-navigations" emptyTitle="No navigation menus" />
          </TabsContent>
        </Tabs>

        <Card className="h-fit xl:sticky xl:top-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              {t('cms.preview')}
              <span className="text-xs font-normal text-muted-foreground">{template.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <ScaledFrame height={1500}>
                <SiteView template={template} accent={accent} content={content} sections={sections} items={items} />
              </ScaledFrame>
            </div>
          </CardContent>
        </Card>
      </div>
      <TemplatePreviewDialog
        template={previewing}
        activeId={templateId}
        accent={accent}
        content={content}
        onOpenChange={(o) => !o && setPreviewing(null)}
        onNavigate={setPreviewing}
        onApply={(tpl) => setTemplate(tpl.id)}
      />
      <FormDialog
        open={creatingPage}
        onOpenChange={setCreatingPage}
        title="New page"
        description="Creates an empty draft page; publish it when it is ready."
        fields={[
          { name: 'title', label: t('cms.pageTitle'), required: true, wide: true },
          { name: 'slug', label: 'Slug', required: true, placeholder: 'about-us' },
          {
            name: 'kind',
            label: t('common.type'),
            type: 'select',
            options: [
              { value: 'page', label: 'Page' },
              { value: 'announcement', label: 'Announcement' },
              { value: 'promotion', label: 'Promotion' },
            ],
          },
        ]}
        initial={{ title: '', slug: '', kind: 'page' }}
        onSubmit={(v) =>
          attempt(
            () =>
              createCmsPage({
                slug: String(v.slug).trim().toLowerCase(),
                kind: String(v.kind) as 'page' | 'announcement' | 'promotion',
                title: localized(String(v.title)),
                content: { blocks: [] },
              }).then(() => pages.mutate()),
            t('common.created'),
          )
        }
      />
    </>
  )
}
