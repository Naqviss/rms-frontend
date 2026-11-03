/**
 * Tax rates — `GET/POST /api/tax/rates`, `GET/PATCH /api/tax/rates/{id}`.
 *
 * Reference adapter: the pattern every module in this folder follows.
 *  - `toUi` maps the wire DTO to the prototype type (basis points → percent, i18n name → string).
 *  - writes send snake_case bodies; PATCH carries `expected_version` from the cached DTO.
 *  - the API has no DELETE for tax rates, so "remove" deactivates the rate instead.
 */
import { api } from '@/services/api/client'
import { apiRepository, versionOf } from '@/services/api/adapter'
import { compact, localized, text } from '@/services/api/mappers'
import type { CreateTaxRateDto, TaxRateResponseDto, UpdateTaxRateDto } from '@/services/api/generated/schemas'
import type { TaxRate } from '@/types'

const toUi = (d: TaxRateResponseDto): TaxRate => ({
  id: d.id,
  name: d.name || text(d.name_i18n) || d.code,
  rate: d.rate_bp / 100,
  category: d.tax_category_codes[0] ?? d.code,
  inclusive: d.inclusive,
  // The UI scopes a rate to one branch or all; the API allows a list (empty = every branch).
  branchId: d.branch_ids.length === 1 ? d.branch_ids[0] : 'all',
  active: d.is_active,
  appliesTo: d.applies_to_all ? 'All items' : `${d.menu_item_ids.length + d.menu_category_ids.length} items/categories`,
})

const codeFrom = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `tax_${Date.now().toString(36)}`

export const taxRates = apiRepository<TaxRate, TaxRateResponseDto>({
  name: 'Tax rates',
  toUi,
  list: () => api.listAll<TaxRateResponseDto>('/tax/rates', { branchId: null }),
  get: (id) => api.get<TaxRateResponseDto>(`/tax/rates/${id}`, { branchId: null }),
  create: (input) => {
    const body: CreateTaxRateDto = {
      code: codeFrom(input.name),
      name: localized(input.name),
      rate_bp: Math.round(input.rate * 100),
      inclusive: input.inclusive,
      branch_ids: input.branchId === 'all' ? [] : [input.branchId],
      applies_to_all: true,
      effective_from: new Date().toISOString(),
      ...(input.category ? { tax_category_codes: [input.category] } : {}),
    }
    return api.post<TaxRateResponseDto>('/tax/rates', body, { branchId: null })
  },
  update: (id, patch, current) => {
    const body: UpdateTaxRateDto = {
      expected_version: versionOf(current),
      ...compact({
        name: patch.name !== undefined ? localized(patch.name) : undefined,
        rate_bp: patch.rate !== undefined ? Math.round(patch.rate * 100) : undefined,
        inclusive: patch.inclusive,
        is_active: patch.active,
        branch_ids: patch.branchId !== undefined ? (patch.branchId === 'all' ? [] : [patch.branchId]) : undefined,
        tax_category_codes: patch.category !== undefined ? [patch.category] : undefined,
      }),
    }
    return api.patch<TaxRateResponseDto>(`/tax/rates/${id}`, body, { branchId: null })
  },
  remove: async (id, current) => {
    await api.patch(`/tax/rates/${id}`, { expected_version: versionOf(current), is_active: false } satisfies UpdateTaxRateDto, { branchId: null })
  },
})
