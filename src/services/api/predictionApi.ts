import type { PredictionRequest, PredictionResult } from "@/types"
import { apiClient } from "./client"
export const predictionApi = { predict: (data: PredictionRequest) => apiClient<PredictionResult[]>("/api/predict", { method: "POST", body: JSON.stringify(data) }) }
