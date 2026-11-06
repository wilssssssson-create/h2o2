export type Point = { x: number; y: number }

export type SampleType = "blank" | "standard" | "quality_control" | "unknown"

export type ColorFeatures = {
  meanR: number
  meanG: number
  meanB: number
  medianR?: number
  medianG?: number
  medianB?: number
  normalizedR: number
  normalizedG: number
  normalizedB: number
  grayscale: number
  hue?: number
  saturation?: number
  value?: number
  labL?: number
  labA?: number
  labB?: number
  labC?: number
  whitePixelRatio?: number
  blackPixelRatio?: number
}

export type ROI = {
  id: string
  x: number
  y: number
  radius: number
  label?: string
  sampleType: SampleType
  concentration?: number
  referenceConcentration?: number
  colorFeatures?: ColorFeatures
  source?: "vision" | "template"
}

export type FeatureKey = "R" | "G" | "B" | "R/G" | "B/G" | "normalizedR" | "normalizedB" | "absorbance" | "hsvS" | "labL" | "labA" | "labB" | "labC"
export type UnivariateModelType = "linear" | "weighted_linear" | "logistic4" | "monotone_spline"
export type ModelType = UnivariateModelType | "ensemble"

export type EnsembleMember = {
  feature: FeatureKey
  coefficients: number[]
  loocvRmse: number
}

export type EnsembleModel = {
  algorithm: "median_linear"
  members: EnsembleMember[]
  loocvRmse: number
}

export type SplineKnot = {
  concentration: number
  measured: number
  tangent: number
  sampleCount: number
}

export type MonotoneSplineModel = {
  algorithm: "pava_pchip"
  direction: "increasing" | "decreasing"
  knots: SplineKnot[]
  distinctConcentrations: number
  sampleCount: number
}

export type CalibrationStandard = {
  id: string
  roiLabel: string
  concentration: number
  sampleType: SampleType
  colorFeatures: ColorFeatures
  featureValue: number
  referenceConcentration?: number
}

export type CalibrationMetadata = {
  tmbBatch: string
  hrpBatch: string
  reactionTime: string
  containerType: string
  phoneModel: string
  notes: string
  cohortId?: string
  lighting?: string
  captureDate?: string
}

export type CalibrationModel = {
  id: string
  name: string
  createdAt: string
  feature: FeatureKey
  selectedFeature: FeatureKey
  modelType: ModelType
  coefficients: number[]
  nonparametricModel?: MonotoneSplineModel
  rSquared: number
  rmse: number
  minConcentration: number
  maxConcentration: number
  concentrationUnit: "μM" | "mM"
  standards: CalibrationStandard[]
  metadata: CalibrationMetadata
  ensembleModel?: EnsembleModel
  loocvRmse?: number
  isDefault?: boolean
}

export type DetectionStatus =
  | "passed"
  | "below_range"
  | "above_range"
  | "image_quality_issue"
  | "missing_blank"
  | "quality_control_failed"

export type QualityCheck = {
  id: string
  label: string
  status: "pass" | "warning" | "fail"
  detail: string
}

export type DetectionRecord = {
  id: string
  createdAt: string
  sampleName: string
  predictedConcentration: number
  lowerBound: number
  upperBound: number
  unit: string
  calibrationModelId: string
  calibrationModelName: string
  status: DetectionStatus
  colorFeatures: ColorFeatures
  qualityChecks: QualityCheck[]
  roiLabel?: string
  referenceConcentration?: number
  cohortId?: string
}

export type RegressionResult = {
  coefficients: number[]
  nonparametricModel?: MonotoneSplineModel
  rSquared: number
  rmse: number
  points: Array<{ concentration: number; measured: number; fitted: number }>
  curvePoints: Array<{ concentration: number; fitted: number }>
  modelType?: ModelType
  loocvRmse?: number
  ensembleModel?: EnsembleModel
}

export type CalibrationRequest = {
  name: string
  feature: FeatureKey
  modelType: ModelType
  unit: "μM" | "mM"
  rois: ROI[]
  metadata: CalibrationMetadata
}

export type PredictionRequest = {
  model: CalibrationModel
  rois: ROI[]
  sampleNames?: Record<string, string>
}

export type PredictionResult = {
  roiId: string
  predictedConcentration: number
  lowerBound: number
  upperBound: number
  status: DetectionStatus
  colorFeatures: ColorFeatures
  qualityChecks: QualityCheck[]
}

export interface ColorAnalysisService {
  detectROIs(image: File, mode?: "calibration" | "detection"): Promise<ROI[]>
  extractColorFeatures(image: File, rois: ROI[]): Promise<ROI[]>
  createCalibration(data: CalibrationRequest): Promise<CalibrationModel>
  predictConcentration(data: PredictionRequest): Promise<PredictionResult[]>
}
