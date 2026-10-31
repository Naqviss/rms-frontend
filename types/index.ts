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
  seats: number
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

export type DietaryLabel = 'halal' | 'vegetarian' | 'spicy' | 'gluten-free'

export interface Product extends Entity {
  name: string
  sku: string
  categoryId: ID
  description: string
  image: string
  basePrice: number
  costPrice: number
  /** Tax rate from Tax Management; whether it sits inside the price or on top follows that rate's `inclusive`. Null when untaxed. */
  taxRateId: ID | null
  available: boolean
  featured: boolean
  dietary: DietaryLabel[]
  optionGroups: ProductOptionGroup[]
  ingredients: string[]
  branchIds: ID[]
  menuId: ID
  schedule: 'all-day' | 'breakfast' | 'lunch' | 'dinner'
}

export interface MenuGroup extends Entity {
  name: string
  description: string
  active: boolean
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
  kind: 'ingredient' | 'raw-material' | 'packaging'
  image: string
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
export type PaymentMethod = 'cash' | 'card' | 'online' | 'split'

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
  tableId: ID | null
  createdAt: string
  notes: string
  source: string
  channel?: SalesChannel
  delivery?: DeliveryInfo
  foodpanda?: FoodpandaInfo
  website?: WebsiteInfo
}

export type TableStatus = 'available' | 'occupied' | 'reserved'

export interface DiningTable extends Entity {
  branchId: ID
  number: number
  capacity: number
  status: TableStatus
  x: number
  y: number
  shape: 'round' | 'square' | 'wide'
  orderId: ID | null
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
  | 'waiter'
  | 'chef'
  | 'kitchen-staff'
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

/** One ingredient used to make a single serving of a menu item. */
export interface RecipeIngredient {
  id: ID
  /** Inventory SKU; when set the cost follows the current stock price. */
  sku: string | null
  name: string
  quantity: number
  unit: string
  /** Price per `unit` for ingredients that are not tracked in inventory. */
  costPerUnit: number
  /** Only recipe owners see what this is; everyone else sees a code name and the quantity. */
  secret?: boolean
}

export interface RecipeStep {
  id: ID
  text: string
  /** Minutes this step takes; 0 when it is not timed. */
  minutes: number
}

/** Who besides the recipe owners can open the kitchen card. */
export type RecipeVisibility = 'owner' | 'managers' | 'kitchen'

/** A non-ingredient cost spent on every serving: packaging, gas, labour minutes and so on. */
export interface RecipeExtra {
  id: ID
  label: string
  amount: number
}

/** Costing sheet for one menu item. The record id equals the product id. */
export interface Recipe extends Entity {
  productId: ID
  ingredients: RecipeIngredient[]
  extras: RecipeExtra[]
  /** Buffer for trimming, spillage and spoilage, as a percentage of ingredient cost. */
  wastagePct: number
  notes: string
  updatedAt: string
  // Recipe book fields. Sheets created from Item Costing do not have them yet.
  method?: RecipeStep[]
  prepMinutes?: number
  cookMinutes?: number
  /** Servings the kitchen usually cooks in one go; the kitchen card scales to it. */
  batchServings?: number
  allergens?: string[]
  visibility?: RecipeVisibility
  version?: number
  updatedBy?: string
}

export type RecipeAccessAction = 'viewed' | 'edited' | 'printed' | 'unlocked' | 'unlock-failed'

/** One line of the recipe access log: who looked at or changed which recipe, and when. */
export interface RecipeAccessEvent extends Entity {
  recipeId: ID | null
  itemName: string
  userName: string
  role: RoleId
  action: RecipeAccessAction
  at: string
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
  | 'waiter'
  | 'chef'
  | 'rider'
  | 'accountant'

export type PermissionModule =
  | 'dashboard'
  | 'orders'
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
