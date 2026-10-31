import { createRepository } from '@/services/repositories'
import { branches, tenants } from '@/mocks/branches'
import { categories, menuGroups, products } from '@/mocks/menu'
import { inventoryItems, stockMovements } from '@/mocks/inventory'
import { purchaseOrders, vendorPayments, vendors } from '@/mocks/vendors'
import { customers } from '@/mocks/customers'
import { employees } from '@/mocks/employees'
import { orders, riders, tables } from '@/mocks/orders'
import { expenseBudgets, recurringExpenses, taxRates, transactions } from '@/mocks/finance'
import { recipeAccessLog, recipes } from '@/mocks/costing'
import { deals, discounts } from '@/mocks/promotions'
import { appUsers, devices, integrations, roles, syncRecords } from '@/mocks/platform'

export const tenantService = createRepository('tenants', tenants)
export const branchService = createRepository('branches', branches)
export const categoryService = createRepository('categories', categories)
export const menuGroupService = createRepository('menu-groups', menuGroups)
export const productService = createRepository('products', products, '-v2')
export const inventoryService = createRepository('inventory', inventoryItems)
export const stockMovementService = createRepository('stock-movements', stockMovements)
export const vendorService = createRepository('vendors', vendors)
export const purchaseOrderService = createRepository('purchase-orders', purchaseOrders)
export const vendorPaymentService = createRepository('vendor-payments', vendorPayments)
export const customerService = createRepository('customers', customers)
export const employeeService = createRepository('employees', employees)
export const orderService = createRepository('orders', orders, '-v3')
export const riderService = createRepository('riders', riders)
export const tableService = createRepository('tables', tables)
export const transactionService = createRepository('transactions', transactions, '-v2')
export const taxService = createRepository('tax-rates', taxRates)
export const discountService = createRepository('discounts', discounts)
export const dealService = createRepository('deals', deals)
export const recurringExpenseService = createRepository('recurring-expenses', recurringExpenses)
export const budgetService = createRepository('expense-budgets', expenseBudgets)
export const recipeService = createRepository('recipes', recipes, '-v2')
export const recipeAccessService = createRepository('recipe-access', recipeAccessLog)
export const integrationService = createRepository('integrations', integrations)
export const deviceService = createRepository('devices', devices)
export const syncService = createRepository('sync-records', syncRecords)
export const userService = createRepository('users', appUsers)
export const roleService = createRepository('roles', roles)
