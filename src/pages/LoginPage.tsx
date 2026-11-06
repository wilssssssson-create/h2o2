import { useState, type FormEvent, type ReactNode } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { FlaskConical } from "lucide-react"
import { useAuth } from "@/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { safeNext } from "@/lib/utils"

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get("next"))
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to={next} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await login(username.trim(), password)
      navigate(next, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败")
    } finally {
      setBusy(false)
    }
  }

  return <AuthCard title="登录" subtitle="使用学号或邮箱进入自己的检测记录。">
    <form className="space-y-4" onSubmit={submit}>
      <Field label="学号或邮箱" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="密码" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" type="submit" disabled={busy || loading}>{busy ? "正在登录…" : "登录"}</Button>
    </form>
    <p className="mt-4 text-center text-sm text-muted-foreground">还没有账号？ <Link className="text-primary" to="/register">注册</Link></p>
  </AuthCard>
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
    <div className="w-full max-w-md rounded-lg border bg-white p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-white"><FlaskConical className="h-5 w-5" /></div>
        <div><p className="text-sm font-semibold text-slate-900">TMB-H₂O₂</p><p className="text-xs text-muted-foreground">智能比色检测</p></div>
      </div>
      <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  </div>
}

function Field({ label, value, onChange, type = "text", autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
  return <label className="block text-xs font-medium text-slate-600">{label}<Input className="mt-1" value={value} type={type} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} required /></label>
}
