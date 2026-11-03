/**
 * Website CMS: site configuration, pages and navigation drafts, plus the public read routes the
 * storefront renders.
 *
 *   GET/PUT /api/cms/site-config, POST …/publish | archive        (tenant-wide; branch overrides under …/branches/{id})
 *   GET/POST /api/cms/pages, PATCH /api/cms/pages/{id}, POST …/publish | archive
 *   GET /api/cms/navigations, PUT /api/cms/navigations/{location}, POST …/publish | archive
 *   GET /api/public/tenants/{tenantId}/site | pages | pages/{slug}  (anonymous)
 *
 * Every write replaces a *draft*; visitors only see a version after publish.
 */
import { api, ApiError } from '@/services/api/client'
import { text } from '@/services/api/mappers'
import type {
  CmsPageResponseDto,
  CmsPublishResponseDto,
  CreateCmsPageDto,
  NavigationPublishResponseDto,
  NavigationResponseDto,
  PublicPageResponseDto,
  PublicPageSummaryDto,
  PublicSiteResponseDto,
  PutNavigationDto,
  PutSiteConfigDto,
  SiteConfigPublishResponseDto,
  SiteConfigResponseDto,
  UpdateCmsPageDto,
  VersionedActionDto,
} from '@/services/api/generated/schemas'
import type { SiteContent } from '@/stores/site-store'

const noBranch = { branchId: null } as const
const siteBase = (branchId?: string) => (branchId ? `/cms/site-config/branches/${branchId}` : '/cms/site-config')

/** A missing draft is a normal state (nothing configured yet), not an error. */
async function orNull<T>(run: Promise<T>): Promise<T | null> {
  try {
    return await run
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

// ─── Site configuration ────────────────────────────────────────────────────────────────────────

export const getSiteConfig = (branchId?: string) => orNull(api.get<SiteConfigResponseDto>(siteBase(branchId), noBranch))

export const putSiteConfig = (body: PutSiteConfigDto, branchId?: string) => api.put<SiteConfigResponseDto>(siteBase(branchId), body, noBranch)

export const publishSiteConfig = (version: number, branchId?: string) =>
  api.post<SiteConfigPublishResponseDto>(`${siteBase(branchId)}/publish`, { expected_version: version } satisfies VersionedActionDto, noBranch)

export const archiveSiteConfig = (version: number, branchId?: string) =>
  api.post<SiteConfigResponseDto>(`${siteBase(branchId)}/archive`, { expected_version: version } satisfies VersionedActionDto, noBranch)

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown) => (typeof v === 'string' ? v : '')
/** Set one language inside a localized object, keeping the others. */
const withLang = (prev: unknown, value: string, lang: string) => ({ ...obj(prev), [lang]: value })

/** Draft → the CMS editor's content fields (only those the draft actually has). */
export function siteContentFrom(cfg: SiteConfigResponseDto, lang = 'en'): { content: Partial<SiteContent>; accent: string | null } {
  const contact = obj(cfg.contact)
  const seo = obj(cfg.seo)
  const content: Partial<SiteContent> = {}
  const put = (k: keyof SiteContent, v: string) => {
    if (v) content[k] = v
  }
  put('brandName', text(cfg.title, lang))
  put('heroTitle', text(cfg.tagline, lang))
  put('heroSubtitle', text(cfg.description, lang))
  put('phone', str(contact.phone))
  put('email', str(contact.email))
  put('address', text(contact.address, lang))
  put('seoTitle', text(seo.title, lang))
  put('seoDescription', text(seo.description, lang))
  const primary = str(obj(cfg.theme).primary_color)
  return { content, accent: /^#[0-9a-f]{6}$/i.test(primary) ? primary : null }
}

/**
 * Editor fields → a full PUT body. PUT replaces the draft, so everything the editor does not own
 * (logo, favicon, social links, opening hours, domain, other languages, other theme keys) is
 * carried over from the current draft.
 *
 * Mapping: brandName→title, heroTitle→tagline, heroSubtitle→description, phone/email/address→contact,
 * seoTitle/seoDescription→seo, accent→theme.primary_color. "About", template and sections have no
 * site-config field and stay in the local editor store.
 */
export function siteConfigBody(current: SiteConfigResponseDto | null, content: SiteContent, accent: string | null, lang = 'en'): PutSiteConfigDto {
  const contact = obj(current?.contact)
  const seo = obj(current?.seo)
  const theme = obj(current?.theme)
  const nextTheme: Obj = { ...theme }
  if (accent) nextTheme.primary_color = accent
  else delete nextTheme.primary_color
  return {
    expected_version: current?.version ?? 0,
    title: withLang(current?.title, content.brandName, lang),
    tagline: withLang(current?.tagline, content.heroTitle, lang),
    description: withLang(current?.description, content.heroSubtitle, lang),
    logo_media_id: current?.logo_media_id ?? null,
    favicon_media_id: current?.favicon_media_id ?? null,
    contact: { ...contact, phone: content.phone, email: content.email, address: withLang(contact.address, content.address, lang) },
    social_links: current?.social_links ?? [],
    opening_hours: current?.opening_hours ?? null,
    theme: Object.keys(nextTheme).length ? nextTheme : null,
    domain: current?.domain ?? null,
    seo: { ...seo, title: withLang(seo.title, content.seoTitle, lang), description: withLang(seo.description, content.seoDescription, lang) },
  }
}

// ─── Pages ─────────────────────────────────────────────────────────────────────────────────────

export const listCmsPages = (query?: { status?: CmsPageResponseDto['status']; kind?: string }) =>
  api.listAll<CmsPageResponseDto>('/cms/pages', { ...noBranch, query })
export const getCmsPage = (id: string) => api.get<CmsPageResponseDto>(`/cms/pages/${id}`, noBranch)
export const createCmsPage = (body: CreateCmsPageDto) => api.post<CmsPageResponseDto>('/cms/pages', body, noBranch)
export const updateCmsPage = (page: Pick<CmsPageResponseDto, 'id' | 'version'>, patch: Omit<UpdateCmsPageDto, 'expected_version'>) =>
  api.patch<CmsPageResponseDto>(`/cms/pages/${page.id}`, { expected_version: page.version, ...patch } satisfies UpdateCmsPageDto, noBranch)
export const publishCmsPage = (page: Pick<CmsPageResponseDto, 'id' | 'version'>) =>
  api.post<CmsPublishResponseDto>(`/cms/pages/${page.id}/publish`, { expected_version: page.version } satisfies VersionedActionDto, noBranch)
export const archiveCmsPage = (page: Pick<CmsPageResponseDto, 'id' | 'version'>) =>
  api.post<CmsPageResponseDto>(`/cms/pages/${page.id}/archive`, { expected_version: page.version } satisfies VersionedActionDto, noBranch)

// ─── Navigations ───────────────────────────────────────────────────────────────────────────────

export const listNavigations = () => api.listAll<NavigationResponseDto>('/cms/navigations', noBranch)
export const putNavigation = (location: NavigationResponseDto['location'], version: number, items: PutNavigationDto['items']) =>
  api.put<NavigationResponseDto>(`/cms/navigations/${location}`, { expected_version: version, items } satisfies PutNavigationDto, noBranch)
export const publishNavigation = (location: NavigationResponseDto['location'], version: number) =>
  api.post<NavigationPublishResponseDto>(`/cms/navigations/${location}/publish`, { expected_version: version } satisfies VersionedActionDto, noBranch)
export const archiveNavigation = (location: NavigationResponseDto['location'], version: number) =>
  api.post<NavigationResponseDto>(`/cms/navigations/${location}/archive`, { expected_version: version } satisfies VersionedActionDto, noBranch)

// ─── Public (anonymous) site ───────────────────────────────────────────────────────────────────

const anon = { branchId: null, anonymous: true } as const

export const getPublicSite = (tenantId: string, branchId?: string) =>
  api.get<PublicSiteResponseDto>(`/public/tenants/${tenantId}/site`, { ...anon, query: { branch_id: branchId } })
export const listPublicPages = (tenantId: string) => api.listAll<PublicPageSummaryDto>(`/public/tenants/${tenantId}/pages`, anon)
export const getPublicPage = (tenantId: string, slug: string) =>
  api.get<PublicPageResponseDto>(`/public/tenants/${tenantId}/pages/${encodeURIComponent(slug)}`, anon)

/** Published site → storefront content overrides (only fields the published config has). */
export function siteContentFromPublic(site: PublicSiteResponseDto | null | undefined): { content: Partial<SiteContent>; accent: string | null } {
  const cfg = site?.config
  if (!cfg) return { content: {}, accent: null }
  const contact = obj(cfg.contact)
  const seo = obj(cfg.seo)
  const content: Partial<SiteContent> = {}
  const put = (k: keyof SiteContent, v: string) => {
    if (v) content[k] = v
  }
  put('brandName', cfg.title ?? '')
  put('heroTitle', cfg.tagline ?? '')
  put('heroSubtitle', cfg.description ?? '')
  put('phone', str(contact.phone))
  put('email', str(contact.email))
  put('address', text(contact.address))
  put('seoTitle', text(seo.title))
  put('seoDescription', text(seo.description))
  const primary = str(obj(cfg.theme).primary_color)
  return { content, accent: /^#[0-9a-f]{6}$/i.test(primary) ? primary : null }
}
