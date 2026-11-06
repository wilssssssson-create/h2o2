import { cn } from "@/lib/utils"
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>
export function Select({ className, children, ...props }: SelectProps) { return <select className={cn("h-9 w-full rounded-lg border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15", className)} {...props}>{children}</select> }
