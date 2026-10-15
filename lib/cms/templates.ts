export type HeroLayout = 'centered' | 'split' | 'overlay' | 'stacked'
export type MenuStyle = 'grid' | 'list' | 'cards'
export type TemplateFont = 'serif' | 'sans' | 'rounded' | 'mono'

export interface SiteTemplate {
  id: string
  name: string
  cuisine: string
  hero: HeroLayout
  menu: MenuStyle
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
    id: 'classic-bistro',
    name: 'Classic Bistro',
    cuisine: 'Fine dining',
    hero: 'centered',
    menu: 'list',
    font: 'serif',
    radius: 6,
    image: '/food/desi.png',
    colors: { bg: '#FAF6EE', surface: '#FFFFFF', text: '#1B2A22', muted: '#6B7A70', accent: '#1F4D3A', accentText: '#FFFFFF' },
  },
  {
    id: 'street-burger',
    name: 'Street Burger',
    cuisine: 'Burgers and fries',
    hero: 'split',
    menu: 'grid',
    font: 'sans',
    radius: 14,
    image: '/food/burgers.png',
    colors: { bg: '#FFD23F', surface: '#FFFFFF', text: '#1A1A1A', muted: '#5C5428', accent: '#E63946', accentText: '#FFFFFF' },
  },
  {
    id: 'sushi-zen',
    name: 'Sushi Zen',
    cuisine: 'Japanese',
    hero: 'centered',
    menu: 'list',
    font: 'serif',
    radius: 0,
    image: '/food/hero.png',
    colors: { bg: '#F4F4F1', surface: '#FFFFFF', text: '#151515', muted: '#747474', accent: '#C8102E', accentText: '#FFFFFF' },
  },
  {
    id: 'napoli-pizza',
    name: 'Napoli Pizzeria',
    cuisine: 'Wood-fired pizza',
    hero: 'overlay',
    menu: 'cards',
    font: 'sans',
    radius: 18,
    image: '/food/pizza.png',
    colors: { bg: '#FFF7E8', surface: '#FFFFFF', text: '#2B1B12', muted: '#7C6A5A', accent: '#D62828', accentText: '#FFFFFF' },
  },
  {
    id: 'desi-dhaba',
    name: 'Desi Dhaba',
    cuisine: 'Pakistani and Indian',
    hero: 'split',
    menu: 'cards',
    font: 'serif',
    radius: 10,
    image: '/food/desi.png',
    colors: { bg: '#2B0F0A', surface: '#40180F', text: '#FFE9C7', muted: '#D1AE86', accent: '#F59E0B', accentText: '#2B0F0A' },
  },
  {
    id: 'cafe-latte',
    name: 'Cafe Latte',
    cuisine: 'Coffee and brunch',
    hero: 'stacked',
    menu: 'cards',
    font: 'rounded',
    radius: 24,
    image: '/food/beverages.png',
    colors: { bg: '#F2E8DD', surface: '#FFFBF6', text: '#3B2616', muted: '#8A6F58', accent: '#7A4B2A', accentText: '#FFFFFF' },
  },
  {
    id: 'fresh-greens',
    name: 'Fresh Greens',
    cuisine: 'Healthy bowls',
    hero: 'split',
    menu: 'grid',
    font: 'sans',
    radius: 18,
    image: '/food/sandwiches.png',
    colors: { bg: '#F0F9EF', surface: '#FFFFFF', text: '#14301B', muted: '#5F7A64', accent: '#2F9E44', accentText: '#FFFFFF' },
  },
  {
    id: 'midnight-lounge',
    name: 'Midnight Lounge',
    cuisine: 'Bar and grill',
    hero: 'overlay',
    menu: 'list',
    font: 'serif',
    radius: 4,
    image: '/food/hero.png',
    colors: { bg: '#0D1117', surface: '#161C26', text: '#EDE6D6', muted: '#98927F', accent: '#C9A24B', accentText: '#0D1117' },
  },
  {
    id: 'sweet-bakery',
    name: 'Sweet Bakery',
    cuisine: 'Cakes and desserts',
    hero: 'centered',
    menu: 'cards',
    font: 'rounded',
    radius: 28,
    image: '/food/desserts.png',
    colors: { bg: '#FFF0F4', surface: '#FFFFFF', text: '#4A1F32', muted: '#A06A83', accent: '#E0568B', accentText: '#FFFFFF' },
  },
  {
    id: 'fast-bites',
    name: 'Fast Bites',
    cuisine: 'Quick service',
    hero: 'stacked',
    menu: 'grid',
    font: 'sans',
    radius: 8,
    image: '/food/sandwiches.png',
    colors: { bg: '#EEF3FF', surface: '#FFFFFF', text: '#0F1E4A', muted: '#5B6A94', accent: '#2563EB', accentText: '#FFFFFF' },
  },
]

export const accentChoices = ['#1F4D3A', '#E63946', '#D62828', '#F59E0B', '#2563EB', '#2F9E44', '#E0568B', '#7A4B2A'] as const

export const templateById = (id: string) => siteTemplates.find((t) => t.id === id) ?? siteTemplates[0]

export const sampleMenu = [
  { id: 's1', name: 'Smash Burger', description: 'Double patty, cheddar, house sauce', price: 890, image: '/food/burgers.png' },
  { id: 's2', name: 'Margherita', description: 'San Marzano, mozzarella, basil', price: 1190, image: '/food/pizza.png' },
  { id: 's3', name: 'Club Sandwich', description: 'Grilled chicken, egg, toasted bread', price: 690, image: '/food/sandwiches.png' },
  { id: 's4', name: 'Chicken Karahi', description: 'Slow-cooked with tomato and ginger', price: 1490, image: '/food/desi.png' },
  { id: 's5', name: 'Iced Latte', description: 'Double shot over milk and ice', price: 450, image: '/food/beverages.png' },
  { id: 's6', name: 'Molten Brownie', description: 'Warm centre, vanilla ice cream', price: 520, image: '/food/desserts.png' },
]
