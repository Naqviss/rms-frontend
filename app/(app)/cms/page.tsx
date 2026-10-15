'use client'

import Link from 'next/link'
import { CheckIcon, ExternalLinkIcon, LayoutTemplateIcon, PaletteIcon, SearchIcon, SlidersHorizontalIcon, TypeIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PageHeader } from '@/components/common/page-header'
import { ScaledFrame, SiteView } from '@/components/cms/site-view'
import { accentChoices, sampleMenu, siteTemplates, templateById } from '@/lib/cms/templates'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { useSiteStore, type SiteContent, type SiteSections } from '@/stores/site-store'

export default function CmsPage() {
  const { t } = useT()
  const { templateId, accent, content, sections, setTemplate, setAccent, setContent, setSections } = useSiteStore()
  const template = templateById(templateId)
  const set = (k: keyof SiteContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setContent({ [k]: e.target.value })
  const save = () => toast.success(t('common.saved'))

  return (
    <>
      <PageHeader
        title={t('cms.title')}
        description={t('cms.subtitle')}
        actions={
          <>
            <Button variant="outline" render={<Link href="/store" target="_blank" />} nativeButton={false}>
              <ExternalLinkIcon data-icon="inline-start" />
              Live site
            </Button>
            <Button onClick={save}>{t('common.saveChanges')}</Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Tabs defaultValue="templates" className="min-w-0">
          <TabsList>
            <TabsTrigger value="templates">
              <LayoutTemplateIcon />
              Templates
            </TabsTrigger>
            <TabsTrigger value="content">
              <TypeIcon />
              Content
            </TabsTrigger>
            <TabsTrigger value="sections">
              <SlidersHorizontalIcon />
              {t('cms.sections')}
            </TabsTrigger>
            <TabsTrigger value="seo">
              <SearchIcon />
              SEO
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
              </CardContent>
            </Card>

            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {siteTemplates.map((tpl) => {
                const active = tpl.id === templateId
                return (
                  <li key={tpl.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTemplate(tpl.id)
                        toast.success(`${tpl.name} applied`)
                      }}
                      aria-pressed={active}
                      className={cn(
                        'group relative block w-full overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        active && 'border-primary ring-2 ring-primary',
                      )}
                    >
                      <ScaledFrame height={640}>
                        <SiteView template={tpl} accent={active ? accent : null} content={content} sections={sections} items={sampleMenu} />
                      </ScaledFrame>
                      <div className="flex items-center justify-between gap-2 border-t p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{tpl.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{tpl.cuisine}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1" aria-hidden>
                          {[tpl.colors.bg, tpl.colors.accent, tpl.colors.text].map((col) => (
                            <span key={col} className="size-4 rounded-full border" style={{ background: col }} />
                          ))}
                        </div>
                      </div>
                      {active && (
                        <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <CheckIcon className="size-4" aria-hidden />
                          <span className="sr-only">Selected</span>
                        </span>
                      )}
                    </button>
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
                    <FieldLabel htmlFor="brandName">Restaurant name</FieldLabel>
                    <Input id="brandName" value={content.brandName} onChange={set('brandName')} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="heroTitle">{t('cms.headline')}</FieldLabel>
                    <Input id="heroTitle" value={content.heroTitle} onChange={set('heroTitle')} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="heroSubtitle">{t('cms.subheadline')}</FieldLabel>
                    <Textarea id="heroSubtitle" rows={3} value={content.heroSubtitle} onChange={set('heroSubtitle')} />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('cms.about')}</CardTitle>
              </CardHeader>
              <CardContent>
                <Field>
                  <FieldLabel htmlFor="about">{t('cms.story')}</FieldLabel>
                  <Textarea id="about" rows={5} value={content.about} onChange={set('about')} />
                </Field>
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
                {(Object.keys(sections) as (keyof SiteSections)[]).map((k) => (
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
                <SiteView template={template} accent={accent} content={content} sections={sections} items={sampleMenu} />
              </ScaledFrame>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
