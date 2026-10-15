import type { Metadata } from 'next'
import { DashboardGrid } from '@/components/dashboard/dashboard-grid'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return <DashboardGrid />
}
