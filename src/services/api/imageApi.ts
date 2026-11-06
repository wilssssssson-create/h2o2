import type { ROI } from "@/types"
import { API_BASE_URL } from "./client"
export async function analyzeImage(file: File): Promise<ROI[]> {
  const body = new FormData(); body.append("image", file)
  const response = await fetch(`${API_BASE_URL}/api/images/analyze`, { method: "POST", body })
  if (!response.ok) throw new Error("图像分析失败")
  return response.json()
}
