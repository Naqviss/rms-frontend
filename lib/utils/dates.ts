const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date in the browser's local time zone, `YYYY-MM-DD`. */
export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local `YYYY-MM-DDTHH:mm:00` timestamp `days` before `reference` (a `YYYY-MM-DD` date) at the given time. */
export function isoDaysAgo(reference: string, days: number, hour = 12, minute = 0) {
  const d = new Date(`${reference}T00:00:00`)
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}
