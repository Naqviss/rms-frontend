import type { Employee, EmployeeRole } from '@/types'
import { createRng, int, pick } from '@/lib/utils/seed'

type Row = [name: string, role: EmployeeRole, branch: string, payType: Employee['payType'], rate: number]

const rows: Row[] = [
  ['Faisal Ahmed', 'manager', 'b1', 'monthly', 135000],
  ['Nadia Hussain', 'manager', 'b2', 'monthly', 125000],
  ['Bilal Sheikh', 'manager', 'b3', 'monthly', 130000],
  ['Kashif Ali', 'cashier', 'b1', 'monthly', 52000],
  ['Sidra Parveen', 'cashier', 'b2', 'monthly', 50000],
  ['Rizwan Haider', 'cashier', 'b3', 'monthly', 51000],
  ['Imtiaz Hussain', 'stock-keeper', 'b1', 'monthly', 60000],
  ['Waseem Akhtar', 'stock-keeper', 'b2', 'monthly', 56000],
  ['Javed Iqbal', 'stock-keeper', 'b3', 'monthly', 57000],
  ['Aslam Baig', 'packer', 'b1', 'daily', 1700],
  ['Rafiq Ahmed', 'packer', 'b2', 'daily', 1600],
  ['Zahid Mehmood', 'salesman', 'b1', 'monthly', 40000],
  ['Shahid Afridi', 'salesman', 'b1', 'monthly', 39000],
  ['Noman Ali', 'salesman', 'b2', 'monthly', 38000],
  ['Tariq Aziz', 'salesman', 'b3', 'hourly', 300],
  ['Adeel Rider', 'rider', 'b1', 'monthly', 38000],
  ['Shoaib Rider', 'rider', 'b2', 'monthly', 36000],
  ['Waqas Rider', 'rider', 'b3', 'monthly', 37000],
  ['Rabia Kamal', 'accountant', 'b1', 'monthly', 95000],
  ['Owais Qureshi', 'admin', 'b1', 'monthly', 125000],
]

const palette = ['oklch(0.55 0.2 272)', 'oklch(0.6 0.15 150)', 'oklch(0.65 0.18 30)', 'oklch(0.55 0.15 200)', 'oklch(0.6 0.18 330)']

export const employees: Employee[] = (() => {
  const rng = createRng(777)
  return rows.map(([name, role, branchId, payType, payRate], i) => ({
    id: `e${i + 1}`,
    code: `EMP-${String(i + 101)}`,
    name,
    role,
    branchId,
    phone: `+92 3${int(rng, 0, 4)}${int(rng, 0, 9)} ${int(rng, 1000000, 9999999)}`,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@alnoormart.pk`,
    joinedAt: `202${int(rng, 2, 5)}-${String(int(rng, 1, 12)).padStart(2, '0')}-${String(int(rng, 1, 28)).padStart(2, '0')}`,
    payType,
    payRate,
    commissionType: role === 'rider' ? 'per-order' : role === 'salesman' ? 'percentage' : 'none',
    commissionRate: role === 'rider' ? 40 : role === 'salesman' ? 1 : 0,
    status: i === 13 ? 'on-leave' : i === 10 ? 'inactive' : 'active',
    shift: pick(rng, ['morning', 'evening', 'night'] as const),
    attendanceRate: int(rng, 82, 100),
    performance: int(rng, 68, 98),
    ordersHandled: role === 'packer' || role === 'cashier' || role === 'rider' ? int(rng, 180, 1400) : 0,
    color: pick(rng, palette),
  }))
})()
