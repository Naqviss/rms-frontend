'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { OptionSelect } from '@/components/common/option-select'
import { PageHeader } from '@/components/common/page-header'
import { languageMeta, type Language } from '@/lib/i18n/dictionary'
import { useT } from '@/lib/i18n/use-t'
import { useAppStore } from '@/stores/app-store'

export default function SettingsPage() {
  const { t } = useT()
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState({ name: 'Dastarkhwan Restaurant', owner: 'Hamza Qureshi', email: 'owner@dastarkhwan.pk', phone: '+92 300 1234567', currency: 'PKR', timezone: 'Asia/Karachi' })
  const [notify, setNotify] = useState({ newOrder: true, lowStock: true, dailySummary: false, syncErrors: true })
  const setP = (k: keyof typeof profile) => (e: React.ChangeEvent<HTMLInputElement>) => setProfile((p) => ({ ...p, [k]: e.target.value }))

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.business')}</CardTitle>
            <CardDescription>{t('settings.businessHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="s-name">{t('common.name')}</FieldLabel>
                <Input id="s-name" value={profile.name} onChange={setP('name')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-owner">{t('settings.owner')}</FieldLabel>
                <Input id="s-owner" value={profile.owner} onChange={setP('owner')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-email">{t('common.email')}</FieldLabel>
                <Input id="s-email" type="email" value={profile.email} onChange={setP('email')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="s-phone">{t('common.phone')}</FieldLabel>
                <Input id="s-phone" type="tel" value={profile.phone} onChange={setP('phone')} />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button onClick={() => toast.success(t('common.saved'))}>{t('common.saveChanges')}</Button>
          </CardFooter>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
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
                <Field>
                  <FieldLabel htmlFor="s-cur">{t('settings.currency')}</FieldLabel>
                  <OptionSelect
                    id="s-cur"
                    value={profile.currency}
                    onValueChange={(v) => setProfile((p) => ({ ...p, currency: v }))}
                    options={[{ value: 'PKR', label: 'PKR - Pakistani Rupee' }, { value: 'USD', label: 'USD - US Dollar' }, { value: 'AED', label: 'AED - UAE Dirham' }]}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('settings.notifications')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(
                [
                  ['newOrder', t('settings.notifyOrders')],
                  ['lowStock', t('settings.notifyStock')],
                  ['dailySummary', t('settings.notifySummary')],
                  ['syncErrors', t('settings.notifySync')],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between text-sm">
                  {label}
                  <Switch checked={notify[k]} onCheckedChange={(v) => setNotify((n) => ({ ...n, [k]: v }))} />
                </label>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
