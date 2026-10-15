'use client'

import { useResource } from '@/hooks/use-resource'
import * as s from '@/services'

export const useTenants = () => useResource('tenants', s.tenantService)
export const useBranches = () => useResource('branches', s.branchService)
export const useCategories = () => useResource('categories', s.categoryService)
export const useMenuGroups = () => useResource('menu-groups', s.menuGroupService)
export const useProducts = () => useResource('products', s.productService)
export const useInventory = () => useResource('inventory', s.inventoryService)
export const useStockMovements = () => useResource('stock-movements', s.stockMovementService)
export const useVendors = () => useResource('vendors', s.vendorService)
export const usePurchaseOrders = () => useResource('purchase-orders', s.purchaseOrderService)
export const useVendorPayments = () => useResource('vendor-payments', s.vendorPaymentService)
export const useCustomers = () => useResource('customers', s.customerService)
export const useEmployees = () => useResource('employees', s.employeeService)
export const useOrders = () => useResource('orders', s.orderService)
export const useRiders = () => useResource('riders', s.riderService)
export const useTables = () => useResource('tables', s.tableService)
export const useTransactions = () => useResource('transactions', s.transactionService)
export const useTaxRates = () => useResource('tax-rates', s.taxService)
export const useIntegrations = () => useResource('integrations', s.integrationService)
export const useDevices = () => useResource('devices', s.deviceService)
export const useSyncRecords = () => useResource('sync-records', s.syncService)
export const useAppUsers = () => useResource('users', s.userService)
export const useRoles = () => useResource('roles', s.roleService)
