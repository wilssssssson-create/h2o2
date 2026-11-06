import { cn } from "@/lib/utils"
export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => <div className="w-full overflow-auto"><table className={cn("w-full caption-bottom text-sm", className)} {...props} /></div>
export const TableHeader = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b bg-slate-50/70" {...props} />
export const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="[&_tr:last-child]:border-0" {...props} />
export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("border-b transition-colors hover:bg-slate-50/60", className)} {...props} />
export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground", className)} {...props} />
export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("p-4 align-middle", className)} {...props} />
