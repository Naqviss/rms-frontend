'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LockIcon, MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, ShieldAlertIcon, UtensilsCrossedIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { SidebarNav } from '@/components/shell/sidebar-nav'
import { CommandPalette } from '@/components/shell/command-palette'
import {
  BranchSwitcher,
  LanguageToggle,
  NotificationsMenu,
  PlanBadge,
  SyncIndicator,
  UserMenu,
} from '@/components/shell/topbar-widgets'
import { useAccess } from '@/hooks/use-access'
import { useAppStore } from '@/stores/app-store'
import { useAccount, useAuthHydrated, useAuthStore } from '@/stores/auth-store'
import { useT } from '@/lib/i18n/use-t'
import { appNav, flattenNav } from '@/lib/navigation'
import { cn } from '@/lib/utils'

function Brand({ collapsed, mode }: { collapsed?: boolean; mode: 'app' | 'admin' }) {
  const { t } = useT()
  const { home } = useAccount()
  return (
    <Link href={mode === 'admin' ? '/admin/tenants' : home} className="flex items-center gap-2.5 px-4 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        <UtensilsCrossedIcon className="size-5" aria-hidden />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold text-sidebar-foreground">{t('app.name')}</span>
          <span className="block text-[11px] text-sidebar-foreground/55">
            {mode === 'admin' ? t('shell.superAdmin') : 'Zaiqa Kitchen'}
          </span>
        </span>
      )}
    </Link>
  )
}

function AccessGate({ children, mode }: { children: React.ReactNode; mode: 'app' | 'admin' }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useT()
  const { stateFor } = useAccess()
  const { owner, home } = useAccount()

  const state = useMemo(() => {
    if (mode === 'admin') return 'allowed' as const
    const match = flattenNav(appNav)
      .filter((e) => pathname === e.href || pathname.startsWith(`${e.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]
    return match ? stateFor(match.item) : ('allowed' as const)
  }, [mode, pathname, stateFor])

  // Staff accounts never see a dead end; send them back to their own screen instead.
  const bounce = state === 'forbidden' && !owner
  useEffect(() => {
    if (bounce) router.replace(home)
  }, [bounce, home, router])

  if (state === 'allowed') return <>{children}</>
  if (bounce) return null

  const locked = state === 'locked'
  return (
    <Empty className="mx-auto mt-16 max-w-md border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{locked ? <LockIcon /> : <ShieldAlertIcon />}</EmptyMedia>
        <EmptyTitle>{locked ? t('shell.locked') : t('shell.restricted')}</EmptyTitle>
        <EmptyDescription>{locked ? t('shell.lockedHint') : t('shell.restrictedHint')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {locked ? (
          <Button render={<Link href="/subscription" />} nativeButton={false}>
            {t('shell.upgrade')}
          </Button>
        ) : (
          <Button variant="outline" render={<Link href={home} />} nativeButton={false}>
            {t('nav.dashboard')}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}

/** Sends signed-out visitors to the login screen, remembering where they were headed. */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const hydrated = useAuthHydrated()
  const username = useAuthStore((s) => s.username)
  const { owner, user } = useAccount()
  const branchIds = useAppStore((s) => s.branchIds)
  const setBranches = useAppStore((s) => s.setBranches)

  useEffect(() => {
    if (hydrated && !username) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [hydrated, username, pathname, router])

  // Staff only work in the branches they are assigned to.
  useEffect(() => {
    if (!hydrated || !username || owner) return
    const allowed = branchIds.filter((id) => user.branchIds.includes(id))
    if (!allowed.length || allowed.length !== branchIds.length) setBranches(allowed.length ? allowed : user.branchIds)
  }, [hydrated, username, owner, user, branchIds, setBranches])

  if (!hydrated || !username) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }
  return <>{children}</>
}

export function AppShell({ children, mode = 'app' }: { children: React.ReactNode; mode?: 'app' | 'admin' }) {
  const { t } = useT()
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isCollapsed = collapsed

  return (
    <AuthGuard>
      <div className="min-h-dvh bg-background">
        <aside
          className={cn(
            'fixed inset-y-0 start-0 z-30 hidden flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex',
            isCollapsed ? 'w-[68px]' : 'w-64',
          )}
        >
          <Brand collapsed={isCollapsed} mode={mode} />
          <SidebarNav mode={mode} collapsed={isCollapsed} />
          <div className="border-t border-sidebar-border p-3">
            <Button
              variant="ghost"
              size={isCollapsed ? 'icon' : 'default'}
              className={cn('w-full text-sidebar-foreground/70 hover:bg-sidebar-accent', !isCollapsed && 'justify-start gap-2')}
              onClick={toggleSidebar}
              aria-label={isCollapsed ? t('shell.expand') : t('shell.collapse')}
            >
              {isCollapsed ? (
                <PanelLeftOpenIcon className="rtl:rotate-180" />
              ) : (
                <>
                  <PanelLeftCloseIcon className="rtl:rotate-180" data-icon="inline-start" />
                  <span className="text-xs">{t('shell.collapse')}</span>
                </>
              )}
            </Button>
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">{t('app.name')}</SheetTitle>
            <Brand mode={mode} />
            <SidebarNav mode={mode} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', isCollapsed ? 'lg:ps-[68px]' : 'lg:ps-64')}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </Button>
            {mode === 'app' && <BranchSwitcher />}
            <div className="flex-1" />
            <CommandPalette />
            <div className="flex items-center gap-0.5">
              {mode === 'app' && <SyncIndicator />}
              <LanguageToggle />
              <NotificationsMenu />
              <PlanBadge />
              <UserMenu mode={mode} />
            </div>
          </header>
          <main className="flex-1 px-3 py-5 sm:px-6 sm:py-6">
            {/* Pages render their sections as siblings; the column gap spaces header, stats, filters and tables evenly. */}
            <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4">
              <AccessGate mode={mode}>{children}</AccessGate>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
