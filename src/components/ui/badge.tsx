import { cn } from "@/lib/utils"
export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "success" | "warning" | "danger" | "outline" }) {
  const styles = { default: "bg-primary/10 text-primary", secondary: "bg-secondary text-secondary-foreground", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700", outline: "border text-muted-foreground" }
  return <div className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", styles[variant], className)} {...props} />
}
