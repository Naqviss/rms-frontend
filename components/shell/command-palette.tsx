'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command,
} from '@/components/ui/command'
import { appNav, flattenNav } from '@/lib/navigation'
import { useAccess } from '@/hooks/use-access'
import { useT } from '@/lib/i18n/use-t'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { t } = useT()
  const { stateFor } = useAccess()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const entries = useMemo(
    () => flattenNav(appNav).filter((e) => stateFor(e.item) === 'allowed'),
    [stateFor],
  )

  return (
    <>
      <Button
        variant="outline"
        className="hidden h-9 w-64 justify-start gap-2 text-muted-foreground md:inline-flex lg:w-80"
        onClick={() => setOpen(true)}
      >
        <SearchIcon data-icon="inline-start" />
        <span className="flex-1 truncate text-start font-normal">{t('shell.search')}</span>
        <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">Ctrl K</kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label={t('common.search')}
      >
        <SearchIcon />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title={t('shell.search')}>
        <Command>
          <CommandInput placeholder={t('shell.search')} />
          <CommandList>
            <CommandEmpty>{t('shell.noResults')}</CommandEmpty>
            <CommandGroup heading={t('shell.pages')}>
              {entries.map((e) => {
                const Icon = e.icon
                return (
                  <CommandItem
                    key={e.href}
                    value={`${t(e.label)} ${e.href}`}
                    onSelect={() => {
                      setOpen(false)
                      router.push(e.href)
                    }}
                  >
                    <Icon aria-hidden />
                    {t(e.label)}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
