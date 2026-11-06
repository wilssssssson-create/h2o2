import type { SignalScore } from "@/lib/comparison"
import { featureLabel, modelTypeLabel } from "@/lib/color"
import { formatNumber } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SignalComparison({ scores, onApply }: { scores: SignalScore[]; onApply: (score: SignalScore) => void }) {
  const shown = scores.slice(0, 6)
  return <Card><CardHeader><CardTitle>信号比较</CardTitle><CardDescription>按浓度留一，比较 RGB、HSV 饱和度、CIELAB 和几种曲线的浓度误差。误差越小越好。</CardDescription></CardHeader><CardContent className="space-y-2">{shown.map((score) => <div key={`${score.feature}-${score.modelType}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"><div><p className="text-sm font-medium">{featureLabel(score.feature)} · {modelTypeLabel(score.modelType)}</p><p className="text-xs text-muted-foreground">留一 RMSE {formatNumber(score.loocvRmse)} μM · 训练 R² {formatNumber(score.rSquared, 4)}</p></div><Button size="sm" variant="outline" onClick={() => onApply(score)}>采用</Button></div>)}</CardContent></Card>
}
