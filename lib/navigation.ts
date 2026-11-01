import {
  Bike,
  BarChart3,
  BookLock,
  Building2,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  Percent,
  Plug,
  Receipt,
  TicketPercent,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Briefcase,
  LineChart,
  type LucideIcon,
} from 'lucide-react'
import type { PermissionModule, PlanId } from '@/types'
import type { TranslationKey } from '@/lib/i18n/dictionary'

export interface NavChild {
  href: string
  label: TranslationKey
}

export interface NavItem {
  href: string
  label: TranslationKey
  icon: LucideIcon
  /** Role needs "view" on this module to see the entry. */
  module?: PermissionModule
  /** Minimum subscription plan that includes the feature. */
  minPlan?: PlanId
  children?: NavChild[]
}

export interface NavGroup {
  label: TranslationKey
  items: NavItem[]
}

export const planRank: Record<PlanId, number> = { starter: 0, professional: 1, enterprise: 2 }

export const appNav: NavGroup[] = [
  {
    label: 'nav.group.operations',
    items: [
      { href: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard, module: 'dashboard' },
      {
        href: '/orders',
        label: 'nav.orders',
        icon: ShoppingCart,
        module: 'orders',
        children: [
          { href: '/orders/pos', label: 'nav.pos' },
          { href: '/orders', label: 'nav.orderList' },
          { href: '/orders/tables', label: 'nav.tables' },
          { href: '/orders/kitchen', label: 'nav.kitchen' },
        ],
      },
      {
        href: '/delivery',
        label: 'nav.delivery',
        icon: Bike,
        module: 'delivery',
        children: [
          { href: '/delivery', label: 'nav.deliveryBoard' },
          { href: '/delivery/riders', label: 'nav.riders' },
        ],
      },
      { href: '/website', label: 'nav.websiteOrders', icon: Globe, module: 'website' },
      {
        href: '/inventory',
        label: 'nav.inventory',
        icon: Package,
        module: 'inventory',
        children: [
          { href: '/inventory', label: 'nav.inventoryOverview' },
          { href: '/inventory/items', label: 'nav.stockItems' },
          { href: '/inventory/movements', label: 'nav.stockMovements' },
        ],
      },
      {
        href: '/vendors',
        label: 'nav.vendors',
        icon: Truck,
        module: 'inventory',
        minPlan: 'professional',
        children: [
          { href: '/vendors', label: 'nav.vendorList' },
          { href: '/vendors/restock', label: 'nav.purchaseOrders' },
        ],
      },
      { href: '/menu', label: 'nav.menu', icon: UtensilsCrossed, module: 'menu' },
      {
        href: '/promotions',
        label: 'nav.promotions',
        icon: TicketPercent,
        module: 'menu',
        children: [
          { href: '/promotions', label: 'nav.discounts' },
          { href: '/promotions/deals', label: 'nav.deals' },
        ],
      },
      { href: '/recipes', label: 'nav.recipes', icon: BookLock, module: 'recipes', minPlan: 'professional' },
    ],
  },
  {
    label: 'nav.group.business',
    items: [
      { href: '/customers', label: 'nav.customers', icon: Users, module: 'customers', minPlan: 'professional' },
      {
        href: '/employees',
        label: 'nav.employees',
        icon: Briefcase,
        module: 'employees',
        minPlan: 'professional',
        children: [
          { href: '/employees', label: 'nav.staffList' },
          { href: '/employees/attendance', label: 'nav.attendance' },
          { href: '/employees/payroll', label: 'nav.payroll' },
        ],
      },
      {
        href: '/finance',
        label: 'nav.finance',
        icon: Wallet,
        module: 'finance',
        minPlan: 'professional',
        children: [
          { href: '/finance', label: 'nav.financeOverview' },
          { href: '/finance/channels', label: 'nav.channels' },
          { href: '/finance/transactions', label: 'nav.transactions' },
          { href: '/finance/expenses', label: 'nav.expenses' },
          { href: '/finance/item-profit', label: 'nav.itemProfit' },
          { href: '/finance/costing', label: 'nav.costing' },
          { href: '/finance/closing', label: 'nav.dailyClosing' },
        ],
      },
      { href: '/reports', label: 'nav.reports', icon: BarChart3, module: 'reports', minPlan: 'professional' },
      { href: '/taxes', label: 'nav.taxes', icon: Percent, module: 'finance', minPlan: 'professional' },
      { href: '/receipts', label: 'nav.receipts', icon: Receipt, module: 'orders' },
    ],
  },
  {
    label: 'nav.group.growth',
    items: [
      {
        href: '/integrations',
        label: 'nav.integrations',
        icon: Plug,
        module: 'settings',
        minPlan: 'enterprise',
        children: [
          { href: '/integrations', label: 'nav.marketplace' },
          { href: '/integrations/hardware', label: 'nav.hardware' },
        ],
      },
      { href: '/cms', label: 'nav.cms', icon: LayoutTemplate, module: 'settings', minPlan: 'enterprise' },
      { href: '/sync', label: 'nav.offlineSync', icon: Wifi, module: 'orders' },
    ],
  },
  {
    label: 'nav.group.admin',
    items: [
      // Hidden for now; the /subscription page still exists.
      // { href: '/subscription', label: 'nav.subscription', icon: CreditCard, module: 'settings' },
      { href: '/branches', label: 'nav.branches', icon: Store, module: 'settings' },
      { href: '/users', label: 'nav.users', icon: UserCog, module: 'settings' },
      { href: '/settings', label: 'nav.settings', icon: Settings, module: 'settings' },
    ],
  },
]

export const adminNav: NavGroup[] = [
  {
    label: 'shell.superAdmin',
    items: [
      { href: '/admin/tenants', label: 'nav.tenants', icon: Building2 },
      { href: '/admin/plans', label: 'nav.platformSubscriptions', icon: ShieldCheck },
      { href: '/admin/analytics', label: 'nav.platformAnalytics', icon: LineChart },
    ],
  },
]

/** Pages that appear in the command palette, flattened from the navigation tree. */
export function flattenNav(groups: NavGroup[]) {
  return groups.flatMap((g) =>
    g.items.flatMap((item) =>
      item.children
        ? item.children.map((c) => ({ href: c.href, label: c.label, icon: item.icon, item }))
        : [{ href: item.href, label: item.label, icon: item.icon, item }],
    ),
  )
}
