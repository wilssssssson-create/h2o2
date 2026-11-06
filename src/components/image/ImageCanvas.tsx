import { useEffect, useState } from "react"
import { Crosshair } from "lucide-react"
import type { ROI, SampleType } from "@/types"
import { createId } from "@/lib/utils"
import { ROIOverlay } from "@/components/roi/ROIOverlay"

export function ImageCanvas({ file, rois, onChange, selectedId, onSelect, defaultSampleType = "standard", onDimensions }: { file: File; rois: ROI[]; onChange: (rois: ROI[]) => void; selectedId?: string; onSelect: (id?: string) => void; defaultSampleType?: SampleType; onDimensions?: (size: { width: number; height: number }) => void }) {
  const [url, setUrl] = useState("")
  useEffect(() => { const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next) }, [file])
  const add = (x: number, y: number) => { const radius = 0.065; const clampedX = Math.max(radius, Math.min(1 - radius, x)); const clampedY = Math.max(radius, Math.min(1 - radius, y)); const id = createId("roi"); onChange([...rois, { id, x: clampedX, y: clampedY, radius, label: `ROI ${rois.length + 1}`, sampleType: rois.length === 0 ? "blank" : defaultSampleType }]); onSelect(id) }
  return <div className="relative overflow-hidden rounded-lg border bg-slate-200"><img src={url} alt="反应液分析图片" className="block h-auto w-full select-none" draggable={false} onLoad={(event) => onDimensions?.({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} /><ROIOverlay rois={rois} selectedId={selectedId} onChange={onChange} onSelect={onSelect} onAdd={add} />{rois.length === 0 && <div className="pointer-events-none absolute inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-xs text-white"><Crosshair className="h-4 w-4" />点击图片添加检测区域</div>}</div>
}
