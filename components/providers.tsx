'use client'

import { useEffect } from 'react'
import { ThemeProvider } from 'next-themes'
import { SWRConfig } from 'swr'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app-store'
import { languageMeta } from '@/lib/i18n/dictionary'

function StoreSync() {
  const language = useAppStore((s) => s.language)

  useEffect(() => {
    void useAppStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    const meta = languageMeta[language]
    document.documentElement.lang = language
    document.documentElement.dir = meta.dir
  }, [language])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const dir = languageMeta[useAppStore((s) => s.language)].dir
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
        <TooltipProvider delay={200}>
          <StoreSync />
          {children}
          <Toaster richColors position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} />
        </TooltipProvider>
      </SWRConfig>
    </ThemeProvider>
  )
}
