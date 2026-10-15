/** Deterministic PRNG so mock data is identical on every render and between server and client. */
export function createRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}

export function int(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function isoDaysAgo(reference: string, days: number, hour = 12, minute = 0) {
  const d = new Date(`${reference}T00:00:00`)
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
