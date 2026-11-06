import { useState, type FormEvent } from "react"
import { Link, Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "@/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthCard } from "@/pages/LoginPage"

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirm) { setError("两次输入的密码不一致"); return }
    setBusy(true)
    setError("")
    try {
      await register({ username: username.trim(), password, inviteCode: inviteCode.trim(), displayName: displayName.trim() })
      navigate("/", { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "注册失败")
    } finally {
      setBusy(false)
    }
  }

  return <AuthCard title="注册" subtitle="需要课程邀请码。注册后只能看到自己的标定方案和检测记录。">
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-xs font-medium text-slate-600">学号或邮箱<Input className="mt-1" value={username} autoComplete="username" onChange={(event) => setUsername(event.target.value)} required /></label>
      <label className="block text-xs font-medium text-slate-600">姓名（可选）<Input className="mt-1" value={displayName} autoComplete="name" onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label className="block text-xs font-medium text-slate-600">密码<Input className="mt-1" type="password" autoComplete="new-password" value={password} minLength={8} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label className="block text-xs font-medium text-slate-600">确认密码<Input className="mt-1" type="password" autoComplete="new-password" value={confirm} minLength={8} onChange={(event) => setConfirm(event.target.value)} required /></label>
      <label className="block text-xs font-medium text-slate-600">邀请码<Input className="mt-1" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required /></label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" type="submit" disabled={busy || loading}>{busy ? "正在注册…" : "注册并进入"}</Button>
    </form>
    <p className="mt-4 text-center text-sm text-muted-foreground">已有账号？ <Link className="text-primary" to="/login">登录</Link></p>
  </AuthCard>
}
