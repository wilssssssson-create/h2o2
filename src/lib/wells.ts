export type WellCircle = { x: number; y: number; radius: number }

const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b
const saturation = (r: number, g: number, b: number) => { const max = Math.max(r, g, b), min = Math.min(r, g, b); return max === 0 ? 0 : (max - min) / max }

function pixel(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const ix = Math.round(x), iy = Math.round(y)
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return null
  const index = (iy * width + ix) * 4
  return [data[index], data[index + 1], data[index + 2]] as const
}

function circleScore(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, radius: number) {
  const count = 16
  let rim = 0, insideSat = 0, outside = 0, outsideSat = 0
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2
    const rimPixel = pixel(data, width, height, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
    const insidePixel = pixel(data, width, height, x + Math.cos(angle) * radius * 0.4, y + Math.sin(angle) * radius * 0.4)
    const outsidePixel = pixel(data, width, height, x + Math.cos(angle) * radius * 1.45, y + Math.sin(angle) * radius * 1.45)
    if (!rimPixel || !insidePixel || !outsidePixel) return 0
    rim += luminance(...rimPixel)
    insideSat += saturation(...insidePixel)
    outside += luminance(...outsidePixel)
    outsideSat += saturation(...outsidePixel)
  }
  const contrast = outside / count - rim / count
  const colorGap = insideSat / count - outsideSat / count
  if (contrast < 6 && colorGap < 0.12) return 0
  return contrast / 30 + colorGap
}

export function detectWells(width: number, height: number, data: Uint8ClampedArray): WellCircle[] {
  const minSide = Math.min(width, height)
  const radii = [0.055, 0.075, 0.095].map((fraction) => fraction * minSide)
  const stride = Math.max(3, Math.round(minSide * 0.02))
  const candidates: Array<WellCircle & { score: number }> = []
  for (let y = stride; y < height - stride; y += stride) {
    for (let x = stride; x < width - stride; x += stride) {
      let best = 0
      let bestRadius = radii[0]
      for (const radius of radii) {
        if (x - radius * 1.5 < 1 || y - radius * 1.5 < 1 || x + radius * 1.5 >= width - 1 || y + radius * 1.5 >= height - 1) continue
        const score = circleScore(data, width, height, x, y, radius)
        if (score > best) { best = score; bestRadius = radius }
      }
      if (best > 0.5) candidates.push({ x: x / width, y: y / height, radius: bestRadius / minSide, score: best })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  const kept: typeof candidates = []
  for (const candidate of candidates) {
    const crowded = kept.some((item) => Math.hypot((item.x - candidate.x) * width, (item.y - candidate.y) * height) < minSide * 0.2)
    if (crowded) continue
    kept.push(candidate)
    if (kept.length === 12) break
  }
  return kept.sort((a, b) => a.x - b.x || a.y - b.y).map(({ x, y, radius }) => ({ x, y, radius }))
}
