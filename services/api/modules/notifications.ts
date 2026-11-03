/**
 * In-app notifications of the signed-in user.
 *
 *   GET  /api/notifications                       inbox (newest first)
 *   GET  /api/notifications/unread-count          badge count
 *   POST /api/notifications/{id}/read             mark one read (idempotent)
 *   POST /api/notifications/read-all              mark all read
 *   GET  /api/notification-preferences            my per-category switches
 *   PUT  /api/notification-preferences/{category}
 */
import { api } from '@/services/api/client'
import { stamp } from '@/services/api/mappers'
import type {
  CategorySettingDto,
  CategorySettingResponseDto,
  DispatchResponseDto,
  NotificationResponseDto,
  PreferenceDto,
  PreferenceResponseDto,
  ReadAllResponseDto,
  TemplateOverrideDto,
  TemplateResponseDto,
  UnreadCountResponseDto,
} from '@/services/api/generated/schemas'
import type { NotificationItem } from '@/types'

const noBranch = { branchId: null } as const

/** The API carries a category, not a severity, so every item renders at the neutral `info` level. */
export const toNotificationItem = (n: NotificationResponseDto): NotificationItem => ({
  id: n.id,
  title: n.title,
  body: n.body,
  at: stamp(n.created_at),
  read: !!n.read_at,
  level: 'info',
})

export const listNotifications = (unreadOnly = false) =>
  api
    .page<NotificationResponseDto>('/notifications', { ...noBranch, query: { page_size: 30, unread_only: unreadOnly || undefined } })
    .then((p) => p.data)

export const getUnreadCount = () => api.get<UnreadCountResponseDto>('/notifications/unread-count', noBranch).then((r) => r.unread)

export const markNotificationRead = (id: string) => api.post<void>(`/notifications/${id}/read`, undefined, noBranch)

export const markAllNotificationsRead = () => api.post<ReadAllResponseDto>('/notifications/read-all', undefined, noBranch)

export const listNotificationPreferences = () => api.listAll<PreferenceResponseDto>('/notification-preferences', noBranch)

export const setNotificationPreference = (category: PreferenceResponseDto['category'], enabled: boolean) =>
  api.put<PreferenceResponseDto>(`/notification-preferences/${category}`, { enabled } satisfies PreferenceDto, noBranch)

// ─── Tenant administration ─────────────────────────────────────────────────────────────────────
//
//   GET/PUT /api/notification-categories[/{category}]   tenant or branch category switches (audited)
//   GET/PUT /api/notification-templates[/{code}]        defaults merged with tenant overrides
//   GET     /api/notification-dispatches                dispatch log — status, reason and counts are
//                                                       rendered exactly as the API reports them

export const listNotificationCategories = (branchId?: string) =>
  api.listAll<CategorySettingResponseDto>('/notification-categories', { ...noBranch, query: branchId ? { branch_id: branchId } : undefined })

export const setNotificationCategory = (category: CategorySettingResponseDto['category'], enabled: boolean, branchId?: string) =>
  api.put<CategorySettingResponseDto>(
    `/notification-categories/${category}`,
    { enabled, ...(branchId ? { branch_id: branchId } : {}) } satisfies CategorySettingDto,
    noBranch,
  )

export const listNotificationTemplates = () => api.listAll<TemplateResponseDto>('/notification-templates', noBranch)

export const overrideNotificationTemplate = (code: string, body: TemplateOverrideDto) =>
  api.put<TemplateResponseDto>(`/notification-templates/${encodeURIComponent(code)}`, body, noBranch)

export const listNotificationDispatches = (query?: { status?: DispatchResponseDto['status']; template_code?: string; branch_id?: string }) =>
  api.page<DispatchResponseDto>('/notification-dispatches', { ...noBranch, query: { page_size: 100, ...query } }).then((p) => p.data)
