import type { CalibrationModel, DetectionRecord } from "@/types"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

function errorMessage(data: unknown, status: number) {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === "string") return detail
  }
  return `请求失败：${status}`
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" })
  } catch {
    throw new ApiError("无法连接服务器", 0)
  }
  if (response.status === 401 && path !== "/api/auth/me" && path !== "/api/auth/login" && path !== "/api/auth/register") {
    window.dispatchEvent(new Event("auth-expired"))
  }
  if (!response.ok) {
    let data: unknown = null
    try { data = await response.json() } catch { data = null }
    throw new ApiError(errorMessage(data, response.status), response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const recordsApi = {
  listCalibrations: () => apiClient<CalibrationModel[]>("/api/calibrations"),
  saveCalibration: (model: CalibrationModel) => apiClient<CalibrationModel>("/api/calibrations", { method: "POST", body: JSON.stringify(model) }),
  setDefaultCalibration: (id: string) => apiClient<CalibrationModel>(`/api/calibrations/${id}/default`, { method: "POST" }),
  deleteCalibration: (id: string) => apiClient<void>(`/api/calibrations/${id}`, { method: "DELETE" }),
  listDetections: () => apiClient<DetectionRecord[]>("/api/detections"),
  saveDetections: (records: DetectionRecord[]) => apiClient<DetectionRecord[]>("/api/detections/batch", { method: "POST", body: JSON.stringify({ records }) }),
  deleteDetection: (id: string) => apiClient<void>(`/api/detections/${id}`, { method: "DELETE" }),
}
