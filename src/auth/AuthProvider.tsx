import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { apiClient } from "@/services/api/client"
import { clearAccountData, loadAccountData } from "@/services/account/store"

export type AccountUser = { id: string; username: string; displayName: string }

type AuthValue = {
  user: AccountUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (input: { username: string; password: string; inviteCode: string; displayName: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiClient<AccountUser>("/api/auth/me").then((account) => { if (!cancelled) setUser(account) }).catch(() => { if (!cancelled) setUser(null) }).finally(() => { if (!cancelled) setLoading(false) })
    const expire = () => { clearAccountData(); setUser(null) }
    window.addEventListener("auth-expired", expire)
    return () => { cancelled = true; window.removeEventListener("auth-expired", expire) }
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) { clearAccountData(); return }
    void loadAccountData()
  }, [user, loading])

  const login = async (username: string, password: string) => { setUser(await apiClient<AccountUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) })) }
  const register = async (input: { username: string; password: string; inviteCode: string; displayName: string }) => { setUser(await apiClient<AccountUser>("/api/auth/register", { method: "POST", body: JSON.stringify(input) })) }
  const logout = async () => { await apiClient("/api/auth/logout", { method: "POST" }); clearAccountData(); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth 必须在 AuthProvider 内使用")
  return value
}
