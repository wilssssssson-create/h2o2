import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportJson, toCsv, downloadText } from "@/lib/export"
export function ExportButton({ data, filename, csv, label = "导出" }: { data: unknown; filename: string; csv?: Record<string, unknown>[]; label?: string }) { return <div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => exportJson(data, `${filename}.json`)}><Download className="h-3.5 w-3.5" />{label} JSON</Button>{csv && <Button variant="ghost" size="sm" onClick={() => downloadText(toCsv(csv), `${filename}.csv`, "text/csv;charset=utf-8")}>CSV</Button>}</div> }
