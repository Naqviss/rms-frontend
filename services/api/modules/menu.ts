/**
 * Menu — `/api/menus`, `/api/menus/{id}/categories`, `/api/menu-categories`, `/api/menu-items`,
 * `/api/modifier-groups` (all tenant-wide management lists, no branch header).
 *
 *  - MenuGroup ↔ menu. Category ↔ menu category, gathered across every menu (a category belongs to one menu).
 *  - Product ↔ menu item. Its option groups are the item's modifier groups (shared, tenant-wide
 *    records) plus, when the item has variants, one synthetic single-choice group whose option
 *    prices are relative to the base price (variant prices are absolute on the wire).
 *  - The API has no DELETE for menus, categories or items, so "remove" deactivates.
 *  - Fields the backend does not store (image URL) read as empty and are not written. A patch that
 *    only changes such fields is rejected with UnsupportedOperationError rather than silently dropped.
 */
import { api } from '@/services/api/client'
import { apiRepository, UnsupportedOperationError, versionOf } from '@/services/api/adapter'
import { compact, fromMinor, localized, text, toMinor } from '@/services/api/mappers'
import type {
  CategoryResponseDto,
  CreateCategoryDto,
  CreateItemDto,
  CreateMenuDto,
  CreateModifierGroupDto,
  ItemResponseDto,
  MenuResponseDto,
  ModifierGroupResponseDto,
  ModifierInputDto,
  TaxRateResponseDto,
  UpdateCategoryDto,
  UpdateItemDto,
  UpdateMenuDto,
  UpdateModifierGroupDto,
  VariantInputDto,
} from '@/services/api/generated/schemas'
import type { MenuCategory, MenuGroup, Product, ProductOptionGroup } from '@/types'

const tenantWide = { branchId: null } as const

// ---------------------------------------------------------------------------------------------
// Shared lookups (filled by list calls, read by the synchronous mappers)
// ---------------------------------------------------------------------------------------------

/** category id → menu id, for Product.menuId. */
const menuOfCategory = new Map<string, string>()
/** Modifier groups by id; items only carry `modifier_group_ids`. */
const modifierGroups = new Map<string, ModifierGroupResponseDto>()
/** Active tax rates, to resolve an item's rate (the item stores a tax category code, not a rate id). */
let taxRates: TaxRateResponseDto[] = []

const loadMenus = () => api.listAll<MenuResponseDto>('/menus', { ...tenantWide, query: { sort_by: 'sort_order', sort_order: 'asc' } })

async function loadCategories(): Promise<CategoryResponseDto[]> {
  const menus = await loadMenus()
  const perMenu = await Promise.all(
    menus.map((m) =>
      api.listAll<CategoryResponseDto>(`/menus/${m.id}/categories`, { ...tenantWide, query: { sort_by: 'sort_order', sort_order: 'asc' } }),
    ),
  )
  const all = perMenu.flat()
  for (const c of all) menuOfCategory.set(c.id, c.menu_id)
  return all
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const nameOf = (d: { name?: string | null; name_i18n: Record<string, unknown> }) => d.name || text(d.name_i18n)

// ---------------------------------------------------------------------------------------------
// Menus → MenuGroup
// ---------------------------------------------------------------------------------------------

export const menuGroups = apiRepository<MenuGroup, MenuResponseDto>({
  name: 'Menus',
  toUi: (d) => ({ id: d.id, name: nameOf(d), description: text(d.description_i18n), active: d.is_active }),
  list: loadMenus,
  create: (input) => {
    const body: CreateMenuDto = {
      name: localized(input.name),
      ...(input.description ? { description: localized(input.description) } : {}),
      is_active: input.active,
    }
    return api.post<MenuResponseDto>('/menus', body, tenantWide)
  },
  update: (id, patch, current) => {
    const body: UpdateMenuDto = {
      expected_version: versionOf(current),
      ...compact({
        name: patch.name !== undefined ? localized(patch.name) : undefined,
        description: patch.description !== undefined ? localized(patch.description) : undefined,
        is_active: patch.active,
      }),
    }
    return api.patch<MenuResponseDto>(`/menus/${id}`, body, tenantWide)
  },
  remove: async (id, current) => {
    await api.patch(`/menus/${id}`, { expected_version: versionOf(current), is_active: false } satisfies UpdateMenuDto, tenantWide)
  },
})

// ---------------------------------------------------------------------------------------------
// Menu categories → MenuCategory
// ---------------------------------------------------------------------------------------------

export const categories = apiRepository<MenuCategory, CategoryResponseDto>({
  name: 'Categories',
  toUi: (d) => {
    const name = nameOf(d)
    // Images are media ids that need a signed URL per file; no URL is resolved here.
    return { id: d.id, name, slug: slugify(name), image: '', sortOrder: d.sort_order }
  },
  // The UI category has no active flag, so deactivated ("removed") categories stay hidden.
  list: async () => (await loadCategories()).filter((c) => c.is_active),
  create: async (input) => {
    // The UI does not pick a menu for a new category; it goes into the first menu.
    const menu = (await loadMenus())[0]
    if (!menu) throw new UnsupportedOperationError('Categories', 'create a category before any menu exists')
    const body: CreateCategoryDto = { menu_id: menu.id, name: localized(input.name), sort_order: input.sortOrder, is_active: true }
    const created = await api.post<CategoryResponseDto>('/menu-categories', body, tenantWide)
    menuOfCategory.set(created.id, created.menu_id)
    return created
  },
  update: (id, patch, current) => {
    const body: UpdateCategoryDto = {
      expected_version: versionOf(current),
      ...compact({ name: patch.name !== undefined ? localized(patch.name) : undefined, sort_order: patch.sortOrder }),
    }
    return api.patch<CategoryResponseDto>(`/menu-categories/${id}`, body, tenantWide)
  },
  remove: async (id, current) => {
    await api.patch(`/menu-categories/${id}`, { expected_version: versionOf(current), is_active: false } satisfies UpdateCategoryDto, tenantWide)
  },
})

// ---------------------------------------------------------------------------------------------
// Menu items → Product
// ---------------------------------------------------------------------------------------------

const variantGroupId = (itemId: string) => `variants:${itemId}`

function groupToUi(g: ModifierGroupResponseDto): ProductOptionGroup {
  return {
    id: g.id,
    name: nameOf(g),
    type: g.max_select === 1 ? 'single' : 'multiple',
    options: g.modifiers
      .filter((m) => m.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ name: nameOf(m), price: fromMinor(m.price_minor) })),
  }
}

function optionGroupsOf(d: ItemResponseDto): ProductOptionGroup[] {
  const groups = d.modifier_group_ids.map((id) => modifierGroups.get(id)).filter((g): g is ModifierGroupResponseDto => !!g && g.is_active)
  const out = groups.map(groupToUi)
  const variants = d.variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order)
  if (variants.length) {
    out.unshift({
      id: variantGroupId(d.id),
      name: 'Variant',
      type: 'single',
      options: variants.map((v) => ({ name: nameOf(v), price: fromMinor(v.price_minor - d.base_price_minor) })),
    })
  }
  return out
}

/** First active rate that covers the item: by item, by category, by tax category code, or tenant-wide. */
function taxRateIdOf(d: ItemResponseDto): string | null {
  const code = d.tax_category_code ?? null
  const covers = (r: TaxRateResponseDto) =>
    r.menu_item_ids.includes(d.id) ||
    r.menu_category_ids.includes(d.category_id) ||
    (!!code && r.tax_category_codes.includes(code)) ||
    (r.applies_to_all && !(code && r.exempt_tax_category_codes.includes(code)))
  return taxRates.find((r) => r.is_active && covers(r))?.id ?? null
}

const productToUi = (d: ItemResponseDto): Product => ({
  id: d.id,
  name: nameOf(d),
  sku: d.sku ?? '',
  categoryId: d.category_id,
  description: d.description ?? text(d.description_i18n),
  image: '',
  basePrice: fromMinor(d.base_price_minor),
  taxRateId: taxRateIdOf(d),
  available: d.is_active,
  optionGroups: optionGroupsOf(d),
  menuId: menuOfCategory.get(d.category_id) ?? '',
})

/** Fields the menu item API does not store. Changing only these is reported as unsupported. */
const PRODUCT_LOCAL: (keyof Product)[] = ['image', 'menuId', 'taxRateId']

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function modifiersFor(g: ProductOptionGroup, existing?: ModifierGroupResponseDto): ModifierInputDto[] {
  return g.options.map((o, i) => ({
    ...(existing ? compact({ id: existing.modifiers.find((m) => nameOf(m) === o.name)?.id }) : {}),
    name: localized(o.name),
    price_minor: toMinor(o.price),
    is_default: g.type === 'single' && i === 0,
    is_active: true,
    sort_order: i,
  }))
}

const selectBounds = (g: ProductOptionGroup) =>
  g.type === 'single' ? { min_select: 1, max_select: 1 } : { min_select: 0, max_select: Math.max(1, g.options.length) }

/** Create or update the modifier groups behind the UI option groups; returns their ids in order. */
async function saveModifierGroups(groups: ProductOptionGroup[]): Promise<string[]> {
  const ids: string[] = []
  for (const g of groups) {
    const existing = modifierGroups.get(g.id)
    if (existing) {
      if (!same(groupToUi(existing), { ...g, id: existing.id })) {
        // Modifier groups are shared records: an edit here applies to every item using the group.
        const body: UpdateModifierGroupDto = {
          expected_version: existing.version,
          name: localized(g.name),
          ...selectBounds(g),
          modifiers: modifiersFor(g, existing),
        }
        modifierGroups.set(existing.id, await api.patch<ModifierGroupResponseDto>(`/modifier-groups/${existing.id}`, body, tenantWide))
      }
      ids.push(existing.id)
    } else {
      const body: CreateModifierGroupDto = { name: localized(g.name), ...selectBounds(g), is_active: true, modifiers: modifiersFor(g) }
      const created = await api.post<ModifierGroupResponseDto>('/modifier-groups', body, tenantWide)
      modifierGroups.set(created.id, created)
      ids.push(created.id)
    }
  }
  return ids
}

function variantsFor(group: ProductOptionGroup, basePrice: number, current?: ItemResponseDto): VariantInputDto[] {
  return group.options.map((o, i) => ({
    ...compact({ id: current?.variants.find((v) => nameOf(v) === o.name)?.id }),
    name: localized(o.name),
    price_minor: toMinor(basePrice + o.price),
    is_default: i === 0,
    is_active: true,
    sort_order: i,
  }))
}

export const products = apiRepository<Product, ItemResponseDto>({
  name: 'Products',
  toUi: productToUi,
  list: async () => {
    const [items, groups, rates] = await Promise.all([
      api.listAll<ItemResponseDto>('/menu-items', { ...tenantWide, query: { sort_by: 'sort_order', sort_order: 'asc' } }),
      api.listAll<ModifierGroupResponseDto>('/modifier-groups', tenantWide),
      // Only used to show which rate applies; a caller without tax access still sees the menu.
      api.listAll<TaxRateResponseDto>('/tax/rates', tenantWide).catch(() => [] as TaxRateResponseDto[]),
      loadCategories().catch(() => []),
    ])
    for (const g of groups) modifierGroups.set(g.id, g)
    taxRates = rates
    return items
  },
  get: (id) => api.get<ItemResponseDto>(`/menu-items/${id}`, tenantWide),
  create: async (input) => {
    const groups = input.optionGroups ?? []
    const variantGroup = groups.find((g) => g.id.startsWith('variants:'))
    const modifierGroupIds = await saveModifierGroups(groups.filter((g) => g !== variantGroup))
    const taxCode = taxRates.find((r) => r.id === input.taxRateId)?.tax_category_codes[0]
    const body: CreateItemDto = {
      category_id: input.categoryId,
      name: localized(input.name),
      base_price_minor: toMinor(input.basePrice),
      is_active: input.available,
      ...(input.sku ? { sku: input.sku } : {}),
      ...(input.description ? { description: localized(input.description) } : {}),
      ...(taxCode ? { tax_category_code: taxCode } : {}),
      ...(modifierGroupIds.length ? { modifier_group_ids: modifierGroupIds } : {}),
      ...(variantGroup ? { variants: variantsFor(variantGroup, input.basePrice) } : {}),
    }
    return api.post<ItemResponseDto>('/menu-items', body, tenantWide)
  },
  update: async (id, patch, current) => {
    const before = current?.ui
    const changed = (k: keyof Product) => patch[k] !== undefined && (!before || !same(patch[k], before[k]))

    const body: UpdateItemDto = {
      expected_version: versionOf(current),
      ...compact({
        name: changed('name') ? localized(patch.name!) : undefined,
        sku: changed('sku') ? patch.sku || null : undefined,
        category_id: changed('categoryId') ? patch.categoryId : undefined,
        description: changed('description') ? localized(patch.description!) : undefined,
        base_price_minor: changed('basePrice') ? toMinor(patch.basePrice) : undefined,
        is_active: changed('available') ? patch.available : undefined,
      }),
    }

    if (changed('optionGroups')) {
      const groups = patch.optionGroups!
      const variantGroup = groups.find((g) => g.id.startsWith('variants:'))
      body.modifier_group_ids = await saveModifierGroups(groups.filter((g) => g !== variantGroup))
      const basePrice = patch.basePrice ?? before?.basePrice ?? fromMinor(current?.dto.base_price_minor)
      if (variantGroup) body.variants = variantsFor(variantGroup, basePrice, current?.dto)
      else if (current?.dto.variants.length) body.variants = []
    } else if (changed('basePrice') && current?.dto.variants.length && before) {
      // Variant prices are absolute; keep each variant's offset from the base price.
      const group = before.optionGroups.find((g) => g.id === variantGroupId(id))
      if (group) body.variants = variantsFor(group, patch.basePrice!, current.dto)
    }

    if (Object.keys(body).length === 1) {
      const local = PRODUCT_LOCAL.filter(changed)
      if (local.length) throw new UnsupportedOperationError('Products', `change ${local.join(', ')}`)
      if (current) return current.dto
      return api.get<ItemResponseDto>(`/menu-items/${id}`, tenantWide)
    }
    return api.patch<ItemResponseDto>(`/menu-items/${id}`, body, tenantWide)
  },
  remove: async (id, current) => {
    await api.patch(`/menu-items/${id}`, { expected_version: versionOf(current), is_active: false } satisfies UpdateItemDto, tenantWide)
  },
})
