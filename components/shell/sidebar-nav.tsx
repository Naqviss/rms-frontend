'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDownIcon, LockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminNav, appNav, type NavGroup, type NavItem } from '@/lib/navigation'
import { useAccess } from '@/hooks/use-access'
import { useT } from '@/lib/i18n/use-t'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'

function isActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function childActive(pathname: string, item: NavItem, href: string) {
  const siblings = item.children ?? []
  // The most specific matching child wins so "/orders" is not active on "/orders/pos".
  const best = siblings
    .filter((c) => pathname === c.href || pathname.startsWith(`${c.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return best?.href === href
}

interface NavEntryProps {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}

function NavEntry({ item, collapsed, onNavigate }: NavEntryProps) {
  const pathname = usePathname()
  const { t } = useT()
  const { stateFor } = useAccess()
  const state = stateFor(item)
  const active = isActive(pathname, item.href)
  const [open, setOpen] = useState(active)
  const Icon = item.icon
  const hasChildren = !!item.children?.length && !collapsed

  const rowClass = cn(
    'group flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
    collapsed && 'justify-center px-0',
  )

  const content = (
    <>
      <Icon className="size-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="flex-1 truncate text-start">{t(item.label)}</span>}
      {!collapsed && state === 'locked' && <LockIcon className="size-3.5 shrink-0 opacity-60" aria-hidden />}
      {hasChildren && (
        <ChevronDownIcon
          className={cn('size-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      )}
    </>
  )

  const row = hasChildren ? (
    <button type="button" className={rowClass} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      {content}
    </button>
  ) : (
    <Link href={item.href} className={rowClass} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  )

  return (
    <li>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={<div />}>{row}</TooltipTrigger>
          <TooltipContent side="right">{t(item.label)}</TooltipContent>
        </Tooltip>
      ) : (
        row
      )}
      {hasChildren && open && (
        <ul className="ms-[18px] mt-1 flex flex-col gap-0.5 border-s border-sidebar-border ps-3">
          {item.children!.map((child) => {
            const on = childActive(pathname, item, child.href)
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                    on
                      ? 'font-medium text-sidebar-primary'
                      : 'text-sidebar-foreground/65 hover:text-sidebar-accent-foreground',
                  )}
                >
                  {t(child.label)}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

interface SidebarNavProps {
  mode: 'app' | 'admin'
  collapsed?: boolean
  onNavigate?: () => void
}

export function SidebarNav({ mode, collapsed = false, onNavigate }: SidebarNavProps) {
  const { t } = useT()
  const { stateFor } = useAccess()
  const groups: NavGroup[] = mode === 'admin' ? adminNav : appNav

  return (
    <ScrollArea className="min-h-0 flex-1">
      <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-2">
        {groups.map((group) => {
          // Role-forbidden items are hidden; plan-locked items stay visible with a lock so upgrades are discoverable.
          const items = mode === 'admin' ? group.items : group.items.filter((i) => stateFor(i) !== 'forbidden')
          if (!items.length) return null
          return (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
                  {t(group.label)}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <NavEntry key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
                ))}
              </ul>
            </div>
          )
        })}
      </nav>
    </ScrollArea>
  )
}
