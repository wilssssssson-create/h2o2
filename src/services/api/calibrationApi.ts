// 页面尚未调用。已保存的标定方案走 services/account/store.ts，提交的是完整 CalibrationModel。
import type { CalibrationModel, CalibrationRequest } from "@/types"
import { apiClient } from "./client"
export const calibrationApi = {
  create: (data: CalibrationRequest) => apiClient<CalibrationModel>("/api/calibrations", { method: "POST", body: JSON.stringify(data) }),
  list: () => apiClient<CalibrationModel[]>("/api/calibrations"),
}
