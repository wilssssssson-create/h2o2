import { Badge } from "@/components/ui/badge"
import type { DetectionStatus } from "@/types"
const labels: Record<DetectionStatus, string> = { passed: "检测通过", below_range: "低于范围", above_range: "高于范围", image_quality_issue: "图片质量异常", missing_blank: "缺少空白孔", quality_control_failed: "质控不通过" }
export function StatusBadge({ status }: { status: DetectionStatus }) { const variant = status === "passed" ? "success" : status === "image_quality_issue" || status === "missing_blank" ? "danger" : "warning"; return <Badge variant={variant}>{labels[status]}</Badge> }
