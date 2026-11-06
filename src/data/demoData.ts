import type { CalibrationModel, ColorFeatures, DetectionRecord } from "@/types"
import { getFeatureValue } from "@/lib/color"
import { regress } from "@/lib/regression"
import { getCalibrations, getDetections, saveCalibration, saveDetections } from "@/services/account/store"

const colors = [[237, 245, 239], [205, 233, 232], [155, 213, 215], [84, 181, 194], [35, 142, 165], [18, 99, 127]]
const concentrations = [0, 25, 50, 100, 200, 400]
const features = (rgb: number[]): ColorFeatures => { const [meanR, meanG, meanB] = rgb; const total = meanR + meanG + meanB; return { meanR, meanG, meanB, medianR: meanR, medianG: meanG, medianB: meanB, normalizedR: meanR / total, normalizedG: meanG / total, normalizedB: meanB / total, grayscale: .299 * meanR + .587 * meanG + .114 * meanB, whitePixelRatio: 0, blackPixelRatio: 0 } }

function createDemoModel(id: string, name: string, feature: "B/G" | "normalizedB", isDefault = false): CalibrationModel {
  const standards = concentrations.map((concentration, index) => ({ id: `${id}_std_${index}`, roiLabel: `ROI ${index + 1}`, concentration, sampleType: index === 0 ? "blank" as const : "standard" as const, colorFeatures: features(colors[index]), featureValue: getFeatureValue(features(colors[index]), feature) }))
  const modelType = isDefault ? "linear" as const : "monotone_spline" as const
  const fit = regress(standards.map((item) => ({ concentration: item.concentration, measured: item.featureValue })), modelType)
  return { id, name, createdAt: new Date(Date.now() - (isDefault ? 86400000 : 604800000)).toISOString(), feature, selectedFeature: feature, modelType, coefficients: fit.coefficients, nonparametricModel: fit.nonparametricModel, rSquared: fit.rSquared, rmse: fit.rmse, minConcentration: 0, maxConcentration: 400, concentrationUnit: "μM", standards, metadata: { tmbBatch: isDefault ? "TMB-2026-A07" : "TMB-2026-A03", hrpBatch: isDefault ? "HRP-260721" : "HRP-260612", reactionTime: "10 min", containerType: "96 孔透明板", phoneModel: isDefault ? "iPhone 15" : "Pixel 8", notes: "系统生成的演示标定方案，仅供界面操作体验。" }, isDefault }
}

export async function installDemoData() {
  const existingModels = getCalibrations()
  const currentDefault = existingModels.find((item) => item.isDefault)
  const models = [createDemoModel("demo_cal_primary", "演示方案 · 线性拟合", "B/G", !currentDefault || currentDefault.id === "demo_cal_primary"), createDemoModel("demo_cal_normalized", "演示方案 · 未知形式拟合", "normalizedB", false)]
  for (const model of models) await saveCalibration(model)
  const sampleColors = [[74, 171, 185], [39, 130, 154], [230, 239, 235], [11, 57, 79]]
  const statuses: DetectionRecord["status"][] = ["passed", "passed", "below_range", "above_range"]
  const predicted = [126.4, 238.7, 0, 486.2]
  const records: DetectionRecord[] = sampleColors.map((rgb, index) => ({ id: `demo_det_${index}`, createdAt: new Date(Date.now() - index * 7200000).toISOString(), sampleName: ["演示样品 A", "演示样品 B", "低浓度对照", "高浓度原液"][index], predictedConcentration: predicted[index], lowerBound: predicted[index] * .9, upperBound: predicted[index] * 1.1, unit: "μM", calibrationModelId: models[0].id, calibrationModelName: models[0].name, status: statuses[index], colorFeatures: features(rgb), qualityChecks: [{ id: "brightness", label: "整体亮度", status: "pass", detail: "曝光可用" }, { id: "blank", label: "空白孔", status: "pass", detail: "已找到空白参照" }, { id: "range", label: "检测范围", status: statuses[index] === "passed" ? "pass" : "warning", detail: "0–400 μM" }] }))
  const existingRecords = getDetections()
  await saveDetections(records.filter((record) => !existingRecords.some((item) => item.id === record.id)))
  return { calibrations: models.length, detections: records.length }
}
