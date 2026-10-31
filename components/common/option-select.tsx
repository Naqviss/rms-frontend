'use client'

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface Option {
  value: string
  label: string
  disabled?: boolean
}

interface OptionSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  id?: string
  'aria-label'?: string
  disabled?: boolean
}

/** Thin wrapper over the Base UI Select that always passes `items` so the trigger shows labels, not raw values. */
export function OptionSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  id,
  disabled,
  ...rest
}: OptionSelectProps) {
  return (
    <Select items={options} value={value} onValueChange={(v) => v !== null && onValueChange(v)} disabled={disabled}>
      <SelectTrigger id={id} className={cn('w-full min-w-0', className)} aria-label={rest['aria-label']}>
        {/* Long labels truncate instead of stretching the trigger past its container. */}
        <SelectValue placeholder={placeholder} className="block! min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
