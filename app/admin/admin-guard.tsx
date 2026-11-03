'use client'

import { ShieldAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useSession } from '@/services/api/session'

/** The operator console is for platform administrators only (GET /api/me → is_platform_admin). */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const status = useSession((s) => s.status)
  const admin = useSession((s) => !!s.me?.is_platform_admin)
  if (status === 'idle' || status === 'loading') return <Skeleton className="h-64 w-full" />
  if (!admin) {
    return (
      <Alert variant="destructive">
        <ShieldAlertIcon />
        <AlertTitle>Platform administrators only</AlertTitle>
        <AlertDescription>Your account does not have access to the platform console.</AlertDescription>
      </Alert>
    )
  }
  return <>{children}</>
}
