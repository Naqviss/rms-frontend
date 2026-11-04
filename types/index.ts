export type ID = string

export interface Entity {
  id: ID
}

export type PlanId = 'starter' | 'professional' | 'enterprise'
export type TenantStatus = 'active' | 'suspended' | 'trial'

export interface Tenant extends Entity {
  name: string
  email: string
  phone: string
  plan: PlanId
  status: TenantStatus
  registeredAt: string
  color: string
}

export interface Branch extends Entity {
  tenantId: ID
  name: string
  city: string
  address: string
  phone: string
  status: 'open' | 'closed'
}

export interface MenuCategory extends Entity {
  name: string
  slug: string
  image: string
  sortOrder: number
}

export interface ProductOption {
  name: string
  /** Added to the base price; negative for a cheaper choice such as a smaller size. */
  price: number
}

/** A set of choices offered when ordering, e.g. "Patty: Single / Double" or "Extras: cheese, egg". */
export interface ProductOptionGroup {
  id: ID
  name: string
  /** `single`: exactly one choice, the first is preselected. `multiple`: any number, none by default. */
  type: 'single' | 'multiple'
  options: ProductOption[]
}

export interface Product extends Entity {
  name: string
  sku: string
  categoryId: ID
  description: string
  image: string
  basePrice: number
  /** Tax rate from Tax Management; whether it sits inside the price or on top follows that rate's `inclusive`. Null when untaxed. */
  taxRateId: ID | null
  available: boolean
  optionGroups: ProductOptionGroup[]
  menuId: ID
}

export interface MenuGroup extends Entity {
  name: string
  description: string
  active: boolean
}

export type StockStatus = 'in-stock' | 'low' | 'out'

export interface InventoryItem extends Entity {
  name: string
  sku: string
  quantity: number
  unit: string
  minStock: number
  costPerUnit: number
  branchId: ID
  vendorId: ID
}

export type MovementType = 'purchase' | 'consumption' | 'adjustment' | 'transfer' | 'wastage'

export interface StockMovement extends Entity {
  itemId: ID
  itemName: string
  type: MovementType
  quantity: number
  unit: string
  branchId: ID
  date: string
  note: string
}

export interface Vendor extends Entity {
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  status: 'active' | 'inactive'
  color: string
}

export type OrderType = 'dine-in' | 'takeaway' | 'delivery' | 'online'
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out-for-delivery'
  | 'completed'
  | 'cancelled'
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'refunded'
/** `unknown`: the order has no recorded payment yet, or the method could not be mapped. */
export type PaymentMethod = 'cash' | 'card' | 'online' | 'split' | 'unknown'

export interface OrderItem {
  productId: ID
  name: string
  quantity: number
  unitPrice: number
  /** Names of the chosen options, e.g. ["Double patty", "Extra cheese"]. */
  options?: string[]
}

export type SalesChannel = 'dine-in' | 'takeaway' | 'own-delivery' | 'foodpanda' | 'website'

export type DeliveryStatus = 'unassigned' | 'assigned' | 'picked-up' | 'delivered' | 'failed'

export interface DeliveryInfo {
  address: string
  area: string
  fee: number
  etaMinutes: number
  status: DeliveryStatus
  riderId: ID | null
  riderName: string | null
  durationMinutes?: number
}

export type RiderStatus = 'available' | 'on-delivery' | 'off-duty'

export interface Rider extends Entity {
  name: string
  phone: string
  branchId: ID
  status: RiderStatus
}

export type FoodpandaAcceptance = 'awaiting' | 'accepted' | 'rejected'

export interface FoodpandaInfo {
  externalId: string
  acceptance: FoodpandaAcceptance
  rejectReason?: string
}

export interface WebsiteInfo {
  fulfillment: 'delivery' | 'pickup'
  acceptance: FoodpandaAcceptance
  promoCode?: string
}

export interface Order extends Entity {
  number: string
  customerId: ID | null
  customerName: string
  type: OrderType
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  items: OrderItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  branchId: ID
  tableId: ID | null
  createdAt: string
  notes: string
  source: string
  channel?: SalesChannel
  delivery?: DeliveryInfo
  foodpanda?: FoodpandaInfo
  website?: WebsiteInfo
  /** Discount applied from Discounts & Deals, if any. */
  discountId?: ID
}

export type TableStatus = 'available' | 'occupied' | 'reserved'

export interface DiningTable extends Entity {
  branchId: ID
  number: number
  /** Table code from the API (e.g. "T4"), when it isn't purely numeric. */
  label?: string
  capacity: number
  status: TableStatus
  orderId: ID | null
}

export interface Customer extends Entity {
  name: string
  phone: string
  email: string
  registeredAt: string
  accountStatus: 'active' | 'blocked'
  notes: string
  color: string
}

export type EmployeeRole =
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'waiter'
  | 'chef'
  | 'kitchen-staff'
  | 'rider'
  | 'accountant'

export type PayType = 'monthly' | 'daily' | 'hourly'

export interface Employee extends Entity {
  code: string
  name: string
  role: EmployeeRole
  branchId: ID
  phone: string
  email: string
  joinedAt: string
  payType: PayType
  payRate: number
  status: 'active' | 'on-leave' | 'inactive'
  shift: 'morning' | 'evening' | 'night'
  color: string
}

export type TransactionType = 'income' | 'expense' | 'refund'

export interface Transaction extends Entity {
  reference: string
  type: TransactionType
  category: string
  description: string
  amount: number
  method: PaymentMethod
  date: string
  branchId: ID
  status: 'completed' | 'pending'
  /** Who was paid (vendor, landlord, utility company...). */
  payee?: string
  /** Set when the expense was recorded from a recurring schedule. */
  recurringId?: ID
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly'

export interface RecurringExpense extends Entity {
  name: string
  category: string
  payee: string
  amount: number
  frequency: RecurringFrequency
  /** Date (YYYY-MM-DD) the next bill falls due. */
  nextDue: string
  branchId: ID
  method: PaymentMethod
  active: boolean
}

/** When a discount or deal can be used. Empty values mean "no restriction". */
export interface PromoSchedule {
  /** yyyy-mm-dd, inclusive. */
  startDate: string
  endDate: string | null
  branchId: ID | 'all'
  channel: SalesChannel | 'all'
  active: boolean
}

export type DiscountKind = 'percent' | 'fixed'
export type DiscountScope = 'order' | 'category' | 'product'

export interface Discount extends Entity, PromoSchedule {
  name: string
  /** Promo code customers enter online. Empty for discounts staff apply at the POS. */
  code: string
  kind: DiscountKind
  /** Percent off, or rupees off for a fixed discount. */
  value: number
  /** Most a percentage discount can take off, in rupees. 0 = no cap. */
  maxAmount: number
  /** Smallest qualifying amount (order subtotal, or the covered items' total), in rupees. */
  minOrder: number
  scope: DiscountScope
  /** Category or product the discount covers when `scope` is not the whole order. */
  targetId: ID | null
  /** 0 = unlimited. */
  usageLimit: number
  used: number
}

export interface TaxRate extends Entity {
  name: string
  rate: number
  category: string
  inclusive: boolean
  branchId: ID | 'all'
  active: boolean
  appliesTo: string
}

export type IntegrationCategory = 'delivery' | 'payments' | 'accounting' | 'messaging' | 'sms' | 'email'

export interface Integration extends Entity {
  name: string
  category: IntegrationCategory
  description: string
  connected: boolean
  lastSync: string | null
  color: string
  initials: string
}

export type DeviceType =
  | 'pos-terminal'
  | 'receipt-printer'
  | 'kitchen-printer'
  | 'barcode-scanner'
  | 'cash-drawer'
  | 'customer-display'
  | 'kitchen-display'

export interface Device extends Entity {
  name: string
  type: DeviceType
  branchId: ID
  status: 'connected' | 'disconnected' | 'error'
  lastSync: string
  model: string
  ipAddress: string
}

export type SyncStatus = 'pending' | 'failed' | 'synced' | 'conflict'

export interface SyncRecord extends Entity {
  entity: string
  action: 'create' | 'update' | 'delete'
  description: string
  status: SyncStatus
  createdAt: string
  error?: string
}

export interface Plan extends Entity {
  name: string
  planId: PlanId
  priceMonthly: number
  description: string
  features: string[]
  limits: { branches: number; users: number; products: number }
  modules: string[]
  highlight?: boolean
}

export interface AppUser extends Entity {
  name: string
  email: string
  role: RoleId
  branchIds: ID[]
  status: 'active' | 'inactive' | 'invited'
  color: string
}

export type RoleId =
  | 'tenant-owner'
  | 'administrator'
  | 'branch-manager'
  | 'cashier'
  | 'waiter'
  | 'chef'
  | 'rider'
  | 'accountant'

export type PermissionModule =
  | 'dashboard'
  | 'orders'
  | 'delivery'
  | 'website'
  | 'inventory'
  | 'menu'
  | 'recipes'
  | 'finance'
  | 'reports'
  | 'employees'
  | 'customers'
  | 'settings'

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete'

export type PermissionMatrix = Record<PermissionModule, PermissionAction[]>

export interface Role extends Entity {
  name: string
  description: string
  permissions: PermissionMatrix
}

export interface ActivityLog extends Entity {
  userName: string
  action: string
  target: string
  at: string
  type: 'order' | 'inventory' | 'finance' | 'user' | 'menu' | 'system'
}

export interface NotificationItem extends Entity {
  title: string
  body: string
  at: string
  read: boolean
  level: 'info' | 'warning' | 'success' | 'danger'
}

export interface DateRange {
  from: string
  to: string
  preset: 'today' | '7d' | '30d' | 'month'
}

export interface SalesPoint {
  date: string
  label: string
  revenue: number
  orders: number
  expenses: number
  profit: number
}
