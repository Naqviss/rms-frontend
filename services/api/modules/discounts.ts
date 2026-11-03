/**
 * Discounts — `/api/discounts/promotions` and `/api/discounts/coupons` (tenant-wide).
 *
 *  - One UI list over both: a coupon is a discount with a code customers enter (`Discount.code`),
 *    a promotion is applied automatically / by staff (UI code is empty). Creating with a code
 *    makes a coupon, without one a promotion. Switching between the two is not possible.
 *  - Percent values travel as basis points, fixed values and limits as minor units.
 *  - No DELETE exists: "remove" deactivates.
 *  - `used`: the offer DTOs carry no redemption count, so it comes from
 *    `GET /api/insights/reports/discounts` (completed orders per offer since the earliest start).
 *    It lags: open orders are not counted yet, and a cancellation releases coupon eligibility
 *    asynchronously (outbox), so the count need not drop right after a cancel. Without report
 *    access it reads 0. The POS "increment used" patch is a no-op; the server counts redemptions.
 */
import { api } from '@/services/api/client'
import { apiRepository, UnsupportedOperationError, versionOf, type Cached } from '@/services/api/adapter'
import { compact, fromMinor, localized, text, toMinor } from '@/services/api/mappers'
import type {
  CouponResponseDto,
  CreateCouponDto,
  CreatePromotionDto,
  PromotionResponseDto,
  DiscountsReportResponseDto,
  UpdateCouponDto,
  UpdatePromotionDto,
} from '@/services/api/generated/schemas'
import type { Discount, SalesChannel } from '@/types'

const tenantWide = { branchId: null } as const

type OfferDto = (PromotionResponseDto & { source: 'promotion' }) | (CouponResponseDto & { source: 'coupon' })
type WireChannel = 'pos' | 'website' | 'other'

const pathOf = (d: { source: OfferDto['source'] }, id: string) =>
  d.source === 'coupon' ? `/discounts/coupons/${id}` : `/discounts/promotions/${id}`

// --- dates: the UI keeps local calendar days, the wire keeps instants -------------------------

const pad = (n: number) => String(n).padStart(2, '0')
const localDay = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const startOfDay = (day: string) => new Date(`${day}T00:00:00`).toISOString()
const endOfDay = (day: string) => new Date(`${day}T23:59:59.999`).toISOString()

const today = () => localDay(new Date().toISOString())

/** discount id → completed orders that applied it (summed over currencies). Filled by `list`. */
let usedById = new Map<string, number>()

async function loadUsage(offers: OfferDto[]): Promise<Map<string, number>> {
  const from = offers.map((o) => localDay(o.starts_at)).filter(Boolean).sort()[0]
  if (!from) return new Map()
  const to = today()
  const report = await api.get<DiscountsReportResponseDto>('/insights/reports/discounts', {
    branchId: null,
    query: { from: from < to ? from : to, to },
  })
  const counts = new Map<string, number>()
  for (const r of report.rows) counts.set(r.discount_id, (counts.get(r.discount_id) ?? 0) + r.order_count)
  return counts
}

// --- channels: the backend knows pos / website / other ---------------------------------------

function channelFromWire(channels: string[]): SalesChannel | 'all' {
  if (channels.length !== 1) return 'all'
  if (channels[0] === 'website') return 'website'
  if (channels[0] === 'pos') return 'dine-in'
  if (channels[0] === 'other') return 'foodpanda'
  return 'all'
}

function channelToWire(channel: SalesChannel | 'all'): WireChannel[] {
  switch (channel) {
    case 'all':
      return []
    case 'website':
      return ['website']
    case 'foodpanda':
      return ['other']
    default:
      // dine-in, takeaway and own-delivery are all rung up on the POS.
      return ['pos']
  }
}

const toUi = (d: OfferDto): Discount => {
  const scope = d.applies_to_all ? 'order' : d.menu_category_ids.length ? 'category' : d.menu_item_ids.length ? 'product' : 'order'
  return {
    id: d.id,
    name: d.name || text(d.name_i18n) || d.code,
    code: d.source === 'coupon' ? d.code : '',
    kind: d.kind === 'percentage' ? 'percent' : 'fixed',
    value: d.kind === 'percentage' ? (d.value_bp ?? 0) / 100 : fromMinor(d.value_minor),
    maxAmount: fromMinor(d.max_discount_minor),
    minOrder: fromMinor(d.source === 'coupon' ? d.min_spend_minor : d.min_order_minor),
    scope,
    targetId: scope === 'category' ? d.menu_category_ids[0] : scope === 'product' ? d.menu_item_ids[0] : null,
    usageLimit: d.source === 'coupon' ? (d.usage_limit ?? 0) : 0,
    used: usedById.get(d.id) ?? 0,
    startDate: localDay(d.starts_at),
    endDate: d.ends_at ? localDay(d.ends_at) : null,
    branchId: d.branch_ids.length === 1 ? d.branch_ids[0] : 'all',
    channel: channelFromWire(d.channels),
    active: d.is_active,
  }
}

/** Value, limits, targeting and schedule fields shared by promotion and coupon bodies. */
function commonFields(d: Partial<Discount>) {
  const kind = d.kind === undefined ? undefined : d.kind === 'percent' ? ('percentage' as const) : ('fixed' as const)
  const target =
    d.scope === undefined
      ? {}
      : d.scope === 'order' || !d.targetId
        ? { applies_to_all: true, menu_item_ids: [], menu_category_ids: [] }
        : d.scope === 'category'
          ? { applies_to_all: false, menu_item_ids: [], menu_category_ids: [d.targetId] }
          : { applies_to_all: false, menu_item_ids: [d.targetId], menu_category_ids: [] }
  return compact({
    kind,
    value_bp: d.value !== undefined && d.kind === 'percent' ? Math.round(d.value * 100) : d.kind === 'fixed' ? null : undefined,
    value_minor: d.value !== undefined && d.kind === 'fixed' ? toMinor(d.value) : d.kind === 'percent' ? null : undefined,
    max_discount_minor: d.maxAmount !== undefined ? (d.maxAmount > 0 ? toMinor(d.maxAmount) : null) : undefined,
    branch_ids: d.branchId !== undefined ? (d.branchId === 'all' ? [] : [d.branchId]) : undefined,
    channels: d.channel !== undefined ? channelToWire(d.channel) : undefined,
    starts_at: d.startDate ? startOfDay(d.startDate) : undefined,
    ends_at: d.endDate !== undefined ? (d.endDate ? endOfDay(d.endDate) : null) : undefined,
    ...target,
  })
}

const minimum = (v: number | undefined) => (v === undefined ? undefined : v > 0 ? toMinor(v) : null)
const usageLimit = (v: number | undefined) => (v === undefined ? undefined : v > 0 ? Math.round(v) : null)
/** Promotions have no redemption cap; only coupons do. */
const noPromotionLimit = (v: number | undefined) => {
  if (v) throw new UnsupportedOperationError('Discounts', 'usage limits without a code (add a code to make it a coupon)')
}

const tag = <S extends OfferDto['source']>(source: S) => <T>(dto: T) => ({ ...dto, source }) as T & { source: S }
const asPromotion = tag('promotion')
const asCoupon = tag('coupon')

const promotionCode = (name: string) =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 32) || 'promo'
  }_${Date.now().toString(36)}`

async function load(id: string): Promise<OfferDto> {
  try {
    return asPromotion(await api.get<PromotionResponseDto>(`/discounts/promotions/${id}`, tenantWide))
  } catch {
    return asCoupon(await api.get<CouponResponseDto>(`/discounts/coupons/${id}`, tenantWide))
  }
}

async function patchOffer(id: string, current: Cached<Discount, OfferDto>, patch: Partial<Discount>): Promise<OfferDto> {
  const d = current.dto
  const base = { expected_version: versionOf(current), ...commonFields(patch), ...compact({ name: patch.name !== undefined ? localized(patch.name) : undefined, is_active: patch.active }) }
  if (d.source === 'coupon') {
    const body: UpdateCouponDto = { ...base, ...compact({ min_spend_minor: minimum(patch.minOrder), usage_limit: usageLimit(patch.usageLimit) }) }
    return asCoupon(await api.patch<CouponResponseDto>(pathOf(d, id), body, tenantWide))
  }
  const body: UpdatePromotionDto = { ...base, ...compact({ min_order_minor: minimum(patch.minOrder) }) }
  return asPromotion(await api.patch<PromotionResponseDto>(pathOf(d, id), body, tenantWide))
}

export const discounts = apiRepository<Discount, OfferDto>({
  name: 'Discounts',
  toUi,
  list: async () => {
    const [promotions, coupons] = await Promise.all([
      api.listAll<PromotionResponseDto>('/discounts/promotions', tenantWide),
      api.listAll<CouponResponseDto>('/discounts/coupons', tenantWide),
    ])
    const offers = [...promotions.map(asPromotion), ...coupons.map(asCoupon)]
    // Usage is informational; a caller without report access still gets the offers.
    usedById = await loadUsage(offers).catch(() => new Map<string, number>())
    return offers
  },
  get: load,
  create: async (input) => {
    const common = {
      name: localized(input.name),
      kind: input.kind === 'percent' ? ('percentage' as const) : ('fixed' as const),
      ...commonFields(input),
      starts_at: startOfDay(input.startDate),
    }
    let created: OfferDto
    if (input.code.trim()) {
      const body: CreateCouponDto = {
        ...common,
        code: input.code.trim(),
        ...compact({ min_spend_minor: minimum(input.minOrder), usage_limit: usageLimit(input.usageLimit) ?? undefined }),
      }
      created = asCoupon(await api.post<CouponResponseDto>('/discounts/coupons', body, tenantWide))
    } else {
      noPromotionLimit(input.usageLimit)
      const body: CreatePromotionDto = { ...common, code: promotionCode(input.name), ...compact({ min_order_minor: minimum(input.minOrder) }) }
      created = asPromotion(await api.post<PromotionResponseDto>('/discounts/promotions', body, tenantWide))
    }
    // Create bodies have no active flag; new offers start active.
    if (!input.active) created = await patchOffer(created.id, { dto: created, ui: toUi(created) }, { active: false })
    return created
  },
  update: async (id, patch, current) => {
    const dto = current?.dto ?? (await load(id))
    const before = current?.ui ?? toUi(dto)
    // Redemptions are counted by the server when orders apply the offer.
    const { used: _used, id: _id, ...rest } = patch
    const changes = Object.fromEntries(
      Object.entries(rest).filter(([k, v]) => v !== undefined && JSON.stringify(v) !== JSON.stringify(before[k as keyof Discount])),
    ) as Partial<Discount>
    if (!Object.keys(changes).length) return dto
    if (changes.code !== undefined) {
      throw new UnsupportedOperationError('Discounts', dto.source === 'coupon' ? 'change a coupon code' : 'add a code to an automatic discount')
    }
    if (dto.source === 'promotion') noPromotionLimit(changes.usageLimit)
    // Value fields only make sense together with the kind.
    if (changes.value !== undefined || changes.kind !== undefined) {
      changes.kind = patch.kind ?? before.kind
      changes.value = patch.value ?? before.value
    }
    if (changes.scope !== undefined || changes.targetId !== undefined) {
      changes.scope = patch.scope ?? before.scope
      changes.targetId = patch.targetId !== undefined ? patch.targetId : before.targetId
    }
    return patchOffer(id, { dto, ui: before }, changes)
  },
  remove: async (id, current) => {
    const dto = current?.dto ?? (await load(id))
    await patchOffer(id, { dto, ui: toUi(dto) }, { active: false })
  },
})
