'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckIcon, CopyIcon, ExternalLinkIcon, GlobeIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { channelMeta } from '@/components/common/channel-icon'
import { StatusBadge } from '@/components/common/status-badge'
import { useSiteConfig } from '@/hooks/use-platform'
import { cn } from '@/lib/utils'
import { useSession } from '@/services/api/session'

/**
 * Storefront link and publish state. The public link carries the tenant id because the public
 * site API is addressed by tenant (GET /api/public/tenants/{tenantId}/site).
 *
 * Website ordering rules (fulfilment, payment, minimum order, fees) have no backend in the RMS API,
 * so they are not offered here.
 */
export function WebsiteSettings() {
  const tenantId = useSession((s) => s.tenant?.id)
  const { data: site } = useSiteConfig()
  const [copied, setCopied] = useState(false)
  const path = tenantId ? `/store?tenant=${tenantId}` : '/store'
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className={cn('flex size-11 items-center justify-center rounded-xl', channelMeta.website.tile)}>
            <GlobeIcon aria-hidden />
          </span>
          <InputGroup className="flex-1">
            <InputGroupInput readOnly value={url} aria-label="Storefront link" />
            <InputGroupAddon align="inline-end">
              <Button size="icon-xs" variant="ghost" onClick={copy} aria-label="Copy link">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </InputGroupAddon>
          </InputGroup>
          <Button variant="outline" render={<Link href={path} target="_blank" />} nativeButton={false}>
            <ExternalLinkIcon data-icon="inline-start" />
            Open storefront
          </Button>
          {site !== undefined && (
            <StatusBadge
              status={site?.published_at ? 'active' : 'draft'}
              label={site?.published_at ? `Published v${site.published_version_no}` : 'Not published'}
            />
          )}
        </CardContent>
      </Card>
      <Alert>
        <AlertTitle>Online ordering</AlertTitle>
        <AlertDescription>
          The storefront shows your published website. Taking orders on it (fulfilment, payment and pricing rules) is not available in the RMS API yet.
        </AlertDescription>
      </Alert>
    </div>
  )
}
