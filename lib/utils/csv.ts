export type CsvRow = Record<string, string | number | boolean | null | undefined>

function escapeCell(value: CsvRow[string]) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(rows: CsvRow[]) {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((h) => escapeCell(row[h])).join(','))
  return lines.join('\n')
}

export function downloadCsv(filename: string, rows: CsvRow[], excel = false) {
  const csv = toCsv(rows)
  const blob = new Blob(['\ufeff' + csv], {
    type: excel ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${excel ? 'xls' : 'csv'}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
