import type { Metadata } from 'next'
import { Storefront } from '@/components/store/storefront'

export const metadata: Metadata = {
  title: 'Restaurant website',
  description: 'Menu, contact details and opening information.',
}

export default function StorePage() {
  return (
    <main>
      <Storefront />
    </main>
  )
}
