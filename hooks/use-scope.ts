'use client'

import { useCallback, useMemo } from 'react'
import { PRESET_DAYS, useAppStore } from '@/stores/app-store'
import { currentBranchIds } from '@/mocks/branches'
import { config } from '@/lib/config'
import { isoDaysAgo } from '@/lib/utils/seed'

/** Branch + date-range scope selected in the top bar, shared by every data page. */
export function useScope() {
  const branchId = useAppStore((s) => s.branchId)
  const preset = useAppStore((s) => s.datePreset)

  const branchIds = useMemo(() => (branchId === 'all' ? currentBranchIds : [branchId]), [branchId])
  const days = PRESET_DAYS[preset]

  const inBranch = useCallback(
    <T extends { branchId: string }>(rows: T[]) => rows.filter((r) => branchIds.includes(r.branchId)),
    [branchIds],
  )

  const inRange = useCallback(
    <T,>(rows: T[], getDate: (row: T) => string) => {
      const cutoff = isoDaysAgo(config.referenceDate, days - 1, 0)
      return rows.filter((r) => getDate(r) >= cutoff)
    },
    [days],
  )

  return { branchId, branchIds, preset, days, inBranch, inRange }
}
