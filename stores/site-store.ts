'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Website editor state. The content fields are loaded from and saved to the tenant's site
 * configuration (GET/PUT /api/cms/site-config, see services/api/modules/cms.ts); only the layout
 * choices with no backend field (template, section toggles) are kept locally as a preference.
 */
export interface SiteContent {
  brandName: string
  heroTitle: string
  heroSubtitle: string
  about: string
  phone: string
  email: string
  address: string
  seoTitle: string
  seoDescription: string
}

export interface SiteSections {
  menu: boolean
  offers: boolean
  reviews: boolean
  gallery: boolean
  reservations: boolean
}

interface SiteState {
  templateId: string
  accent: string | null
  content: SiteContent
  sections: SiteSections
  setTemplate: (id: string) => void
  setAccent: (accent: string | null) => void
  setContent: (patch: Partial<SiteContent>) => void
  setSections: (patch: Partial<SiteSections>) => void
}

/** Empty until the site configuration loads — never demo copy. */
export const emptyContent: SiteContent = {
  brandName: '',
  heroTitle: '',
  heroSubtitle: '',
  about: '',
  phone: '',
  email: '',
  address: '',
  seoTitle: '',
  seoDescription: '',
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      templateId: 'classic-bistro',
      accent: null,
      content: emptyContent,
      sections: { menu: true, offers: false, reviews: false, gallery: false, reservations: false },
      setTemplate: (templateId) => set({ templateId, accent: null }),
      setAccent: (accent) => set({ accent }),
      setContent: (patch) => set((s) => ({ content: { ...s.content, ...patch } })),
      setSections: (patch) => set((s) => ({ sections: { ...s.sections, ...patch } })),
    }),
    // v2: drop content persisted by the demo build; only layout preferences are kept locally.
    { name: 'site-settings-v2', partialize: (s) => ({ templateId: s.templateId, sections: s.sections }) },
  ),
)
