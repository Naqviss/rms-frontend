/** Small, shared conversions between backend wire values and the UI's domain types. */

/** Integer minor units (paisa) → major units (rupees). The backend never sends floats for money. */
export const fromMinor = (v: number | null | undefined) => (v ?? 0) / 100
/** Major units → integer minor units for request bodies. */
export const toMinor = (v: number | null | undefined) => Math.round((v ?? 0) * 100)

/** Localised text objects (`{ en: "Burgers", ur: "برگر" }`) → one string, falling back to English, then anything. */
export function text(value: unknown, lang = 'en'): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const pick = o[lang] ?? o.en ?? Object.values(o).find((v) => typeof v === 'string')
    return typeof pick === 'string' ? pick : ''
  }
  return String(value)
}

/** One-language string → the localised object shape the backend stores. */
export const localized = (value: string, lang = 'en') => ({ [lang]: value })

/** `2026-10-15T09:30:00.000Z` → `2026-10-15` */
export const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')
/** ISO timestamp without the trailing `Z`/millis, matching the mocks' `YYYY-MM-DDTHH:mm:ss`. */
export const stamp = (iso: string | null | undefined) => (iso ? iso.slice(0, 19) : '')

const palette = [272, 150, 25, 230, 70, 330, 190, 110]
/** Deterministic accent colour for avatars/initials, so the same record keeps its colour. */
export function colorFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return `oklch(0.55 0.17 ${palette[Math.abs(h) % palette.length]})`
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

/** Drop keys whose value is `undefined` so PATCH bodies only carry what actually changed. */
export function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
