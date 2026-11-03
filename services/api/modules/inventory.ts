/**
 * Inventory — `/api/inventory/items` (tenant-wide catalogue), `/api/inventory/balances` and
 * `/api/inventory/movements` (both need exactly one X-Branch-Id), `/opening`, `/adjustments`,
 * `/balances/{itemId}/levels`; supplier links via `/api/vendors/{id}/items`.
 *
 *  - The UI stock row is per branch, so every active item is listed once per branch in scope,
 *    joined with that branch's balance (no balance yet = quantity 0). Row id: `<itemId>@<branchId>`.
 *  - Quantity edits become ledger movements: opening stock when the branch has no balance yet,
 *    otherwise an audited adjustment of the difference. Each user action gets one operation_id.
 *  - `minStock` ↔ the branch reorder level (what the server's `is_low` uses).
 *  - Name, SKU and unit cost are item-wide: editing them on one branch row changes every branch.
 *    The base unit is immutable. "remove" deactivates the item for every branch (no DELETE).
 */
import { api, operationId } from '@/services/api/client'
import { acrossBranches, apiRepository, primaryBranchId, UnsupportedOperationError } from '@/services/api/adapter'
import { compact, fromMinor, localized, stamp, text, toMinor } from '@/services/api/mappers'
import { linkSupplier, supplierByItem, unlinkSupplier } from '@/services/api/modules/vendors'
import type {
  AdjustStockDto,
  BalanceResponseDto,
  CreateInventoryItemDto,
  InventoryItemResponseDto,
  MovementResponseDto,
  OpeningStockDto,
  StockLevelsDto,
  UpdateInventoryItemDto,
} from '@/services/api/generated/schemas'
import type { InventoryItem, MovementType, StockMovement } from '@/types'

const tenantWide = { branchId: null } as const

type Unit = CreateInventoryItemDto['base_unit']
const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'pcs', 'dozen']
const UNIT_ALIASES: Record<string, Unit> = { pc: 'pcs', piece: 'pcs', pieces: 'pcs', litre: 'l', liter: 'l', ltr: 'l', gram: 'g', grams: 'g' }

function unitOf(value: string): Unit {
  const v = value.trim().toLowerCase()
  const unit = (UNITS as string[]).includes(v) ? (v as Unit) : UNIT_ALIASES[v]
  if (!unit) throw new Error(`Unit "${value}" is not supported. Use one of: ${UNITS.join(', ')}`)
  return unit
}

/** Decimal string for the wire; quantities are exact decimals, never floats. */
const decimal = (n: number) => String(Math.round(n * 1000) / 1000)
const num = (s: string | null | undefined) => (s == null || s === '' ? 0 : Number(s))

// ---------------------------------------------------------------------------------------------
// Stock rows (item × branch)
// ---------------------------------------------------------------------------------------------

interface StockRow {
  item: InventoryItemResponseDto
  branchId: string
  /** Branch balance, exact decimal; '0' when the branch has none yet. */
  quantity: string
  reorderLevel: string | null
  hasBalance: boolean
  vendorId: string
  vendorItemId: string | null
}

const rowId = (itemId: string, branchId: string) => `${itemId}@${branchId}`
export function parseRowId(id: string): { itemId: string; branchId: string | null } {
  const at = id.indexOf('@')
  return at < 0 ? { itemId: id, branchId: null } : { itemId: id.slice(0, at), branchId: id.slice(at + 1) }
}

const itemName = (d: InventoryItemResponseDto) => d.name || text(d.name_i18n) || d.sku || ''

const rowToUi = (r: StockRow): InventoryItem => ({
  id: rowId(r.item.id, r.branchId),
  name: itemName(r.item),
  sku: r.item.sku ?? '',
  quantity: num(r.quantity),
  unit: r.item.base_unit,
  minStock: num(r.reorderLevel ?? r.item.default_reorder_level),
  costPerUnit: fromMinor(r.item.unit_cost_minor),
  branchId: r.branchId,
  vendorId: r.vendorId,
})

const INVENTORY_LOCAL: (keyof InventoryItem)[] = ['unit']

/** Opening stock if the branch has no balance yet, otherwise an adjustment by `delta`. Returns the new balance. */
async function moveStock(
  row: Pick<StockRow, 'hasBalance'> & { itemId: string; branchId: string },
  delta: number,
  reason: string,
  note?: string,
): Promise<MovementResponseDto> {
  const opts = { branchId: row.branchId }
  if (!row.hasBalance && delta > 0) {
    const body: OpeningStockDto = { inventory_item_id: row.itemId, quantity: decimal(delta), operation_id: operationId() }
    return api.post<MovementResponseDto>('/inventory/opening', body, opts)
  }
  const body: AdjustStockDto = {
    inventory_item_id: row.itemId,
    direction: delta < 0 ? 'out' : 'in',
    quantity: decimal(Math.abs(delta)),
    reason_code: reason,
    operation_id: operationId(),
    client_occurred_at: new Date().toISOString(),
    ...(note ? { note } : {}),
  }
  return api.post<MovementResponseDto>('/inventory/adjustments', body, opts)
}

/** Items deactivated in this session, so bulk-removing several branch rows of one item patches it once. */
const deactivated = new Set<string>()

export const inventory = apiRepository<InventoryItem, StockRow>({
  name: 'Inventory',
  toUi: rowToUi,
  list: async () => {
    const [items, suppliers] = await Promise.all([
      api.listAll<InventoryItemResponseDto>('/inventory/items', { ...tenantWide, query: { is_active: true } }),
      supplierByItem().catch(() => new Map<string, never>()),
    ])
    deactivated.clear()
    return acrossBranches(async (branchId) => {
      const balances = await api.listAll<BalanceResponseDto>('/inventory/balances', { branchId })
      const byItem = new Map(balances.map((b) => [b.inventory_item_id, b]))
      return items.map((item): StockRow => {
        const b = byItem.get(item.id)
        const s = suppliers.get(item.id)
        return {
          item,
          branchId,
          quantity: b?.quantity ?? '0',
          reorderLevel: b?.reorder_level ?? null,
          hasBalance: !!b,
          vendorId: s?.vendorId ?? '',
          vendorItemId: s?.link.id ?? null,
        }
      })
    })
  },
  create: async (input) => {
    const branchId = input.branchId || primaryBranchId()
    if (!branchId) throw new UnsupportedOperationError('Inventory', 'create stock without a branch')
    const body: CreateInventoryItemDto = {
      name: localized(input.name),
      base_unit: unitOf(input.unit),
      ...compact({
        sku: input.sku || undefined,
        default_reorder_level: input.minStock > 0 ? decimal(input.minStock) : undefined,
        unit_cost_minor: input.costPerUnit > 0 ? toMinor(input.costPerUnit) : undefined,
      }),
    }
    const item = await api.post<InventoryItemResponseDto>('/inventory/items', body, tenantWide)
    const row: StockRow = { item, branchId, quantity: '0', reorderLevel: null, hasBalance: false, vendorId: '', vendorItemId: null }
    if (input.quantity > 0) {
      const m = await moveStock({ itemId: item.id, branchId, hasBalance: false }, input.quantity, 'opening')
      Object.assign(row, { quantity: m.balance_after, hasBalance: true })
    }
    if (input.vendorId) {
      const link = await linkSupplier(input.vendorId, item.id)
      Object.assign(row, { vendorId: input.vendorId, vendorItemId: link.id })
    }
    return row
  },
  update: async (id, patch, current) => {
    if (!current) throw new UnsupportedOperationError('Inventory', 'edit an item that is not loaded')
    const before = current.ui
    const row: StockRow = { ...current.dto }
    const changed = (k: keyof InventoryItem) => patch[k] !== undefined && patch[k] !== before[k]
    let touched = false

    const itemBody: UpdateInventoryItemDto = {
      expected_version: row.item.version,
      ...compact({
        name: changed('name') ? localized(patch.name!) : undefined,
        sku: changed('sku') ? patch.sku || null : undefined,
        unit_cost_minor: changed('costPerUnit') ? toMinor(patch.costPerUnit) : undefined,
      }),
    }
    if (Object.keys(itemBody).length > 1) {
      row.item = await api.patch<InventoryItemResponseDto>(`/inventory/items/${row.item.id}`, itemBody, tenantWide)
      touched = true
    }

    if (changed('minStock')) {
      const body: StockLevelsDto = { reorder_level: decimal(patch.minStock!) }
      await api.put(`/inventory/balances/${row.item.id}/levels`, body, { branchId: row.branchId })
      row.reorderLevel = body.reorder_level ?? null
      touched = true
    }

    if (changed('quantity')) {
      const delta = patch.quantity! - before.quantity
      const m = await moveStock({ itemId: row.item.id, branchId: row.branchId, hasBalance: row.hasBalance }, delta, 'count_correction')
      Object.assign(row, { quantity: m.balance_after, hasBalance: true })
      touched = true
    }

    if (changed('vendorId')) {
      if (patch.vendorId) {
        const link = await linkSupplier(patch.vendorId, row.item.id)
        if (row.vendorId && row.vendorItemId && row.vendorId !== patch.vendorId) await unlinkSupplier(row.vendorId, row.vendorItemId)
        Object.assign(row, { vendorId: patch.vendorId, vendorItemId: link.id })
      } else if (row.vendorId && row.vendorItemId) {
        await unlinkSupplier(row.vendorId, row.vendorItemId)
        Object.assign(row, { vendorId: '', vendorItemId: null })
      }
      touched = true
    }

    if (!touched) {
      const local = INVENTORY_LOCAL.filter(changed)
      if (local.length) throw new UnsupportedOperationError('Inventory', `change ${local.join(', ')}`)
    }
    return row
  },
  remove: async (id, current) => {
    const { itemId } = parseRowId(id)
    if (deactivated.has(itemId)) return
    if (!current) throw new UnsupportedOperationError('Inventory', 'remove an item that is not loaded')
    const body: UpdateInventoryItemDto = { expected_version: current.dto.item.version, is_active: false }
    await api.patch(`/inventory/items/${itemId}`, body, tenantWide)
    deactivated.add(itemId)
  },
})

// ---------------------------------------------------------------------------------------------
// Stock movement ledger
// ---------------------------------------------------------------------------------------------

type MovementRow = MovementResponseDto & { branch_id: string; item: InventoryItemResponseDto | undefined }

const MOVEMENT_TYPE: Record<MovementResponseDto['type'], MovementType> = {
  opening: 'adjustment',
  adjustment_in: 'adjustment',
  adjustment_out: 'adjustment',
  count_correction: 'adjustment',
  sale: 'consumption',
  sale_reversal: 'consumption',
  purchase_receipt: 'purchase',
  waste: 'wastage',
  transfer_in: 'transfer',
  transfer_out: 'transfer',
}

const movementToUi = (m: MovementRow): StockMovement => ({
  id: m.id,
  itemId: rowId(m.inventory_item_id, m.branch_id),
  itemName: m.item ? itemName(m.item) : '',
  type: MOVEMENT_TYPE[m.type] ?? 'adjustment',
  quantity: num(m.quantity_delta),
  unit: m.item?.base_unit ?? '',
  branchId: m.branch_id,
  date: stamp(m.occurred_at),
  note: m.reason_code ?? '',
})

/** Every item including inactive ones, so old ledger lines still show a name. */
const itemsById = async () =>
  new Map((await api.listAll<InventoryItemResponseDto>('/inventory/items', tenantWide)).map((i) => [i.id, i]))

/** Reason code sent for each UI movement type, with its direction. */
const MOVE_REASON: Partial<Record<MovementType, { reason: string; sign: 1 | -1 | 0 }>> = {
  purchase: { reason: 'purchase', sign: 1 },
  wastage: { reason: 'waste', sign: -1 },
  consumption: { reason: 'consumption', sign: -1 },
  adjustment: { reason: 'adjustment', sign: 0 },
}

export const stockMovements = apiRepository<StockMovement, MovementRow>({
  name: 'Stock movements',
  toUi: movementToUi,
  list: async () => {
    const items = await itemsById()
    return acrossBranches(async (branchId) => {
      // Newest first; capped so a long ledger does not stall the page.
      const rows = await api.listAll<MovementResponseDto>('/inventory/movements', { branchId }, 5)
      return rows.map((m) => ({ ...m, branch_id: branchId, item: items.get(m.inventory_item_id) }))
    })
  },
  create: async (input) => {
    const parsed = parseRowId(input.itemId)
    const branchId = parsed.branchId ?? input.branchId ?? primaryBranchId()
    const rule = MOVE_REASON[input.type]
    if (!rule || !branchId) throw new UnsupportedOperationError('Stock movements', `record a ${input.type}`)
    const delta = rule.sign === 0 ? input.quantity : rule.sign * Math.abs(input.quantity)
    if (!delta) throw new Error('Quantity must not be zero')
    const cached = inventory.cached(rowId(parsed.itemId, branchId))
    const hasBalance = cached ? cached.dto.hasBalance : true
    const m = await moveStock({ itemId: parsed.itemId, branchId, hasBalance }, delta, rule.reason, input.note || undefined)
    return { ...m, branch_id: branchId, item: cached?.dto.item }
  },
})
