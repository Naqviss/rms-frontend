'use client'

import Link from 'next/link'
import { ExternalLinkIcon, LayoutTemplateIcon, ListOrderedIcon, SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/common/page-header'
import { WebsiteOrders } from '@/components/website/website-orders'
import { WebsiteSettings } from '@/components/website/website-settings'

export default function WebsitePage() {
  return (
    <>
      <PageHeader
        title="Website orders"
        actions={
          <>
            <Button variant="outline" render={<Link href="/cms" />} nativeButton={false}>
              <LayoutTemplateIcon data-icon="inline-start" />
              Templates
            </Button>
            <Button render={<Link href="/store" target="_blank" />} nativeButton={false}>
              <ExternalLinkIcon data-icon="inline-start" />
              Storefront
            </Button>
          </>
        }
      />
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">
            <ListOrderedIcon />
            Orders
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon />
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <WebsiteOrders />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <WebsiteSettings />
        </TabsContent>
      </Tabs>
    </>
  )
}
