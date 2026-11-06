import type { ColorFeatures, EnsembleModel, FeatureKey, RegressionResult, UnivariateModelType } from "@/types"
import { getFeatureValue } from "@/lib/color"
import { invertLogistic, invertMonotoneSpline, regress } from "@/lib/regression"

export const comparisonFeatures: FeatureKey[] = ["B", "B/G", "absorbance", "hsvS", "labB", "labC"]
export const comparisonModels: UnivariateModelType[] = ["linear", "weighted_linear", "logistic4", "monotone_spline"]

export type SignalScore = { feature: FeatureKey; modelType: UnivariateModelType; loocvRmse: number; rSquared: number }
export type ColorSample = { concentration: number; colorFeatures: ColorFeatures }

const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 }

function series(samples: ColorSample[], feature: FeatureKey, blank?: ColorFeatures) {
  return samples.map((sample) => ({ concentration: sample.concentration, measured: getFeatureValue(sample.colorFeatures, feature, blank) }))
}

function predictFit(fit: RegressionResult, measured: number, min: number, max: number) {
  if (fit.modelType === "logistic4") return invertLogistic(fit.coefficients, measured, min, max)
  if (fit.modelType === "monotone_spline" && fit.nonparametricModel) return invertMonotoneSpline(fit.nonparametricModel, measured)
  return (measured - fit.coefficients[0]) / (fit.coefficients[1] || 1e-12)
}

export function leaveOneConcentrationRmse(data: Array<{ concentration: number; measured: number }>, modelType: UnivariateModelType) {
  const levels = [...new Set(data.map((item) => item.concentration))]
  if (levels.length < 4 || (modelType === "monotone_spline" && levels.length < 5)) return null
  const errors: number[] = []
  for (const held of levels) {
    const train = data.filter((item) => item.concentration !== held)
    const test = data.filter((item) => item.concentration === held)
    if (new Set(train.map((item) => item.concentration)).size < 3) return null
    let fit: RegressionResult
    try { fit = regress(train, modelType) } catch { return null }
    const min = Math.min(...train.map((item) => item.concentration))
    const max = Math.max(...train.map((item) => item.concentration))
    for (const point of test) {
      const predicted = predictFit(fit, point.measured, min, max)
      if (!Number.isFinite(predicted)) return null
      errors.push((predicted - point.concentration) ** 2)
    }
  }
  return Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length)
}

export function scoreSignals(samples: ColorSample[], blank?: ColorFeatures): SignalScore[] {
  const scores: SignalScore[] = []
  for (const feature of comparisonFeatures) {
    const data = series(samples, feature, blank)
    for (const modelType of comparisonModels) {
      const loocvRmse = leaveOneConcentrationRmse(data, modelType)
      if (loocvRmse === null) continue
      try {
        const fit = regress(data, modelType)
        scores.push({ feature, modelType, loocvRmse, rSquared: fit.rSquared })
      } catch { /* 该通道在这个模型下无法拟合 */ }
    }
  }
  return scores.sort((a, b) => a.loocvRmse - b.loocvRmse)
}

export function fitEnsemble(samples: ColorSample[], blank?: ColorFeatures): RegressionResult {
  const ranked = comparisonFeatures.flatMap((feature) => {
    const data = series(samples, feature, blank)
    const loocvRmse = leaveOneConcentrationRmse(data, "linear")
    if (loocvRmse === null) return []
    try {
      const fit = regress(data, "linear")
      return [{ feature, coefficients: fit.coefficients, loocvRmse, fit }]
    } catch { return [] }
  }).sort((a, b) => a.loocvRmse - b.loocvRmse).slice(0, 3)
  if (ranked.length < 2) throw new Error("集成学习至少需要两个可留一验证的颜色通道")
  const features = ranked.map((item) => item.feature)
  const levels = [...new Set(samples.map((item) => item.concentration))]
  const errors: number[] = []
  for (const held of levels) {
    const train = samples.filter((item) => item.concentration !== held)
    const test = samples.filter((item) => item.concentration === held)
    const fits = features.map((feature) => regress(series(train, feature, blank), "linear"))
    test.forEach((sample) => {
      const votes = fits.map((fit, index) => (getFeatureValue(sample.colorFeatures, features[index], blank) - fit.coefficients[0]) / (fit.coefficients[1] || 1e-12))
      errors.push((median(votes) - sample.concentration) ** 2)
    })
  }
  const ensembleModel: EnsembleModel = { algorithm: "median_linear", members: ranked.map(({ feature, coefficients, loocvRmse }) => ({ feature, coefficients, loocvRmse })), loocvRmse: Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length) }
  const primary = ranked[0].fit
  return { ...primary, coefficients: primary.coefficients, modelType: "ensemble", ensembleModel, loocvRmse: ensembleModel.loocvRmse }
}
