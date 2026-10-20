import type { Recipe, RecipeExtra, RecipeIngredient } from '@/types'
import { config } from '@/lib/config'

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

export const recipes: Recipe[] = seeds.map(([productId, wastagePct, lines, extras, notes]) => ({
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
  })),
  extras: extras.map<RecipeExtra>(([label, amount], i) => ({ id: `${productId}-x${i + 1}`, label, amount })),
  notes: notes ?? '',
  updatedAt: `${config.referenceDate}T09:00:00`,
}))
