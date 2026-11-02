import type { Customer } from '@/types'
import { config } from '@/lib/config'
import { createRng, int, isoDaysAgo, pick } from '@/lib/utils/seed'

const names = [
  'Ahmed Raza', 'Fatima Noor', 'Hassan Ali', 'Ayesha Khan', 'Bilal Chaudhry', 'Sara Malik', 'Usman Tariq', 'Zainab Shah',
  'Omar Farooq', 'Hira Baig', 'Kamran Akmal', 'Mehreen Saeed', 'Danish Qazi', 'Amna Iqbal', 'Rashid Mehmood', 'Sobia Hashmi',
  'Taha Siddiqui', 'Laiba Ansari', 'Yasir Jamil', 'Noor ul Ain', 'Imtiaz Gill', 'Rida Fatima', 'Salman Butt', 'Maryam Aziz',
  'Junaid Khalid', 'Anum Rehman',
]
const cities = ['Karachi', 'Karachi', 'Karachi', 'Lahore', 'Islamabad']
const staples = ['Milk 1 L', 'Chakki Atta 10 kg', 'Danedar Tea 900 g', 'Sandwich Bread', 'Farm Eggs', 'Cooking Oil 5 L', 'Washing Powder 1 kg', 'Tomatoes']
const palette = ['oklch(0.55 0.2 272)', 'oklch(0.6 0.15 150)', 'oklch(0.65 0.18 30)', 'oklch(0.55 0.15 200)', 'oklch(0.6 0.18 330)']

export const customers: Customer[] = (() => {
  const rng = createRng(555)
  return names.map((name, i) => {
    const orders = int(rng, 1, 64)
    const spent = orders * int(rng, 1400, 6200)
    const lastVisitDays = int(rng, 0, 75)
    const segment: Customer['segment'] = orders > 40 ? 'vip' : lastVisitDays > 45 ? 'at-risk' : orders < 4 ? 'new' : 'regular'
    const auth = pick(rng, ['phone-otp', 'phone-otp', 'email', 'google', 'walk-in'] as const)
    return {
      id: `cu${i + 1}`,
      name,
      phone: `+92 3${int(rng, 0, 4)}${int(rng, 0, 9)} ${int(rng, 1000000, 9999999)}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      city: pick(rng, cities),
      registeredAt: isoDaysAgo(config.referenceDate, int(rng, 20, 600)).slice(0, 10),
      totalOrders: orders,
      totalSpent: spent,
      loyaltyPoints: Math.round(spent / 100),
      lastVisit: isoDaysAgo(config.referenceDate, lastVisitDays),
      segment,
      authMethod: auth,
      accountStatus: i === 19 ? 'blocked' : 'active',
      notes: i % 5 === 0 ? 'Buys monthly ration in the first week. Prefers delivery after 6 pm.' : i % 7 === 0 ? 'Orders office pantry supplies every Monday.' : '',
      favoriteItems: [pick(rng, staples), pick(rng, staples)],
      color: pick(rng, palette),
    }
  })
})()
