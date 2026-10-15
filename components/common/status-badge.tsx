'use client'

import { Badge } from '@/components/ui/badge'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const toneClass: Record<Tone, string> = {
  success: 'bg-success/15 text-success dark:text-success',
  warning: 'bg-warning/20 text-warning-foreground dark:text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-primary/10 text-primary',
  neutral: 'bg-muted text-muted-foreground',
}

const toneFor: Record<string, Tone> = {
  completed: 'success', paid: 'success', 'in-stock': 'success', available: 'success', active: 'success',
  connected: 'success', synced: 'success', received: 'success', fulfilled: 'success', open: 'success',
  online: 'success', 'completed-tx': 'success', vip: 'success', delivered: 'success',
  pending: 'warning', low: 'warning', expiring: 'warning', reserved: 'warning', trial: 'warning',
  partial: 'warning', draft: 'warning', invited: 'warning', 'on-leave': 'warning', conflict: 'warning',
  offline: 'warning', syncing: 'info', sent: 'info', regular: 'info',
  cancelled: 'danger', out: 'danger', unpaid: 'danger', suspended: 'danger', error: 'danger', failed: 'danger',
  blocked: 'danger', refunded: 'danger', 'sync-failed': 'danger', disconnected: 'danger', 'at-risk': 'danger',
  confirmed: 'info', preparing: 'info', ready: 'success', 'out-for-delivery': 'info', occupied: 'info',
  new: 'info', closed: 'neutral', inactive: 'neutral',
  awaiting: 'warning', accepted: 'success', rejected: 'danger', unassigned: 'warning',
  assigned: 'info', 'picked-up': 'info', 'on-delivery': 'info', 'off-duty': 'neutral',
}

interface StatusBadgeProps {
  status: string
  label?: string
  tone?: Tone
  className?: string
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const { td } = useT()
  const resolved = tone ?? toneFor[status] ?? 'neutral'
  const text = label ?? td(`status.${status}`, status.replace(/-/g, ' '))
  return (
    <Badge variant="ghost" className={cn('gap-1.5 font-medium capitalize', toneClass[resolved], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {text}
    </Badge>
  )
}
