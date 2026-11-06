import { Link, useLocation, useNavigate } from "react-router-dom"
import { LogOut, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/auth/AuthProvider"

const titles: Record<string, string> = { "/": "仪表盘", "/calibration": "标准曲线标定", "/detection": "未知样品检测", "/history": "检测记录", "/calibrations": "标定方案管理", "/help": "使用说明" }

export function Header({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const signOut = async () => { await logout(); navigate("/login") }
  return <header className="flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6">
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}><Menu className="h-5 w-5" /></Button>
      <div>
        <h1 className="text-base font-semibold text-slate-900">{titles[pathname] || "检测工作台"}</h1>
        <p className="hidden text-xs text-muted-foreground sm:block">标定和检测记录保存在当前账号中</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {user ? <>
        <span className="hidden max-w-[160px] truncate text-xs text-slate-600 sm:block">{user.displayName}</span>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}><LogOut className="h-4 w-4" />退出</Button>
      </> : <Button size="sm" asChild><Link to="/login">登录</Link></Button>}
      <Link to="/help" className="hidden text-xs text-muted-foreground hover:text-primary md:block">帮助中心</Link>
    </div>
  </header>
}
