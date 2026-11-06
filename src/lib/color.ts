import type { CalibrationModel, ColorFeatures, FeatureKey } from "@/types"
import { invertLogistic, invertMonotoneSpline } from "./regression"

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const center = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2
}

function srgbToLinear(channel: number) {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255, green = g / 255, blue = b / 255
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6
    else if (max === green) hue = (blue - red) / delta + 2
    else hue = (red - green) / delta + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  return { hue, saturation: max === 0 ? 0 : delta / max, value: max }
}

export function rgbToLab(r: number, g: number, b: number) {
  const red = srgbToLinear(r), green = srgbToLinear(g), blue = srgbToLinear(b)
  const x = red * 0.4124564 + green * 0.3575761 + blue * 0.1804375
  const y = red * 0.2126729 + green * 0.7151522 + blue * 0.072175
  const z = red * 0.0193339 + green * 0.119192 + blue * 0.9503041
  const epsilon = (6 / 29) ** 3
  const kappa = (29 / 3) ** 3
  const pivot = (value: number, white: number) => value / white > epsilon ? Math.cbrt(value / white) : (kappa * value / white + 16) / 116
  const fx = pivot(x, 0.95047), fy = pivot(y, 1), fz = pivot(z, 1.08883)
  const labA = 500 * (fx - fy)
  const labB = 200 * (fy - fz)
  return { labL: 116 * fy - 16, labA, labB, labC: Math.hypot(labA, labB) }
}

export function completeColorFeatures(features: ColorFeatures): ColorFeatures {
  if (features.saturation !== undefined && features.labB !== undefined && features.labC !== undefined) return features
  return { ...features, ...rgbToHsv(features.meanR, features.meanG, features.meanB), ...rgbToLab(features.meanR, features.meanG, features.meanB) }
}

export function colorFeaturesFromRgb(rgb: number[], extras?: Partial<ColorFeatures>): ColorFeatures {
  const [meanR, meanG, meanB] = rgb
  const total = meanR + meanG + meanB || 1
  return completeColorFeatures({
    meanR, meanG, meanB,
    medianR: meanR, medianG: meanG, medianB: meanB,
    normalizedR: meanR / total, normalizedG: meanG / total, normalizedB: meanB / total,
    grayscale: 0.299 * meanR + 0.587 * meanG + 0.114 * meanB,
    whitePixelRatio: 0, blackPixelRatio: 0,
    ...extras,
  })
}

export function getFeatureValue(features: ColorFeatures, feature: FeatureKey, blank?: ColorFeatures): number {
  const color = completeColorFeatures(features)
  const reference = blank ? completeColorFeatures(blank) : undefined
  switch (feature) {
    case "R": return color.meanR
    case "G": return color.meanG
    case "B": return color.meanB
    case "R/G": return color.meanR / Math.max(color.meanG, 1)
    case "B/G": return color.meanB / Math.max(color.meanG, 1)
    case "normalizedR": return color.normalizedR
    case "normalizedB": return color.normalizedB
    case "hsvS": return color.saturation ?? 0
    case "labL": return color.labL ?? 0
    case "labA": return color.labA ?? 0
    case "labB": return color.labB ?? 0
    case "labC": return color.labC ?? 0
    case "absorbance": {
      const blankIntensity = reference?.meanB ?? 255
      return -Math.log10((color.meanB + 1) / (blankIntensity + 1))
    }
  }
}

export function featureLabel(feature: string) {
  const labels: Record<string, string> = { R: "R 均值", G: "G 均值", B: "B 均值", "R/G": "R/G", "B/G": "B/G", normalizedR: "归一化 r", normalizedB: "归一化 b", absorbance: "模拟吸光度", hsvS: "HSV 饱和度", labL: "CIELAB L*", labA: "CIELAB a*", labB: "CIELAB b*", labC: "CIELAB C*" }
  return labels[feature] || feature
}

export function modelTypeLabel(modelType: string) {
  const labels: Record<string, string> = { linear: "线性拟合", weighted_linear: "加权线性", logistic4: "四参数 logistic", monotone_spline: "单调曲线", ensemble: "集成学习" }
  return labels[modelType] || modelType
}

const invertLinear = (coefficients: number[], measured: number) => (measured - coefficients[0]) / (coefficients[1] || 1e-12)

export function predictFromFeatures(model: CalibrationModel, features: ColorFeatures, blank?: ColorFeatures) {
  if (model.modelType === "ensemble" && model.ensembleModel?.members.length) {
    const predictions = model.ensembleModel.members.map((member) => invertLinear(member.coefficients, getFeatureValue(features, member.feature, blank))).filter(Number.isFinite)
    return predictions.length ? median(predictions) : Number.NaN
  }
  const measured = getFeatureValue(features, model.feature, blank)
  if (model.modelType === "logistic4") return invertLogistic(model.coefficients, measured, model.minConcentration, model.maxConcentration)
  if (model.modelType === "monotone_spline" && model.nonparametricModel) return invertMonotoneSpline(model.nonparametricModel, measured)
  return invertLinear(model.coefficients, measured)
}

export function predictConcentrationFromFeature(model: CalibrationModel, measured: number): number {
  if (model.modelType === "logistic4") return invertLogistic(model.coefficients, measured, model.minConcentration, model.maxConcentration)
  if (model.modelType === "monotone_spline" && model.nonparametricModel) return invertMonotoneSpline(model.nonparametricModel, measured)
  const [a0, a1] = model.coefficients
  return (measured - a0) / (a1 || 1e-12)
}

export function rgbCss(features?: ColorFeatures) {
  if (!features) return "rgb(226,232,240)"
  return `rgb(${Math.round(features.meanR)}, ${Math.round(features.meanG)}, ${Math.round(features.meanB)})`
}
