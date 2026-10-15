'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WebsiteSettings {
  acceptDelivery: boolean
  acceptPickup: boolean
  minOrder: number
  deliveryFee: number
  freeDeliveryOver: number
  prepMinutes: number
  paymentCash: boolean
  paymentOnline: boolean
}

interface ChannelState {
  deliveryEnabled: boolean
  foodpandaConnected: boolean
  foodpandaAutoAccept: boolean
  foodpandaOpen: boolean
  websiteOrderingEnabled: boolean
  website: WebsiteSettings
  setDeliveryEnabled: (v: boolean) => void
  setFoodpandaConnected: (v: boolean) => void
  setFoodpandaAutoAccept: (v: boolean) => void
  setFoodpandaOpen: (v: boolean) => void
  setWebsiteOrderingEnabled: (v: boolean) => void
  setWebsite: (patch: Partial<WebsiteSettings>) => void
}

export const useChannelStore = create<ChannelState>()(
  persist(
    (set) => ({
      deliveryEnabled: true,
      foodpandaConnected: true,
      foodpandaAutoAccept: false,
      foodpandaOpen: true,
      websiteOrderingEnabled: true,
      website: {
        acceptDelivery: true,
        acceptPickup: true,
        minOrder: 800,
        deliveryFee: 150,
        freeDeliveryOver: 3000,
        prepMinutes: 25,
        paymentCash: true,
        paymentOnline: true,
      },
      setDeliveryEnabled: (deliveryEnabled) => set({ deliveryEnabled }),
      setFoodpandaConnected: (foodpandaConnected) => set({ foodpandaConnected }),
      setFoodpandaAutoAccept: (foodpandaAutoAccept) => set({ foodpandaAutoAccept }),
      setFoodpandaOpen: (foodpandaOpen) => set({ foodpandaOpen }),
      setWebsiteOrderingEnabled: (websiteOrderingEnabled) => set({ websiteOrderingEnabled }),
      setWebsite: (patch) => set((s) => ({ website: { ...s.website, ...patch } })),
    }),
    { name: 'channel-settings-v2' },
  ),
)
