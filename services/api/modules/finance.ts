/**
 * Finance — expenses, recurring expense schedules and the unified transaction ledger.
 *
 *   GET/POST  /api/finance/expense-categories           category id ↔ the UI's category name
 *   GET/POST  /api/finance/expenses, PATCH /{id}         expense rows of the ledger
 *   POST      /api/finance/expenses/{id}/pay | /void     "Mark as paid" / delete
 *   GET       /api/finance/cash-accounts                 register a cash payment leaves
 *   GET       /api/payments (X-Branch-Id, per branch)    income (captured payments) and refunds
 *   GET/POST  /api/finance/recurring-expenses, PATCH /{id}, POST /{id}/pause | /resume
 *   GET       /api/vendors                               vendor id ↔ the UI's free-text payee
 *
 * The UI `Transaction` is a unified ledger. The API has no such resource, so it is assembled from
 * what the backend exposes: expenses → `expense`; branch payments → `income` (pending until
 * captured); each payment refund → `refund`. Only expense rows can be written; income and refunds
 * are recorded by the POS (orders/payments) and are read-only here.
 *
 * Budgets have no backend API and stay unavailable.
 */
import { api, operationId } from '@/services/api/client'
import { acrossBranches, apiRepository, unavailableRepository, UnsupportedOperationError, versionOf, type Cached } from '@/services/api/adapter'
import { compact, fromMinor, localized, stamp, text, toMinor } from '@/services/api/mappers'
import type {
  CashAccountResponseDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateRecurringExpenseDto,
  ExpectedVersionDto,
  ExpenseCategoryResponseDto,
  ExpenseResponseDto,
  PayExpenseDto,
  PaymentResponseDto,
  RecurringExpenseResponseDto,
  RefundResponseDto,
  UpdateExpenseDto,
  UpdateRecurringExpenseDto,
  VendorResponseDto,
  VoidExpenseDto,
} from '@/services/api/generated/schemas'
import type { ExpenseBudget, PaymentMethod, RecurringExpense, RecurringFrequency, Transaction } from '@/types'

type ApiMethod = NonNullable<ExpenseResponseDto['payment_method']>

/** Local calendar date (YYYY-MM-DD). */
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ───────────────────────── lookups ───────────────────────── */

let categories: ExpenseCategoryResponseDto[] = []
let categoriesLoaded: Promise<void> | null = null

const categoryLabel = (c: ExpenseCategoryResponseDto) => c.name || text(c.name_i18n) || c.code

/** Tenant expense categories (tenant-wide configuration), cached until `force`. */
export function loadExpenseCategories(force = false): Promise<ExpenseCategoryResponseDto[]> {
  if (force || !categoriesLoaded) {
    categoriesLoaded = api.listAll<ExpenseCategoryResponseDto>('/finance/expense-categories', { branchId: null }).then((rows) => {
      categories = rows
    })
    categoriesLoaded.catch(() => (categoriesLoaded = null))
  }
  return categoriesLoaded.then(() => categories)
}

const categoryName = (id: string) => {
  const c = categories.find((x) => x.id === id)
  return c ? categoryLabel(c) : ''
}

const codeFrom = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `category_${Date.now().toString(36)}`

/**
 * Category id for a UI category name. The UI picks from a fixed list of names; when the tenant has
 * no category with that name or code yet, it is created (POST /finance/expense-categories).
 */
export async function expenseCategoryId(name: string): Promise<string> {
  const label = name.trim() || 'Other'
  const rows = await loadExpenseCategories()
  const key = label.toLowerCase()
  const hit = rows.find((c) => categoryLabel(c).toLowerCase() === key || c.code.toLowerCase() === codeFrom(label))
  if (hit) return hit.id
  const body: CreateExpenseCategoryDto = { code: codeFrom(label), name: localized(label) }
  const created = await api.post<ExpenseCategoryResponseDto>('/finance/expense-categories', body, { branchId: null })
  categories = [...categories, created]
  return created.id
}

let vendors: VendorResponseDto[] = []

/** Vendor names for payees. Optional: without vendor read access payees are simply blank. */
async function loadVendors() {
  try {
    vendors = await api.listAll<VendorResponseDto>('/vendors', { branchId: null })
  } catch {
    vendors = []
  }
}

const vendorName = (id: string | null | undefined) => (id ? (vendors.find((v) => v.id === id)?.name ?? '') : '')
/** The API stores a vendor reference, not free text: a payee that is not a known vendor is not sent. */
const vendorIdFor = (payee: string | undefined) => {
  const key = payee?.trim().toLowerCase()
  return key ? vendors.find((v) => v.name.toLowerCase() === key)?.id : undefined
}

/* ───────────────────────── value maps ───────────────────────── */

const methodToUi = (m: string | null | undefined): PaymentMethod =>
  m === 'card' ? 'card' : m === 'bank_transfer' || m === 'external_platform' || m === 'other' ? 'online' : 'cash'

const methodToApi = (m: PaymentMethod | undefined): ApiMethod =>
  m === 'card' ? 'card' : m === 'online' ? 'bank_transfer' : m === 'split' ? 'other' : 'cash'

/** The register a cash payment leaves: the branch's default open cash account. */
export async function cashAccountFor(branchId: string | null | undefined): Promise<string> {
  const rows = await api.listAll<CashAccountResponseDto>('/finance/cash-accounts', { branchId: null, query: { status: 'open' } })
  const mine = rows.filter((a) => !branchId || a.branch_id === branchId)
  const account = mine.find((a) => a.is_default) ?? mine[0]
  if (!account) throw new Error('No open cash register for this branch. Pay by card or bank transfer instead.')
  return account.id
}

/* ───────────────────────── transactions ───────────────────────── */

type LedgerRow =
  | { kind: 'expense'; version: number; expense: ExpenseResponseDto }
  | { kind: 'payment'; version: number; payment: PaymentResponseDto }
  | { kind: 'refund'; version: number; refund: RefundResponseDto; payment: PaymentResponseDto }

const short = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase()

const expenseRow = (expense: ExpenseResponseDto): LedgerRow => ({ kind: 'expense', version: expense.version, expense })

function ledgerToUi(row: LedgerRow): Transaction {
  if (row.kind === 'expense') {
    const d = row.expense
    const category = categoryName(d.category_id)
    return {
      id: d.id,
      reference: `EXP-${short(d.id)}`,
      type: 'expense',
      category,
      description: d.description || category,
      amount: fromMinor(d.amount_minor),
      method: methodToUi(d.payment_method),
      // expense_date is a calendar day; the record's creation time keeps rows ordered within it.
      date: `${d.expense_date}T${stamp(d.created_at).slice(11) || '00:00:00'}`,
      branchId: d.branch_id ?? '',
      status: d.status === 'paid' ? 'completed' : 'pending',
      payee: vendorName(d.vendor_id) || undefined,
      recurringId: d.recurring_expense_id ?? undefined,
    }
  }
  if (row.kind === 'payment') {
    const p = row.payment
    return {
      id: p.id,
      reference: `PAY-${short(p.id)}`,
      type: 'income',
      category: 'Sales',
      description: `${p.method_label || p.method} payment`,
      amount: fromMinor(p.amount_minor),
      method: methodToUi(p.method),
      date: stamp(p.captured_at ?? p.created_at),
      branchId: p.branch_id,
      status: p.status === 'pending' || p.status === 'authorized' ? 'pending' : 'completed',
    }
  }
  const r = row.refund
  return {
    id: r.id,
    reference: `REF-${short(r.id)}`,
    type: 'refund',
    category: 'Refund',
    description: r.reason_code,
    amount: fromMinor(r.amount_minor),
    method: methodToUi(row.payment.method),
    date: stamp(r.created_at),
    branchId: row.payment.branch_id,
    status: /pend|process/i.test(r.status) ? 'pending' : 'completed',
  }
}

const COUNTED_PAYMENTS: PaymentResponseDto['status'][] = ['pending', 'authorized', 'captured', 'partially_refunded', 'refunded']

async function listLedger(): Promise<LedgerRow[]> {
  await Promise.all([loadExpenseCategories(true), loadVendors()])
  const [expenses, payments] = await Promise.all([
    api.listAll<ExpenseResponseDto>('/finance/expenses', { branchId: null, query: { sort_by: 'expense_date', sort_order: 'desc' } }),
    // Income needs payment read access per branch; without it the ledger still shows expenses.
    // Payments have no date filter, so only the newest 500 per branch are read.
    acrossBranches((b) => api.listAll<PaymentResponseDto>('/payments', { branchId: b }, 5)).catch(() => [] as PaymentResponseDto[]),
  ])
  const rows: LedgerRow[] = expenses.filter((e) => e.status !== 'void').map(expenseRow)
  for (const p of payments) {
    if (!COUNTED_PAYMENTS.includes(p.status)) continue
    rows.push({ kind: 'payment', version: p.version, payment: p })
    for (const r of p.refunds ?? []) {
      if (/fail|cancel/i.test(r.status)) continue
      rows.push({ kind: 'refund', version: 0, refund: r, payment: p })
    }
  }
  return rows
}

async function payExpense(e: ExpenseResponseDto, method: PaymentMethod | undefined): Promise<ExpenseResponseDto> {
  const apiMethod = method ? methodToApi(method) : (e.payment_method ?? 'cash')
  const body: PayExpenseDto = {
    expected_version: e.version,
    method: apiMethod,
    ...(apiMethod === 'cash' ? { cash_account_id: await cashAccountFor(e.branch_id) } : {}),
  }
  return api.post<ExpenseResponseDto>(`/finance/expenses/${e.id}/pay`, body, { branchId: null })
}

const expenseOf = (current: Cached<Transaction, LedgerRow> | undefined, op: string): ExpenseResponseDto => {
  if (current?.dto.kind !== 'expense') throw new UnsupportedOperationError('Transactions', `${op} a payment or refund (they come from the POS)`)
  return current.dto.expense
}

export const transactions = apiRepository<Transaction, LedgerRow>({
  name: 'Transactions',
  toUi: ledgerToUi,
  list: listLedger,
  create: async (input) => {
    if (input.type !== 'expense') throw new UnsupportedOperationError('Transactions', `record ${input.type} manually (it comes from POS payments)`)
    const body: CreateExpenseDto = {
      id: operationId(),
      category_id: await expenseCategoryId(input.category),
      expense_date: input.date.slice(0, 10),
      amount_minor: toMinor(input.amount),
      ...compact({
        branch_id: input.branchId || undefined,
        description: input.description || undefined,
        vendor_id: vendorIdFor(input.payee),
        payment_method: methodToApi(input.method),
      }),
    }
    let created = await api.post<ExpenseResponseDto>('/finance/expenses', body, { branchId: null })
    if (input.status === 'completed' && created.status === 'recorded') created = await payExpense(created, input.method)
    return expenseRow(created)
  },
  update: async (_id, patch, current) => {
    let e = expenseOf(current, 'edit')
    const ui = current!.ui
    const changed = <K extends keyof Transaction>(k: K) => patch[k] !== undefined && patch[k] !== ui[k]
    if (changed('branchId')) throw new UnsupportedOperationError('Expenses', 'move to another branch')
    if (changed('type')) throw new UnsupportedOperationError('Expenses', 'change the transaction type')

    const fields = compact({
      category_id: changed('category') ? await expenseCategoryId(patch.category!) : undefined,
      expense_date: changed('date') && patch.date!.slice(0, 10) !== ui.date.slice(0, 10) ? patch.date!.slice(0, 10) : undefined,
      amount_minor: changed('amount') ? toMinor(patch.amount) : undefined,
      description: changed('description') ? patch.description || null : undefined,
      vendor_id: changed('payee') ? (vendorIdFor(patch.payee) ?? null) : undefined,
      payment_method: changed('method') ? methodToApi(patch.method) : undefined,
    })
    if (Object.keys(fields).length) {
      // Only unpaid expenses can be corrected; the server rejects edits to a paid one.
      const body: UpdateExpenseDto = { expected_version: versionOf(current), ...fields }
      e = await api.patch<ExpenseResponseDto>(`/finance/expenses/${e.id}`, body, { branchId: null })
    }
    if (patch.status === 'completed' && e.status === 'recorded') e = await payExpense(e, patch.method ?? ui.method)
    else if (patch.status === 'pending' && e.status === 'paid') throw new UnsupportedOperationError('Expenses', 'mark a paid expense as unpaid')
    return expenseRow(e)
  },
  // No DELETE: an expense is voided (a cash-paid one is reversed into its register).
  remove: async (_id, current) => {
    const e = expenseOf(current, 'delete')
    const body: VoidExpenseDto = { expected_version: e.version, reason: 'Removed in back office' }
    await api.post(`/finance/expenses/${e.id}/void`, body, { branchId: null })
  },
})

/* ───────────────────────── recurring expenses ───────────────────────── */

const frequencyToUi = (f: RecurringExpenseResponseDto['frequency']): RecurringFrequency =>
  // The UI has no daily schedule; daily ones are shown under the closest (weekly) bucket.
  f === 'monthly' ? 'monthly' : 'weekly'

const frequencyToApi = (f: RecurringFrequency): CreateRecurringExpenseDto['frequency'] => {
  if (f === 'quarterly') throw new UnsupportedOperationError('Recurring expenses', 'quarterly schedules')
  return f
}

const recurringToUi = (d: RecurringExpenseResponseDto): RecurringExpense => ({
  id: d.id,
  name: d.description || categoryName(d.category_id),
  category: categoryName(d.category_id),
  payee: vendorName(d.vendor_id),
  amount: fromMinor(d.amount_minor),
  frequency: frequencyToUi(d.frequency),
  nextDue: d.next_due_date ?? d.start_date,
  branchId: d.branch_id ?? '',
  method: methodToUi(d.payment_method),
  active: d.status === 'active',
})

const transition = (id: string, action: 'pause' | 'resume', version: number) =>
  api.post<RecurringExpenseResponseDto>(`/finance/recurring-expenses/${id}/${action}`, { expected_version: version } satisfies ExpectedVersionDto, {
    branchId: null,
  })

export const recurringExpenses = apiRepository<RecurringExpense, RecurringExpenseResponseDto>({
  name: 'Recurring expenses',
  toUi: recurringToUi,
  list: async () => {
    await Promise.all([loadExpenseCategories(true), loadVendors()])
    const rows = await api.listAll<RecurringExpenseResponseDto>('/finance/recurring-expenses', { branchId: null })
    // Ended schedules (including ones "deleted" here) are history, not bills to manage.
    return rows.filter((r) => r.status !== 'ended')
  },
  get: (id) => api.get<RecurringExpenseResponseDto>(`/finance/recurring-expenses/${id}`, { branchId: null }),
  create: async (input) => {
    const body: CreateRecurringExpenseDto = {
      category_id: await expenseCategoryId(input.category),
      amount_minor: toMinor(input.amount),
      frequency: frequencyToApi(input.frequency),
      start_date: input.nextDue,
      payment_method: methodToApi(input.method),
      ...compact({
        branch_id: input.branchId || undefined,
        description: input.name || undefined,
        vendor_id: vendorIdFor(input.payee),
      }),
    }
    const created = await api.post<RecurringExpenseResponseDto>('/finance/recurring-expenses', body, { branchId: null })
    return input.active === false ? transition(created.id, 'pause', created.version) : created
  },
  update: async (id, patch, current) => {
    const ui = current?.ui
    const changed = <K extends keyof RecurringExpense>(k: K) => patch[k] !== undefined && patch[k] !== ui?.[k]
    if (changed('branchId')) throw new UnsupportedOperationError('Recurring expenses', 'move to another branch')

    let dto = current?.dto as RecurringExpenseResponseDto
    const fields = compact({
      category_id: changed('category') ? await expenseCategoryId(patch.category!) : undefined,
      amount_minor: changed('amount') ? toMinor(patch.amount) : undefined,
      description: changed('name') ? patch.name || null : undefined,
      vendor_id: changed('payee') ? (vendorIdFor(patch.payee) ?? null) : undefined,
      payment_method: changed('method') ? methodToApi(patch.method) : undefined,
      frequency: changed('frequency') ? frequencyToApi(patch.frequency!) : undefined,
      // The schedule is anchored on its start date; moving the next due date re-anchors it.
      start_date: changed('nextDue') ? patch.nextDue : undefined,
    })
    if (Object.keys(fields).length) {
      const body: UpdateRecurringExpenseDto = { expected_version: versionOf(current), ...fields }
      dto = await api.patch<RecurringExpenseResponseDto>(`/finance/recurring-expenses/${id}`, body, { branchId: null })
    }
    if (patch.active !== undefined && patch.active !== (dto.status === 'active')) {
      dto = await transition(id, patch.active ? 'resume' : 'pause', dto.version)
    }
    return dto
  },
  // No DELETE: the schedule is ended today (generated expenses stay). One that has not started yet
  // cannot end before its start, so it is paused instead.
  remove: async (id, current) => {
    const dto = current?.dto ?? (await api.get<RecurringExpenseResponseDto>(`/finance/recurring-expenses/${id}`, { branchId: null }))
    if (dto.start_date > today()) {
      if (dto.status === 'active') await transition(id, 'pause', dto.version)
      return
    }
    const body: UpdateRecurringExpenseDto = { expected_version: dto.version, end_date: today() }
    await api.patch(`/finance/recurring-expenses/${id}`, body, { branchId: null })
  },
})

/** Monthly category budgets have no backend API. */
export const budgets = unavailableRepository<ExpenseBudget>('budgets')
