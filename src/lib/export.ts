export function downloadText(content: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement("a")
  anchor.href = url; anchor.download = filename; anchor.click()
  URL.revokeObjectURL(url)
}

export function exportJson(data: unknown, filename: string) { downloadText(JSON.stringify(data, null, 2), filename) }

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
  return `\ufeff${headers.map(escape).join(",")}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(",")).join("\n")}`
}
