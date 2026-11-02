export type HeroLayout = 'centered' | 'split' | 'overlay' | 'stacked'
export type ProductLayout = 'grid' | 'list' | 'cards'
export type TemplateFont = 'serif' | 'sans' | 'rounded' | 'mono'

export interface SiteTemplate {
  id: string
  name: string
  /** Kind of shop the template was designed for, shown as the hero eyebrow. */
  storeType: string
  hero: HeroLayout
  layout: ProductLayout
  font: TemplateFont
  radius: number
  image: string
  colors: { bg: string; surface: string; text: string; muted: string; accent: string; accentText: string }
}

export const fontStacks: Record<TemplateFont, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, monospace',
}

export const siteTemplates: SiteTemplate[] = [
  {
    id: 'kiryana-classic',
    name: 'Kiryana Classic',
    storeType: 'Neighbourhood grocery',
    hero: 'centered',
    layout: 'list',
    font: 'serif',
    radius: 6,
    image: '/mart/staples.svg',
    colors: { bg: '#FAF6EE', surface: '#FFFFFF', text: '#1B2A22', muted: '#6B7A70', accent: '#1F4D3A', accentText: '#FFFFFF' },
  },
  {
    id: 'bachat-bazaar',
    name: 'Bachat Bazaar',
    storeType: 'Discount store',
    hero: 'split',
    layout: 'grid',
    font: 'sans',
    radius: 14,
    image: '/mart/snacks.svg',
    colors: { bg: '#FFD23F', surface: '#FFFFFF', text: '#1A1A1A', muted: '#5C5428', accent: '#E63946', accentText: '#FFFFFF' },
  },
  {
    id: 'corner-24-7',
    name: 'Corner 24/7',
    storeType: 'Convenience store',
    hero: 'centered',
    layout: 'list',
    font: 'serif',
    radius: 0,
    image: '/mart/beverages.svg',
    colors: { bg: '#F4F4F1', surface: '#FFFFFF', text: '#151515', muted: '#747474', accent: '#C8102E', accentText: '#FFFFFF' },
  },
  {
    id: 'daily-bread',
    name: 'Daily Bread',
    storeType: 'Bakery & breakfast',
    hero: 'overlay',
    layout: 'cards',
    font: 'sans',
    radius: 18,
    image: '/mart/bakery.svg',
    colors: { bg: '#FFF7E8', surface: '#FFFFFF', text: '#2B1B12', muted: '#7C6A5A', accent: '#D62828', accentText: '#FFFFFF' },
  },
  {
    id: 'masala-mandi',
    name: 'Masala Mandi',
    storeType: 'Spices & dry goods',
    hero: 'split',
    layout: 'cards',
    font: 'serif',
    radius: 10,
    image: '/mart/staples.svg',
    colors: { bg: '#2B0F0A', surface: '#40180F', text: '#FFE9C7', muted: '#D1AE86', accent: '#F59E0B', accentText: '#2B0F0A' },
  },
  {
    id: 'chai-corner',
    name: 'Chai Corner',
    storeType: 'Tea, coffee & snacks',
    hero: 'stacked',
    layout: 'cards',
    font: 'rounded',
    radius: 24,
    image: '/mart/beverages.svg',
    colors: { bg: '#F2E8DD', surface: '#FFFBF6', text: '#3B2616', muted: '#8A6F58', accent: '#7A4B2A', accentText: '#FFFFFF' },
  },
  {
    id: 'fresh-greens',
    name: 'Fresh Greens',
    storeType: 'Fruit & vegetables',
    hero: 'split',
    layout: 'grid',
    font: 'sans',
    radius: 18,
    image: '/mart/produce.svg',
    colors: { bg: '#F0F9EF', surface: '#FFFFFF', text: '#14301B', muted: '#5F7A64', accent: '#2F9E44', accentText: '#FFFFFF' },
  },
  {
    id: 'midnight-mart',
    name: 'Midnight Mart',
    storeType: 'Late-night convenience',
    hero: 'overlay',
    layout: 'list',
    font: 'serif',
    radius: 4,
    image: '/mart/hero.svg',
    colors: { bg: '#0D1117', surface: '#161C26', text: '#EDE6D6', muted: '#98927F', accent: '#C9A24B', accentText: '#0D1117' },
  },
  {
    id: 'care-beauty',
    name: 'Care & Beauty',
    storeType: 'Cosmetics & personal care',
    hero: 'centered',
    layout: 'cards',
    font: 'rounded',
    radius: 28,
    image: '/mart/personal-care.svg',
    colors: { bg: '#FFF0F4', surface: '#FFFFFF', text: '#4A1F32', muted: '#A06A83', accent: '#E0568B', accentText: '#FFFFFF' },
  },
  {
    id: 'quick-basket',
    name: 'Quick Basket',
    storeType: 'Express grocery delivery',
    hero: 'stacked',
    layout: 'grid',
    font: 'sans',
    radius: 8,
    image: '/mart/household.svg',
    colors: { bg: '#EEF3FF', surface: '#FFFFFF', text: '#0F1E4A', muted: '#5B6A94', accent: '#2563EB', accentText: '#FFFFFF' },
  },
]

export const accentChoices = ['#1F4D3A', '#E63946', '#D62828', '#F59E0B', '#2563EB', '#2F9E44', '#E0568B', '#7A4B2A'] as const

export const templateById = (id: string) => siteTemplates.find((t) => t.id === id) ?? siteTemplates[0]

export const sampleProducts = [
  { id: 's1', name: 'Milk 1 L', description: 'Nestle Milkpak · 1 L', price: 290, image: '/mart/dairy.svg' },
  { id: 's2', name: 'Chakki Atta 10 kg', description: 'Sunridge · 10 kg', price: 1850, image: '/mart/staples.svg' },
  { id: 's3', name: 'Sandwich Bread', description: 'Dawn · Large', price: 220, image: '/mart/bakery.svg' },
  { id: 's4', name: 'Tomatoes', description: 'Fresh · per kg', price: 180, image: '/mart/produce.svg' },
  { id: 's5', name: 'Danedar Tea 900 g', description: 'Tapal · 900 g', price: 1650, image: '/mart/beverages.svg' },
  { id: 's6', name: 'Washing Powder 1 kg', description: 'Surf Excel · 1 kg', price: 690, image: '/mart/household.svg' },
]
