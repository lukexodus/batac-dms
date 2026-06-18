import React from "react";
import { Globe, Building, Shield, Lock, TrendingUp, TrendingDown, ChevronRight, X } from "lucide-react";

export const statusConfig = {
  "Approved": { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  "Released": { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  "Completed": { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  "In Workflow": { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  "Pending Approval": { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  "In Committee": { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  "For 1st Reading": { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
  "For 2nd Reading": { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" },
  "3rd Reading": { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" },
  "VP Certification": { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  "Under Investigation": { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  "Rejected": { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  "Draft": { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  "Archived": { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-300" },
}

export const StatusBadge = ({ status }) => {
  const c = statusConfig[status] || { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {status}
    </span>
  )
}

export const classConfig = {
  "Public": { bg: "bg-green-100", text: "text-green-700", Icon: Globe },
  "Internal": { bg: "bg-blue-100", text: "text-blue-700", Icon: Building },
  "Confidential": { bg: "bg-amber-100", text: "text-amber-700", Icon: Shield },
  "Restricted": { bg: "bg-red-100", text: "text-red-700", Icon: Lock },
}

export const ClassificationBadge = ({ level }) => {
  const c = classConfig[level] || classConfig["Internal"]
  const { Icon } = c
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${c.bg} ${c.text}`}>
      <Icon size={10} />
      {level}
    </span>
  )
}

export const PriorityTag = ({ priority }) => {
  if (priority === "normal") return null
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priority === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
      {priority === "overdue" ? "OVERDUE" : "URGENT"}
    </span>
  )
}

export const Btn = ({ children, variant = "primary", size = "md", icon: Icon, onClick, disabled, className = "" }) => {
  const variants = {
    primary: "text-white border-transparent",
    secondary: "bg-white text-gray-700 hover:bg-gray-50 border-gray-200",
    danger: "bg-red-600 text-white hover:bg-red-700 border-transparent",
    warning: "bg-amber-500 text-white hover:bg-amber-600 border-transparent",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 border-transparent",
    outline: "bg-transparent border-2 border-current",
  }
  const sizes = {
    xs: "text-xs px-2 py-1 gap-1",
    sm: "text-xs px-3 py-1.5 gap-1.5",
    md: "text-sm px-4 py-2 gap-2",
    lg: "text-sm px-5 py-2.5 gap-2",
  }
  const iconSize = size === "xs" || size === "sm" ? 13 : 15
  const isPrimary = variant === "primary"
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className} ${isPrimary ? "brand-btn" : ""}`}
      style={isPrimary ? { backgroundColor: disabled ? undefined : undefined } : {}}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
    </button>
  )
}

export const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = "green" }) => {
  const colors = {
    green: { bg: "brand-bg-light", icon: "brand-text" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600" },
    red: { bg: "bg-red-50", icon: "text-red-600" },
    blue: { bg: "bg-blue-50", icon: "text-blue-600" },
    purple: { bg: "bg-purple-50", icon: "text-purple-600" },
  }
  const c = colors[color] || colors.green
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-default">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 leading-tight">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
          <Icon size={18} className={c.icon} />
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      {trend && (
        <div className="mt-2.5 flex items-center gap-1">
          {trend === "up"
            ? <TrendingUp size={13} className="text-green-500" />
            : <TrendingDown size={13} className="text-red-500" />}
          <span className={`text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-600"}`}>{trendValue}</span>
          <span className="text-xs text-gray-400">vs last month</span>
        </div>
      )}
    </div>
  )
}

export const SectionHdr = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
)

export const PageHdr = ({ title, subtitle, breadcrumb, actions }) => (
  <div className="mb-6">
    {breadcrumb && (
      <nav className="flex items-center gap-1 text-xs text-gray-400 mb-2">
        {breadcrumb.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} />}
            <span className={i === breadcrumb.length - 1 ? "text-gray-600" : ""}>{item}</span>
          </span>
        ))}
      </nav>
    )}
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  </div>
)

export const Modal = ({ open, onClose, title, subtitle, width = "max-w-2xl", children }) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16" style={{ overflow: "auto" }}>
      <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${width} flex flex-col`} style={{ maxHeight: "calc(100vh - 8rem)" }}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-4 flex-shrink-0">
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

export const FLabel = ({ children, required }) => (
  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
)

export const FRow = ({ children, cols = 2 }) => (
  <div className={`grid gap-4 mb-4 ${cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-1"}`}>{children}</div>
)
