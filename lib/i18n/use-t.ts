'use client'

import { useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'
import { dictionaries, languageMeta, type TranslationKey } from '@/lib/i18n/dictionary'

export function useT() {
  const language = useAppStore((s) => s.language)
  const dict = dictionaries[language]
  const t = useCallback((key: TranslationKey) => dict[key] ?? dictionaries.en[key] ?? key, [dict])
  /** Translate a dynamic key (e.g. a status value) and fall back to the raw label when no entry exists. */
  const td = useCallback(
    (key: string, fallback?: string) =>
      (dict as Record<string, string>)[key] ?? (dictionaries.en as Record<string, string>)[key] ?? fallback ?? key,
    [dict],
  )
  return { t, td, language, dir: languageMeta[language].dir }
}
