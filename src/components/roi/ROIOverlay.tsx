import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import type { ROI } from "@/types"
import { cn } from "@/lib/utils"

type DragState = { id: string; mode: "move" | "resize"; startX: number; startY: number; initial: ROI }

export function ROIOverlay({ rois, selectedId, onChange, onSelect, onAdd, readOnly = false }: { rois: ROI[]; selectedId?: string; onChange: (rois: ROI[]) => void; onSelect: (id?: string) => void; onAdd: (x: number, y: number) => void; readOnly?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); const [size, setSize] = useState({ width: 1, height: 1 }); const [drag, setDrag] = useState<DragState | null>(null)
  useEffect(() => { if (!ref.current) return; const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height })); observer.observe(ref.current); return () => observer.disconnect() }, [])
  const minSize = Math.min(size.width, size.height)
  const updateDrag = (event: React.PointerEvent) => {
    if (!drag) return
    const dx = (event.clientX - drag.startX) / size.width; const dy = (event.clientY - drag.startY) / size.height
    let next = drag.initial
    if (drag.mode === "move") {
      const rx = drag.initial.radius * minSize / size.width; const ry = drag.initial.radius * minSize / size.height
      next = { ...drag.initial, x: Math.max(rx, Math.min(1 - rx, drag.initial.x + dx)), y: Math.max(ry, Math.min(1 - ry, drag.initial.y + dy)) }
    } else {
      const distance = Math.sqrt((event.clientX - (drag.initial.x * size.width)) ** 2 + (event.clientY - (drag.initial.y * size.height)) ** 2) / minSize
      const maxRadius = Math.min(drag.initial.x * size.width, (1 - drag.initial.x) * size.width, drag.initial.y * size.height, (1 - drag.initial.y) * size.height) / minSize
      next = { ...drag.initial, radius: Math.max(0.025, Math.min(0.16, maxRadius, distance)) }
    }
    onChange(rois.map((roi) => roi.id === drag.id ? next : roi))
  }
  return <div ref={ref} className="absolute inset-0 touch-none" onPointerMove={updateDrag} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)} onPointerDown={(event) => { if (event.target !== event.currentTarget || readOnly) return; const rect = event.currentTarget.getBoundingClientRect(); onAdd((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height) }}>
    {rois.map((roi, index) => { const radiusPx = roi.radius * minSize; const selected = selectedId === roi.id; return <div key={roi.id} className={cn("absolute rounded-full border-2 shadow-[0_0_0_1px_rgba(255,255,255,.75)]", roi.sampleType === "blank" ? "border-sky-500 bg-sky-400/10" : roi.sampleType === "quality_control" ? "border-amber-500 bg-amber-400/10" : "border-emerald-500 bg-emerald-400/10", selected && "ring-2 ring-white ring-offset-2 ring-offset-primary")} style={{ left: roi.x * size.width - radiusPx, top: roi.y * size.height - radiusPx, width: radiusPx * 2, height: radiusPx * 2 }} onPointerDown={(event) => { if (readOnly) return; event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onSelect(roi.id); setDrag({ id: roi.id, mode: "move", startX: event.clientX, startY: event.clientY, initial: roi }) }}>
      <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-slate-900/75 px-1.5 text-[11px] font-semibold text-white">{index + 1}</span>
      {selected && !readOnly && <><button title="删除 ROI" className="absolute -right-3 -top-3 grid h-6 w-6 place-items-center rounded-full bg-red-600 text-white shadow" onPointerDown={(event) => { event.stopPropagation(); onChange(rois.filter((item) => item.id !== roi.id)); onSelect(undefined) }}><X className="h-3.5 w-3.5" /></button><div title="拖动调整大小" className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-primary shadow" onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDrag({ id: roi.id, mode: "resize", startX: event.clientX, startY: event.clientY, initial: roi }) }} /></>}
    </div> })}
  </div>
}
