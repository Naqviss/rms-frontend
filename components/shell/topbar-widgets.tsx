'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  BellIcon,
  CloudOffIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  CloudIcon,
  LanguagesIcon,
  LifeBuoyIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  StoreIcon,
  SunIcon,
  UserIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAccess } from '@/hooks/use-access'
import { useScope } from '@/hooks/use-scope'
import { useAppStore } from '@/stores/app-store'
import { useAccount, useAuthStore } from '@/stores/auth-store'
import { useT } from '@/lib/i18n/use-t'
import { languageMeta } from '@/lib/i18n/dictionary'
import { branchName, currentTenantBranches } from '@/lib/directory'
import { formatRelative, initials } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { NotificationItem } from '@/types'
import { toast } from 'sonner'
import { errorMessage } from '@/services/api/client'
import { text } from '@/services/api/mappers'
import { useSession } from '@/services/api/session'
import { markAllNotificationsRead, markNotificationRead, toNotificationItem } from '@/services/api/modules/notifications'
import { useNotifications, useUnreadCount } from '@/hooks/use-platform'

export function BranchSwitcher() {
  const { t } = useT()
  const setBranches = useAppStore((s) => s.setBranches)
  const { branchIds, allBranches } = useScope()
  const { owner, user } = useAccount()
  // The owner can look across every branch; staff only pick between the branches they work in.
  const available = currentTenantBranches.filter((b) => owner || user.branchIds.includes(b.id))

  const toggle = (id: string, on: boolean) => {
    const next = available.map((b) => b.id).filter((b) => (b === id ? on : branchIds.includes(b)))
    if (!next.length) return
    setBranches(owner && next.length === currentTenantBranches.length ? [] : next)
  }

  const label =
    owner && allBranches
      ? t('shell.allBranches')
      : branchIds.length === 1
        ? branchName(branchIds[0])
        : `${branchIds.length} ${t('shell.branchesCount')}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="hidden h-9 w-44 justify-start gap-2 px-3 font-normal sm:flex lg:w-52" aria-label={t('shell.branch')} />}
      >
        <StoreIcon className="size-4 text-muted-foreground" aria-hidden />
        <span className="flex-1 truncate text-start">{label}</span>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          {owner && (
            <>
              <DropdownMenuCheckboxItem checked={allBranches} onCheckedChange={(c) => c && setBranches([])}>
                {t('shell.allBranches')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </>
          )}
          {available.map((b) => (
            <DropdownMenuCheckboxItem key={b.id} checked={branchIds.includes(b.id)} onCheckedChange={(c) => toggle(b.id, c)}>
              {b.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SyncIndicator() {
  const { t } = useT()
  const syncState = useAppStore((s) => s.syncState)
  const config = {
    online: { icon: CloudIcon, cls: 'text-success', label: t('status.online') },
    offline: { icon: CloudOffIcon, cls: 'text-warning', label: t('status.offline') },
    syncing: { icon: RefreshCwIcon, cls: 'text-primary animate-spin', label: t('status.syncing') },
    'sync-failed': { icon: CloudOffIcon, cls: 'text-destructive', label: t('status.sync-failed') },
  }[syncState]
  const Icon = config.icon
  return (
    <Button
      variant="ghost"
      size="sm"
      className="hidden gap-1.5 lg:inline-flex"
      render={<Link href="/sync" />}
      nativeButton={false}
    >
      <Icon className={cn('size-4', config.cls)} aria-hidden />
      <span className="text-xs">{config.label}</span>
    </Button>
  )
}

export function LanguageToggle() {
  const { language } = useT()
  const setLanguage = useAppStore((s) => s.setLanguage)
  const next = language === 'en' ? 'ur' : 'en'
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={() => setLanguage(next)}
      aria-label={`Switch language to ${languageMeta[next].label}`}
    >
      <LanguagesIcon data-icon="inline-start" />
      <span className="text-xs font-medium">{languageMeta[next].label}</span>
    </Button>
  )
}

/** Inbox: GET /api/notifications + unread-count; read / read-all post to the API. */
export function NotificationsMenu() {
  const { data, mutate } = useNotifications()
  const { data: unread, mutate: mutateUnread } = useUnreadCount()
  const items = (data ?? []).map(toNotificationItem)
  const refresh = () => Promise.all([mutate(), mutateUnread()])
  return (
    <NotificationsPopover
      items={items}
      unreadCount={unread}
      onMarkAllRead={async () => {
        try {
          await markAllNotificationsRead()
        } catch (err) {
          toast.error(errorMessage(err))
        }
        await refresh()
      }}
      onRead={async (id) => {
        try {
          await markNotificationRead(id)
        } catch (err) {
          toast.error(errorMessage(err))
        }
        await refresh()
      }}
    />
  )
}

function NotificationsPopover({
  items,
  unreadCount,
  onMarkAllRead,
  onRead,
}: {
  items: NotificationItem[]
  unreadCount?: number
  onMarkAllRead: () => void
  onRead: (id: string) => void
}) {
  const { t } = useT()
  const unread = unreadCount ?? items.filter((n) => !n.read).length
  const dot = { info: 'bg-primary', warning: 'bg-warning', success: 'bg-success', danger: 'bg-destructive' }
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={t('shell.notifications')} />}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute end-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{t('shell.notifications')}</p>
          <Button variant="ghost" size="xs" onClick={onMarkAllRead} disabled={unread === 0}>
            <CheckCheckIcon data-icon="inline-start" />
            {t('shell.markAllRead')}
          </Button>
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn('flex gap-3 border-b px-4 py-3 last:border-0', !n.read && 'bg-accent/40 cursor-pointer')}
              onClick={!n.read ? () => onRead(n.id) : undefined}
            >
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[n.level])} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{n.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{n.at ? formatRelative(n.at) : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function UserMenu({ mode }: { mode: 'app' | 'admin' }) {
  const { t, td } = useT()
  const { theme, setTheme } = useTheme()
  const { role } = useAccess()
  const logout = useAuthStore((s) => s.logout)
  const router = useRouter()
  const { user, owner, isPlatformAdmin } = useAccount()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Account menu" />}>
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-start leading-tight xl:block">
          <span className="block text-xs font-medium">{user.name}</span>
          <span className="block text-[11px] text-muted-foreground">{td(`role.${role}`)}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('shell.theme')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'light'} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">
              <SunIcon /> {t('shell.light')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <MoonIcon /> {t('shell.dark')}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <MonitorIcon /> {t('shell.system')}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {owner && (
            <>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <UserIcon /> {t('shell.profile')}
              </DropdownMenuItem>
              {(isPlatformAdmin || mode === 'admin') && (
                <DropdownMenuItem render={<Link href={mode === 'admin' ? '/dashboard' : '/admin/tenants'} />}>
                  <ShieldCheckIcon /> {mode === 'admin' ? t('shell.backToApp') : t('shell.superAdmin')}
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuItem render={<a href="https://vercel.com/help" target="_blank" rel="noreferrer" />}>
            <LifeBuoyIcon /> {t('shell.help')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            logout()
            router.replace('/login')
          }}
        >
          <LogOutIcon /> {t('shell.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Real plan name from GET /api/subscription; non-active states (trial, grace, suspended…) are called out. */
export function PlanBadge() {
  const subscription = useSession((s) => s.subscription)
  if (!subscription) return null
  const name = text(subscription.plan.name) || subscription.plan.code
  const status = subscription.status
  const tone = status === 'active' ? 'secondary' : status === 'trialing' || status === 'grace' ? 'outline' : 'destructive'
  return (
    <Badge variant={tone} className="hidden capitalize xl:inline-flex">
      {name}
      {status !== 'active' && ` · ${status === 'trialing' ? 'trial' : status}`}
    </Badge>
  )
}
