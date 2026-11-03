/**
 * The signed-in tenant and its branches, readable synchronously from anywhere in the UI.
 *
 * The arrays start empty and are filled in place by the session bootstrap
 * (services/api/session.ts) *before* the app shell renders, so call sites like
 * `branchName(id)` work without a hook.
 */
import type { Branch } from '@/types'

export const directory = { tenantId: '', tenantName: '' }
export const currentTenantBranches: Branch[] = []
export const currentBranchIds: string[] = []

export function branchName(id: string) {
  return currentTenantBranches.find((b) => b.id === id)?.name ?? 'Unknown branch'
}

/** Replace the branch list in place (arrays are shared by reference with every importer). */
export function setDirectory(tenantId: string, tenantName: string, branches: Branch[]) {
  directory.tenantId = tenantId
  directory.tenantName = tenantName
  currentTenantBranches.splice(0, currentTenantBranches.length, ...branches)
  currentBranchIds.splice(0, currentBranchIds.length, ...branches.map((b) => b.id))
}
