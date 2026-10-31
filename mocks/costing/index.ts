import type { Recipe, RecipeAccessEvent, RecipeExtra, RecipeIngredient, RecipeVisibility } from '@/types'
import { config } from '@/lib/config'
import { isoDaysAgo } from '@/lib/utils/seed'

type Line = [sku: string, quantity: number, unit: string] | [name: string, quantity: number, unit: string, costPerUnit: number]

const isStock = (name: string) => name.startsWith('INV-')

/** Typical per-serving running costs, in rupees. */
const extrasFor = (packaging: number, gas: number, labour: number): [string, number][] => [
  ['Packaging & condiments', packaging],
  ['Gas & electricity', gas],
  ['Kitchen labour', labour],
]

// Quantities are for one serving. Stock SKUs follow mocks/inventory (INV-001 chicken breast, INV-007 mozzarella, ...).
const seeds: [productId: string, wastagePct: number, lines: Line[], extras: [string, number][], notes?: string][] = [
  ['p1', 5, [['INV-001', 150, 'g'], ['INV-015', 1, 'pcs'], ['INV-013', 20, 'g'], ['Mayonnaise', 25, 'g', 0.9], ['INV-006', 60, 'ml'], ['INV-005', 30, 'g'], ['INV-025', 3, 'g']], extrasFor(18, 12, 25), 'Fillet weighed raw before breading.'],
  ['p2', 4, [['INV-002', 180, 'g'], ['INV-015', 1, 'pcs'], ['INV-008', 40, 'g'], ['House sauce', 30, 'g', 0.8], ['INV-012', 20, 'g']], extrasFor(18, 14, 28)],
  ['p3', 5, [['INV-001', 140, 'g'], ['INV-015', 1, 'pcs'], ['INV-010', 30, 'g'], ['Mint chutney', 20, 'g', 0.6], ['INV-026', 4, 'g'], ['INV-013', 15, 'g']], extrasFor(18, 14, 25)],
  ['p7', 6, [['INV-005', 250, 'g'], ['INV-007', 160, 'g'], ['INV-001', 120, 'g'], ['INV-014', 40, 'g'], ['INV-012', 30, 'g'], ['Pizza sauce', 60, 'g', 0.5], ['INV-022', 1, 'pcs']], extrasFor(10, 35, 40), 'Large 13" base; small and medium scale down.'],
  ['p8', 6, [['INV-005', 250, 'g'], ['INV-007', 160, 'g'], ['INV-001', 120, 'g'], ['INV-014', 50, 'g'], ['Fajita sauce', 50, 'g', 0.7], ['INV-022', 1, 'pcs']], extrasFor(10, 35, 40)],
  ['p10', 6, [['INV-005', 250, 'g'], ['INV-007', 170, 'g'], ['INV-011', 60, 'g'], ['Pizza sauce', 70, 'g', 0.5], ['Fresh basil', 5, 'g', 3], ['INV-022', 1, 'pcs']], extrasFor(10, 35, 35)],
  ['p11', 6, [['INV-005', 250, 'g'], ['INV-007', 180, 'g'], ['INV-001', 150, 'g'], ['Fresh cream', 40, 'g', 1.2], ['Garlic sauce', 30, 'g', 0.8], ['INV-006', 20, 'ml'], ['INV-022', 1, 'pcs']], extrasFor(10, 35, 40)],
  ['p12', 8, [['INV-005', 250, 'g'], ['INV-007', 160, 'g'], ['INV-014', 50, 'g'], ['Mushrooms', 50, 'g', 0.9], ['Olives & corn', 40, 'g', 1.1], ['INV-022', 1, 'pcs']], extrasFor(10, 35, 35)],
  ['p13', 5, [['INV-016', 3, 'slice'], ['INV-001', 120, 'g'], ['INV-017', 1, 'pcs'], ['INV-008', 20, 'g'], ['INV-013', 15, 'g'], ['Mayonnaise', 20, 'g', 0.9], ['Fries', 150, 'g', 0.45], ['INV-021', 1, 'pcs']], extrasFor(8, 18, 25)],
  ['p18', 4, [['INV-004', 180, 'g'], ['INV-001', 160, 'g'], ['INV-010', 40, 'g'], ['INV-006', 25, 'ml'], ['INV-012', 40, 'g'], ['INV-026', 5, 'g'], ['INV-025', 4, 'g']], extrasFor(15, 20, 20), 'Cooked in 40-plate degs; costed per plate.'],
  ['p19', 5, [['INV-001', 450, 'g'], ['INV-011', 200, 'g'], ['INV-006', 60, 'ml'], ['Ginger & garlic', 30, 'g', 0.6], ['INV-025', 6, 'g'], ['INV-026', 5, 'g']], extrasFor(20, 45, 45)],
  ['p20', 5, [['INV-003', 450, 'g'], ['INV-011', 200, 'g'], ['INV-006', 70, 'ml'], ['Ginger & garlic', 30, 'g', 0.6], ['INV-025', 6, 'g'], ['INV-026', 6, 'g']], extrasFor(20, 55, 50)],
  ['p27', 3, [['INV-018', 5, 'g'], ['INV-009', 150, 'ml'], ['INV-019', 15, 'g'], ['INV-023', 1, 'pcs']], extrasFor(2, 6, 6)],
  ['p29', 0, [['INV-020', 1, 'can'], ['INV-023', 1, 'pcs']], extrasFor(2, 2, 3), 'Resold as is; cost is the can plus a cup.'],
  ['p31', 6, [['INV-024', 40, 'g'], ['INV-005', 30, 'g'], ['INV-019', 30, 'g'], ['INV-017', 1, 'pcs'], ['Butter', 25, 'g', 2.2], ['Vanilla ice cream', 60, 'g', 0.9]], extrasFor(8, 10, 15)],
]

interface BookDetails {
  /** Indexes into the costing lines that only the owner may see. */
  secret: number[]
  batch: number
  prep: number
  cook: number
  visibility: RecipeVisibility
  allergens: string[]
  method: [text: string, minutes: number][]
}

// Recipe book pages for the signature dishes; the rest of the menu only has a costing sheet so far.
const book: Record<string, BookDetails> = {
  p1: {
    secret: [6],
    batch: 20,
    prep: 25,
    cook: 6,
    visibility: 'kitchen',
    allergens: ['Gluten', 'Eggs'],
    method: [
      ['Marinate fillets overnight in buttermilk with half of the secret mix.', 0],
      ['Toss flour with the rest of the secret mix; dredge, dip in iced water, dredge again.', 3],
      ['Fry at 175°C until golden and 74°C inside.', 6],
      ['Toast bun, spread mayo on both halves, add lettuce and fillet.', 1],
    ],
  },
  p7: {
    secret: [5],
    batch: 12,
    prep: 20,
    cook: 9,
    visibility: 'kitchen',
    allergens: ['Gluten', 'Dairy'],
    method: [
      ['Stretch proofed dough ball to 13".', 2],
      ['Spread pizza sauce to 2 cm from the edge, then mozzarella.', 1],
      ['Top with tikka chunks, onions and capsicum.', 1],
      ['Bake at 280°C until the cheese browns.', 9],
    ],
  },
  p18: {
    secret: [5, 6],
    batch: 40,
    prep: 45,
    cook: 70,
    visibility: 'kitchen',
    allergens: ['Dairy'],
    method: [
      ['Soak rice 30 minutes.', 30],
      ['Fry onions to deep brown; keep half for layering.', 15],
      ['Cook chicken with yogurt and the masala until oil separates.', 25],
      ['Par-boil rice to 70% in heavily salted water.', 8],
      ['Layer rice over chicken with fried onions; seal and dum on low heat.', 20],
    ],
  },
  p19: {
    secret: [5],
    batch: 10,
    prep: 15,
    cook: 35,
    visibility: 'managers',
    allergens: [],
    method: [
      ['Sear chicken in hot oil on high flame.', 8],
      ['Add tomatoes and ginger-garlic; cover until tomatoes break down.', 15],
      ['Add chili and the karahi masala; bhuno until oil separates.', 10],
      ['Finish with julienned ginger and green chilies.', 2],
    ],
  },
  p27: {
    secret: [],
    batch: 30,
    prep: 2,
    cook: 8,
    visibility: 'kitchen',
    allergens: ['Dairy'],
    method: [
      ['Boil tea leaves in a splash of water until dark.', 3],
      ['Add milk and sugar; bring to a rolling boil three times.', 5],
      ['Strain into cups.', 0],
    ],
  },
}

export const recipes: Recipe[] = seeds.map(([productId, wastagePct, lines, extras, notes]) => {
  const page = book[productId]
  return {
    id: productId,
    productId,
    wastagePct,
    ingredients: lines.map<RecipeIngredient>((l, i) => ({
      id: `${productId}-i${i + 1}`,
      sku: isStock(l[0]) ? l[0] : null,
      name: isStock(l[0]) ? '' : l[0],
      quantity: l[1],
      unit: l[2],
      costPerUnit: l.length === 4 ? l[3] : 0,
      ...(page?.secret.includes(i) && { secret: true }),
    })),
    extras: extras.map<RecipeExtra>(([label, amount], i) => ({ id: `${productId}-x${i + 1}`, label, amount })),
    notes: notes ?? '',
    updatedAt: `${config.referenceDate}T09:00:00`,
    ...(page && {
      method: page.method.map(([text, minutes], i) => ({ id: `${productId}-s${i + 1}`, text, minutes })),
      prepMinutes: page.prep,
      cookMinutes: page.cook,
      batchServings: page.batch,
      allergens: page.allergens,
      visibility: page.visibility,
      version: 1,
      updatedBy: 'Imran Qureshi',
    }),
  }
})

const ref = config.referenceDate

export const recipeAccessLog: RecipeAccessEvent[] = [
  { id: 'ra1', recipeId: 'p18', itemName: 'Chicken Biryani', userName: 'Imtiaz Hussain', role: 'chef', action: 'viewed', at: isoDaysAgo(ref, 0, 11, 40) },
  { id: 'ra2', recipeId: 'p19', itemName: 'Chicken Karahi (Half)', userName: 'Faisal Ahmed', role: 'branch-manager', action: 'viewed', at: isoDaysAgo(ref, 0, 10, 15) },
  { id: 'ra3', recipeId: null, itemName: 'Recipe vault', userName: 'Imran Qureshi', role: 'tenant-owner', action: 'unlocked', at: isoDaysAgo(ref, 1, 21, 5) },
  { id: 'ra4', recipeId: 'p1', itemName: 'Zinger Burger', userName: 'Imran Qureshi', role: 'tenant-owner', action: 'edited', at: isoDaysAgo(ref, 1, 21, 12) },
  { id: 'ra5', recipeId: 'p1', itemName: 'Zinger Burger', userName: 'Imtiaz Hussain', role: 'chef', action: 'printed', at: isoDaysAgo(ref, 2, 9, 30) },
]
