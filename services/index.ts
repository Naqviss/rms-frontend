import { createRepository } from '@/services/repositories'
import { branches, tenants } from '@/mocks/branches'
import { categories, products } from '@/mocks/catalog'
import { inventoryItems, stockMovements } from '@/mocks/inventory'
import { purchaseOrders, vendorPayments, vendors } from '@/mocks/vendors'
import { customers } from '@/mocks/customers'
import { employees } from '@/mocks/employees'
import { orders, riders } from '@/mocks/orders'
import { expenseBudgets, recurringExpenses, taxRates, transactions } from '@/mocks/finance'
import { deals, discounts } from '@/mocks/promotions'
import { appUsers, devices, integrations, roles, syncRecords } from '@/mocks/platform'

export const tenantService = createRepository('tenants', tenants)
export const branchService = createRepository('branches', branches)
export const categoryService = createRepository('categories', categories)
export const productService = createRepository('products', products)
export const inventoryService = createRepository('inventory', inventoryItems)
export const stockMovementService = createRepository('stock-movements', stockMovements)
export const vendorService = createRepository('vendors', vendors)
export const purchaseOrderService = createRepository('purchase-orders', purchaseOrders)
export const vendorPaymentService = createRepository('vendor-payments', vendorPayments)
export const customerService = createRepository('customers', customers)
export const employeeService = createRepository('employees', employees)
export const orderService = createRepository('orders', orders)
export const riderService = createRepository('riders', riders)
export const transactionService = createRepository('transactions', transactions)
export const taxService = createRepository('tax-rates', taxRates)
export const discountService = createRepository('discounts', discounts)
export const dealService = createRepository('deals', deals)
export const recurringExpenseService = createRepository('recurring-expenses', recurringExpenses)
export const budgetService = createRepository('expense-budgets', expenseBudgets)
export const integrationService = createRepository('integrations', integrations)
export const deviceService = createRepository('devices', devices)
export const syncService = createRepository('sync-records', syncRecords)
export const userService = createRepository('users', appUsers)
export const roleService = createRepository('roles', roles)
