import { Suspense, useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { useAuth } from "@/auth/AuthProvider"
import { loadAccountData, useAccountError, useAccountReady } from "@/services/account/store"
import { Button } from "@/components/ui/button"

function AccountData() {
  const { user, loading } = useAuth()
  const ready = useAccountReady()
  const error = useAccountError()
  if (loading || (user && !ready)) return <div className="grid min-h-[45vh] place-items-center text-sm text-muted-foreground">正在读取账号数据…</div>
  if (user && error) return <div className="grid min-h-[45vh] place-items-center gap-3 text-center text-sm"><p>{error}</p><Button onClick={() => void loadAccountData()}>重试</Button></div>
  return <Suspense fallback={<div className="grid min-h-[45vh] place-items-center text-sm text-muted-foreground">正在加载工作台…</div>}><Outlet /></Suspense>
}

export function AppLayout() { const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); useEffect(() => { const close = () => setMobileOpen(false); window.addEventListener("resize", close); return () => window.removeEventListener("resize", close) }, []); return <div className="flex min-h-screen bg-background"><div className={`fixed inset-0 z-40 bg-slate-950/20 lg:hidden ${mobileOpen ? "block" : "hidden"}`} onClick={() => setMobileOpen(false)} /><div className={`fixed inset-y-0 left-0 z-50 lg:static lg:block ${mobileOpen ? "block" : "hidden"}`}><Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} onNavigate={() => setMobileOpen(false)} /></div><div className="flex min-w-0 flex-1 flex-col"><Header onMenu={() => setMobileOpen(true)} /><main className="min-h-0 flex-1 overflow-auto"><div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"><AccountData /></div></main></div></div> }
