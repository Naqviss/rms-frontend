import type { Employee, EmployeeRole } from '@/types'
import { createRng, int, pick } from '@/lib/utils/seed'

type Row = [name: string, role: EmployeeRole, branch: string, payType: Employee['payType'], rate: number]

const rows: Row[] = [
  ['Faisal Ahmed', 'manager', 'b1', 'monthly', 145000],
  ['Nadia Hussain', 'manager', 'b2', 'monthly', 135000],
  ['Bilal Sheikh', 'manager', 'b3', 'monthly', 140000],
  ['Kashif Ali', 'cashier', 'b1', 'monthly', 55000],
  ['Sidra Parveen', 'cashier', 'b2', 'monthly', 52000],
  ['Rizwan Haider', 'cashier', 'b3', 'monthly', 54000],
  ['Imtiaz Hussain', 'chef', 'b1', 'monthly', 120000],
  ['Chef Waseem', 'chef', 'b2', 'monthly', 110000],
  ['Chef Javed', 'chef', 'b3', 'monthly', 115000],
  ['Aslam Baig', 'kitchen-staff', 'b1', 'daily', 1800],
  ['Rafiq Ahmed', 'kitchen-staff', 'b2', 'daily', 1700],
  ['Zahid Mehmood', 'waiter', 'b1', 'monthly', 42000],
  ['Shahid Afridi', 'waiter', 'b1', 'monthly', 41000],
  ['Noman Ali', 'waiter', 'b2', 'monthly', 40000],
  ['Tariq Aziz', 'waiter', 'b3', 'hourly', 320],
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
    email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@zaiqakitchen.pk`,
    joinedAt: `202${int(rng, 2, 5)}-${String(int(rng, 1, 12)).padStart(2, '0')}-${String(int(rng, 1, 28)).padStart(2, '0')}`,
    payType,
    payRate,
    commissionType: role === 'rider' ? 'per-order' : role === 'waiter' ? 'percentage' : 'none',
    commissionRate: role === 'rider' ? 40 : role === 'waiter' ? 2 : 0,
    status: i === 13 ? 'on-leave' : i === 10 ? 'inactive' : 'active',
    shift: pick(rng, ['morning', 'evening', 'night'] as const),
    attendanceRate: int(rng, 82, 100),
    performance: int(rng, 68, 98),
    ordersHandled: role === 'waiter' || role === 'cashier' || role === 'rider' ? int(rng, 180, 1400) : 0,
    color: pick(rng, palette),
  }))
})()
