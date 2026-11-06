import type { CalibrationModel, RegressionResult } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { equationText } from "@/lib/regression"
import { featureLabel, modelTypeLabel } from "@/lib/color"
import { formatNumber } from "@/lib/utils"

export function CalibrationSummary({ result, model }: { result?: RegressionResult; model?: CalibrationModel }) {
  const coefficients = result?.coefficients ?? model?.coefficients ?? []
  const spline = result?.nonparametricModel ?? model?.nonparametricModel
  const ensemble = result?.ensembleModel ?? model?.ensembleModel
  const modelType = result?.modelType ?? model?.modelType
  const rSquared = result?.rSquared ?? model?.rSquared
  const rmse = result?.rmse ?? model?.rmse
  const loocvRmse = result?.loocvRmse ?? model?.loocvRmse
  const description = ensemble ? `多通道线性中位数 · ${ensemble.members.map((member) => featureLabel(member.feature)).join("、")}` : modelType === "logistic4" && coefficients.length === 4 ? `四参数 logistic · 拐点 ${formatNumber(coefficients[2], 1)}` : spline ? `PAVA 保序 + PCHIP · ${spline.distinctConcentrations} 个浓度 · ${spline.direction === "increasing" ? "递增" : "递减"}` : coefficients.length >= 2 ? `y = ${equationText(coefficients.slice(0, 2))}` : undefined
  return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>拟合摘要</CardTitle>{rSquared !== undefined && <Badge variant={rSquared >= 0.98 ? "success" : rSquared >= 0.9 ? "warning" : "danger"}>{modelType ? modelTypeLabel(modelType) : "拟合"}</Badge>}</CardHeader><CardContent>{description ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label={ensemble ? "集成通道" : spline ? "非参数方法" : "回归方程"} value={description} wide /><Metric label="决定系数 R²" value={formatNumber(rSquared ?? 0, 4)} /><Metric label="训练 RMSE" value={formatNumber(rmse ?? 0, 4)} />{loocvRmse !== undefined && <Metric label="留一 RMSE (μM)" value={formatNumber(loocvRmse)} />}{model && <><Metric label="检测范围" value={`${model.minConcentration}–${model.maxConcentration} ${model.concentrationUnit}`} /><Metric label="颜色特征" value={featureLabel(model.feature)} /></>}</div> : <p className="text-sm text-muted-foreground">完善浓度数据后生成曲线。</p>}</CardContent></Card>
}

function Metric({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div>
}
