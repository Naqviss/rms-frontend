import type { Metadata } from 'next'
import { Storefront } from '@/components/store/storefront'

export const metadata: Metadata = {
  title: 'Order food online',
  description: 'Order your favourites online for delivery or pickup.',
}

export default function StorePage() {
  return (
    <main>
      <Storefront />
    </main>
  )
}
