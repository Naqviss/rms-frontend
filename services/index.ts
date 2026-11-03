import * as menuApi from '@/services/api/modules/menu'
import * as taxApi from '@/services/api/modules/tax'
import * as discountApi from '@/services/api/modules/discounts'
import * as inventoryApi from '@/services/api/modules/inventory'
import * as vendorApi from '@/services/api/modules/vendors'
import * as orderApi from '@/services/api/modules/orders'
import * as customerApi from '@/services/api/modules/customers'
import * as deliveryApi from '@/services/api/modules/delivery'
import * as financeApi from '@/services/api/modules/finance'
import * as staffApi from '@/services/api/modules/staff'
import * as platformApi from '@/services/api/modules/platform'

/** RMS API adapters behind the repository contract. UI code only ever imports from here. */
export const tenantService = platformApi.tenants
export const branchService = platformApi.branches
export const categoryService = menuApi.categories
export const menuGroupService = menuApi.menuGroups
export const productService = menuApi.products
export const inventoryService = inventoryApi.inventory
export const stockMovementService = inventoryApi.stockMovements
export const vendorService = vendorApi.vendors
export const purchaseOrderService = vendorApi.purchaseOrders
export const vendorPaymentService = vendorApi.vendorPayments
export const customerService = customerApi.customers
export const employeeService = staffApi.employees
export const orderService = orderApi.orders
export const riderService = deliveryApi.riders
export const tableService = orderApi.tables
export const transactionService = financeApi.transactions
export const taxService = taxApi.taxRates
export const discountService = discountApi.discounts
export const dealService = discountApi.deals
export const recurringExpenseService = financeApi.recurringExpenses
export const budgetService = financeApi.budgets
export const recipeService = inventoryApi.recipes
export const recipeAccessService = inventoryApi.recipeAccess
export const integrationService = platformApi.integrations
export const deviceService = platformApi.devices
export const syncService = platformApi.syncRecords
export const userService = platformApi.users
export const roleService = platformApi.roles
