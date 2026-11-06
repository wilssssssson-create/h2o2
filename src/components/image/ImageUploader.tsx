import { useRef } from "react"
import { Camera, ImagePlus, RotateCcw, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils"

export function ImageUploader({ file, dimensions, onFile, onError }: { file?: File | null; dimensions?: { width: number; height: number } | null; onFile: (file: File) => void; onError: (message: string) => void }) {
  const uploadRef = useRef<HTMLInputElement>(null); const cameraRef = useRef<HTMLInputElement>(null)
  const select = (candidate?: File) => { if (!candidate) return; if (!candidate.type.match(/^image\/(jpeg|png)$/)) { onError("仅支持 JPG、JPEG 或 PNG 图片"); return } if (candidate.size > 15 * 1024 * 1024) { onError("图片不能超过 15 MB"); return } onFile(candidate) }
  return <Card className="overflow-hidden border-dashed shadow-none">
    <input ref={uploadRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(event) => select(event.target.files?.[0])} />
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => select(event.target.files?.[0])} />
    <div className="flex flex-col items-center justify-center gap-3 px-5 py-7 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">{file ? <ImagePlus className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}</div>
      <div><p className="text-sm font-medium">{file ? file.name : "上传反应液照片"}</p><p className="mt-1 text-xs text-muted-foreground">JPG / PNG，最大 15 MB</p></div>
      {file && <div className="text-xs text-muted-foreground">{dimensions ? `${dimensions.width} × ${dimensions.height} px · ` : ""}{formatNumber(file.size / 1024, 1)} KB</div>}
      <div className="flex flex-wrap justify-center gap-2"><Button size="sm" onClick={() => uploadRef.current?.click()}>{file ? <RotateCcw className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}{file ? "重新上传" : "选择图片"}</Button><Button size="sm" variant="outline" onClick={() => cameraRef.current?.click()}><Camera className="h-4 w-4" />拍照</Button></div>
    </div>
  </Card>
}
