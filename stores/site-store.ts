'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

export const defaultContent: SiteContent = {
  brandName: 'Savour Kitchen',
  heroTitle: 'Fresh, fast and made to order',
  heroSubtitle: 'Burgers, pizza and desi favourites delivered hot to your door.',
  about: 'Family-run since 2012, we cook everything from scratch using locally sourced ingredients.',
  phone: '+92 300 1234567',
  email: 'hello@restaurant.pk',
  address: 'MM Alam Road, Gulberg III, Lahore',
  seoTitle: 'Order food online | Lahore',
  seoDescription: 'Order burgers, pizza and desi food online with fast delivery across Lahore.',
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      templateId: 'classic-bistro',
      accent: null,
      content: defaultContent,
      sections: { menu: true, offers: true, reviews: true, gallery: false, reservations: true },
      setTemplate: (templateId) => set({ templateId, accent: null }),
      setAccent: (accent) => set({ accent }),
      setContent: (patch) => set((s) => ({ content: { ...s.content, ...patch } })),
      setSections: (patch) => set((s) => ({ sections: { ...s.sections, ...patch } })),
    }),
    { name: 'site-settings-v1' },
  ),
)
