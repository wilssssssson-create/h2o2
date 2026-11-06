import { useEffect, useState } from "react"
import { ImageIcon, Sparkles } from "lucide-react"
import type { DemoImageScenario } from "@/lib/image"
import { createDemoReactionImage } from "@/lib/image"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const scenarioText: Record<DemoImageScenario, { title: string; description: string; badge: string }> = {
  standard: { title: "标准光照", description: "曝光均匀，适合演示正常标定和检测流程。", badge: "推荐" },
  low_light: { title: "低照度照片", description: "整体偏暗，用于演示图片亮度质量告警。", badge: "质量异常" },
  overexposed: { title: "过曝与反光", description: "高亮像素较多，用于演示反光检查。", badge: "质量异常" },
  out_of_range: { title: "高浓度样品", description: "颜色响应超出标准曲线，用于演示超范围状态。", badge: "超出范围" },
}

export function DemoImageDialog({ open, onOpenChange, mode, onSelect }: { open: boolean; onOpenChange: (open: boolean) => void; mode: "calibration" | "detection"; onSelect: (file: File, scenario: DemoImageScenario) => void }) {
  const scenarios: DemoImageScenario[] = mode === "calibration" ? ["standard", "low_light", "overexposed"] : ["standard", "low_light", "overexposed", "out_of_range"]
  const [images, setImages] = useState<Array<{ scenario: DemoImageScenario; file: File; url: string }>>([])
  useEffect(() => { if (!open) return; let disposed = false; const urls: string[] = []; Promise.all(scenarios.map(async (scenario) => { const file = await createDemoReactionImage(mode, scenario); const url = URL.createObjectURL(file); urls.push(url); return { scenario, file, url } })).then((items) => { if (!disposed) setImages(items) }); return () => { disposed = true; urls.forEach(URL.revokeObjectURL); setImages([]) } }, [open, mode])
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />选择演示照片</DialogTitle><DialogDescription>照片由浏览器 Canvas 实时生成，不包含真实实验数据。</DialogDescription></DialogHeader><div className="grid max-h-[68vh] gap-4 overflow-y-auto sm:grid-cols-2">{images.length ? images.map(({ scenario, file, url }) => { const text = scenarioText[scenario]; return <button key={scenario} className="overflow-hidden rounded-lg border bg-white text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" onClick={() => { onSelect(file, scenario); onOpenChange(false) }}><div className="aspect-[5/3] overflow-hidden bg-slate-100"><img src={url} alt={text.title} className="h-full w-full object-cover" /></div><div className="p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{text.title}</p><Badge variant={scenario === "standard" ? "success" : "warning"}>{text.badge}</Badge></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{text.description}</p></div></button> }) : <div className="col-span-full grid min-h-52 place-items-center text-sm text-muted-foreground"><ImageIcon className="mr-2 inline h-4 w-4" />正在生成演示照片…</div>}</div><div className="flex justify-end"><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button></div></DialogContent></Dialog>
}
