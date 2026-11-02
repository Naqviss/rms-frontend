'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { config } from '@/lib/config'

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
  products: boolean
  offers: boolean
  reviews: boolean
  gallery: boolean
  /** Opening hours and delivery promise in the footer. */
  hours: boolean
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
  brandName: 'Al-Noor Mart',
  heroTitle: 'Your daily groceries, delivered in an hour',
  heroSubtitle: 'Fresh produce, dairy, staples and household essentials at shelf prices, straight to your door.',
  about: 'A family-run neighbourhood mart since 2012. We stock thousands of everyday products and deliver across Clifton, DHA and Gulshan.',
  phone: '+92 21 3587 1100',
  email: 'hello@alnoormart.pk',
  address: 'Block 5, Clifton, Karachi',
  seoTitle: 'Order groceries online | Karachi',
  seoDescription: 'Order groceries, fresh produce and household essentials online with same-day delivery across Karachi.',
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      templateId: 'kiryana-classic',
      accent: null,
      content: defaultContent,
      sections: { products: true, offers: true, reviews: true, gallery: false, hours: true },
      setTemplate: (templateId) => set({ templateId, accent: null }),
      setAccent: (accent) => set({ accent }),
      setContent: (patch) => set((s) => ({ content: { ...s.content, ...patch } })),
      setSections: (patch) => set((s) => ({ sections: { ...s.sections, ...patch } })),
    }),
    { name: `${config.storagePrefix}site-settings` },
  ),
)
