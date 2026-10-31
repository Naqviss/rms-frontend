import type { Recipe, RecipeIngredient, RecipeVisibility, RoleId } from '@/types'
import type { CatalogItem } from '@/lib/utils/costing'

export const ALLERGENS = ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Peanuts', 'Soy', 'Sesame', 'Fish', 'Shellfish', 'Mustard']

export const visibilityLabel: Record<RecipeVisibility, string> = {
  owner: 'Only recipe owners',
  managers: 'Owners and managers',
  kitchen: 'Managers and kitchen team',
}

/** Roles that may open a kitchen card at each visibility level, on top of whoever can edit recipes. */
const visibleTo: Record<RecipeVisibility, RoleId[]> = {
  owner: [],
  managers: ['administrator', 'branch-manager'],
  kitchen: ['administrator', 'branch-manager', 'chef'],
}

export function canOpenRecipe(recipe: Pick<Recipe, 'visibility'>, role: RoleId, isOwner: boolean) {
  return isOwner || visibleTo[recipe.visibility ?? 'owner'].includes(role)
}

export type RecipeStatus = 'complete' | 'costing' | 'none'

export const recipeStatus = (recipe: Recipe | undefined): RecipeStatus => (!recipe ? 'none' : recipe.method?.length ? 'complete' : 'costing')

/** Stable code names ("Secret mix A", "Secret mix B") so staff can follow the method without learning the ingredient. */
export function secretCodes(ingredients: RecipeIngredient[]) {
  const codes = new Map<string, string>()
  for (const line of ingredients) if (line.secret) codes.set(line.id, `Secret mix ${String.fromCharCode(65 + codes.size)}`)
  return codes
}

export const ingredientName = (line: RecipeIngredient, catalog: Map<string, CatalogItem>) =>
  (line.sku ? catalog.get(line.sku)?.name : line.name) || 'Unnamed ingredient'

/** Scaled quantity in the most readable unit: 1,250 g becomes 1.25 kg. */
export function formatQuantity(quantity: number, unit: string) {
  const up: Record<string, string> = { g: 'kg', ml: 'L' }
  if (up[unit] && quantity >= 1000) return `${trim(quantity / 1000)} ${up[unit]}`
  return `${trim(quantity)} ${unit}`
}

const trim = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-PK')

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

interface KitchenCard {
  title: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  ingredients: { name: string; quantity: string; secret: boolean }[]
  method: { text: string; minutes: number }[]
  allergens: string[]
  /** Printed on every page so a leaked copy can be traced. */
  watermark: string
}

/** Standalone printable page. Secret ingredients arrive here already masked. */
export function kitchenCardHtml(card: KitchenCard) {
  const w = escape(card.watermark)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(card.title)} · kitchen card</title><style>
body{font:14px/1.5 system-ui,sans-serif;color:#111;margin:32px;position:relative}
h1{font-size:22px;margin:0 0 4px}.meta{color:#555;margin-bottom:20px}
h2{font-size:15px;margin:20px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px dotted #ddd}td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.secret{font-style:italic}ol{padding-left:20px}li{margin-bottom:6px}.min{color:#555;font-size:12px}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:28px;color:rgba(0,0,0,.07);transform:rotate(-30deg);text-align:center}
footer{margin-top:28px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="wm">${w}<br>${w}<br>${w}</div>
<h1>${escape(card.title)}</h1>
<div class="meta">${card.servings} servings · prep ${card.prepMinutes} min · cook ${card.cookMinutes} min${card.allergens.length ? ` · contains ${escape(card.allergens.join(', '))}` : ''}</div>
<h2>Ingredients</h2><table>${card.ingredients
    .map((i) => `<tr><td${i.secret ? ' class="secret"' : ''}>${escape(i.name)}</td><td>${escape(i.quantity)}</td></tr>`)
    .join('')}</table>
<h2>Method</h2><ol>${card.method.map((s) => `<li>${escape(s.text)}${s.minutes ? ` <span class="min">(${s.minutes} min)</span>` : ''}</li>`).join('')}</ol>
<footer>Confidential. ${w}. Do not copy or share.</footer>
<script>window.onload=()=>{window.print()}</script>
</body></html>`
}
