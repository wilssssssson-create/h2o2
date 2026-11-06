import { lazy } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"
import { AppLayout } from "@/components/layout/AppLayout"
import { ToastProvider } from "@/components/common/ToastProvider"
import { AuthProvider, useAuth } from "@/auth/AuthProvider"
import { LoginPage } from "@/pages/LoginPage"
import { RegisterPage } from "@/pages/RegisterPage"
import { safeNext } from "@/lib/utils"
import "@/index.css"

const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })))
const CalibrationPage = lazy(() => import("@/pages/CalibrationPage").then((module) => ({ default: module.CalibrationPage })))
const DetectionPage = lazy(() => import("@/pages/DetectionPage").then((module) => ({ default: module.DetectionPage })))
const DetectionHistoryPage = lazy(() => import("@/pages/DetectionHistoryPage").then((module) => ({ default: module.DetectionHistoryPage })))
const CalibrationManagementPage = lazy(() => import("@/pages/CalibrationManagementPage").then((module) => ({ default: module.CalibrationManagementPage })))
const HelpPage = lazy(() => import("@/pages/HelpPage").then((module) => ({ default: module.HelpPage })))

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">正在确认登录状态…</div>
  if (!user && location.pathname !== "/help") return <Navigate to={`/login?next=${encodeURIComponent(safeNext(location.pathname + location.search))}`} replace />
  return <Outlet />
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calibration" element={<CalibrationPage />} />
              <Route path="/detection" element={<DetectionPage />} />
              <Route path="/history" element={<DetectionHistoryPage />} />
              <Route path="/calibrations" element={<CalibrationManagementPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>,
)
