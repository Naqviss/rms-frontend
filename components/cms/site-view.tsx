'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MapPinIcon, MailIcon, PhoneIcon, PlusIcon, ShoppingBagIcon, StarIcon, TruckIcon } from 'lucide-react'
import { fontStacks, type SiteTemplate } from '@/lib/cms/templates'
import { formatCurrency } from '@/lib/utils/format'
import type { SiteContent, SiteSections } from '@/stores/site-store'

export interface SiteItem {
  id: string
  name: string
  description: string
  price: number
  image: string
}

interface SiteViewProps {
  template: SiteTemplate
  accent?: string | null
  content: SiteContent
  sections: SiteSections
  items: SiteItem[]
  onAdd?: (item: SiteItem) => void
  cartCount?: number
  onCart?: () => void
}

const reviews = [
  { name: 'Ayesha K.', text: 'Hot, fresh and right on time. Our weekly go-to.' },
  { name: 'Bilal R.', text: 'Portions are generous and the flavours are spot on.' },
  { name: 'Sana M.', text: 'Ordering was effortless and the rider was lovely.' },
]

/**
 * Renders a restaurant website from a template. Layout adapts to its own width via container queries,
 * so the same markup works as a scaled preview and as the live storefront.
 */
export function SiteView({ template, accent, content, sections, items, onAdd, cartCount = 0, onCart }: SiteViewProps) {
  const c = { ...template.colors, accent: accent ?? template.colors.accent }
  const r = template.radius
  const root: CSSProperties = { background: c.bg, color: c.text, fontFamily: fontStacks[template.font] }
  const surface: CSSProperties = { background: c.surface, borderRadius: r }
  const accentBg: CSSProperties = { background: c.accent, color: c.accentText }
  const heading = { fontFamily: template.font === 'sans' ? undefined : fontStacks[template.font] }

  const heroText = (align: 'left' | 'center', light = false) => (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-lg'} style={light ? { color: '#fff' } : undefined}>
      <p className="mb-3 text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: light ? '#fff' : c.accent }}>
        {template.cuisine}
      </p>
      <h1 className="text-4xl leading-tight font-bold text-balance @3xl:text-5xl" style={heading}>
        {content.heroTitle}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-pretty" style={{ color: light ? 'rgba(255,255,255,.85)' : c.muted }}>
        {content.heroSubtitle}
      </p>
      <a
        href="#menu"
        className={`mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold ${align === 'center' ? '' : ''}`}
        style={{ ...accentBg, borderRadius: Math.min(r, 999) }}
      >
        <ShoppingBagIcon className="size-4" aria-hidden />
        Order now
      </a>
    </div>
  )

  return (
    <div className="@container w-full" style={root}>
      <header className="flex items-center justify-between gap-4 px-6 py-4 @3xl:px-12">
        <span className="text-lg font-bold" style={heading}>
          {content.brandName}
        </span>
        <nav className="hidden items-center gap-6 text-sm @2xl:flex" style={{ color: c.muted }} aria-label="Site">
          <a href="#menu">Menu</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        {onCart ? (
          <button
            type="button"
            onClick={onCart}
            aria-label="Open cart"
            className="relative flex size-10 items-center justify-center"
            style={{ ...accentBg, borderRadius: Math.min(r, 999) }}
          >
            <ShoppingBagIcon className="size-5" aria-hidden />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: c.text, color: c.bg }}>
                {cartCount}
              </span>
            )}
          </button>
        ) : (
          <span className="px-4 py-2 text-sm font-semibold" style={{ ...accentBg, borderRadius: Math.min(r, 999) }}>
            Order online
          </span>
        )}
      </header>
      <nav className="flex gap-5 overflow-x-auto px-6 pb-3 text-sm @2xl:hidden" style={{ color: c.muted }} aria-label="Site">
        <a href="#menu">Menu</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </nav>

      {template.hero === 'centered' && (
        <section className="flex flex-col gap-10 px-6 pt-10 pb-12 @3xl:px-12">
          {heroText('center')}
          <img src={template.image} alt="" className="h-60 w-full object-cover @3xl:h-72" style={{ borderRadius: r }} />
        </section>
      )}
      {template.hero === 'split' && (
        <section className="grid items-center gap-8 px-6 py-10 @3xl:grid-cols-2 @3xl:px-12">
          {heroText('left')}
          <img src={template.image} alt="" className="h-64 w-full object-cover @3xl:h-80" style={{ borderRadius: r }} />
        </section>
      )}
      {template.hero === 'overlay' && (
        <section className="relative flex min-h-[26rem] items-center overflow-hidden px-6 @3xl:px-12">
          <img src={template.image} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.75), rgba(0,0,0,.2))' }} />
          <div className="relative py-16">{heroText('left', true)}</div>
        </section>
      )}
      {template.hero === 'stacked' && (
        <section className="flex flex-col">
          <img src={template.image} alt="" className="h-52 w-full object-cover @3xl:h-64" />
          <div className="relative -mt-12 mx-6 p-8 shadow-lg @3xl:mx-12" style={surface}>
            {heroText('center')}
          </div>
        </section>
      )}

      {sections.offers && (
        <section className="mx-6 mt-10 flex items-center gap-4 p-5 @3xl:mx-12" style={{ ...accentBg, borderRadius: r }}>
          <TruckIcon className="size-8 shrink-0" aria-hidden />
          <div>
            <p className="font-bold" style={heading}>
              Free delivery on orders over {formatCurrency(3000)}
            </p>
            <p className="text-sm opacity-90">Use code WELCOME10 for 10% off your first order.</p>
          </div>
        </section>
      )}

      {sections.menu && (
        <section id="menu" className="px-6 py-12 @3xl:px-12">
          <h2 className="mb-6 text-2xl font-bold" style={heading}>
            Popular dishes
          </h2>
          {template.menu === 'grid' && (
            <ul className="grid grid-cols-2 gap-4 @3xl:grid-cols-3">
              {items.map((i) => (
                <li key={i.id} className="flex flex-col overflow-hidden" style={surface}>
                  <img src={i.image} alt={i.name} className="aspect-[4/3] w-full object-cover" />
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <p className="font-semibold">{i.name}</p>
                    <p className="line-clamp-2 text-xs" style={{ color: c.muted }}>
                      {i.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <span className="font-bold" style={{ color: c.accent }}>
                        {formatCurrency(i.price)}
                      </span>
                      <AddButton item={i} onAdd={onAdd} style={accentBg} radius={r} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {template.menu === 'list' && (
            <ul className="mx-auto flex max-w-3xl flex-col">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 border-b py-4" style={{ borderColor: `${c.muted}44` }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={heading}>
                      {i.name}
                    </p>
                    <p className="truncate text-sm" style={{ color: c.muted }}>
                      {i.description}
                    </p>
                  </div>
                  <span className="font-bold" style={{ color: c.accent }}>
                    {formatCurrency(i.price)}
                  </span>
                  <AddButton item={i} onAdd={onAdd} style={accentBg} radius={r} />
                </li>
              ))}
            </ul>
          )}
          {template.menu === 'cards' && (
            <ul className="grid gap-4 @2xl:grid-cols-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-4 p-3" style={surface}>
                  <img src={i.image} alt={i.name} className="size-24 shrink-0 object-cover" style={{ borderRadius: Math.max(r - 6, 0) }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.name}</p>
                    <p className="line-clamp-2 text-xs" style={{ color: c.muted }}>
                      {i.description}
                    </p>
                    <p className="mt-2 font-bold" style={{ color: c.accent }}>
                      {formatCurrency(i.price)}
                    </p>
                  </div>
                  <AddButton item={i} onAdd={onAdd} style={accentBg} radius={r} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section id="about" className="mx-6 grid gap-6 p-8 @3xl:mx-12 @3xl:grid-cols-[1fr_1.4fr]" style={surface}>
        <h2 className="text-2xl font-bold" style={heading}>
          Our story
        </h2>
        <p className="leading-relaxed text-pretty" style={{ color: c.muted }}>
          {content.about}
        </p>
      </section>

      {sections.reviews && (
        <section className="px-6 py-12 @3xl:px-12">
          <h2 className="mb-6 text-2xl font-bold" style={heading}>
            Loved by guests
          </h2>
          <ul className="grid gap-4 @3xl:grid-cols-3">
            {reviews.map((rv) => (
              <li key={rv.name} className="flex flex-col gap-3 p-5" style={surface}>
                <div className="flex gap-0.5" style={{ color: c.accent }} aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, n) => (
                    <StarIcon key={n} className="size-4 fill-current" aria-hidden />
                  ))}
                </div>
                <p className="text-sm leading-relaxed">{rv.text}</p>
                <p className="text-xs font-semibold" style={{ color: c.muted }}>
                  {rv.name}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sections.gallery && (
        <section className="grid grid-cols-4 gap-2 px-6 pb-12 @3xl:px-12">
          {items.slice(0, 4).map((i) => (
            <img key={i.id} src={i.image} alt="" className="aspect-square w-full object-cover" style={{ borderRadius: r }} />
          ))}
        </section>
      )}

      <footer id="contact" className="mt-4 flex flex-col gap-6 p-8 @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:px-12" style={{ background: c.text, color: c.bg }}>
        <div>
          <p className="text-lg font-bold" style={heading}>
            {content.brandName}
          </p>
          {sections.reservations && <p className="mt-1 text-sm opacity-80">Reservations open daily, 12pm to 11pm.</p>}
        </div>
        <ul className="flex flex-col gap-2 text-sm opacity-90">
          <li className="flex items-center gap-2">
            <PhoneIcon className="size-4" aria-hidden />
            {content.phone}
          </li>
          <li className="flex items-center gap-2">
            <MailIcon className="size-4" aria-hidden />
            {content.email}
          </li>
          <li className="flex items-center gap-2">
            <MapPinIcon className="size-4" aria-hidden />
            {content.address}
          </li>
        </ul>
      </footer>
    </div>
  )
}

function AddButton({ item, onAdd, style, radius }: { item: SiteItem; onAdd?: (i: SiteItem) => void; style: CSSProperties; radius: number }) {
  if (!onAdd) return <span className="size-9 shrink-0" style={{ ...style, borderRadius: Math.min(radius, 999) }} aria-hidden />
  return (
    <button
      type="button"
      onClick={() => onAdd(item)}
      aria-label={`Add ${item.name} to cart`}
      className="flex size-9 shrink-0 items-center justify-center transition-transform active:scale-90"
      style={{ ...style, borderRadius: Math.min(radius, 999) }}
    >
      <PlusIcon className="size-4" aria-hidden />
    </button>
  )
}

/** Renders children on a fixed 1000px canvas and scales it to fit the available width. */
export function ScaledFrame({ height, children, width = 1000 }: { height: number; children: React.ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(el.clientWidth / width)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: height * scale }} aria-hidden>
      <div className="pointer-events-none absolute top-0 left-0 origin-top-left select-none" style={{ width, height, transform: `scale(${scale})` }}>
        <div className="h-full overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
