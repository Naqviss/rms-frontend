import type { Product, ProductCategory, ProductOptionGroup, SoldBy } from '@/types'

export const categories: ProductCategory[] = [
  { id: 'c1', name: 'Grocery & Staples', slug: 'staples', image: '/mart/staples.svg', sortOrder: 1 },
  { id: 'c2', name: 'Dairy & Eggs', slug: 'dairy', image: '/mart/dairy.svg', sortOrder: 2 },
  { id: 'c3', name: 'Beverages', slug: 'beverages', image: '/mart/beverages.svg', sortOrder: 3 },
  { id: 'c4', name: 'Snacks & Sweets', slug: 'snacks', image: '/mart/snacks.svg', sortOrder: 4 },
  { id: 'c5', name: 'Bakery & Breakfast', slug: 'bakery', image: '/mart/bakery.svg', sortOrder: 5 },
  { id: 'c6', name: 'Fruits & Vegetables', slug: 'produce', image: '/mart/produce.svg', sortOrder: 6 },
  { id: 'c7', name: 'Personal Care', slug: 'personal-care', image: '/mart/personal-care.svg', sortOrder: 7 },
  { id: 'c8', name: 'Household & Cleaning', slug: 'household', image: '/mart/household.svg', sortOrder: 8 },
]

const eggPacks: ProductOptionGroup[] = [
  {
    id: 'pack',
    name: 'Pack',
    type: 'single',
    options: [
      { name: 'Dozen', price: 0 },
      { name: 'Half dozen', price: -185 },
      { name: 'Tray (30)', price: 540 },
    ],
  },
]
const breadSizes: ProductOptionGroup[] = [
  {
    id: 'size',
    name: 'Size',
    type: 'single',
    options: [
      { name: 'Large', price: 0 },
      { name: 'Small', price: -70 },
    ],
  },
]
const soapPacks: ProductOptionGroup[] = [
  {
    id: 'pack',
    name: 'Pack',
    type: 'single',
    options: [
      { name: 'Single bar', price: 0 },
      { name: 'Pack of 3', price: 300 },
    ],
  },
]
const giftWrap: ProductOptionGroup[] = [
  {
    id: 'extras',
    name: 'Add-ons',
    type: 'multiple',
    options: [{ name: 'Gift wrap', price: 100 }],
  },
]

type Seed = [
  name: string,
  brand: string,
  packSize: string,
  category: string,
  price: number,
  desc: string,
  soldBy?: SoldBy,
  featured?: boolean,
  options?: ProductOptionGroup[],
]

const seeds: Seed[] = [
  ['Chakki Atta 10 kg', 'Sunridge', '10 kg', 'c1', 1850, 'Stone-ground whole wheat flour for rotis', 'unit', true],
  ['Super Basmati Rice 5 kg', 'Guard', '5 kg', 'c1', 2450, 'Aged long-grain basmati rice'],
  ['Cooking Oil 5 L', 'Dalda', '5 L', 'c1', 2750, 'Fortified canola blend cooking oil', 'unit', true],
  ['Banaspati Ghee 1 kg', 'Mezan', '1 kg', 'c1', 560, 'Vegetable ghee in a sealed pouch'],
  ['Iodized Salt 800 g', 'National', '800 g', 'c1', 70, 'Refined iodized table salt'],
  ['Biryani Masala 50 g', 'Shan', '50 g', 'c1', 150, 'Ready spice mix for biryani'],
  ['Daal Chana (loose)', 'Loose', 'per kg', 'c1', 320, 'Split chickpeas, weighed at the counter', 'weight'],
  ['Sugar (loose)', 'Loose', 'per kg', 'c1', 165, 'Fine white sugar, weighed at the counter', 'weight'],
  ['Milk 1 L', 'Nestle Milkpak', '1 L', 'c2', 290, 'UHT full-cream milk', 'unit', true],
  ['Plain Yogurt 1 kg', 'Nurpur', '1 kg', 'c2', 360, 'Set yogurt in a tub'],
  ['Salted Butter 200 g', 'Nurpur', '200 g', 'c2', 520, 'Creamy salted table butter'],
  ['Cheddar Slices 200 g', 'Adams', '200 g', 'c2', 690, '10 processed cheddar slices'],
  ['Farm Eggs', 'Farm Fresh', 'Dozen', 'c2', 380, 'Fresh brown eggs', 'unit', false, eggPacks],
  ['Fresh Cream 200 ml', 'Nestle', '200 ml', 'c2', 230, 'Cooking and dessert cream'],
  ['Cola 1.5 L', 'Pepsi', '1.5 L', 'c3', 210, 'Chilled cola, family bottle'],
  ['Mineral Water 1.5 L', 'Nestle Pure Life', '1.5 L', 'c3', 110, 'Bottled drinking water'],
  ['Danedar Tea 900 g', 'Tapal', '900 g', 'c3', 1650, 'Strong granular black tea', 'unit', true],
  ['Mango Juice 1 L', 'Shezan', '1 L', 'c3', 280, 'Mango nectar drink'],
  ['Energy Drink 250 ml', 'Sting', '250 ml', 'c3', 120, 'Berry-flavoured energy drink'],
  ['Instant Coffee 100 g', 'Nescafe Classic', '100 g', 'c3', 1150, 'Instant coffee in a glass jar'],
  ['Potato Chips 70 g', "Lay's", '70 g', 'c4', 100, 'Classic salted crisps'],
  ['Sooper Biscuits Family Pack', 'Peek Freans', 'Family pack', 'c4', 260, 'Egg and milk cookies'],
  ['Milk Chocolate 40 g', 'Cadbury Dairy Milk', '40 g', 'c4', 180, 'Smooth milk chocolate bar', 'unit', false, giftWrap],
  ['Nimko Mix 400 g', 'Nimco Corner', '400 g', 'c4', 380, 'Spicy fried lentil and nut mix'],
  ['Ice Cream Tub 1.4 L', 'Walls', '1.4 L', 'c4', 1050, 'Chocolate chip family tub'],
  ['Sandwich Bread', 'Dawn', 'Large', 'c5', 220, 'Soft white sliced bread', 'unit', true, breadSizes],
  ['Rusk 400 g', 'Bake Parlor', '400 g', 'c5', 260, 'Crunchy tea-time rusks'],
  ['Corn Flakes 375 g', "Kellogg's", '375 g', 'c5', 890, 'Breakfast cereal'],
  ['Strawberry Jam 440 g', "Mitchell's", '440 g', 'c5', 520, 'Fruit jam in a glass jar'],
  ['Pure Honey 250 g', 'Marhaba', '250 g', 'c5', 650, 'Natural honey'],
  ['Potatoes', 'Loose', 'per kg', 'c6', 120, 'Fresh potatoes', 'weight'],
  ['Onions', 'Loose', 'per kg', 'c6', 140, 'Red onions', 'weight'],
  ['Tomatoes', 'Loose', 'per kg', 'c6', 180, 'Ripe tomatoes', 'weight', true],
  ['Bananas', 'Loose', 'per dozen', 'c6', 220, 'Sweet Sindhi bananas'],
  ['Kala Kulu Apples', 'Loose', 'per kg', 'c6', 380, 'Crisp red apples', 'weight'],
  ['Green Chillies', 'Loose', 'per kg', 'c6', 260, 'Fresh green chillies', 'weight'],
  ['Shampoo 360 ml', 'Sunsilk', '360 ml', 'c7', 850, 'Everyday shampoo'],
  ['Beauty Soap 115 g', 'Lux', '115 g', 'c7', 170, 'Scented bath soap', 'unit', false, soapPacks],
  ['Toothpaste 150 g', 'Colgate', '150 g', 'c7', 420, 'Cavity protection toothpaste'],
  ['Hand Wash 200 ml', 'Dettol', '200 ml', 'c7', 380, 'Antibacterial liquid hand wash'],
  ['Baby Diapers Medium (40)', 'Pampers', 'Pack of 40', 'c7', 2850, 'Size 3 diapers'],
  ['Washing Powder 1 kg', 'Surf Excel', '1 kg', 'c8', 690, 'Laundry detergent powder', 'unit', true],
  ['Dishwash Bar', 'Lemon Max', '1 bar', 'c8', 110, 'Lemon dishwashing bar'],
  ['Toilet Cleaner 500 ml', 'Harpic', '500 ml', 'c8', 420, 'Thick toilet bowl cleaner'],
  ['Tissue Box (150)', 'Rose Petal', '150 sheets', 'c8', 240, 'Two-ply facial tissues'],
  ['Garbage Bags (30)', 'Clean Home', 'Roll of 30', 'c8', 350, 'Large black bin liners'],
  ['Insect Spray 450 ml', 'Mortein', '450 ml', 'c8', 790, 'Mosquito and fly killer'],
]

/** Valid EAN-13 under Pakistan's GS1 prefix (896) so scanners and checksum validators accept it. */
function ean13(n: number) {
  const body = `896${String(4100000 + n * 37).padStart(9, '0')}`
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0)
  return `${body}${(10 - (sum % 10)) % 10}`
}

const catImage: Record<string, string> = Object.fromEntries(categories.map((c) => [c.id, c.image]))
const taxFor = (categoryId: string, soldBy: SoldBy) => (categoryId === 'c6' || soldBy === 'weight' ? 'tx3' : categoryId === 'c2' ? 'tx2' : 'tx1')
/** Sample GST rates of tx1-tx3 in mocks/finance, so cost prices sit below the tax-free part of the shelf price. */
const taxRate: Record<string, number> = { tx1: 18, tx2: 10, tx3: 0 }
/** Typical retailer margin on the tax-free price: thin on staples and dairy, wider on fresh produce and personal care. */
const marginByCategory: Record<string, number> = { c1: 0.07, c2: 0.07, c3: 0.13, c4: 0.17, c5: 0.14, c6: 0.22, c7: 0.19, c8: 0.15 }
function costFor(price: number, categoryId: string, taxRateId: string, i: number) {
  const net = price / (1 + taxRate[taxRateId] / 100)
  const margin = marginByCategory[categoryId] + ((i % 5) - 2) * 0.01
  return Math.round(net * (1 - margin))
}

export const products: Product[] = seeds.map(([name, brand, packSize, categoryId, basePrice, description, soldBy = 'unit', featured, options], i) => ({
  id: `p${i + 1}`,
  name,
  sku: `ALN-${categoryId.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
  // Loose goods have no printed code; they are found by name or SKU and weighed.
  barcode: brand === 'Loose' ? '' : ean13(i + 1),
  brand,
  packSize,
  soldBy,
  categoryId,
  description,
  image: catImage[categoryId],
  basePrice,
  costPrice: costFor(basePrice, categoryId, taxFor(categoryId, soldBy), i),
  taxRateId: taxFor(categoryId, soldBy),
  available: i % 13 !== 9,
  featured: Boolean(featured),
  optionGroups: options ?? [],
  branchIds: i % 11 === 4 ? ['b1', 'b3'] : ['b1', 'b2', 'b3'],
}))

/** Catalogue id for a product name; mocks refer to products by name so the seed list can be reordered. */
export function productId(name: string) {
  const p = products.find((x) => x.name === name)
  if (!p) throw new Error(`Unknown product: ${name}`)
  return p.id
}
