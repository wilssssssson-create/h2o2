import type { ModelType, MonotoneSplineModel, RegressionResult, SplineKnot } from "@/types"

const evaluatePolynomial = (coefficients: number[], x: number) => coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0)

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])
  for (let pivot = 0; pivot < n; pivot++) {
    let maxRow = pivot
    for (let row = pivot + 1; row < n; row++) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) maxRow = row
    ;[augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]]
    const divisor = augmented[pivot][pivot]
    if (Math.abs(divisor) < 1e-12) throw new Error("浓度点不足以完成拟合，请检查是否有重复浓度")
    for (let column = pivot; column <= n; column++) augmented[pivot][column] /= divisor
    for (let row = 0; row < n; row++) {
      if (row === pivot) continue
      const factor = augmented[row][pivot]
      for (let column = pivot; column <= n; column++) augmented[row][column] -= factor * augmented[pivot][column]
    }
  }
  return augmented.map((row) => row[n])
}

export function regress(data: Array<{ concentration: number; measured: number }>, modelType: ModelType): RegressionResult {
  if (data.length < 2) throw new Error("有效数据点不足")
  if (modelType === "monotone_spline") return { ...monotoneSplineRegression(data), modelType }
  if (modelType === "weighted_linear") return { ...weightedLinearRegression(data), modelType }
  if (modelType === "logistic4") return { ...logisticRegression(data), modelType }
  if (modelType === "ensemble") throw new Error("集成学习需要多个颜色通道")
  const matrix = Array.from({ length: 2 }, (_, row) =>
    Array.from({ length: 2 }, (_, column) => data.reduce((sum, item) => sum + item.concentration ** (row + column), 0)),
  )
  const vector = Array.from({ length: 2 }, (_, power) => data.reduce((sum, item) => sum + item.measured * item.concentration ** power, 0))
  const coefficients = solveLinearSystem(matrix, vector)
  const mean = data.reduce((sum, item) => sum + item.measured, 0) / data.length
  const points = data.map((item) => ({ ...item, fitted: evaluatePolynomial(coefficients, item.concentration) }))
  const ssResidual = points.reduce((sum, item) => sum + (item.measured - item.fitted) ** 2, 0)
  const ssTotal = data.reduce((sum, item) => sum + (item.measured - mean) ** 2, 0)
  const min = Math.min(...data.map((item) => item.concentration)); const max = Math.max(...data.map((item) => item.concentration))
  return {
    coefficients,
    rSquared: ssTotal < 1e-12 ? 1 : 1 - ssResidual / ssTotal,
    rmse: Math.sqrt(ssResidual / data.length),
    points: points.sort((a, b) => a.concentration - b.concentration),
    curvePoints: sampleRange(min, max).map((concentration) => ({ concentration, fitted: evaluatePolynomial(coefficients, concentration) })),
    modelType: "linear",
  }
}

function weightedLinearRegression(data: Array<{ concentration: number; measured: number }>): RegressionResult {
  let weightSum = 0, weightedX = 0, weightedX2 = 0, weightedY = 0, weightedXY = 0
  data.forEach((item) => {
    const weight = 1 / Math.max(item.measured ** 2, 1e-4)
    weightSum += weight
    weightedX += weight * item.concentration
    weightedX2 += weight * item.concentration ** 2
    weightedY += weight * item.measured
    weightedXY += weight * item.concentration * item.measured
  })
  const coefficients = solveLinearSystem([[weightSum, weightedX], [weightedX, weightedX2]], [weightedY, weightedXY])
  return summarizeLinear(data, coefficients, "weighted_linear")
}

function logisticRegression(data: Array<{ concentration: number; measured: number }>): RegressionResult {
  const ordered = [...data].sort((a, b) => a.concentration - b.concentration)
  const low = ordered[0], high = ordered.at(-1)!
  const positive = ordered.filter((item) => item.concentration > 0)
  const inflection = positive.length ? Math.exp(positive.reduce((sum, item) => sum + Math.log(item.concentration), 0) / positive.length) : Math.max(high.concentration / 2, 1)
  const start = [low.measured, 1, inflection, high.measured]
  const loss = (parameters: number[]) => {
    const [lower, slope, midpoint, upper] = parameters
    if (!(slope >= 0.2 && slope <= 12) || !(midpoint > 0)) return 1e12
    return data.reduce((sum, item) => sum + (fourParameterLogistic(item.concentration, lower, slope, midpoint, upper) - item.measured) ** 2, 0)
  }
  const fitted = nelderMead(start, loss, [Math.max(1, Math.abs(high.measured - low.measured) * 0.2), 0.4, Math.max(inflection * 0.3, 1), Math.max(1, Math.abs(high.measured - low.measured) * 0.2)])
  if (loss(fitted) >= 1e11) throw new Error("四参数曲线未能收敛，请增加浓度层级或更换颜色特征")
  const coefficients = fitted
  const points = data.map((item) => ({ ...item, fitted: fourParameterLogistic(item.concentration, coefficients[0], coefficients[1], coefficients[2], coefficients[3]) }))
  const mean = data.reduce((sum, item) => sum + item.measured, 0) / data.length
  const ssResidual = points.reduce((sum, item) => sum + (item.measured - item.fitted) ** 2, 0)
  const ssTotal = data.reduce((sum, item) => sum + (item.measured - mean) ** 2, 0)
  const min = Math.min(...data.map((item) => item.concentration))
  const max = Math.max(...data.map((item) => item.concentration))
  return {
    coefficients,
    rSquared: ssTotal < 1e-12 ? 1 : 1 - ssResidual / ssTotal,
    rmse: Math.sqrt(ssResidual / data.length),
    points: points.sort((a, b) => a.concentration - b.concentration),
    curvePoints: sampleRange(min, max).map((concentration) => ({ concentration, fitted: fourParameterLogistic(concentration, coefficients[0], coefficients[1], coefficients[2], coefficients[3]) })),
    modelType: "logistic4",
  }
}

function summarizeLinear(data: Array<{ concentration: number; measured: number }>, coefficients: number[], modelType: ModelType): RegressionResult {
  const mean = data.reduce((sum, item) => sum + item.measured, 0) / data.length
  const points = data.map((item) => ({ ...item, fitted: evaluatePolynomial(coefficients, item.concentration) }))
  const ssResidual = points.reduce((sum, item) => sum + (item.measured - item.fitted) ** 2, 0)
  const ssTotal = data.reduce((sum, item) => sum + (item.measured - mean) ** 2, 0)
  const min = Math.min(...data.map((item) => item.concentration))
  const max = Math.max(...data.map((item) => item.concentration))
  return { coefficients, rSquared: ssTotal < 1e-12 ? 1 : 1 - ssResidual / ssTotal, rmse: Math.sqrt(ssResidual / data.length), points: points.sort((a, b) => a.concentration - b.concentration), curvePoints: sampleRange(min, max).map((concentration) => ({ concentration, fitted: evaluatePolynomial(coefficients, concentration) })), modelType }
}

export function fourParameterLogistic(x: number, lower: number, slope: number, midpoint: number, upper: number) {
  const ratio = (Math.max(x, 0) / Math.max(midpoint, 1e-9)) ** slope
  return upper + (lower - upper) / (1 + ratio)
}

export function invertLogistic(coefficients: number[], measured: number, min: number, max: number) {
  const [lower, slope, midpoint, upper] = coefficients
  const span = lower - upper
  const denominator = measured - upper
  if (Math.abs(span) < 1e-8 || !Number.isFinite(slope) || slope === 0) return (min + max) / 2
  const inner = span / denominator - 1
  if (!(inner > 0) || !Number.isFinite(inner)) return Math.abs(measured - lower) <= Math.abs(measured - upper) ? min : max
  return midpoint * inner ** (1 / slope)
}

function nelderMead(start: number[], loss: (parameters: number[]) => number, step: number[], iterations = 90) {
  const count = start.length
  let simplex = [start, ...start.map((_, index) => start.map((value, column) => value + (index === column ? step[column] : 0)))]
  const score = (parameters: number[]) => loss(parameters)
  for (let iteration = 0; iteration < iterations; iteration++) {
    simplex.sort((a, b) => score(a) - score(b))
    const best = simplex[0], worst = simplex[count], nextWorst = simplex[count - 1]
    const centroid = start.map((_, column) => simplex.slice(0, count).reduce((sum, parameters) => sum + parameters[column], 0) / count)
    const reflected = centroid.map((value, column) => value + (value - worst[column]))
    const reflectedLoss = score(reflected)
    if (reflectedLoss < score(best)) {
      const expanded = centroid.map((value, column) => value + 2 * (reflected[column] - value))
      simplex[count] = score(expanded) < reflectedLoss ? expanded : reflected
    } else if (reflectedLoss < score(nextWorst)) simplex[count] = reflected
    else {
      const contracted = centroid.map((value, column) => value + 0.5 * (worst[column] - value))
      if (score(contracted) < score(worst)) simplex[count] = contracted
      else simplex = simplex.map((parameters, index) => index === 0 ? parameters : parameters.map((value, column) => best[column] + 0.5 * (value - best[column])))
    }
  }
  simplex.sort((a, b) => score(a) - score(b))
  return simplex[0]
}

function monotoneSplineRegression(data: Array<{ concentration: number; measured: number }>): RegressionResult {
  const grouped = new Map<number, number[]>()
  data.forEach(({ concentration, measured }) => grouped.set(concentration, [...(grouped.get(concentration) || []), measured]))
  const levels = [...grouped.entries()].sort(([a], [b]) => a - b).map(([concentration, values]) => ({ concentration, measured: median(values), weight: values.length }))
  if (levels.length < 4) throw new Error("单调非参数拟合至少需要 4 个不同浓度，建议使用 6 个以上")
  const xMean = levels.reduce((sum, item) => sum + item.concentration, 0) / levels.length
  const yMean = levels.reduce((sum, item) => sum + item.measured, 0) / levels.length
  const covariance = levels.reduce((sum, item) => sum + (item.concentration - xMean) * (item.measured - yMean), 0)
  const direction: MonotoneSplineModel["direction"] = covariance >= 0 ? "increasing" : "decreasing"
  const sign = direction === "increasing" ? 1 : -1
  const fittedIncreasing = pava(levels.map((item) => item.measured * sign), levels.map((item) => item.weight)).map((value) => value * sign)
  const dynamicRange = Math.max(...fittedIncreasing) - Math.min(...fittedIncreasing)
  if (Math.abs(dynamicRange) < 1e-8) throw new Error("颜色特征几乎没有变化，无法建立可逆标定曲线")
  const tangents = pchipTangents(levels.map((item) => item.concentration), fittedIncreasing)
  const knots: SplineKnot[] = levels.map((item, index) => ({ concentration: item.concentration, measured: fittedIncreasing[index], tangent: tangents[index], sampleCount: item.weight }))
  const nonparametricModel: MonotoneSplineModel = { algorithm: "pava_pchip", direction, knots, distinctConcentrations: knots.length, sampleCount: data.length }
  const points = data.map((item) => ({ ...item, fitted: evaluateMonotoneSpline(nonparametricModel, item.concentration) })).sort((a, b) => a.concentration - b.concentration)
  const mean = data.reduce((sum, item) => sum + item.measured, 0) / data.length
  const ssResidual = points.reduce((sum, item) => sum + (item.measured - item.fitted) ** 2, 0)
  const ssTotal = data.reduce((sum, item) => sum + (item.measured - mean) ** 2, 0)
  return { coefficients: [], nonparametricModel, rSquared: ssTotal < 1e-12 ? 1 : 1 - ssResidual / ssTotal, rmse: Math.sqrt(ssResidual / data.length), points, curvePoints: sampleRange(knots[0].concentration, knots.at(-1)!.concentration).map((concentration) => ({ concentration, fitted: evaluateMonotoneSpline(nonparametricModel, concentration) })) }
}

function pava(values: number[], weights: number[]) {
  const blocks = values.map((value, index) => ({ start: index, end: index, value, weight: weights[index] }))
  let index = 0
  while (index < blocks.length - 1) {
    if (blocks[index].value <= blocks[index + 1].value) { index++; continue }
    const left = blocks[index], right = blocks[index + 1]; const weight = left.weight + right.weight
    blocks.splice(index, 2, { start: left.start, end: right.end, value: (left.value * left.weight + right.value * right.weight) / weight, weight })
    if (index > 0) index--
  }
  const result = Array(values.length).fill(0)
  blocks.forEach((block) => { for (let i = block.start; i <= block.end; i++) result[i] = block.value })
  return result
}

function pchipTangents(x: number[], y: number[]) {
  const n = x.length; const h = Array.from({ length: n - 1 }, (_, i) => x[i + 1] - x[i]); const delta = h.map((width, i) => (y[i + 1] - y[i]) / width); const tangent = Array(n).fill(0)
  if (n === 2) return [delta[0], delta[0]]
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) tangent[i] = 0
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; tangent[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]) }
  }
  tangent[0] = endpointTangent(h[0], h[1], delta[0], delta[1])
  tangent[n - 1] = endpointTangent(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3])
  return tangent
}

function endpointTangent(h0: number, h1: number, delta0: number, delta1: number) {
  let value = ((2 * h0 + h1) * delta0 - h0 * delta1) / (h0 + h1)
  if (value * delta0 <= 0) value = 0
  else if (delta0 * delta1 < 0 && Math.abs(value) > Math.abs(3 * delta0)) value = 3 * delta0
  return value
}

export function evaluateMonotoneSpline(model: MonotoneSplineModel, concentration: number) {
  const knots = model.knots
  if (concentration <= knots[0].concentration) return knots[0].measured + knots[0].tangent * (concentration - knots[0].concentration)
  if (concentration >= knots.at(-1)!.concentration) { const last = knots.at(-1)!; return last.measured + last.tangent * (concentration - last.concentration) }
  let index = 0; while (index < knots.length - 2 && concentration > knots[index + 1].concentration) index++
  const left = knots[index], right = knots[index + 1], h = right.concentration - left.concentration, t = (concentration - left.concentration) / h
  const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2
  return h00 * left.measured + h10 * h * left.tangent + h01 * right.measured + h11 * h * right.tangent
}

export function invertMonotoneSpline(model: MonotoneSplineModel, measured: number) {
  const first = model.knots[0], last = model.knots.at(-1)!, increasing = model.direction === "increasing"
  const below = increasing ? measured < first.measured : measured > first.measured
  const above = increasing ? measured > last.measured : measured < last.measured
  if (below) return first.concentration + (measured - first.measured) / (Math.abs(first.tangent) > 1e-12 ? first.tangent : (last.measured - first.measured) / (last.concentration - first.concentration))
  if (above) return last.concentration + (measured - last.measured) / (Math.abs(last.tangent) > 1e-12 ? last.tangent : (last.measured - first.measured) / (last.concentration - first.concentration))
  let low = first.concentration, high = last.concentration
  for (let i = 0; i < 60; i++) { const middle = (low + high) / 2, value = evaluateMonotoneSpline(model, middle); if ((value < measured) === increasing) low = middle; else high = middle }
  return (low + high) / 2
}

const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 }
const sampleRange = (min: number, max: number, count = 100) => Array.from({ length: count }, (_, index) => min + (max - min) * index / (count - 1))

export function equationText(coefficients: number[]) {
  const format = (value: number) => Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(4)
  return coefficients.map((coefficient, index) => {
    const absolute = format(Math.abs(coefficient))
    const term = index === 0 ? absolute : `${absolute}x`
    return `${index === 0 ? (coefficient < 0 ? "-" : "") : coefficient < 0 ? " − " : " + "}${term}`
  }).join("")
}
