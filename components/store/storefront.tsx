'use client'

import { useEffect, useState } from 'react'
import { PhoneIcon, StoreIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { SiteView } from '@/components/cms/site-view'
import { usePublicSite, useSiteItems } from '@/hooks/use-platform'
import { templateById } from '@/lib/cms/templates'
import { hasSession } from '@/services/api/auth'
import { siteContentFromPublic } from '@/services/api/modules/cms'
import { bootstrapSession, useSession } from '@/services/api/session'
import { emptyContent, useSiteStore } from '@/stores/site-store'

/**
 * Public website at /store?tenant=<tenantId>.
 *
 * Content comes from the tenant's *published* site configuration
 * (GET /api/public/tenants/{tenantId}/site, anonymous). The RMS API has no public menu or public
 * ordering endpoint, so dishes are only shown when a staff member who is signed in previews the
 * site (the authenticated menu API), and the cart/checkout is not offered.
 */
export function Storefront() {
  const { templateId, sections } = useSiteStore()
  const sessionTenant = useSession((s) => s.tenant?.id ?? null)
  const sessionStatus = useSession((s) => s.status)
  const [queryTenant, setQueryTenant] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    setQueryTenant(new URLSearchParams(window.location.search).get('tenant'))
  }, [])

  // Staff preview: a signed-in user gets the session (and so the real menu) without the app shell.
  useEffect(() => {
    if (sessionStatus === 'idle' && hasSession()) void bootstrapSession()
  }, [sessionStatus])

  const tenantId = queryTenant ?? sessionTenant
  const { data: site, isLoading, error } = usePublicSite(tenantId)
  const items = useSiteItems()
  const published = siteContentFromPublic(site)
  const content = { ...emptyContent, ...published.content }

  if (queryTenant === undefined || (tenantId && isLoading)) return <Skeleton className="m-6 h-96" />

  if (!tenantId || error || !site?.config) {
    return (
      <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <StoreIcon className="size-10 text-muted-foreground" aria-hidden />
        <p className="text-lg font-semibold">{!tenantId ? 'Restaurant not specified' : 'This website is not published yet'}</p>
        <p className="text-sm text-muted-foreground">
          {!tenantId ? 'Open the storefront link from the restaurant (it includes ?tenant=…).' : 'Please check back soon.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <Alert className="rounded-none">
        <StoreIcon />
        <AlertTitle>Online ordering is not available yet</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-1">
          {content.phone ? (
            <>
              <PhoneIcon className="size-3.5" aria-hidden /> Call us on {content.phone} to order.
            </>
          ) : (
            'Please contact the restaurant to order.'
          )}
        </AlertDescription>
      </Alert>
      <SiteView template={templateById(templateId)} accent={published.accent} content={content} sections={sections} items={items} />
    </>
  )
}
