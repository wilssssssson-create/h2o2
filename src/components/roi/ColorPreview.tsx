import type { ColorFeatures } from "@/types"
import { rgbCss } from "@/lib/color"
import { formatNumber } from "@/lib/utils"
export function ColorPreview({ features, compact = false }: { features?: ColorFeatures; compact?: boolean }) { return <div className="flex items-center gap-2"><div className={compact ? "h-7 w-7 rounded-md border shadow-inner" : "h-10 w-10 rounded-lg border shadow-inner"} style={{ backgroundColor: rgbCss(features) }} />{features && <div className="whitespace-nowrap text-[11px] leading-4 text-muted-foreground"><span className="text-red-600">R {formatNumber(features.meanR, 0)}</span> · <span className="text-emerald-700">G {formatNumber(features.meanG, 0)}</span> · <span className="text-sky-700">B {formatNumber(features.meanB, 0)}</span></div>}</div> }
