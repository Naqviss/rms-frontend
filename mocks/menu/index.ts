import type { DietaryLabel, MenuCategory, MenuGroup, Product, ProductOptionGroup } from '@/types'

export const menuGroups: MenuGroup[] = [
  { id: 'm1', name: 'Main Menu', description: 'Served all day at every branch', active: true },
  { id: 'm2', name: 'Ramadan Specials', description: 'Iftar and sehri combos', active: false },
  { id: 'm3', name: 'Kids Menu', description: 'Small portions for little ones', active: true },
]

export const categories: MenuCategory[] = [
  { id: 'c1', name: 'Burgers', slug: 'burgers', image: '/food/burgers.png', sortOrder: 1 },
  { id: 'c2', name: 'Pizza', slug: 'pizza', image: '/food/pizza.png', sortOrder: 2 },
  { id: 'c3', name: 'Sandwiches', slug: 'sandwiches', image: '/food/sandwiches.png', sortOrder: 3 },
  { id: 'c4', name: 'Desi Mains', slug: 'desi', image: '/food/desi.png', sortOrder: 4 },
  { id: 'c5', name: 'Beverages', slug: 'beverages', image: '/food/beverages.png', sortOrder: 5 },
  { id: 'c6', name: 'Desserts', slug: 'desserts', image: '/food/desserts.png', sortOrder: 6 },
]

const burgerOptions: ProductOptionGroup[] = [
  {
    id: 'patty',
    name: 'Patty',
    type: 'single',
    options: [
      { name: 'Single patty', price: 0 },
      { name: 'Double patty', price: 350 },
      { name: 'Triple patty', price: 650 },
    ],
  },
  {
    id: 'meal',
    name: 'Make it a meal',
    type: 'single',
    options: [
      { name: 'Burger only', price: 0 },
      { name: 'With fries', price: 200 },
      { name: 'Meal: fries + drink', price: 350 },
    ],
  },
  {
    id: 'extras',
    name: 'Extras',
    type: 'multiple',
    options: [
      { name: 'Extra cheese', price: 80 },
      { name: 'Fried egg', price: 60 },
      { name: 'Jalapenos', price: 50 },
      { name: 'Caramelised onions', price: 60 },
      { name: 'Extra sauce', price: 40 },
    ],
  },
]
const sandwichOptions: ProductOptionGroup[] = [
  {
    id: 'size',
    name: 'Size',
    type: 'single',
    options: [
      { name: 'Regular', price: 0 },
      { name: 'Large', price: 250 },
    ],
  },
  {
    id: 'extras',
    name: 'Extras',
    type: 'multiple',
    options: [
      { name: 'Extra cheese', price: 80 },
      { name: 'Fried egg', price: 60 },
      { name: 'Jalapenos', price: 50 },
    ],
  },
]
const pizzaOptions: ProductOptionGroup[] = [
  {
    id: 'size',
    name: 'Size',
    type: 'single',
    options: [
      { name: 'Medium 10"', price: 0 },
      { name: 'Small 7"', price: -300 },
      { name: 'Large 13"', price: 450 },
    ],
  },
  {
    id: 'crust',
    name: 'Crust',
    type: 'single',
    options: [
      { name: 'Pan crust', price: 0 },
      { name: 'Thin crust', price: 0 },
      { name: 'Stuffed crust', price: 200 },
    ],
  },
  {
    id: 'toppings',
    name: 'Extra toppings',
    type: 'multiple',
    options: [
      { name: 'Extra cheese', price: 150 },
      { name: 'Olives', price: 80 },
      { name: 'Mushrooms', price: 100 },
      { name: 'Jalapenos', price: 60 },
    ],
  },
]
const drinkOptions: ProductOptionGroup[] = [
  {
    id: 'prefs',
    name: 'Preferences',
    type: 'multiple',
    options: [
      { name: 'Extra ice', price: 0 },
      { name: 'Sugar free', price: 0 },
    ],
  },
]
const optionsByCategory: Record<string, ProductOptionGroup[]> = { c1: burgerOptions, c2: pizzaOptions, c3: sandwichOptions, c5: drinkOptions }

type Seed = [
  name: string,
  category: string,
  price: number,
  cost: number,
  desc: string,
  dietary: DietaryLabel[],
  ingredients: string[],
  featured?: boolean,
]

const seeds: Seed[] = [
  ['Zinger Burger', 'c1', 690, 290, 'Crispy spicy chicken fillet with mayo and lettuce', ['halal', 'spicy'], ['Chicken fillet', 'Burger bun', 'Mayonnaise', 'Lettuce'], true],
  ['Smash Beef Burger', 'c1', 890, 410, 'Double smashed patty with cheddar and house sauce', ['halal'], ['Beef patty', 'Burger bun', 'Cheddar', 'House sauce']],
  ['Chicken Tikka Burger', 'c1', 750, 320, 'Tikka-marinated grilled chicken, mint chutney', ['halal', 'spicy'], ['Chicken', 'Burger bun', 'Mint chutney']],
  ['Veggie Crunch Burger', 'c1', 590, 240, 'Crispy vegetable patty with fresh salad', ['halal', 'vegetarian'], ['Veg patty', 'Burger bun', 'Lettuce']],
  ['BBQ Chicken Stack', 'c1', 820, 370, 'Smoky BBQ chicken stack with onion rings', ['halal'], ['Chicken', 'Burger bun', 'BBQ sauce', 'Onion']],
  ['Mushroom Swiss Burger', 'c1', 860, 390, 'Beef patty topped with mushrooms and Swiss cheese', ['halal'], ['Beef patty', 'Mushroom', 'Cheese']],
  ['Chicken Tikka Pizza', 'c2', 1450, 560, 'Desi favorite with tikka chunks, onions and capsicum', ['halal', 'spicy'], ['Pizza dough', 'Mozzarella', 'Chicken', 'Capsicum'], true],
  ['Fajita Pizza', 'c2', 1390, 540, 'Fajita chicken, peppers and creamy sauce', ['halal'], ['Pizza dough', 'Mozzarella', 'Chicken', 'Capsicum']],
  ['Pepperoni-style Beef Pizza', 'c2', 1550, 620, 'Beef salami slices with extra mozzarella', ['halal'], ['Pizza dough', 'Mozzarella', 'Beef salami']],
  ['Margherita Pizza', 'c2', 1190, 430, 'Classic tomato, basil and mozzarella', ['halal', 'vegetarian'], ['Pizza dough', 'Mozzarella', 'Tomato sauce']],
  ['Malai Boti Pizza', 'c2', 1490, 590, 'Creamy malai boti with a garlic drizzle', ['halal'], ['Pizza dough', 'Mozzarella', 'Chicken']],
  ['Veggie Supreme Pizza', 'c2', 1290, 470, 'Olives, mushrooms, corn and peppers', ['halal', 'vegetarian'], ['Pizza dough', 'Mozzarella', 'Mushroom', 'Capsicum']],
  ['Club Sandwich', 'c3', 790, 330, 'Triple-decker with chicken, egg and fries', ['halal'], ['Bread', 'Chicken', 'Egg', 'Mayonnaise'], true],
  ['Grilled Chicken Sandwich', 'c3', 690, 280, 'Grilled chicken with cheese on toasted bread', ['halal'], ['Bread', 'Chicken', 'Cheese']],
  ['Steak Sandwich', 'c3', 990, 450, 'Sliced beef steak with peppercorn sauce', ['halal'], ['Bread', 'Beef', 'Pepper sauce']],
  ['Egg & Cheese Sandwich', 'c3', 490, 190, 'Soft scrambled egg with melted cheese', ['halal', 'vegetarian'], ['Bread', 'Egg', 'Cheese']],
  ['Tuna Melt', 'c3', 750, 340, 'Tuna salad and cheddar, grilled until golden', ['halal'], ['Bread', 'Tuna', 'Cheese']],
  ['Chicken Biryani', 'c4', 520, 210, 'Fragrant basmati rice layered with spiced chicken', ['halal', 'spicy'], ['Basmati rice', 'Chicken', 'Spices', 'Yogurt'], true],
  ['Chicken Karahi (Half)', 'c4', 1450, 650, 'Wok-cooked tomato-ginger chicken karahi', ['halal', 'spicy'], ['Chicken', 'Tomato', 'Ginger', 'Spices']],
  ['Mutton Karahi (Half)', 'c4', 2450, 1250, 'Slow-cooked mutton karahi with green chilies', ['halal', 'spicy'], ['Mutton', 'Tomato', 'Ginger', 'Spices']],
  ['Beef Nihari', 'c4', 890, 400, 'Slow-simmered beef shank with naan', ['halal', 'spicy'], ['Beef', 'Spices', 'Flour']],
  ['Chicken Handi', 'c4', 1350, 590, 'Creamy handi gravy with tender chicken', ['halal'], ['Chicken', 'Cream', 'Spices']],
  ['Daal Mash', 'c4', 450, 150, 'Slow-cooked white lentils with butter tadka', ['halal', 'vegetarian'], ['Lentils', 'Butter', 'Spices']],
  ['Seekh Kabab Platter', 'c4', 990, 430, 'Four seekh kababs with mint chutney and naan', ['halal', 'spicy'], ['Mince', 'Spices', 'Flour']],
  ['Mint Lemonade', 'c5', 250, 70, 'Fresh lemon and mint, chilled', ['vegetarian', 'gluten-free'], ['Lemon', 'Mint', 'Sugar'], true],
  ['Mango Lassi', 'c5', 320, 110, 'Thick yogurt shake with Sindhri mango', ['vegetarian', 'gluten-free'], ['Yogurt', 'Mango', 'Sugar']],
  ['Doodh Patti Chai', 'c5', 180, 50, 'Classic milky tea brewed on the stove', ['vegetarian', 'gluten-free'], ['Tea leaves', 'Milk', 'Sugar']],
  ['Cold Coffee', 'c5', 420, 150, 'Iced blended coffee with cream', ['vegetarian'], ['Coffee', 'Milk', 'Ice cream']],
  ['Soft Drink (345ml)', 'c5', 150, 80, 'Chilled soft drink can', ['vegetarian', 'gluten-free'], ['Soft drink']],
  ['Fresh Orange Juice', 'c5', 350, 140, 'Squeezed to order', ['vegetarian', 'gluten-free'], ['Oranges']],
  ['Chocolate Brownie', 'c6', 450, 160, 'Warm brownie with vanilla ice cream', ['vegetarian'], ['Chocolate', 'Flour', 'Ice cream'], true],
  ['Gulab Jamun (2 pcs)', 'c6', 220, 70, 'Warm milk dumplings in cardamom syrup', ['vegetarian'], ['Milk powder', 'Sugar']],
  ['Kheer', 'c6', 280, 90, 'Rice pudding with pistachios', ['vegetarian', 'gluten-free'], ['Rice', 'Milk', 'Sugar']],
  ['Kulfi Falooda', 'c6', 390, 140, 'Pistachio kulfi on falooda with rose syrup', ['vegetarian'], ['Milk', 'Vermicelli', 'Sugar']],
  ['Cheesecake Slice', 'c6', 590, 230, 'New York style baked cheesecake', ['vegetarian'], ['Cream cheese', 'Biscuit', 'Sugar']],
]

const catImage: Record<string, string> = Object.fromEntries(categories.map((c) => [c.id, c.image]))

export const products: Product[] = seeds.map(([name, categoryId, basePrice, costPrice, description, dietary, ingredients, featured], i) => ({
  id: `p${i + 1}`,
  name,
  sku: `ZK-${categoryId.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
  categoryId,
  description,
  image: catImage[categoryId],
  basePrice,
  costPrice,
  taxRateId: categoryId === 'c5' ? 'tx4' : 'tx1',
  available: i % 11 !== 7,
  featured: Boolean(featured),
  dietary,
  optionGroups: optionsByCategory[categoryId] ?? [],
  ingredients,
  branchIds: i % 9 === 4 ? ['b1', 'b3'] : ['b1', 'b2', 'b3'],
  menuId: categoryId === 'c6' && i % 2 === 0 ? 'm3' : 'm1',
  schedule: 'all-day',
}))
