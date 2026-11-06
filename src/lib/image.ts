import type { ColorFeatures, ROI } from "@/types"
import { completeColorFeatures } from "@/lib/color"
import { detectWells } from "@/lib/wells"

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const center = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2
}

export function extractColorFeaturesFromImage(image: HTMLImageElement, rois: ROI[]): ROI[] {
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("浏览器不支持 Canvas 图像分析")
  context.drawImage(image, 0, 0)
  const scale = Math.min(canvas.width, canvas.height)

  return rois.map((roi) => {
    const centerX = roi.x * canvas.width
    const centerY = roi.y * canvas.height
    const radius = Math.max(2, roi.radius * scale * 0.72)
    const left = Math.max(0, Math.floor(centerX - radius))
    const top = Math.max(0, Math.floor(centerY - radius))
    const right = Math.min(canvas.width, Math.ceil(centerX + radius))
    const bottom = Math.min(canvas.height, Math.ceil(centerY + radius))
    const pixels = context.getImageData(left, top, right - left, bottom - top).data
    const rs: number[] = [], gs: number[] = [], bs: number[] = []
    let white = 0, black = 0
    for (let y = 0; y < bottom - top; y++) for (let x = 0; x < right - left; x++) {
      const px = left + x + 0.5 - centerX
      const py = top + y + 0.5 - centerY
      if (px * px + py * py > radius * radius) continue
      const index = (y * (right - left) + x) * 4
      if (pixels[index + 3] < 128) continue
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2]
      rs.push(r); gs.push(g); bs.push(b)
      if (r > 245 && g > 245 && b > 245) white++
      if (r < 15 && g < 15 && b < 15) black++
    }
    if (!rs.length) return roi
    const meanR = rs.reduce((sum, value) => sum + value, 0) / rs.length
    const meanG = gs.reduce((sum, value) => sum + value, 0) / gs.length
    const meanB = bs.reduce((sum, value) => sum + value, 0) / bs.length
    const total = meanR + meanG + meanB || 1
    const colorFeatures: ColorFeatures = completeColorFeatures({
      meanR, meanG, meanB,
      medianR: median(rs), medianG: median(gs), medianB: median(bs),
      normalizedR: meanR / total, normalizedG: meanG / total, normalizedB: meanB / total,
      grayscale: 0.299 * meanR + 0.587 * meanG + 0.114 * meanB,
      whitePixelRatio: white / rs.length,
      blackPixelRatio: black / rs.length,
    })
    return { ...roi, colorFeatures }
  })
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("图片读取失败"))
      image.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

export type DemoImageScenario = "standard" | "low_light" | "overexposed" | "out_of_range"

export async function createDemoReactionImage(mode: "calibration" | "detection" = "calibration", scenario: DemoImageScenario = "standard") {
  const canvas = document.createElement("canvas")
  canvas.width = 1200; canvas.height = 720
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#e8edf0"; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#f8fafb"; ctx.fillRect(80, 90, 1040, 540)
  ctx.strokeStyle = "#cbd5dc"; ctx.lineWidth = 4; ctx.strokeRect(80, 90, 1040, 540)
  let colors = mode === "calibration"
    ? ["#edf5ef", "#cde9e8", "#9bd5d7", "#54b5c2", "#238ea5", "#12637f"]
    : ["#edf5ef", "#4aabb9", "#2d8ea5"]
  if (mode === "detection" && scenario === "out_of_range") colors = ["#edf5ef", "#105b76", "#07364c"]
  colors.forEach((color, index) => {
    const x = colors.length > 3 ? 180 + index * 168 : 310 + index * 290
    const y = 355
    ctx.beginPath(); ctx.arc(x, y, 78, 0, Math.PI * 2)
    ctx.fillStyle = "#d5dde1"; ctx.fill()
    ctx.beginPath(); ctx.arc(x, y, 66, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
    const gradient = ctx.createRadialGradient(x - 20, y - 25, 5, x, y, 64)
    gradient.addColorStop(0, "rgba(255,255,255,.32)"); gradient.addColorStop(1, "rgba(0,40,55,.08)")
    ctx.fillStyle = gradient; ctx.fill()
  })
  if (scenario === "low_light") { ctx.fillStyle = "rgba(3, 12, 18, .58)"; ctx.fillRect(0, 0, canvas.width, canvas.height) }
  if (scenario === "overexposed") {
    ctx.fillStyle = "rgba(255, 255, 255, .55)"; ctx.fillRect(0, 0, canvas.width, canvas.height)
    colors.forEach((_, index) => { const x = colors.length > 3 ? 180 + index * 168 : 310 + index * 290; ctx.beginPath(); ctx.arc(x - 20, 330, 28, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fill() })
  }
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/png"))
  return new File([blob], `demo-${mode}-${scenario}.png`, { type: "image/png" })
}

export function detectWellsFromImage(image: HTMLImageElement): Array<Pick<ROI, "x" | "y" | "radius">> {
  const canvas = document.createElement("canvas")
  const maxSide = 480
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return []
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  return detectWells(canvas.width, canvas.height, data)
}
