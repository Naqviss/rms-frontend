export type ID = string

export interface Entity {
  id: ID
}

export type PlanId = 'starter' | 'professional' | 'enterprise'
export type TenantStatus = 'active' | 'suspended' | 'trial'

export interface Tenant extends Entity {
  name: string
  owner: string
  email: string
  phone: string
  city: string
  branches: number
  plan: PlanId
  status: TenantStatus
  registeredAt: string
  monthlyRevenue: number
  usersCount: number
  ordersThisMonth: number
  color: string
}

export interface Branch extends Entity {
  tenantId: ID
  name: string
  city: string
  address: string
  phone: string
  email: string
  manager: string
  opensAt: string
  closesAt: string
  status: 'open' | 'closed'
  /** Checkout counters (tills) at the store. */
  counters: number
}

export interface ProductCategory extends Entity {
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

/** A set of choices offered at the till, e.g. "Pack: Half dozen / Dozen / Tray" or "Add-ons: gift wrap". */
export interface ProductOptionGroup {
  id: ID
  name: string
  /** `single`: exactly one choice, the first is preselected. `multiple`: any number, none by default. */
  type: 'single' | 'multiple'
  options: ProductOption[]
}

/** `unit`: rung up by the piece or pack. `weight`: loose goods priced per kg and weighed at the counter. */
export type SoldBy = 'unit' | 'weight'

export interface Product extends Entity {
  name: string
  sku: string
  /** EAN/UPC printed on the pack; scanned at the till. Empty for loose goods weighed in store. */
  barcode: string
  brand: string
  /** Pack size shown on the shelf label, e.g. "1 kg", "500 ml", "Pack of 6". "per kg" for loose goods. */
  packSize: string
  soldBy: SoldBy
  categoryId: ID
  description: string
  image: string
  basePrice: number
  costPrice: number
  /** Tax rate from Tax Management; whether it sits inside the price or on top follows that rate's `inclusive`. Null when untaxed. */
  taxRateId: ID | null
  available: boolean
  featured: boolean
  optionGroups: ProductOptionGroup[]
  branchIds: ID[]
}

export type StockStatus = 'in-stock' | 'low' | 'out' | 'expiring'

export interface InventoryItem extends Entity {
  name: string
  sku: string
  category: string
  quantity: number
  unit: string
  minStock: number
  costPerUnit: number
  branchId: ID
  vendorId: ID
  expiryDate: string | null
  /** `retail`: packed goods on the shelf. `loose`: weighed goods. `supplies`: bags, receipt rolls and other store consumables. */
  kind: 'retail' | 'loose' | 'supplies'
  /** Catalogue product this stock is sold as; null for store supplies. */
  productId: ID | null
  image: string
}

export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'wastage'

export interface StockMovement extends Entity {
  itemId: ID
  itemName: string
  type: MovementType
  quantity: number
  unit: string
  branchId: ID
  date: string
  note: string
  by: string
}

export interface Vendor extends Entity {
  name: string
  category: string
  contactPerson: string
  phone: string
  email: string
  address: string
  outstanding: number
  rating: number
  onTimeRate: number
  status: 'active' | 'inactive'
  color: string
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled'

export interface PurchaseOrder extends Entity {
  vendorId: ID
  vendorName: string
  items: { itemId: ID; name: string; quantity: number; unit: string; unitCost: number }[]
  total: number
  status: PurchaseOrderStatus
  createdAt: string
  branchId: ID
}

export interface VendorPayment extends Entity {
  vendorId: ID
  amount: number
  date: string
  method: PaymentMethod
  reference: string
}

export type OrderType = 'walk-in' | 'pickup' | 'delivery' | 'online'
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out-for-delivery'
  | 'completed'
  | 'cancelled'
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'refunded'
export type PaymentMethod = 'cash' | 'card' | 'online' | 'split'

export interface OrderItem {
  productId: ID
  name: string
  quantity: number
  unitPrice: number
  /** Names of the chosen options, e.g. ["Tray (30)"]. */
  options?: string[]
  /** Set for loose goods weighed at the counter: `quantity` is then in kg and `unitPrice` is per kg. */
  unit?: 'kg'
  /** Set when the line is a deal; `productId` then holds the deal id. */
  dealId?: ID
}

export type SalesChannel = 'in-store' | 'pickup' | 'own-delivery' | 'foodpanda' | 'website'

export type DeliveryStatus = 'unassigned' | 'assigned' | 'picked-up' | 'delivered' | 'failed'

export interface DeliveryInfo {
  address: string
  area: string
  phone: string
  fee: number
  distanceKm: number
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
  vehicle: 'bike' | 'scooter' | 'car'
  branchId: ID
  status: RiderStatus
}

export type FoodpandaAcceptance = 'awaiting' | 'accepted' | 'rejected'

export interface FoodpandaInfo {
  externalId: string
  acceptance: FoodpandaAcceptance
  prepMinutes: number
  commissionRate: number
  commission: number
  netPayout: number
  riderName: string | null
  rejectReason?: string
}

export interface WebsiteInfo {
  fulfillment: 'delivery' | 'pickup'
  acceptance: FoodpandaAcceptance
  device: 'mobile' | 'desktop'
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

export interface Customer extends Entity {
  name: string
  phone: string
  email: string
  city: string
  registeredAt: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  lastVisit: string
  segment: 'vip' | 'regular' | 'new' | 'at-risk'
  authMethod: 'phone-otp' | 'email' | 'google' | 'walk-in'
  accountStatus: 'active' | 'blocked'
  notes: string
  favoriteItems: string[]
  color: string
}

export type EmployeeRole =
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'salesman'
  | 'stock-keeper'
  | 'packer'
  | 'rider'
  | 'accountant'

export type PayType = 'monthly' | 'daily' | 'hourly'
export type CommissionType = 'none' | 'per-order' | 'percentage'

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
  commissionType: CommissionType
  commissionRate: number
  status: 'active' | 'on-leave' | 'inactive'
  shift: 'morning' | 'evening' | 'night'
  attendanceRate: number
  performance: number
  ordersHandled: number
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
  channel?: SalesChannel
  /** Who was paid (vendor, landlord, utility company...). */
  payee?: string
  /** Set when the expense was recorded from a recurring schedule. */
  recurringId?: ID
  /** Sales tax collected inside `amount` (income only). */
  tax?: number
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

export interface ExpenseBudget extends Entity {
  category: string
  /** Monthly limit across all branches. */
  monthly: number
}

/** When a discount or deal can be used. Empty values mean "no restriction". */
export interface PromoSchedule {
  /** yyyy-mm-dd, inclusive. */
  startDate: string
  endDate: string | null
  /** Weekdays it runs on (0 = Sunday). Empty = every day. */
  days: number[]
  /** "HH:mm" window, e.g. a 16:00-20:00 evening offer. Both empty = all day. */
  startTime: string
  endTime: string
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

export interface DealItem {
  productId: ID
  quantity: number
}

/** A bundle of products sold together at one price, e.g. a monthly ration pack. */
export interface Deal extends Entity, PromoSchedule {
  name: string
  description: string
  image: string
  items: DealItem[]
  price: number
  featured: boolean
  sold: number
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
  | 'label-printer'
  | 'barcode-scanner'
  | 'weighing-scale'
  | 'cash-drawer'
  | 'customer-display'

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
  attempts: number
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
  lastActive: string
  color: string
}

export type RoleId =
  | 'tenant-owner'
  | 'administrator'
  | 'branch-manager'
  | 'cashier'
  | 'stock-keeper'
  | 'packer'
  | 'rider'
  | 'accountant'

export type PermissionModule =
  | 'dashboard'
  | 'orders'
  | 'delivery'
  | 'website'
  | 'inventory'
  | 'catalog'
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
  type: 'order' | 'inventory' | 'finance' | 'user' | 'catalog' | 'system'
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
