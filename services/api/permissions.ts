/**
 * Maps server permission codes (`<resource>.<verb>`, e.g. `order.create`, `expense.record`) onto
 * the prototype's module × action matrix that drives navigation and button gating.
 *
 * This is UX only: the backend re-checks every request and answers 403 PERMISSION_DENIED.
 */
import type { PermissionAction, PermissionModule, RoleId } from '@/types'

const MODULE_BY_PREFIX: [RegExp, PermissionModule][] = [
  [/^(reports?|insights?\.reports?)/, 'reports'],
  [/^(insights?|dashboard)/, 'dashboard'],
  [/^(orders?|tables?|dining|kitchen|payments?|receipts?|pos)/, 'orders'],
  [/^(delivery|riders?)/, 'delivery'],
  [/^(cms|website|site|storefront)/, 'website'],
  [/^(inventory|stock|vendors?|purchas)/, 'inventory'],
  [/^(menu|modifier|catalog|media)/, 'menu'],
  [/^(recipes?|costing)/, 'recipes'],
  [/^(finance|expenses?|cash|tax|discounts?|promotions?|coupons?)/, 'finance'],
  [/^(staff|employees?|attendance|shifts?|payroll|compensation)/, 'employees'],
  [/^(customers?|reservations?)/, 'customers'],
  [/^(settings?|tenant|branch|brand|users?|roles?|audit|integration|subscription|offline|devices?|notification|localization|experience)/, 'settings'],
]

function actionsFor(verb: string): PermissionAction[] {
  if (/^(manage|admin|all|\*)$/.test(verb)) return ['view', 'create', 'edit', 'delete']
  if (/^(view|read|list|get|export)/.test(verb)) return ['view']
  if (/^(create|record|register|issue|invite|add|open)/.test(verb)) return ['view', 'create']
  if (/^(delete|remove|void|archive|revoke|cancel|deactivate)/.test(verb)) return ['view', 'delete']
  // update, edit, transition, publish, assign, approve, pay, refund, adjust, resolve…
  return ['view', 'edit']
}

export function moduleOf(code: string): PermissionModule | null {
  const resource = code.split('.').slice(0, -1).join('.') || code
  return MODULE_BY_PREFIX.find(([re]) => re.test(resource))?.[1] ?? null
}

/** Does any server permission grant `action` on `module`? */
export function grants(permissions: Set<string>, module: PermissionModule, action: PermissionAction): boolean {
  if (permissions.has('*')) return true
  for (const code of permissions) {
    if (moduleOf(code) !== module) continue
    const verb = code.split('.').pop() ?? ''
    if (actionsFor(verb).includes(action)) return true
  }
  return false
}

/** Best-effort label for a server role code, used for display and the default landing screen. */
export function roleIdOf(codes: string[]): RoleId {
  const all = codes.join(' ').toLowerCase()
  if (/owner/.test(all)) return 'tenant-owner'
  if (/admin/.test(all)) return 'administrator'
  if (/manager/.test(all)) return 'branch-manager'
  if (/account|finance/.test(all)) return 'accountant'
  if (/cashier|counter/.test(all)) return 'cashier'
  if (/waiter|server/.test(all)) return 'waiter'
  if (/chef|kitchen|cook/.test(all)) return 'chef'
  if (/rider|driver/.test(all)) return 'rider'
  return 'branch-manager'
}

export const homeFor: Record<RoleId, string> = {
  'tenant-owner': '/dashboard',
  administrator: '/dashboard',
  'branch-manager': '/dashboard',
  accountant: '/finance',
  cashier: '/orders/pos',
  waiter: '/orders/tables',
  chef: '/orders/kitchen',
  rider: '/delivery',
}
