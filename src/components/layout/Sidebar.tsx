import { NavLink } from "react-router-dom"
import { Activity, BookOpen, ClipboardList, FlaskConical, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const links = [
  { to: "/", label: "仪表盘", icon: LayoutDashboard },
  { to: "/calibration", label: "标准曲线标定", icon: FlaskConical },
  { to: "/detection", label: "未知样品检测", icon: Activity },
  { to: "/history", label: "检测记录", icon: ClipboardList },
  { to: "/calibrations", label: "标定方案管理", icon: Settings2 },
  { to: "/help", label: "使用说明", icon: BookOpen },
]

export function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  return <aside className={cn("flex h-full shrink-0 flex-col border-r bg-white transition-[width] duration-200", collapsed ? "w-[76px]" : "w-[248px]")}>
    <div className="flex h-16 items-center gap-3 border-b px-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-white"><FlaskConical className="h-5 w-5" /></div>
      {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">TMB-H₂O₂</p><p className="truncate text-[11px] text-muted-foreground">智能比色检测</p></div>}
    </div>
    <nav className="flex-1 space-y-1 p-3">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onNavigate} title={collapsed ? label : undefined} className={({ isActive }) => cn("flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors", isActive ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900", collapsed && "justify-center px-0")}><Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span>{label}</span>}</NavLink>)}</nav>
    <div className="border-t p-3"><Button variant="ghost" size="sm" className={cn("w-full text-muted-foreground", collapsed ? "px-0" : "justify-start")} onClick={onToggle}>{collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> 收起侧栏</>}</Button></div>
  </aside>
}
