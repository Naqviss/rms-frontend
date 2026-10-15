'use client'

import { MoreHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useT } from '@/lib/i18n/use-t'

export interface RowAction {
  label: string
  onSelect: () => void
  destructive?: boolean
}

export function RowActions({ actions }: { actions: RowAction[] }) {
  const { t } = useT()
  const normal = actions.filter((a) => !a.destructive)
  const danger = actions.filter((a) => a.destructive)
  return (
    <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('common.actions')} />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {normal.map((a) => (
              <DropdownMenuItem key={a.label} onClick={a.onSelect}>
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          {danger.length > 0 && normal.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            {danger.map((a) => (
              <DropdownMenuItem key={a.label} variant="destructive" onClick={a.onSelect}>
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
