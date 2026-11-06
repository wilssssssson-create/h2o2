import { useSyncExternalStore } from "react"
import type { CalibrationModel, DetectionRecord } from "@/types"
import { regress } from "@/lib/regression"
import { recordsApi } from "@/services/api/client"

type AccountState = { calibrations: CalibrationModel[]; detections: DetectionRecord[]; ready: boolean; error: string }

let state: AccountState = { calibrations: [], detections: [], ready: false, error: "" }
const listeners = new Set<() => void>()

function emit(next: AccountState) {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function normalizeCalibration(model: CalibrationModel): CalibrationModel {
  if ((model.modelType as string) !== "quadratic") return model
  const data = model.standards.map((item) => ({ concentration: item.concentration, measured: item.featureValue }))
  const fit = regress(data, "monotone_spline")
  return { ...model, modelType: "monotone_spline", coefficients: fit.coefficients, nonparametricModel: fit.nonparametricModel, rSquared: fit.rSquared, rmse: fit.rmse }
}

export function getCalibrations() { return state.calibrations }
export function getDetections() { return state.detections }
export function useCalibrations() { return useSyncExternalStore(subscribe, getCalibrations, getCalibrations) }
export function useDetections() { return useSyncExternalStore(subscribe, getDetections, getDetections) }
export function useAccountReady() { return useSyncExternalStore(subscribe, () => state.ready, () => state.ready) }
export function useAccountError() { return useSyncExternalStore(subscribe, () => state.error, () => state.error) }

export function clearAccountData() {
  emit({ calibrations: [], detections: [], ready: false, error: "" })
}

export async function loadAccountData() {
  try {
    const [calibrations, detections] = await Promise.all([recordsApi.listCalibrations(), recordsApi.listDetections()])
    emit({ calibrations, detections, ready: true, error: "" })
  } catch (error) {
    emit({ calibrations: [], detections: [], ready: true, error: error instanceof Error ? error.message : "账号数据读取失败" })
  }
}

async function reloadCalibrations() {
  emit({ ...state, calibrations: await recordsApi.listCalibrations(), error: "" })
}

async function reloadDetections() {
  emit({ ...state, detections: await recordsApi.listDetections(), error: "" })
}

export async function saveCalibration(model: CalibrationModel) {
  const saved = await recordsApi.saveCalibration(normalizeCalibration(model))
  await reloadCalibrations()
  return saved
}

export async function setDefaultCalibration(id: string) {
  await recordsApi.setDefaultCalibration(id)
  await reloadCalibrations()
}

export async function deleteCalibration(id: string) {
  await recordsApi.deleteCalibration(id)
  await reloadCalibrations()
}

export async function importCalibration(model: CalibrationModel) {
  const { createId } = await import("@/lib/utils")
  return saveCalibration({ ...normalizeCalibration(model), id: createId("cal"), createdAt: new Date().toISOString(), isDefault: false })
}

export async function saveDetections(records: DetectionRecord[]) {
  if (!records.length) return []
  const saved = await recordsApi.saveDetections(records)
  await reloadDetections()
  return saved
}

export async function deleteDetection(id: string) {
  await recordsApi.deleteDetection(id)
  await reloadDetections()
}
