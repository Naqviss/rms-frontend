'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { useIntegrations } from '@/hooks/use-data'
import { useT } from '@/lib/i18n/use-t'
import { formatRelative, titleCase } from '@/lib/utils/format'
import type { IntegrationCategory } from '@/types'

const categories: ('all' | IntegrationCategory)[] = ['all', 'delivery', 'payments', 'accounting', 'messaging', 'sms', 'email']

export default function IntegrationsPage() {
  const { t } = useT()
  const { data, isLoading, update } = useIntegrations()
  const [category, setCategory] = useState<string>('all')
  const rows = useMemo(() => (data ?? []).filter((i) => (category === 'all' ? true : i.category === category)), [data, category])

  return (
    <>
      <PageHeader
        title={t('integrations.title')}
        description={t('integrations.subtitle')}
        actions={
          <Button variant="outline" render={<Link href="/integrations/hardware" />} nativeButton={false}>
            {t('integrations.hardware')}
          </Button>
        }
      />
      <Tabs value={category} onValueChange={setCategory}>
        <div className="overflow-x-auto">
          <TabsList>
            {categories.map((c) => (
              <TabsTrigger key={c} value={c}>
                {c === 'all' ? t('common.all') : titleCase(c)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: i.color }}
                    aria-hidden
                  >
                    {i.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{i.name}</CardTitle>
                    <CardDescription className="capitalize">{i.category}</CardDescription>
                  </div>
                  <StatusBadge status={i.connected ? 'connected' : 'disconnected'} />
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{i.description}</p>
                <p className="mt-2 text-xs">
                  {t('common.lastSync')}: {i.lastSync ? formatRelative(i.lastSync) : t('common.never')}
                </p>
              </CardContent>
              <CardFooter className="gap-2">
                <Button
                  size="sm"
                  variant={i.connected ? 'outline' : 'default'}
                  onClick={async () => {
                    await update(i.id, { connected: !i.connected, lastSync: i.connected ? null : new Date().toISOString().slice(0, 19) })
                    toast.success(i.connected ? t('integrations.disconnected') : t('integrations.connectedToast'))
                  }}
                >
                  {i.connected ? t('common.disconnect') : t('common.connect')}
                </Button>
                {i.connected && (
                  <Button size="sm" variant="ghost" onClick={() => toast.success(t('integrations.testOk'))}>
                    {t('common.test')}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
