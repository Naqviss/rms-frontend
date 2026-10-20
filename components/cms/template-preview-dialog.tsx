'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, LockIcon, MonitorIcon, RotateCwIcon, SmartphoneIcon, TabletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SiteView } from '@/components/cms/site-view'
import { sampleMenu, siteTemplates, type SiteTemplate } from '@/lib/cms/templates'
import { cn } from '@/lib/utils'
import type { SiteContent, SiteSections } from '@/stores/site-store'

type Device = 'desktop' | 'tablet' | 'mobile'

const deviceWidth: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' }

/** Pages of the previewed site. Each maps to a section of the one-page template. */
const ROUTES = [
  { path: '/', label: 'Home', section: null },
  { path: '/menu', label: 'Menu', section: 'menu' },
  { path: '/about', label: 'About', section: 'about' },
  { path: '/contact', label: 'Contact', section: 'contact' },
] as const

type RoutePath = (typeof ROUTES)[number]['path']

/** Height of the sticky browser bar, so sections land just below it. */
const CHROME_OFFSET = 84

/** Every section switched on so the preview shows the whole template, not just what is currently enabled. */
const allSections: SiteSections = { menu: true, offers: true, reviews: true, gallery: true, reservations: true }

interface TemplatePreviewDialogProps {
  template: SiteTemplate | null
  activeId: string
  accent: string | null
  content: SiteContent
  onOpenChange: (open: boolean) => void
  onNavigate: (template: SiteTemplate) => void
  onApply: (template: SiteTemplate) => void
}

export function TemplatePreviewDialog({ template, activeId, accent, content, onOpenChange, onNavigate, onApply }: TemplatePreviewDialogProps) {
  const [device, setDevice] = useState<Device>('desktop')
  const [cart, setCart] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const index = template ? siteTemplates.findIndex((t) => t.id === template.id) : -1
  const active = template?.id === activeId

  const siteRef = useRef<HTMLDivElement>(null)
  const [path, setPath] = useState<RoutePath>('/')
  const [history, setHistory] = useState<{ stack: RoutePath[]; index: number }>({ stack: ['/'], index: 0 })
  // Ignore scroll-spy updates while a smooth scroll triggered by navigation is still moving.
  const navigatingUntil = useRef(0)

  // Start each template at the top of the page with an empty demo cart and fresh history.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    setCart(0)
    setPath('/')
    setHistory({ stack: ['/'], index: 0 })
  }, [template?.id])

  const sectionTop = (section: string) => {
    const scroller = scrollRef.current
    const el = siteRef.current?.querySelector<HTMLElement>(`#${section}`)
    if (!scroller || !el) return null
    return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
  }

  const scrollTo = useCallback((to: RoutePath) => {
    const route = ROUTES.find((r) => r.path === to)
    const top = route?.section ? sectionTop(route.section) : 0
    if (top === null || top === undefined) return
    navigatingUntil.current = Date.now() + 800
    setPath(to)
    scrollRef.current?.scrollTo({ top: Math.max(0, top - CHROME_OFFSET), behavior: 'smooth' })
  }, [])

  const navigate = (to: RoutePath) => {
    scrollTo(to)
    setHistory((h) => (h.stack[h.index] === to ? h : { stack: [...h.stack.slice(0, h.index + 1), to], index: h.index + 1 }))
  }

  const go = (delta: -1 | 1) => {
    const index = history.index + delta
    if (index < 0 || index >= history.stack.length) return
    setHistory({ ...history, index })
    scrollTo(history.stack[index])
  }

  // Route links inside the template are plain "#section" anchors; keep them inside the preview instead of the app page.
  const onSiteClick = (e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
    if (!link) return
    e.preventDefault()
    const route = ROUTES.find((r) => r.section === link.getAttribute('href')?.slice(1))
    if (route) navigate(route.path)
  }

  // Scroll spy: the address bar follows whichever page section is at the top of the viewport.
  const onScroll = () => {
    if (Date.now() < navigatingUntil.current) return
    const scroller = scrollRef.current
    // The footer is too short to reach the top, so the bottom of the page counts as the last route.
    if (scroller && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) {
      const last = ROUTES[ROUTES.length - 1].path
      if (last !== path) setPath(last)
      return
    }
    let current: RoutePath = '/'
    for (const r of ROUTES) {
      if (!r.section) continue
      const top = sectionTop(r.section)
      if (top !== null && top - CHROME_OFFSET - 40 <= (scrollRef.current?.scrollTop ?? 0)) current = r.path
    }
    if (current !== path) setPath(current)
  }

  const host = `${content.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.zaiqa.pk`

  const step = (dir: 1 | -1) => onNavigate(siteTemplates[(index + dir + siteTemplates.length) % siteTemplates.length])

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1280px,calc(100%-2rem))]"
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'ArrowRight') step(1)
          if (e.key === 'ArrowLeft') step(-1)
        }}
      >
        {template && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 pe-12">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Previous template">
                  <ChevronLeftIcon className="rtl:rotate-180" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Next template">
                  <ChevronRightIcon className="rtl:rotate-180" />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2">
                  <span className="truncate">{template.name}</span>
                  {active && <Badge variant="secondary">Applied</Badge>}
                </DialogTitle>
                <DialogDescription className="truncate text-xs">
                  {template.cuisine} · {index + 1} of {siteTemplates.length} · {template.hero} hero, {template.menu} menu, {template.font} type
                </DialogDescription>
              </div>
              <ToggleGroup
                value={[device]}
                onValueChange={(v) => v.length && setDevice(v[0] as Device)}
                variant="outline"
                size="sm"
                aria-label="Preview device"
                className="hidden sm:flex"
              >
                <ToggleGroupItem value="desktop" aria-label="Desktop">
                  <MonitorIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="tablet" aria-label="Tablet">
                  <TabletIcon />
                </ToggleGroupItem>
                <ToggleGroupItem value="mobile" aria-label="Mobile">
                  <SmartphoneIcon />
                </ToggleGroupItem>
              </ToggleGroup>
              <Button
                size="sm"
                disabled={active}
                onClick={() => {
                  onApply(template)
                  toast.success(`${template.name} applied`)
                }}
              >
                <CheckIcon data-icon="inline-start" />
                {active ? 'Applied' : 'Use this template'}
              </Button>
            </div>

            <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto bg-muted/60 p-3 sm:p-5">
              <div
                className="mx-auto overflow-clip rounded-xl border bg-background shadow-sm transition-[max-width] duration-300"
                style={{ maxWidth: deviceWidth[device] }}
              >
                <div className="sticky -top-3 z-10 border-b bg-muted/95 backdrop-blur sm:-top-5">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="hidden gap-1.5 sm:flex" aria-hidden>
                      <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                      <span className="size-2.5 rounded-full bg-[#febc2e]" />
                      <span className="size-2.5 rounded-full bg-[#28c840]" />
                    </span>
                    <span className="flex items-center">
                      <Button variant="ghost" size="icon-xs" onClick={() => go(-1)} disabled={history.index === 0} aria-label="Back">
                        <ArrowLeftIcon className="rtl:rotate-180" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => go(1)} disabled={history.index >= history.stack.length - 1} aria-label="Forward">
                        <ArrowRightIcon className="rtl:rotate-180" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => navigate('/')} aria-label="Reload from home">
                        <RotateCwIcon />
                      </Button>
                    </span>
                    <span
                      className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md bg-background px-3 py-1 text-[11px] text-muted-foreground"
                      aria-label="Preview address"
                      aria-live="polite"
                    >
                      <LockIcon className="size-3 shrink-0" aria-hidden />
                      <span className="truncate">
                        {host}
                        <span className="font-medium text-foreground">{path === '/' ? '' : path}</span>
                      </span>
                    </span>
                  </div>
                  <nav aria-label="Preview pages" className="flex gap-1 overflow-x-auto px-3 pb-2">
                    {ROUTES.map((r) => (
                      <button
                        key={r.path}
                        type="button"
                        onClick={() => navigate(r.path)}
                        aria-current={path === r.path ? 'page' : undefined}
                        className={cn(
                          'shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          path === r.path ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {r.path === '/' ? r.label : r.path}
                      </button>
                    ))}
                  </nav>
                </div>
                <div ref={siteRef} onClickCapture={onSiteClick}>
                  <SiteView
                    template={template}
                    accent={active ? accent : null}
                    content={content}
                    sections={allSections}
                    items={sampleMenu}
                    cartCount={cart}
                    onCart={() => toast.info('Checkout is disabled in preview')}
                    onAdd={(item) => {
                      setCart((n) => n + 1)
                      toast.success(`${item.name} added (preview)`)
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
