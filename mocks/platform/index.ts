import type {
  ActivityLog,
  AppUser,
  Device,
  Integration,
  NotificationItem,
  PermissionAction,
  PermissionMatrix,
  PermissionModule,
  Plan,
  Role,
  SyncRecord,
} from '@/types'
import { config } from '@/lib/config'
import { isoDaysAgo } from '@/lib/utils/seed'

const ref = config.referenceDate

export const integrations: Integration[] = [
  { id: 'i1', name: 'Foodpanda', category: 'delivery', description: 'Receive Foodpanda orders directly in your POS and kitchen display.', connected: true, lastSync: isoDaysAgo(ref, 0, 17, 42), color: 'oklch(0.62 0.22 5)', initials: 'FP' },
  { id: 'i2', name: 'Cheetay', category: 'delivery', description: 'Sync Cheetay delivery orders and menu availability.', connected: false, lastSync: null, color: 'oklch(0.7 0.16 70)', initials: 'CH' },
  { id: 'i3', name: 'Careem Food', category: 'delivery', description: 'Accept Careem orders and push menu updates in real time.', connected: false, lastSync: null, color: 'oklch(0.6 0.16 150)', initials: 'CF' },
  { id: 'i4', name: 'JazzCash', category: 'payments', description: 'Accept mobile wallet payments at the counter and online.', connected: true, lastSync: isoDaysAgo(ref, 0, 16, 5), color: 'oklch(0.58 0.2 25)', initials: 'JC' },
  { id: 'i5', name: 'Easypaisa', category: 'payments', description: 'Take Easypaisa wallet and OTC payments.', connected: false, lastSync: null, color: 'oklch(0.62 0.17 150)', initials: 'EP' },
  { id: 'i6', name: 'Stripe', category: 'payments', description: 'Card payments for online ordering and reservations.', connected: true, lastSync: isoDaysAgo(ref, 0, 15, 20), color: 'oklch(0.52 0.2 280)', initials: 'ST' },
  { id: 'i7', name: 'QuickBooks', category: 'accounting', description: 'Export sales, expenses and tax summaries to QuickBooks.', connected: false, lastSync: null, color: 'oklch(0.6 0.15 150)', initials: 'QB' },
  { id: 'i8', name: 'Xero', category: 'accounting', description: 'Automated journal entries and bank reconciliation.', connected: false, lastSync: null, color: 'oklch(0.62 0.13 230)', initials: 'XR' },
  { id: 'i9', name: 'WhatsApp Business', category: 'messaging', description: 'Send order confirmations and receive customer messages.', connected: true, lastSync: isoDaysAgo(ref, 0, 17, 58), color: 'oklch(0.65 0.18 150)', initials: 'WA' },
  { id: 'i10', name: 'Twilio SMS', category: 'sms', description: 'Transactional SMS for OTP, order updates and promotions.', connected: true, lastSync: isoDaysAgo(ref, 0, 14, 30), color: 'oklch(0.58 0.2 15)', initials: 'TW' },
  { id: 'i11', name: 'Mailgun', category: 'email', description: 'Receipts, invoices and campaign emails.', connected: false, lastSync: null, color: 'oklch(0.58 0.2 20)', initials: 'MG' },
]

export const devices: Device[] = [
  { id: 'd1', name: 'Counter POS 1', type: 'pos-terminal', branchId: 'b1', status: 'connected', lastSync: isoDaysAgo(ref, 0, 17, 59), model: 'Sunmi T2', ipAddress: '192.168.1.21' },
  { id: 'd2', name: 'Counter POS 2', type: 'pos-terminal', branchId: 'b1', status: 'connected', lastSync: isoDaysAgo(ref, 0, 17, 58), model: 'Sunmi T2', ipAddress: '192.168.1.22' },
  { id: 'd3', name: 'Receipt Printer', type: 'receipt-printer', branchId: 'b1', status: 'connected', lastSync: isoDaysAgo(ref, 0, 17, 40), model: 'Epson TM-T88VI', ipAddress: '192.168.1.31' },
  { id: 'd4', name: 'Kitchen Printer', type: 'kitchen-printer', branchId: 'b1', status: 'error', lastSync: isoDaysAgo(ref, 0, 12, 10), model: 'Star TSP143', ipAddress: '192.168.1.32' },
  { id: 'd5', name: 'Kitchen Display 1', type: 'kitchen-display', branchId: 'b1', status: 'connected', lastSync: isoDaysAgo(ref, 0, 17, 59), model: 'Samsung 24" KDS', ipAddress: '192.168.1.41' },
  { id: 'd6', name: 'Barcode Scanner', type: 'barcode-scanner', branchId: 'b2', status: 'disconnected', lastSync: isoDaysAgo(ref, 1, 20, 12), model: 'Zebra DS2208', ipAddress: 'USB' },
  { id: 'd7', name: 'Cash Drawer', type: 'cash-drawer', branchId: 'b2', status: 'connected', lastSync: isoDaysAgo(ref, 0, 17, 22), model: 'APG Vasario', ipAddress: 'RJ11' },
  { id: 'd8', name: 'Customer Display', type: 'customer-display', branchId: 'b3', status: 'connected', lastSync: isoDaysAgo(ref, 0, 17, 50), model: 'Posiflex PD-2600', ipAddress: '192.168.3.51' },
  { id: 'd9', name: 'Counter POS 1', type: 'pos-terminal', branchId: 'b3', status: 'connected', lastSync: isoDaysAgo(ref, 0, 17, 56), model: 'Sunmi T2', ipAddress: '192.168.3.21' },
]

export const syncRecords: SyncRecord[] = [
  { id: 's1', entity: 'Order', action: 'create', description: 'Order #3198 (dine-in, Table 4)', status: 'pending', createdAt: isoDaysAgo(ref, 0, 17, 51), attempts: 0 },
  { id: 's2', entity: 'Order', action: 'update', description: 'Order #3195 marked completed', status: 'pending', createdAt: isoDaysAgo(ref, 0, 17, 47), attempts: 1 },
  { id: 's3', entity: 'Inventory', action: 'update', description: 'Stock adjustment: Chicken breast -4 kg', status: 'failed', createdAt: isoDaysAgo(ref, 0, 16, 30), attempts: 3, error: 'Network timeout while contacting sync server' },
  { id: 's4', entity: 'Customer', action: 'create', description: 'New customer: Maryam Aziz', status: 'conflict', createdAt: isoDaysAgo(ref, 0, 15, 12), attempts: 2, error: 'Duplicate phone number exists on server' },
  { id: 's5', entity: 'Order', action: 'create', description: 'Order #3190 (delivery)', status: 'synced', createdAt: isoDaysAgo(ref, 0, 14, 5), attempts: 1 },
  { id: 's6', entity: 'Menu item', action: 'update', description: 'Price change: Zinger Burger Rs 690', status: 'synced', createdAt: isoDaysAgo(ref, 0, 11, 2), attempts: 1 },
  { id: 's7', entity: 'Transaction', action: 'create', description: 'Cash expense: Cleaning supplies', status: 'failed', createdAt: isoDaysAgo(ref, 0, 10, 40), attempts: 2, error: 'Validation error: missing branch reference' },
]

export const plans: Plan[] = [
  {
    id: 'pl1', name: 'Starter', planId: 'starter', priceMonthly: 9900,
    description: 'For a single-location restaurant getting started with digital operations.',
    features: ['1 branch', 'Up to 5 users', 'POS & orders', 'Basic inventory', 'Email support'],
    limits: { branches: 1, users: 5, products: 150 },
    modules: ['POS', 'Orders', 'Inventory', 'Menu'],
  },
  {
    id: 'pl2', name: 'Professional', planId: 'professional', priceMonthly: 24900,
    description: 'For growing restaurants that need finance, staff and customer tools.',
    features: ['Up to 5 branches', 'Up to 25 users', 'Finance & reports', 'Employee management', 'Vendor management', 'Priority support'],
    limits: { branches: 5, users: 25, products: 600 },
    modules: ['POS', 'Orders', 'Inventory', 'Menu', 'Finance', 'Employees', 'Vendors', 'Customers'],
    highlight: true,
  },
  {
    id: 'pl3', name: 'Enterprise', planId: 'enterprise', priceMonthly: 59900,
    description: 'For restaurant groups running multiple branches with full control.',
    features: ['Unlimited branches', 'Unlimited users', 'All modules', 'Custom roles & permissions', 'Delivery & payment integrations', 'Dedicated success manager'],
    limits: { branches: 999, users: 999, products: 9999 },
    modules: ['All modules', 'Integrations', 'Advanced reports', 'Roles & permissions', 'API access'],
  },
]

const A: PermissionAction[] = ['view', 'create', 'edit', 'delete']
const VE: PermissionAction[] = ['view', 'create', 'edit']
const V: PermissionAction[] = ['view']
const N: PermissionAction[] = []

function matrix(entries: Partial<Record<PermissionModule, PermissionAction[]>>): PermissionMatrix {
  const modules: PermissionModule[] = ['dashboard', 'orders', 'inventory', 'menu', 'finance', 'reports', 'employees', 'customers', 'settings']
  return Object.fromEntries(modules.map((m) => [m, entries[m] ?? N])) as PermissionMatrix
}

export const roles: Role[] = [
  { id: 'tenant-owner', name: 'Tenant Owner', description: 'Full access to every module and setting.', permissions: matrix({ dashboard: A, orders: A, inventory: A, menu: A, finance: A, reports: A, employees: A, customers: A, settings: A }) },
  { id: 'administrator', name: 'Administrator', description: 'Manages operations, staff and configuration.', permissions: matrix({ dashboard: A, orders: A, inventory: A, menu: A, finance: VE, reports: V, employees: A, customers: A, settings: VE }) },
  { id: 'branch-manager', name: 'Branch Manager', description: 'Runs day-to-day operations of assigned branches.', permissions: matrix({ dashboard: V, orders: A, inventory: VE, menu: VE, finance: V, reports: V, employees: VE, customers: VE }) },
  { id: 'cashier', name: 'Cashier', description: 'Takes orders and payments at the counter.', permissions: matrix({ orders: VE, customers: VE, menu: V }) },
  { id: 'waiter', name: 'Waiter', description: 'Creates dine-in orders and manages tables.', permissions: matrix({ orders: VE, menu: V }) },
  { id: 'chef', name: 'Chef', description: 'Views kitchen queue and updates stock usage.', permissions: matrix({ orders: ['view', 'edit'], inventory: VE, menu: V }) },
  { id: 'rider', name: 'Rider', description: 'Sees and updates assigned delivery orders.', permissions: matrix({ orders: ['view', 'edit'] }) },
  { id: 'accountant', name: 'Accountant', description: 'Manages finance, tax and reports.', permissions: matrix({ dashboard: V, finance: A, reports: A, inventory: V, orders: V }) },
]

const palette = ['oklch(0.55 0.2 272)', 'oklch(0.6 0.15 150)', 'oklch(0.65 0.18 30)', 'oklch(0.55 0.15 200)', 'oklch(0.6 0.18 330)']

export const appUsers: AppUser[] = [
  { id: 'u1', name: 'Imran Qureshi', email: 'imran@zaiqakitchen.pk', role: 'tenant-owner', branchIds: ['b1', 'b2', 'b3'], status: 'active', lastActive: isoDaysAgo(ref, 0, 17, 55), color: palette[0] },
  { id: 'u2', name: 'Owais Qureshi', email: 'owais@zaiqakitchen.pk', role: 'administrator', branchIds: ['b1', 'b2', 'b3'], status: 'active', lastActive: isoDaysAgo(ref, 0, 16, 10), color: palette[1] },
  { id: 'u3', name: 'Faisal Ahmed', email: 'faisal@zaiqakitchen.pk', role: 'branch-manager', branchIds: ['b1'], status: 'active', lastActive: isoDaysAgo(ref, 0, 17, 30), color: palette[2] },
  { id: 'u4', name: 'Nadia Hussain', email: 'nadia@zaiqakitchen.pk', role: 'branch-manager', branchIds: ['b2'], status: 'active', lastActive: isoDaysAgo(ref, 0, 15, 45), color: palette[3] },
  { id: 'u5', name: 'Bilal Sheikh', email: 'bilal@zaiqakitchen.pk', role: 'branch-manager', branchIds: ['b3'], status: 'active', lastActive: isoDaysAgo(ref, 1, 22, 5), color: palette[4] },
  { id: 'u6', name: 'Kashif Ali', email: 'kashif@zaiqakitchen.pk', role: 'cashier', branchIds: ['b1'], status: 'active', lastActive: isoDaysAgo(ref, 0, 17, 52), color: palette[0] },
  { id: 'u7', name: 'Rabia Kamal', email: 'rabia@zaiqakitchen.pk', role: 'accountant', branchIds: ['b1', 'b2', 'b3'], status: 'active', lastActive: isoDaysAgo(ref, 0, 12, 20), color: palette[1] },
  { id: 'u8', name: 'Imtiaz Hussain', email: 'imtiaz@zaiqakitchen.pk', role: 'chef', branchIds: ['b1'], status: 'inactive', lastActive: isoDaysAgo(ref, 12, 20, 0), color: palette[2] },
  { id: 'u9', name: 'Sidra Parveen', email: 'sidra@zaiqakitchen.pk', role: 'cashier', branchIds: ['b2'], status: 'invited', lastActive: isoDaysAgo(ref, 3, 9, 0), color: palette[3] },
]

export const activityLog: ActivityLog[] = [
  { id: 'a1', userName: 'Kashif Ali', action: 'created order', target: '#3198', at: isoDaysAgo(ref, 0, 17, 51), type: 'order' },
  { id: 'a2', userName: 'Imtiaz Hussain', action: 'recorded wastage', target: 'Chicken breast -2 kg', at: isoDaysAgo(ref, 0, 17, 20), type: 'inventory' },
  { id: 'a3', userName: 'Faisal Ahmed', action: 'approved purchase order', target: 'PO-1043', at: isoDaysAgo(ref, 0, 16, 40), type: 'inventory' },
  { id: 'a4', userName: 'Rabia Kamal', action: 'recorded expense', target: 'Utilities Rs 68,000', at: isoDaysAgo(ref, 0, 15, 5), type: 'finance' },
  { id: 'a5', userName: 'Nadia Hussain', action: 'updated price of', target: 'Chicken Tikka Pizza', at: isoDaysAgo(ref, 0, 13, 30), type: 'menu' },
  { id: 'a6', userName: 'Imran Qureshi', action: 'invited user', target: 'sidra@zaiqakitchen.pk', at: isoDaysAgo(ref, 0, 11, 12), type: 'user' },
  { id: 'a7', userName: 'System', action: 'completed sync of', target: '14 offline records', at: isoDaysAgo(ref, 0, 9, 2), type: 'system' },
]

export const notifications: NotificationItem[] = [
  { id: 'n1', title: 'Low stock: Chicken breast', body: 'Only 8 kg left at Clifton Flagship. Reorder soon.', at: isoDaysAgo(ref, 0, 17, 30), read: false, level: 'warning' },
  { id: 'n2', title: 'New online order #3199', body: 'Foodpanda order of Rs 3,240 is waiting for confirmation.', at: isoDaysAgo(ref, 0, 17, 45), read: false, level: 'info' },
  { id: 'n3', title: 'Kitchen printer offline', body: 'Clifton Flagship kitchen printer has not responded since noon.', at: isoDaysAgo(ref, 0, 12, 15), read: false, level: 'danger' },
  { id: 'n4', title: 'Daily sales target reached', body: 'DHA Phase 6 crossed Rs 180,000 in sales today.', at: isoDaysAgo(ref, 0, 16, 2), read: true, level: 'success' },
]
