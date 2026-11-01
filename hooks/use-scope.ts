'use client'

import { useCallback, useMemo } from 'react'
import { PRESET_DAYS, useAppStore } from '@/stores/app-store'
import { currentBranchIds } from '@/mocks/branches'
import { config } from '@/lib/config'
import { isoDaysAgo } from '@/lib/utils/seed'

/** Branch + date-range scope selected in the top bar, shared by every data page. */
export function useScope() {
  const selected = useAppStore((s) => s.branchIds)
  const preset = useAppStore((s) => s.datePreset)

  const branchIds = useMemo(() => {
    const picked = (selected ?? []).filter((id) => currentBranchIds.includes(id))
    return picked.length ? picked : currentBranchIds
  }, [selected])
  const allBranches = branchIds.length === currentBranchIds.length
  /** Branch that new records (orders, expenses, stock...) are filed under when several are in view. */
  const primaryBranch = branchIds[0]
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

  return { branchIds, allBranches, primaryBranch, preset, days, inBranch, inRange }
}
