'use client'

import { useState } from 'react'
import { ArrowDownRightIcon, ArrowUpRightIcon, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  icon?: LucideIcon
  /** Percentage change versus the previous period. */
  delta?: number
  deltaLabel?: string
  hint?: string
  invertDelta?: boolean
  tone?: keyof typeof toneTile
  className?: string
}

const toneTile = {
  primary: 'bg-primary/12 text-primary',
  dine: 'bg-dine/15 text-dine',
  takeaway: 'bg-takeaway/20 text-takeaway',
  delivery: 'bg-delivery/15 text-delivery',
  foodpanda: 'bg-foodpanda/15 text-foodpanda',
  website: 'bg-website/15 text-website',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/25 text-warning-foreground dark:text-warning',
  danger: 'bg-destructive/12 text-destructive',
} as const

const toneCycle = ['primary', 'delivery', 'takeaway', 'dine'] as const
let cycle = 0

export function StatCard({ label, value, icon: Icon, delta, deltaLabel, hint, invertDelta, tone, className }: StatCardProps) {
  const good = delta === undefined ? true : invertDelta ? delta <= 0 : delta >= 0
  const [auto] = useState(() => toneCycle[cycle++ % toneCycle.length])
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {Icon && (
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', toneTile[tone ?? auto])}>
              <Icon className="size-5" aria-hidden />
            </span>
          )}
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {(delta !== undefined || hint) && (
          <div className="flex items-center gap-1.5 text-xs">
            {delta !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium',
                  good ? 'text-success' : 'text-destructive',
                )}
              >
                {delta >= 0 ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            <span className="truncate text-muted-foreground">{deltaLabel ?? hint}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
