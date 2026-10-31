'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n/use-t'
import { useAppStore } from '@/stores/app-store'

/** Include or exclude collected sales tax from revenue and profit. Shared across finance pages. */
export function TaxToggle() {
  const { t } = useT()
  const includeTax = useAppStore((s) => s.includeTax)
  const setIncludeTax = useAppStore((s) => s.setIncludeTax)
  return (
    <Label title={t('common.includeTaxHint')} className="h-9 cursor-pointer rounded-md border bg-background px-3 font-normal">
      <Checkbox checked={includeTax} onCheckedChange={(v) => setIncludeTax(!!v)} />
      {t('common.includeTax')}
    </Label>
  )
}
