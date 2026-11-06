import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export const createId = (prefix = "id") => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
export const formatDate = (value: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
export const formatNumber = (value: number, digits = 2) => Number.isFinite(value) ? value.toLocaleString("zh-CN", { maximumFractionDigits: digits }) : "--"
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || value.startsWith("/register")) return "/"
  return value
}
