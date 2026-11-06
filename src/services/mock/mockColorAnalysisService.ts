import type { CalibrationModel, ColorAnalysisService, DetectionStatus, PredictionResult, QualityCheck, ROI } from "@/types"
import { createId, sleep } from "@/lib/utils"
import { fileToImage, extractColorFeaturesFromImage, detectWellsFromImage } from "@/lib/image"
import { getFeatureValue, predictFromFeatures } from "@/lib/color"
import { regress } from "@/lib/regression"
import { fitEnsemble, leaveOneConcentrationRmse } from "@/lib/comparison"

const positions = (count: number) => Array.from({ length: count }, (_, index) => ({ x: count > 3 ? 0.15 + index * 0.14 : 0.26 + index * 0.24, y: 0.5 }))

function qualityChecks(roi: ROI, hasBlank: boolean, predicted?: number, model?: CalibrationModel): QualityCheck[] {
  const features = roi.colorFeatures!
  const checks: QualityCheck[] = [
    { id: "brightness", label: "整体亮度", status: features.grayscale < 35 || features.grayscale > 242 ? "fail" : features.grayscale < 55 || features.grayscale > 225 ? "warning" : "pass", detail: features.grayscale < 35 ? "图像过暗" : features.grayscale > 242 ? "图像过亮" : `灰度 ${features.grayscale.toFixed(1)}，曝光可用` },
    { id: "white", label: "纯白像素", status: (features.whitePixelRatio ?? 0) > 0.25 ? "warning" : "pass", detail: `占比 ${((features.whitePixelRatio ?? 0) * 100).toFixed(1)}%` },
    { id: "black", label: "纯黑像素", status: (features.blackPixelRatio ?? 0) > 0.15 ? "warning" : "pass", detail: `占比 ${((features.blackPixelRatio ?? 0) * 100).toFixed(1)}%` },
    { id: "blank", label: "空白孔", status: hasBlank ? "pass" : "fail", detail: hasBlank ? "已找到空白参照" : "缺少空白孔" },
  ]
  if (predicted !== undefined && model) checks.push({ id: "range", label: "检测范围", status: predicted < model.minConcentration || predicted > model.maxConcentration ? "warning" : "pass", detail: `${model.minConcentration}–${model.maxConcentration} ${model.concentrationUnit}` })
  return checks
}

export const mockColorAnalysisService: ColorAnalysisService = {
  async detectROIs(image, mode = "calibration") {
    await sleep(200)
    const htmlImage = await fileToImage(image)
    const found = detectWellsFromImage(htmlImage)
    const minimum = mode === "calibration" ? 4 : 2
    const placed = (found.length >= minimum ? found : positions(mode === "calibration" ? 6 : 3)).map((position) => ({ x: position.x, y: position.y, radius: "radius" in position && typeof position.radius === "number" ? position.radius : 0.075 }))
    const source = found.length >= minimum ? "vision" as const : "template" as const
    return placed.map((position, index) => ({ id: createId("roi"), ...position, label: `ROI ${index + 1}`, sampleType: index === 0 ? "blank" as const : mode === "calibration" ? "standard" as const : "unknown" as const, source }))
  },
  async extractColorFeatures(image, rois) {
    const htmlImage = await fileToImage(image)
    return extractColorFeaturesFromImage(htmlImage, rois)
  },
  async createCalibration(data) {
    const blank = data.rois.find((roi) => roi.sampleType === "blank" || roi.concentration === 0)?.colorFeatures
    const standards = data.rois.filter((roi) => roi.colorFeatures && roi.concentration !== undefined).map((roi) => ({
      id: roi.id, roiLabel: roi.label || roi.id, concentration: roi.concentration!, sampleType: roi.sampleType,
      colorFeatures: roi.colorFeatures!, featureValue: getFeatureValue(roi.colorFeatures!, data.feature, blank), referenceConcentration: roi.referenceConcentration,
    }))
    const samples = standards.map((item) => ({ concentration: item.concentration, colorFeatures: item.colorFeatures }))
    const result = data.modelType === "ensemble" ? fitEnsemble(samples, blank) : regress(standards.map((item) => ({ concentration: item.concentration, measured: item.featureValue })), data.modelType)
    const loocvRmse = data.modelType === "ensemble" ? result.loocvRmse : leaveOneConcentrationRmse(standards.map((item) => ({ concentration: item.concentration, measured: item.featureValue })), data.modelType) ?? undefined
    const feature = data.modelType === "ensemble" && result.ensembleModel ? result.ensembleModel.members[0].feature : data.feature
    const aligned = standards.map((item) => ({ ...item, featureValue: getFeatureValue(item.colorFeatures, feature, blank) }))
    await sleep(250)
    return {
      id: createId("cal"), name: data.name, createdAt: new Date().toISOString(), feature, selectedFeature: feature,
      modelType: data.modelType, coefficients: data.modelType === "ensemble" ? result.ensembleModel?.members[0].coefficients || [] : result.coefficients, nonparametricModel: data.modelType === "ensemble" ? undefined : result.nonparametricModel, ensembleModel: result.ensembleModel, loocvRmse, rSquared: result.rSquared, rmse: result.rmse,
      minConcentration: Math.min(...aligned.map((item) => item.concentration)), maxConcentration: Math.max(...aligned.map((item) => item.concentration)),
      concentrationUnit: data.unit, standards: aligned, metadata: data.metadata,
    }
  },
  async predictConcentration(data): Promise<PredictionResult[]> {
    const blank = data.rois.find((roi) => roi.sampleType === "blank")?.colorFeatures
    const hasBlank = Boolean(blank)
    await sleep(300)
    return data.rois.filter((roi) => roi.sampleType === "unknown" && roi.colorFeatures).map((roi) => {
      const raw = predictFromFeatures(data.model, roi.colorFeatures!, blank)
      const predictedConcentration = Math.max(0, raw)
      const checks = qualityChecks(roi, hasBlank, predictedConcentration, data.model)
      let status: DetectionStatus = "passed"
      if (!hasBlank) status = "missing_blank"
      else if (checks.some((check) => check.status === "fail")) status = "image_quality_issue"
      else if (raw < data.model.minConcentration) status = "below_range"
      else if (raw > data.model.maxConcentration) status = "above_range"
      return { roiId: roi.id, predictedConcentration, lowerBound: Math.max(0, predictedConcentration * 0.9), upperBound: predictedConcentration * 1.1, status, colorFeatures: roi.colorFeatures!, qualityChecks: checks }
    })
  },
}
