import { useState } from "react"
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X,
  Layers, Briefcase, Scale, Activity, FileCheck, Folder, Globe,
  Check, RotateCcw, Download, Upload, Printer, Eye, ExternalLink,
  RefreshCw, Plus, MoreHorizontal, Send, Filter, Search,
  CheckCircle, XCircle, AlertCircle, AlertTriangle, Clock,
  FileText, BarChart3, TrendingUp, TrendingDown,
  User, Building, LogOut, Bell, Settings,
  Shield, Lock, Star, Archive, Calendar, MapPin, Phone,
  Mail, BookOpen, Inbox, Home, MessageSquare,
  ClipboardList
} from "lucide-react"
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
const GlobalStyles = () => null


// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────
const mockPendingSignatures = [
  { id: "DTS-2026-000089", title: "Travel Order — City Engineering Site Inspection (Brgy. 7)", type: "Travel Order", submittedBy: "Engr. Maria P. Santos", office: "City Engineering", daysInQueue: 1, dueDate: "2026-06-12", priority: "normal" },
  { id: "DTS-2026-000085", title: "Purchase Request — Medical Supplies Q3 2026", type: "Purchase Request", submittedBy: "Dr. Juan C. Reyes", office: "City Health", daysInQueue: 4, dueDate: "2026-06-07", priority: "overdue" },
  { id: "DTS-2026-000082", title: "Project Proposal — Road Rehabilitation Brgy. 4 North", type: "Project Proposal", submittedBy: "Engr. Pedro O. Ramos", office: "City Engineering", daysInQueue: 2, dueDate: "2026-06-13", priority: "normal" },
  { id: "DTS-2026-000079", title: "Memorandum Order — City-Wide Compliance Check June 2026", type: "Memorandum Order", submittedBy: "Adm. Lorna M. Cruz", office: "City Administrator", daysInQueue: 1, dueDate: "2026-06-14", priority: "normal" },
  { id: "DTS-2026-000076", title: "Leave Application — CSWDO Director Annual Leave", type: "Leave Application", submittedBy: "Dir. Rosa S. Fernandez", office: "CSWDO", daysInQueue: 6, dueDate: "2026-06-05", priority: "overdue" },
]

const mockSLAData = [
  { name: "Jan", compliant: 94, breach: 6 },
  { name: "Feb", compliant: 91, breach: 9 },
  { name: "Mar", compliant: 96, breach: 4 },
  { name: "Apr", compliant: 93, breach: 7 },
  { name: "May", compliant: 97, breach: 3 },
  { name: "Jun", compliant: 95, breach: 5 },
]

const mockDeptWorkload = [
  { name: "Engineering", pending: 12, completed: 45, overdue: 2 },
  { name: "Health", pending: 8, completed: 32, overdue: 1 },
  { name: "Budget", pending: 15, completed: 28, overdue: 3 },
  { name: "HRMO", pending: 6, completed: 54, overdue: 0 },
  { name: "Treasurer", pending: 9, completed: 41, overdue: 1 },
  { name: "CSWDO", pending: 4, completed: 23, overdue: 0 },
]

const mockLegislativeQueue = [
  { id: "DTS-2026-000092", title: "Resolution Authorizing the City Mayor to Negotiate and Enter into MOA with DILG for Community-Based Solid Waste Management", type: "Resolution", status: "For 1st Reading", committee: "Environment", author: "Coun. Salamangkit", session: "June 12, 2026" },
  { id: "DTS-2026-000088", title: "Ordinance Establishing the Batac City Youth Development Office and Defining Its Powers and Functions", type: "Ordinance", status: "In Committee", committee: "Youth & Sports", author: "Coun. Daguio", session: "TBD" },
  { id: "DTS-2026-000084", title: "Resolution Congratulating BNRHS Athletes for 2026 Regional Meet Championship", type: "Resolution", status: "For 2nd Reading", committee: "Education", author: "Coun. Borleo", session: "June 12, 2026" },
  { id: "DTS-2026-000080", title: "Ordinance Regulating Outdoor Advertising and Signage Within the Territorial Jurisdiction of Batac City", type: "Ordinance", status: "3rd Reading", committee: "Trade & Commerce", author: "Coun. Flojo", session: "June 12, 2026" },
  { id: "DTS-2026-000077", title: "Resolution Supporting the National Socialized Housing Program and Creating a Local Coordinating Committee", type: "Resolution", status: "VP Certification", committee: "Housing", author: "Coun. Quidang", session: "Completed" },
]

const mockSessionCalendar = [
  { date: "2026-06-12", day: "12", title: "Regular Session", time: "9:00 AM", type: "regular", items: 6 },
  { date: "2026-06-19", day: "19", title: "Regular Session", time: "9:00 AM", type: "regular", items: 4 },
  { date: "2026-06-26", day: "26", title: "Special Session", time: "2:00 PM", type: "special", items: 2 },
]

const mockLegislativeOutput = [
  { month: "Jan", resolutions: 8, ordinances: 2 },
  { month: "Feb", resolutions: 12, ordinances: 1 },
  { month: "Mar", resolutions: 6, ordinances: 3 },
  { month: "Apr", resolutions: 9, ordinances: 2 },
  { month: "May", resolutions: 11, ordinances: 4 },
  { month: "Jun", resolutions: 5, ordinances: 1 },
]

const mockRoutingHistory = [
  { id: 1, office: "Office of Coun. Jose R. Dela Cruz", action: "Document Drafted", detail: "Initial draft of SP Resolution prepared and submitted to the SP Secretariat for logging.", timestamp: "May 15, 2026 — 9:30 AM", status: "done", user: "Coun. Jose R. Dela Cruz", role: "Author / SP Member" },
  { id: 2, office: "SP Secretariat", action: "Document Logged & Numbered", detail: "Document received and logged. Assigned tracking number DTS-2026-000045. QR cover sheet and preliminary series number generated.", timestamp: "May 15, 2026 — 10:15 AM", status: "done", user: "Sec. Ana Maria T. Reyes", role: "SP Secretary" },
  { id: 3, office: "SP Committee on Environment, NR, Climate Change", action: "Committee Referral", detail: "Referred jointly to the Committee on Environment and the Committee on Laws, Rules, Ethics & Privileges for review.", timestamp: "May 15, 2026 — 2:00 PM", status: "done", user: "VM Albert D. Chua", role: "Presiding Officer" },
  { id: 4, office: "Committee on Environment / Committee on Laws", action: "Committee Report Submitted", detail: "Joint Committee Report submitted with a FAVORABLE recommendation. Committees recommend approval with minor amendments incorporated.", timestamp: "May 20, 2026 — 11:00 AM", status: "done", user: "Coun. Salamangkit / Coun. Flojo", role: "Committee Chairpersons" },
  { id: 5, office: "SP Secretariat — Plenary Session", action: "First Reading", detail: "Resolution read by title and referred. Calendared for Second Reading at the next regular session.", timestamp: "May 22, 2026 — 10:00 AM", status: "done", user: "VM Albert D. Chua", role: "Presiding Officer" },
  { id: 6, office: "SP Secretariat — Plenary Session", action: "Second Reading & Final Vote", detail: "Resolution read in full. Deliberations conducted. Amendments accepted. Put to a vote. Result: 10 Ayes, 0 Nays, 0 Abstentions. APPROVED.", timestamp: "May 29, 2026 — 10:45 AM", status: "done", user: "VM Albert D. Chua", role: "Presiding Officer" },
  { id: 7, office: "Office of the Vice Mayor", action: "VP Certification & Series Number Assigned", detail: "Approved resolution formally certified by the Presiding Officer. Final series number assigned: Resolution No. 7SP 2026-047. Official copy produced.", timestamp: "May 29, 2026 — 2:30 PM", status: "done", user: "VM Albert D. Chua", role: "Vice Mayor / Presiding Officer" },
  { id: 8, office: "Office of the City Mayor", action: "Reference Copy Transmitted", detail: "Official copy transmitted to the Mayor's Office for filing and reference. Copy also transmitted to SP Secretariat archive.", timestamp: "May 30, 2026 — 9:00 AM", status: "done", user: "Sec. Ana Maria T. Reyes", role: "SP Secretary" },
  { id: 9, office: "Records Office — SP Secretariat", action: "Archived & Published", detail: "Resolution archived as a permanent official record. Classified Public. Published to the Citizen Portal. Transmitted to the Sangguniang Panlalawigan for review.", timestamp: "June 2, 2026 — 3:15 PM", status: "current", user: "RO Maria B. Soriano", role: "Records Officer" },
]

const mockDocuments = [
  { id: "DTS-2026-000092", title: "Resolution Authorizing MOA with DILG for Community-Based SWM", type: "SP Resolution", office: "SP Secretariat", date: "2026-06-01", status: "In Workflow", classification: "Public", size: "1.2 MB", ver: 1 },
  { id: "DTS-2026-000091", title: "Travel Order — Engineering Site Inspection June 2026", type: "Travel Order", office: "City Engineering", date: "2026-05-30", status: "Approved", classification: "Internal", size: "0.5 MB", ver: 1 },
  { id: "DTS-2026-000090", title: "Purchase Request — IT Equipment Procurement Q3", type: "Purchase Request", office: "City IT Office", date: "2026-05-29", status: "Pending Approval", classification: "Internal", size: "0.8 MB", ver: 2 },
  { id: "DTS-2026-000089", title: "Citizen Request — Road Repair Brgy. 1-S Valdez", type: "Citizen Request", office: "Mayor's Office", date: "2026-05-28", status: "In Workflow", classification: "Internal", size: "0.3 MB", ver: 1 },
  { id: "DTS-2026-000088", title: "SP Ordinance — Batac City Youth Development Office", type: "SP Ordinance", office: "SP Secretariat", date: "2026-05-27", status: "In Workflow", classification: "Public", size: "2.1 MB", ver: 3 },
  { id: "DTS-2026-000087", title: "Memorandum — Adjusted Office Hours During Holiday Season", type: "Internal Memorandum", office: "City Administrator", date: "2026-05-26", status: "Released", classification: "Internal", size: "0.4 MB", ver: 1 },
  { id: "DTS-2026-000086", title: "Citizen Complaint — Illegal Dumping Brgy. 2 (Ref: CC-2026-019)", type: "Citizen Complaint", office: "Mayor's Office", date: "2026-05-25", status: "Under Investigation", classification: "Confidential", size: "0.7 MB", ver: 1 },
  { id: "DTS-2026-000085", title: "Purchase Request — Medical Supplies Q3 2026", type: "Purchase Request", office: "City Health", date: "2026-05-24", status: "Pending Approval", classification: "Internal", size: "1.1 MB", ver: 1 },
  { id: "DTS-2026-000084", title: "Leave Application — HRMO Director Annual Leave June", type: "Leave Application", office: "HRMO", date: "2026-05-23", status: "Approved", classification: "Internal", size: "0.2 MB", ver: 1 },
  { id: "DTS-2026-000083", title: "Project Proposal — Flood Control System Brgy. 5 Phase 2", type: "Project Proposal", office: "City Engineering", date: "2026-05-22", status: "Pending Approval", classification: "Internal", size: "3.5 MB", ver: 2 },
  { id: "DTS-2026-000082", title: "Resolution No. 7SP 2026-046 — Supporting National Housing Program", type: "SP Resolution", office: "SP Secretariat", date: "2026-05-20", status: "Released", classification: "Public", size: "0.9 MB", ver: 1 },
  { id: "DTS-2026-000081", title: "Administrative Case — Complaint Against Barangay Official (AC-2026-04)", type: "Admin Case", office: "SP Secretariat", date: "2026-05-18", status: "Under Investigation", classification: "Confidential", size: "1.8 MB", ver: 2 },
]

const publicOrdinances = [
  { number: "Ord. 7SP 2026-005", title: "Ordinance Establishing the Batac City Youth Development Office", date: "2026-05-30", type: "Ordinance", pages: 12 },
  { number: "Res. 7SP 2026-047", title: "Resolution Authorizing City Mayor to Enter into MOA with DILG for CBSWM Project", date: "2026-06-02", type: "Resolution", pages: 4 },
  { number: "Res. 7SP 2026-046", title: "Resolution Supporting the National Socialized Housing Program", date: "2026-05-28", type: "Resolution", pages: 3 },
  { number: "Ord. 7SP 2026-004", title: "Ordinance Regulating Outdoor Advertising and Signage in Batac City", date: "2026-05-20", type: "Ordinance", pages: 18 },
  { number: "Res. 7SP 2026-043", title: "Resolution Congratulating BNRHS Athletes for Regional Championships", date: "2026-05-15", type: "Resolution", pages: 2 },
  { number: "Ord. 7SP 2026-003", title: "Anti-Littering and Solid Waste Management Ordinance of Batac City", date: "2026-04-22", type: "Ordinance", pages: 24 },
]

// ─────────────────────────────────────────────────────────────────────────────
// UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
const statusConfig = {
  "Approved":           { bg: "bg-green-100",   text: "text-green-700",  dot: "bg-green-500"  },
  "Released":           { bg: "bg-green-100",   text: "text-green-700",  dot: "bg-green-500"  },
  "Completed":          { bg: "bg-green-100",   text: "text-green-700",  dot: "bg-green-500"  },
  "In Workflow":        { bg: "bg-blue-100",    text: "text-blue-700",   dot: "bg-blue-500"   },
  "Pending Approval":   { bg: "bg-amber-100",   text: "text-amber-700",  dot: "bg-amber-500"  },
  "In Committee":       { bg: "bg-purple-100",  text: "text-purple-700", dot: "bg-purple-500" },
  "For 1st Reading":    { bg: "bg-violet-100",  text: "text-violet-700", dot: "bg-violet-500" },
  "For 2nd Reading":    { bg: "bg-violet-100",  text: "text-violet-700", dot: "bg-violet-500" },
  "3rd Reading":        { bg: "bg-indigo-100",  text: "text-indigo-700", dot: "bg-indigo-500" },
  "VP Certification":   { bg: "bg-blue-100",    text: "text-blue-700",   dot: "bg-blue-500"   },
  "Under Investigation":{ bg: "bg-orange-100",  text: "text-orange-700", dot: "bg-orange-500" },
  "Rejected":           { bg: "bg-red-100",     text: "text-red-700",    dot: "bg-red-500"    },
  "Draft":              { bg: "bg-gray-100",    text: "text-gray-600",   dot: "bg-gray-400"   },
  "Archived":           { bg: "bg-gray-100",    text: "text-gray-500",   dot: "bg-gray-300"   },
}

const StatusBadge = ({ status }) => {
  const c = statusConfig[status] || { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {status}
    </span>
  )
}

const classConfig = {
  "Public":       { bg: "bg-green-100",  text: "text-green-700",  Icon: Globe   },
  "Internal":     { bg: "bg-blue-100",   text: "text-blue-700",   Icon: Building },
  "Confidential": { bg: "bg-amber-100",  text: "text-amber-700",  Icon: Shield  },
  "Restricted":   { bg: "bg-red-100",    text: "text-red-700",    Icon: Lock    },
}

const ClassificationBadge = ({ level }) => {
  const c = classConfig[level] || classConfig["Internal"]
  const { Icon } = c
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${c.bg} ${c.text}`}>
      <Icon size={10} />
      {level}
    </span>
  )
}

const PriorityTag = ({ priority }) => {
  if (priority === "normal") return null
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${priority === "overdue" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
      {priority === "overdue" ? "OVERDUE" : "URGENT"}
    </span>
  )
}

const Btn = ({ children, variant = "primary", size = "md", icon: Icon, onClick, disabled, className = "" }) => {
  const variants = {
    primary:   "text-white border-transparent",
    secondary: "bg-white text-gray-700 hover:bg-gray-50 border-gray-200",
    danger:    "bg-red-600 text-white hover:bg-red-700 border-transparent",
    warning:   "bg-amber-500 text-white hover:bg-amber-600 border-transparent",
    ghost:     "bg-transparent text-gray-600 hover:bg-gray-100 border-transparent",
    outline:   "bg-transparent border-2 border-current",
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

const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = "green" }) => {
  const colors = {
    green:  { bg: "brand-bg-light", icon: "brand-text" },
    amber:  { bg: "bg-amber-50",    icon: "text-amber-600" },
    red:    { bg: "bg-red-50",      icon: "text-red-600" },
    blue:   { bg: "bg-blue-50",     icon: "text-blue-600" },
    purple: { bg: "bg-purple-50",   icon: "text-purple-600" },
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

const SectionHdr = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
)

const PageHdr = ({ title, subtitle, breadcrumb, actions }) => (
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

// ─────────────────────────────────────────────────────────────────────────────
// CITY SEAL SVG
// ─────────────────────────────────────────────────────────────────────────────
const CitySeal = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="48" fill="#1A6B35" />
    <circle cx="50" cy="50" r="44" fill="#1A6B35" stroke="#F59E0B" strokeWidth="2" />
    <circle cx="50" cy="50" r="37" fill="#1A6B35" stroke="#F59E0B" strokeWidth="1" />
    {/* Building */}
    <rect x="36" y="52" width="28" height="20" rx="1" fill="#F0FAF4" />
    <rect x="40" y="44" width="20" height="10" rx="1" fill="#F0FAF4" />
    <rect x="45" y="38" width="10" height="8" rx="1" fill="#F0FAF4" />
    <rect x="42" y="55" width="5" height="9" rx="0.5" fill="#1A6B35" />
    <rect x="53" y="55" width="5" height="9" rx="0.5" fill="#1A6B35" />
    {/* Stars */}
    <circle cx="28" cy="50" r="2" fill="#F59E0B" />
    <circle cx="72" cy="50" r="2" fill="#F59E0B" />
    <circle cx="50" cy="26" r="2" fill="#F59E0B" />
    {/* Text arc approximation */}
    <text x="50" y="20" textAnchor="middle" fill="#F59E0B" fontSize="6" fontFamily="serif" fontWeight="bold" letterSpacing="0.5">CITY OF BATAC</text>
    <text x="50" y="88" textAnchor="middle" fill="#F59E0B" fontSize="5.5" fontFamily="serif" letterSpacing="0.3">ILOCOS NORTE</text>
  </svg>
)

// ─────────────────────────────────────────────────────────────────────────────
// QR CODE DISPLAY (visual approximation — non-functional)
// ─────────────────────────────────────────────────────────────────────────────
const QRDisplay = ({ size = 80 }) => {
  const N = 21
  const cs = size / N
  const isBlack = (r, c) => {
    const inTL = r < 7 && c < 7
    const inTR = r < 7 && c >= 14
    const inBL = r >= 14 && c < 7
    const finder = (rr, cc) => (rr === 0 || rr === 6 || cc === 0 || cc === 6) || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4)
    if (inTL) return finder(r, c)
    if (inTR) return finder(r, c - 14)
    if (inBL) return finder(r - 14, c)
    if (r === 6 && c >= 8 && c <= 12) return c % 2 === 0
    if (c === 6 && r >= 8 && r <= 12) return r % 2 === 0
    if (r >= 8 && c >= 8) return ((r * 29 + c * 17 + r * c * 3) % 11) < 4
    return false
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="white" />
      {Array.from({ length: N }, (_, r) =>
        Array.from({ length: N }, (_, c) =>
          isBlack(r, c) ? <rect key={`${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill="#111" /> : null
        )
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
const navGroups = [
  {
    label: "PROTOTYPE",
    items: [{ id: "kitchen", label: "Design System", icon: Layers }],
  },
  {
    label: "DASHBOARDS",
    items: [
      { id: "mayor",    label: "Mayor's Dashboard",       icon: Briefcase },
      { id: "sp",       label: "SP Secretary Dashboard",  icon: Scale     },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { id: "dts",  label: "Document Tracking",  icon: Activity   },
      { id: "wms",  label: "Approval Interface", icon: FileCheck  },
      { id: "dms",  label: "Document Repository",icon: Folder     },
    ],
  },
  {
    label: "PUBLIC",
    items: [{ id: "portal", label: "Citizen Portal", icon: Globe }],
  },
]

const Sidebar = ({ page, setPage, collapsed, setCollapsed }) => (
  <div className={`sidebar-bg flex flex-col flex-shrink-0 transition-all duration-200 ${collapsed ? "w-16" : "w-64"}`} style={{ minHeight: "100vh" }}>
    {/* Logo */}
    <div className={`flex items-center gap-3 border-b border-opacity-20 border-white p-4 flex-shrink-0 ${collapsed ? "justify-center px-2" : ""}`}
         style={{ borderBottomColor: "rgba(255,255,255,0.15)" }}>
      <CitySeal size={collapsed ? 30 : 34} />
      {!collapsed && (
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-tight">City of Batac</p>
          <p className="text-xs leading-tight" style={{ color: "#86efac" }}>LGU Platform · v0.1</p>
        </div>
      )}
    </div>

    {/* Nav */}
    <nav className="flex-1 overflow-y-auto py-3">
      {navGroups.map(g => (
        <div key={g.label} className="mb-1">
          {!collapsed && (
            <p className="px-4 py-1.5 text-[10px] font-semibold tracking-widest" style={{ color: "#4ade80", opacity: 0.7 }}>
              {g.label}
            </p>
          )}
          {g.items.map(item => {
            const active = page === item.id
            const { icon: Icon } = item
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 py-2.5 text-sm transition-colors text-left nav-hover ${collapsed ? "justify-center px-2" : "px-4"} ${active ? "nav-active" : ""}`}
                style={{ color: active ? "white" : "rgba(255,255,255,0.65)" }}
              >
                <Icon size={17} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && active && <span className="ml-auto w-1 h-4 rounded-full" style={{ backgroundColor: "#86efac" }} />}
              </button>
            )
          })}
        </div>
      ))}
    </nav>

    {/* User + collapse */}
    <div className="flex-shrink-0 p-3" style={{ borderTopColor: "rgba(255,255,255,0.15)", borderTopWidth: 1, borderTopStyle: "solid" }}>
      {!collapsed && (
        <div className="flex items-center gap-2.5 p-2 mb-2 rounded-lg cursor-pointer" style={{ transition: "background 0.15s" }}
             onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"}
             onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 brand-btn">MK</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">Mark Christian R. Chua</p>
            <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>Mayor · City of Batac</p>
          </div>
        </div>
      )}
      <button onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs transition-colors"
        style={{ color: "rgba(255,255,255,0.5)" }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
        {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
      </button>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// TOP BAR
// ─────────────────────────────────────────────────────────────────────────────
const TopBar = ({ title, subtitle }) => (
  <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0" style={{ minHeight: 52 }}>
    <div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-1">
      <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <Bell size={17} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
      </button>
      <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"><Settings size={17} /></button>
      <div className="h-7 w-px bg-gray-200 mx-1" />
      <div className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white brand-btn">MK</div>
        <ChevronDown size={13} className="text-gray-400" />
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: DESIGN SYSTEM (KITCHEN SINK)
// ─────────────────────────────────────────────────────────────────────────────
const KitchenSinkPage = () => (
  <div className="p-6 max-w-5xl">
    <PageHdr title="Design System" subtitle="Batac City LGU Platform — Component Library v0.1 · IBM Plex Sans + Plex Mono"
      breadcrumb={["Prototype", "Design System"]} />

    {/* Color Palette */}
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Color Palette</p>
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Brand Green</p>
        <div className="flex gap-2 flex-wrap">
          {[["50","#F0FAF4"],["100","#D9F2E6"],["200","#B3E4CC"],["300","#7DCFA8"],["400","#3DB77C"],["500","#00A651"],["600","#007A3A"],["700","#0D3D20"],["800","#092912"],["900","#040F07"]].map(([s,hex]) => (
            <div key={s} className="text-center">
              <div className="w-10 h-10 rounded-lg mb-1 border border-white border-opacity-20 shadow-sm" style={{ backgroundColor: hex }} />
              <p className="text-[9px] text-gray-400">{s}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Semantic Status</p>
        <div className="flex flex-wrap gap-3">
          {[["Success","#16a34a","#dcfce7"],["Warning","#f59e0b","#fef3c7"],["Danger","#dc2626","#fee2e2"],["Info","#2563eb","#dbeafe"],["Accent Gold","#f59e0b","#fef9c3"]].map(([name,dark,light]) => (
            <div key={name} className="flex items-center gap-2">
              <div style={{ backgroundColor: dark }} className="w-7 h-7 rounded-lg" />
              <div style={{ backgroundColor: light }} className="w-7 h-7 rounded-lg" />
              <span className="text-xs text-gray-400">{name}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-2">Neutral Gray</p>
        <div className="flex gap-2">
          {[["50","#F9FAFB"],["100","#F3F4F6"],["200","#E5E7EB"],["300","#D1D5DB"],["400","#9CA3AF"],["500","#6B7280"],["600","#4B5563"],["700","#374151"],["800","#1F2937"],["900","#111827"]].map(([s,hex]) => (
            <div key={s} className="flex-1 text-center">
              <div className="h-8 rounded mb-1" style={{ backgroundColor: hex }} />
              <p className="text-[9px] text-gray-400">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Typography */}
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-5">Typography — IBM Plex Sans</p>
      <div className="space-y-4 divide-y divide-gray-50">
        {[
          ["Display · 36px Bold", "text-4xl font-bold text-gray-900", "City of Batac LGU Platform"],
          ["Heading XL · 24px Bold", "text-2xl font-bold text-gray-900", "Document Management System"],
          ["Heading LG · 20px Semibold", "text-xl font-semibold text-gray-900", "SP Secretary's Dashboard"],
          ["Heading MD · 16px Semibold", "text-base font-semibold text-gray-800", "Pending Signatures Queue"],
          ["Body · 14px Regular", "text-sm text-gray-700", "Resolution No. 7SP 2026-047 has been certified by the Presiding Officer."],
          ["Small · 12px Regular", "text-xs text-gray-500", "Submitted by Engr. Santos · City Engineering · 1d in queue · Due: June 12, 2026"],
          ["Mono · Tracking Number", "font-mono text-sm text-green-700 font-medium", "DTS-2026-000045"],
        ].map(([label, cls, sample]) => (
          <div key={label} className="flex items-baseline gap-4 pt-3 first:pt-0">
            <span className="text-[10px] text-gray-400 w-40 flex-shrink-0">{label}</span>
            <span className={cls}>{sample}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Buttons */}
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Buttons</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <Btn variant="primary">Primary Action</Btn>
        <Btn variant="secondary">Secondary</Btn>
        <Btn variant="danger">Reject Document</Btn>
        <Btn variant="warning">Return for Revision</Btn>
        <Btn variant="ghost">Ghost</Btn>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Btn variant="primary" icon={Check}>Approve</Btn>
        <Btn variant="danger" icon={XCircle}>Reject</Btn>
        <Btn variant="warning" icon={RotateCcw}>Return for Revision</Btn>
        <Btn variant="secondary" icon={Download}>Download</Btn>
        <Btn variant="secondary" icon={Printer}>Print Cover Sheet</Btn>
        <Btn variant="secondary" icon={Eye}>View</Btn>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn size="xs">Extra Small</Btn>
        <Btn size="sm">Small</Btn>
        <Btn size="md">Medium</Btn>
        <Btn size="lg">Large</Btn>
        <Btn disabled>Disabled</Btn>
      </div>
    </div>

    {/* Badges */}
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Status & Classification Badges</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {["Approved","Pending Approval","In Workflow","In Committee","For 1st Reading","For 2nd Reading","3rd Reading","VP Certification","Released","Rejected","Under Investigation","Draft","Archived"].map(s => (
          <StatusBadge key={s} status={s} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {["Public","Internal","Confidential","Restricted"].map(l => <ClassificationBadge key={l} level={l} />)}
      </div>
    </div>

    {/* Alerts */}
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Alert Banners</p>
      <div className="space-y-3">
        {[
          { icon: CheckCircle, c: "green",  bg: "bg-green-50",  border: "border-green-200", title: "Document Approved", body: "Resolution No. 7SP 2026-047 has been approved and certified by the Vice Mayor." },
          { icon: AlertTriangle, c: "amber", bg: "bg-amber-50", border: "border-amber-200", title: "SLA Warning — 80% of Time Limit Reached", body: "Purchase Request DTS-2026-000085 is approaching its ARTA processing deadline." },
          { icon: AlertCircle, c: "red",    bg: "bg-red-50",    border: "border-red-200",   title: "SLA Breach — Automatically Escalated", body: "Leave Application DTS-2026-000076 has exceeded the 3-day processing limit." },
          { icon: Inbox, c: "blue",         bg: "bg-blue-50",   border: "border-blue-200",  title: "Mayor's 10-Day Review Period — 6 Days Remaining", body: "SP Ordinance No. 7SP 2026-004 requires executive action before June 14, 2026." },
        ].map(({ icon: Icon, c, bg, border, title, body }) => (
          <div key={title} className={`flex items-start gap-3 p-3.5 rounded-lg border ${bg} ${border}`}>
            <Icon size={15} className={`text-${c}-600 mt-0.5 flex-shrink-0`} />
            <div>
              <p className={`text-sm font-semibold text-${c}-800`}>{title}</p>
              <p className={`text-xs text-${c}-700 mt-0.5`}>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Forms */}
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Form Elements</p>
      <div className="grid grid-cols-2 gap-5">
        {[["Text Input","text","Enter document title..."],["Date Input","date",""]].map(([label, type, ph]) => (
          <div key={label}>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>
            <input type={type} placeholder={ph} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring transition-shadow" />
          </div>
        ))}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Select</label>
          <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
            {["All Document Types","SP Resolution","SP Ordinance","Travel Order","Purchase Request"].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Search</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search tracking numbers, titles..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
          </div>
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Comment (Mandatory on Rejection) <span className="text-red-500">*</span></label>
          <textarea rows={3} placeholder="State your reason or provide revision instructions (required)..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring resize-none" />
        </div>
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: MAYOR'S DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const MayorPage = () => (
  <div className="p-6">
    <PageHdr
      title="Mayor's Dashboard"
      subtitle="Mayor Mark Christian 'Markee' R. Chua · City of Batac, Ilocos Norte"
      breadcrumb={["Dashboards", "Mayor's Dashboard"]}
      actions={<>
        <Btn variant="secondary" size="sm" icon={RefreshCw}>Refresh</Btn>
        <Btn variant="secondary" size="sm" icon={Download}>Export Report</Btn>
      </>}
    />

    {/* SLA breach alert */}
    <div className="flex items-start gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl">
      <AlertCircle size={17} className="text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-800">5 Documents Require Immediate Executive Attention</p>
        <p className="text-xs text-red-700 mt-0.5">Purchase Request DTS-2026-000085 (City Health, +4 days) and Leave Application DTS-2026-000076 (CSWDO, +6 days) have breached ARTA limits and have been automatically escalated.</p>
      </div>
      <Btn variant="danger" size="sm">Review Now</Btn>
    </div>

    {/* KPIs */}
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatCard title="Pending Signature" value="12" subtitle="5 are overdue" icon={FileCheck} color="amber" trend="down" trendValue="3 fewer" />
      <StatCard title="City-Wide Overdue" value="7" subtitle="Across 5 departments" icon={AlertTriangle} color="red" trend="up" trendValue="2 more" />
      <StatCard title="SLA Compliance" value="95.3%" subtitle="This month · Target: 95%" icon={Activity} color="green" trend="up" trendValue="+1.2%" />
      <StatCard title="Active Documents" value="148" subtitle="In workflow system" icon={FileText} color="blue" trend="up" trendValue="+12 new" />
    </div>

    <div className="grid grid-cols-3 gap-5 mb-5">
      {/* Pending signatures table */}
      <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <SectionHdr title="Pending Your Signature" subtitle="Sorted by urgency — ARTA deadlines apply"
            action={<Btn variant="ghost" size="xs" icon={Eye}>View All (12)</Btn>} />
        </div>
        <div>
          {mockPendingSignatures.map((doc, i) => (
            <div key={doc.id} className={`px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors ${i !== mockPendingSignatures.length - 1 ? "border-b border-gray-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-gray-400">{doc.id}</span>
                  <PriorityTag priority={doc.priority} />
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Building size={10} />{doc.office}</span>
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{doc.daysInQueue}d in queue</span>
                  <span className={`text-xs ${doc.priority === "overdue" ? "text-red-600 font-medium" : "text-gray-400"}`}>Due: {doc.dueDate}</span>
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Btn variant="secondary" size="xs" icon={Eye}>Review</Btn>
                <Btn variant="primary" size="xs" icon={Check}>Sign</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SLA chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <SectionHdr title="SLA Compliance Trend" subtitle="Monthly compliance rate (%)" />
        <ResponsiveContainer width="100%" height={185}>
          <AreaChart data={mockSLAData} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="slaG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00A651" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#00A651" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[85, 100]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area type="monotone" dataKey="compliant" stroke="#00A651" fill="url(#slaG)" strokeWidth={2} dot={{ r: 3 }} name="Compliant %" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Target: 95%</span>
          <span className="text-xs font-medium text-green-600 flex items-center gap-1"><TrendingUp size={12} />Above target</span>
        </div>
      </div>
    </div>

    {/* Department workload */}
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <SectionHdr title="Department Document Workload" subtitle="Active documents by department and status" />
      <ResponsiveContainer width="100%" height={195}>
        <BarChart data={mockDeptWorkload} barSize={18} margin={{ top: 2, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="completed" fill="#bbf7d0" name="Completed" radius={[2, 2, 0, 0]} />
          <Bar dataKey="pending"   fill="#00A651" name="Pending"   radius={[2, 2, 0, 0]} />
          <Bar dataKey="overdue"   fill="#dc2626" name="Overdue"   radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: SP SECRETARY DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const SPSecretaryPage = () => (
  <div className="p-6">
    <PageHdr
      title="SP Secretary's Dashboard"
      subtitle="Office of the Secretary, Sangguniang Panlungsod · 7th SP · Batac City"
      breadcrumb={["Dashboards", "SP Secretary's Dashboard"]}
      actions={<>
        <Btn variant="primary" size="sm" icon={Plus}>Log New Document</Btn>
        <Btn variant="secondary" size="sm" icon={Calendar}>Schedule Session</Btn>
      </>}
    />

    {/* KPIs */}
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatCard title="Active in Queue" value="9" subtitle="Legislative documents" icon={ClipboardList} color="blue" />
      <StatCard title="Next Session" value="6" subtitle="Items · June 12, 2026" icon={Calendar} color="green" />
      <StatCard title="Approved This Month" value="8" subtitle="Resolutions & Ordinances" icon={CheckCircle} color="green" trend="up" trendValue="+3 vs May" />
      <StatCard title="For Mayor Review" value="3" subtitle="SP Ordinances — pending LCE" icon={Scale} color="amber" />
    </div>

    <div className="grid grid-cols-3 gap-5 mb-5">
      {/* Legislative queue */}
      <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <SectionHdr title="Active Legislative Queue" subtitle="All SP resolutions and ordinances currently in workflow"
            action={<Btn variant="ghost" size="xs" icon={Plus}>Log New</Btn>} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Tracking ID","Title","Type","Status","Session Date"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockLegislativeQueue.map((item, i) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-green-600 whitespace-nowrap">{item.id}</td>
                  <td className="px-4 py-3" style={{ maxWidth: 260 }}>
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.author} · {item.committee} Committee</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.type === "Ordinance" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{item.session}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sidebar: sessions + quick actions */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHdr title="Upcoming Sessions" subtitle="June 2026" />
          <div className="space-y-3">
            {mockSessionCalendar.map((s, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${s.type === "special" ? "bg-amber-50 border border-amber-200" : "border border-green-100"}`} style={s.type === "regular" ? { backgroundColor: "#F0FAF4" } : {}}>
                <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-white ${s.type === "special" ? "bg-amber-500" : ""}`} style={s.type === "regular" ? { backgroundColor: "#00A651" } : {}}>
                  <span className="font-bold text-lg leading-tight">{s.day}</span>
                  <span className="text-[9px] opacity-80">June</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.time} · {s.items} agenda items</p>
                  <span className={`text-xs font-medium ${s.type === "special" ? "text-amber-700" : "text-green-700"}`}>{s.type === "special" ? "Special Session" : "Regular Session"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHdr title="Quick Actions" />
          <div className="space-y-2">
            {[
              [Plus, "Log Incoming Document"],
              [Printer, "Print Session Agenda"],
              [FileText, "Draft Session Minutes"],
              [Archive, "Archive Released Docs"],
            ].map(([Icon, label]) => (
              <button key={label} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left">
                <Icon size={14} className="brand-text flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Legislative output chart */}
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <SectionHdr title="Legislative Output — 2026" subtitle="Resolutions and Ordinances passed per month" />
      <ResponsiveContainer width="100%" height={195}>
        <BarChart data={mockLegislativeOutput} barSize={20} margin={{ top: 2, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="resolutions" fill="#00A651" name="Resolutions" radius={[2, 2, 0, 0]} />
          <Bar dataKey="ordinances"  fill="#7c3aed" name="Ordinances"  radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: DTS TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
const DTSPage = () => (
  <div className="p-6">
    <PageHdr
      title="Document Tracking View"
      subtitle="Complete routing history and physical custody record"
      breadcrumb={["Operations", "Document Tracking"]}
      actions={<>
        <Btn variant="secondary" size="sm" icon={Printer}>Print Cover Sheet</Btn>
        <Btn variant="secondary" size="sm" icon={Download}>Download PDF</Btn>
      </>}
    />

    <div className="grid grid-cols-3 gap-5">
      {/* Timeline column */}
      <div className="col-span-2 space-y-5">
        {/* Doc header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">DTS-2026-000045</span>
                <StatusBadge status="Released" />
                <ClassificationBadge level="Public" />
              </div>
              <p className="text-base font-semibold text-gray-900 mb-0.5">Resolution No. 7SP 2026-047</p>
              <p className="text-sm text-gray-600 line-clamp-2">Resolution Authorizing the City Mayor to Negotiate and Enter into a Memorandum of Agreement with the Department of Interior and Local Government (DILG) for the Community-Based Solid Waste Management Project of Batac City</p>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                {[["Type","SP Resolution"],["Author","Coun. Dela Cruz"],["Created","May 15, 2026"],["Released","Jun 2, 2026"]].map(([k,v]) => (
                  <div key={k}>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{k}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="bg-gray-900 p-2 rounded-xl">
                <QRDisplay size={80} />
              </div>
              <p className="text-[9px] text-gray-400 mt-1 text-center">Scan to track</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <SectionHdr title="Complete Routing History" subtitle="Tamper-evident audit trail — append-only record" />
          <div>
            {mockRoutingHistory.map((entry, i) => (
              <div key={entry.id} className="flex gap-4">
                {/* Spine */}
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 flex-shrink-0 ${entry.status === "current" ? "border-green-500 text-white" : "bg-white border-green-400"}`}
                       style={entry.status === "current" ? { backgroundColor: "#00A651" } : {}}>
                    {entry.status === "current"
                      ? <Clock size={13} className="text-white" />
                      : <Check size={13} className="text-green-600" />}
                  </div>
                  {i < mockRoutingHistory.length - 1 && (
                    <div className="w-0.5 flex-1 mt-0" style={{ backgroundColor: "#bbf7d0", minHeight: 24 }} />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 mb-4 ${i === mockRoutingHistory.length - 1 ? "mb-0" : ""}`}>
                  <div className={`rounded-lg p-4 ${entry.status === "current" ? "border border-green-200" : "bg-gray-50"}`}
                       style={entry.status === "current" ? { backgroundColor: "#F0FAF4" } : {}}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className={`text-sm font-semibold ${entry.status === "current" ? "text-green-800" : "text-gray-800"}`}>{entry.action}</p>
                        <p className="text-xs text-gray-500">{entry.office}</p>
                      </div>
                      {entry.status === "current" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-semibold flex-shrink-0" style={{ backgroundColor: "#00A651" }}>CURRENT</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{entry.detail}</p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><User size={11} />{entry.user} — {entry.role}</span>
                      <span className="font-mono text-xs text-gray-400 flex items-center gap-1"><Clock size={11} />{entry.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Cover Sheet */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Document Cover Sheet</p>
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center">
            <div className="flex justify-center mb-3">
              <div className="bg-black p-2.5 rounded-xl">
                <QRDisplay size={110} />
              </div>
            </div>
            <p className="font-mono text-sm font-bold text-gray-900">DTS-2026-000045</p>
            <p className="text-xs text-gray-500 mt-0.5">SP Resolution</p>
            <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
              City Government of Batac<br />Ilocos Norte, Philippines<br />
              <span className="font-semibold">Permanent Retention · Public</span>
            </div>
          </div>
          <Btn variant="secondary" size="sm" className="w-full mt-3" icon={Printer}>Print Cover Sheet</Btn>
        </div>

        {/* Document details */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Document Details</p>
          <dl className="space-y-3">
            {[
              ["Classification", <ClassificationBadge level="Public" />],
              ["Owning Office", "SP Secretariat"],
              ["Retention Policy", "Permanent Record"],
              ["Current Custodian", "Records Officer"],
              ["Physical Custody", <span className="text-xs text-green-700 font-medium flex items-center gap-1"><CheckCircle size={12} />Records Archive Room</span>],
              ["Total Transit Time", "18 calendar days"],
              ["Total Steps", `${mockRoutingHistory.length} workflow steps`],
            ].map(([label, val]) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <dt className="text-xs text-gray-400 flex-shrink-0">{label}</dt>
                <dd className="text-xs text-gray-900 font-medium text-right">{val}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Actions</p>
          <div className="space-y-2">
            {[[Eye,"View Official Document"],[Download,"Download Certified Copy"],[ExternalLink,"View on Citizen Portal"]].map(([Icon, label]) => (
              <button key={label} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left">
                <Icon size={14} className="brand-text" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: WMS APPROVAL INTERFACE
// ─────────────────────────────────────────────────────────────────────────────
const WMSPage = () => {
  const [action, setAction] = useState(null)
  const [comment, setComment] = useState("")
  const [done, setDone] = useState(false)

  const handleSubmit = () => {
    if ((action === "reject" || action === "return") && !comment.trim()) return
    setDone(true)
  }

  if (done) return (
    <div className="p-6 flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-md w-full text-center">
        {action === "approve" && <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />}
        {action === "reject"  && <XCircle     size={52} className="text-red-500 mx-auto mb-4" />}
        {action === "return"  && <RotateCcw   size={52} className="text-amber-500 mx-auto mb-4" />}
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {action === "approve" ? "Document Approved" : action === "reject" ? "Document Rejected" : "Returned for Revision"}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {action === "approve" ? "Forwarded to the next workflow step. The City Budget Office has been notified."
           : action === "reject" ? "The request has been rejected. The submitter (Dr. Reyes, City Health) has been notified."
           : "Returned to Dr. Reyes (City Health) with your revision instructions."}
        </p>
        {comment && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left">
            <p className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Your comment:</p>
            <p className="text-sm text-gray-700 italic">"{comment}"</p>
          </div>
        )}
        <Btn variant="primary" onClick={() => { setDone(false); setAction(null); setComment("") }}>
          Back to Review Queue
        </Btn>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <PageHdr
        title="Document Review & Approval"
        subtitle="Workflow Management System — Approver Interface"
        breadcrumb={["Operations", "Approval Interface"]}
      />
      <div className="flex gap-5" style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>
        {/* PDF viewer */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">Purchase Request — Medical Supplies Q3 2026</span>
              <span className="text-gray-300">·</span>
              <span className="font-mono">DTS-2026-000085</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Btn variant="ghost" size="xs" icon={Download}>Download</Btn>
              <Btn variant="ghost" size="xs" icon={ExternalLink}>Full View</Btn>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-100 p-5">
            <div className="bg-white max-w-2xl mx-auto shadow rounded-lg border border-gray-200 p-10">
              {/* Letterhead */}
              <div className="flex items-start justify-between mb-6 pb-5 border-b border-gray-200">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-widest">Republic of the Philippines · Province of Ilocos Norte</p>
                  <p className="text-base font-bold text-gray-800 mt-0.5">City Government of Batac</p>
                  <p className="text-xs text-gray-500">City Health Office</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-gray-400">DTS-2026-000085</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">May 24, 2026</p>
                </div>
              </div>
              <div className="text-center mb-7">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Purchase Request</p>
                <h2 className="text-lg font-bold text-gray-900 mt-1">Medical Supplies — Q3 2026</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg text-xs mb-6">
                {[["Requesting Office","City Health Office"],["Requested By","Dr. Juan C. Reyes, City Health Officer"],["Date Requested","May 24, 2026"],["Purpose","Quarterly medical supplies for CHO operations"]].map(([k,v]) => (
                  <div key={k}><span className="text-gray-400">{k}:</span><br /><strong>{v}</strong></div>
                ))}
              </div>
              <table className="w-full text-xs border-collapse mb-6">
                <thead>
                  <tr className="bg-gray-100">
                    {["Item Description","Qty","Unit","Estimated Cost"].map(h => (
                      <th key={h} className={`p-2 border border-gray-200 font-semibold text-gray-600 ${h === "Estimated Cost" ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[["Amoxicillin 500mg Capsules","500","capsules","₱2,500.00"],["Metformin 500mg Tablets","1,000","tablets","₱3,200.00"],["IV Fluids (NSS 1L)","200","bags","₱8,000.00"],["Surgical Gloves Medium (box)","50","boxes","₱4,500.00"],["N95 Respirator Masks","100","pieces","₱5,000.00"]].map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 border border-gray-200">{row[0]}</td>
                      <td className="p-2 border border-gray-200">{row[1]}</td>
                      <td className="p-2 border border-gray-200">{row[2]}</td>
                      <td className="p-2 border border-gray-200 text-right">{row[3]}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={3} className="p-2 border border-gray-200 text-right">TOTAL ESTIMATED COST</td>
                    <td className="p-2 border border-gray-200 text-right">₱23,200.00</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-500 italic">I hereby certify that the above items are necessary and will be used for the official functions of the City Health Office of Batac City, Ilocos Norte.</p>
              <div className="mt-8 grid grid-cols-3 gap-4 pt-5 border-t border-gray-200">
                {[["Requested By","Dr. Juan C. Reyes","[Signed]"],["Noted By","City Administrator","[Signed]"],["Approved By","Mayor's Office","____________"]].map(([r,n,s]) => (
                  <div key={r} className="text-center">
                    <p className="text-xs text-gray-400 italic mb-6">{s}</p>
                    <p className="text-xs font-semibold text-gray-700">{n}</p>
                    <p className="text-[10px] text-gray-400">{r}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action panel */}
        <div className="w-80 flex flex-col gap-4 flex-shrink-0 overflow-y-auto">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2"><FileText size={14} />Document Summary</p>
            <dl className="space-y-2">
              {[["Tracking No.","DTS-2026-000085","font-mono text-xs"],["Document Type","Purchase Request","text-xs"],["Submitted By","Dr. Juan C. Reyes","text-xs"],["Office","City Health Office","text-xs"],["Days in Queue",<span className="text-red-600 font-bold text-xs">4 days ⚠ OVERDUE</span>,""],["ARTA Deadline",<span className="text-red-600 font-medium text-xs">June 7, 2026</span>,""],["Classification",<ClassificationBadge level="Internal" />,""]].map(([k,v,cls]) => (
                <div key={k} className="flex justify-between items-center gap-2">
                  <dt className="text-[10px] text-gray-400 flex-shrink-0">{k}</dt>
                  <dd className={cls || "text-xs font-medium text-right"}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Workflow position */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Workflow Position</p>
            <div className="space-y-1.5">
              {[["Submitted by CHO",true,false],["Department Head Endorsement",true,false],["Budget Office Certification",true,false],["Mayor's Office Approval",false,true],["Release to Requesting Office",false,false]].map(([step, done, current], i) => (
                <div key={i} className={`flex items-center gap-2 p-1.5 rounded ${current ? "bg-amber-50" : ""}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? "bg-green-100" : current ? "bg-amber-100 border-2 border-amber-400" : "bg-gray-100"}`}>
                    {done ? <Check size={10} className="text-green-600" /> : current ? <Clock size={9} className="text-amber-600" /> : null}
                  </div>
                  <span className={`text-xs ${current ? "font-semibold text-amber-700" : done ? "text-gray-400 line-through" : "text-gray-500"}`}>{step}</span>
                  {current && <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full text-white font-bold bg-amber-500">YOU</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-3">Take Action</p>
            <div className="space-y-2 mb-4">
              {[
                { id: "approve", icon: Check,     border: "border-green-500",  bg: "bg-green-50",  label: "Approve",             sub: "Forward to next step" },
                { id: "return",  icon: RotateCcw, border: "border-amber-400",  bg: "bg-amber-50",  label: "Return for Revision",  sub: "Send back with comments" },
                { id: "reject",  icon: X,         border: "border-red-500",    bg: "bg-red-50",    label: "Reject",               sub: "Terminate this request" },
              ].map(({ id, icon: Icon, border, bg, label, sub }) => (
                <button key={id} onClick={() => setAction(id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${action === id ? `${border} ${bg}` : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                  <Icon size={15} className={action === id ? (id === "approve" ? "text-green-600" : id === "return" ? "text-amber-600" : "text-red-600") : "text-gray-400"} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                  {action === id && <Check size={14} className="ml-auto text-gray-600 flex-shrink-0" />}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                Comment {(action === "reject" || action === "return") && <span className="text-red-500">* Required</span>}
              </label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} disabled={!action}
                placeholder={!action ? "Select an action above..." : action === "approve" ? "Optional remarks..." : action === "reject" ? "State the reason for rejection (required)..." : "Describe what needs to be revised (required)..."}
                className={`w-full px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none brand-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${!comment.trim() && (action === "reject" || action === "return") ? "border-red-300" : "border-gray-200"}`}
              />
              {!comment.trim() && (action === "reject" || action === "return") && (
                <p className="text-[10px] text-red-500 mt-1">A comment is required for this action.</p>
              )}
            </div>

            <button onClick={handleSubmit} disabled={!action || (( action === "reject" || action === "return") && !comment.trim())}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${action === "reject" ? "bg-red-600 hover:bg-red-700" : action === "return" ? "bg-amber-500 hover:bg-amber-600" : "brand-btn"}`}>
              {action === "approve" ? <><Check size={15} /> Confirm Approval</> : action === "reject" ? <><X size={15} /> Confirm Rejection</> : action === "return" ? <><RotateCcw size={15} /> Send for Revision</> : "Select an Action First"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: DMS REPOSITORY
// ─────────────────────────────────────────────────────────────────────────────
const DMSPage = () => {
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState({ type: "All Types", office: "All Offices", status: "All Statuses", classification: "All" })

  const filtered = mockDocuments.filter(d => {
    const q = search.toLowerCase()
    if (q && !d.title.toLowerCase().includes(q) && !d.id.toLowerCase().includes(q)) return false
    if (filters.type !== "All Types" && d.type !== filters.type) return false
    if (filters.office !== "All Offices" && d.office !== filters.office) return false
    if (filters.status !== "All Statuses" && d.status !== filters.status) return false
    if (filters.classification !== "All" && d.classification !== filters.classification) return false
    return true
  })

  const activeFilters = Object.entries(filters).filter(([, v]) => !v.startsWith("All")).map(([k, v]) => ({ k, v }))

  return (
    <div className="p-6">
      <PageHdr
        title="Document Repository"
        subtitle="DMS — Search, filter, and manage all registered documents"
        breadcrumb={["Operations", "Document Repository"]}
        actions={<>
          <Btn variant="secondary" size="sm" icon={Upload}>Upload Document</Btn>
          <Btn variant="primary" size="sm" icon={Plus}>New Document</Btn>
        </>}
      />

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, tracking number, or author..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
          </div>
          <Btn variant="secondary" size="sm" icon={Filter}>Filters</Btn>
          <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={() => { setSearch(""); setFilters({ type:"All Types", office:"All Offices", status:"All Statuses", classification:"All" }) }}>Reset</Btn>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            ["type", "All Types", ["All Types","SP Resolution","SP Ordinance","Travel Order","Purchase Request","Leave Application","Internal Memorandum","Citizen Request","Citizen Complaint","Project Proposal","Admin Case"]],
            ["office", "All Offices", ["All Offices","SP Secretariat","Mayor's Office","City Engineering","City Health","City Budget","HRMO","City Administrator","CSWDO","City IT Office"]],
            ["status", "All Statuses", ["All Statuses","In Workflow","Pending Approval","Approved","Released","Rejected","Under Investigation","Archived"]],
            ["classification", "All", ["All","Public","Internal","Confidential","Restricted"]],
          ].map(([key, def, opts]) => (
            <select key={key} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-xs text-gray-400">Active:</span>
            {activeFilters.map(({ k, v }) => (
              <button key={k} onClick={() => setFilters({ ...filters, [k]: k === "classification" ? "All" : `All ${k.charAt(0).toUpperCase() + k.slice(1)}s` })}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-green-700" style={{ backgroundColor: "#E8F5ED" }}>
                {v} <X size={10} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">Showing <span className="font-semibold text-gray-800">{filtered.length}</span> of {mockDocuments.length} documents</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Sort by:</span>
          <select className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none brand-ring">
            {["Date (newest first)","Title A–Z","Status","Type","Office"].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  ["Tracking No.", "whitespace-nowrap"],
                  ["Title", ""],
                  ["Type", "whitespace-nowrap"],
                  ["Office", "whitespace-nowrap"],
                  ["Date", "whitespace-nowrap"],
                  ["Status", "whitespace-nowrap"],
                  ["Classification", "whitespace-nowrap"],
                  ["", ""],
                ].map(([h, cls]) => (
                  <th key={h} className={`text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 ${cls}`}>
                    {h && <div className="flex items-center gap-1">{h} {h !== "" && <ChevronDown size={11} className="text-gray-300" />}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Search size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No documents match your filters</p>
                    <button className="mt-2 text-xs brand-text hover:underline" onClick={() => { setSearch(""); setFilters({ type:"All Types", office:"All Offices", status:"All Statuses", classification:"All" }) }}>Clear all filters</button>
                  </td>
                </tr>
              ) : filtered.map((doc, i) => (
                <tr key={doc.id} className={`hover:bg-gray-50 cursor-pointer transition-colors group ${i !== filtered.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs text-green-600 hover:text-green-800">{doc.id}</span>
                  </td>
                  <td className="px-4 py-3.5" style={{ maxWidth: 260 }}>
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">v{doc.ver} · {doc.size}</p>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="text-xs text-gray-600">{doc.type}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="text-xs text-gray-600">{doc.office}</span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="font-mono text-xs text-gray-400">{doc.date}</span>
                  </td>
                  <td className="px-4 py-3.5"><StatusBadge status={doc.status} /></td>
                  <td className="px-4 py-3.5"><ClassificationBadge level={doc.classification} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {[[Eye,"View"],[Activity,"Track"],[Download,"Download"],[MoreHorizontal,"More"]].map(([Icon, title]) => (
                        <button key={title} title={title} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                          <Icon size={13} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">Page 1 of 1 · {filtered.length} results</p>
          <div className="flex items-center gap-1">
            <button disabled className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-400 disabled:opacity-40">Previous</button>
            <button className="px-3 py-1.5 text-xs rounded-lg text-white" style={{ backgroundColor: "#00A651" }}>1</button>
            <button disabled className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-400 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: CITIZEN PORTAL
// ─────────────────────────────────────────────────────────────────────────────
const CitizenPortalPage = () => {
  const [tab, setTab] = useState("track")
  const [query, setQuery] = useState("")
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const handleTrack = () => {
    if (query.trim()) setResult({ found: true })
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Gov header */}
      <div style={{ backgroundColor: "#0D3D20" }} className="text-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CitySeal size={44} />
            <div>
              <p className="text-xs opacity-60">Republic of the Philippines · Province of Ilocos Norte</p>
              <p className="text-base font-bold leading-tight">City Government of Batac</p>
              <p className="text-xs" style={{ color: "#86efac" }}>Official Public Document Portal · sp.batac.gov.ph</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs opacity-60">
            <span className="flex items-center gap-1"><Phone size={11} />(077) 670-7091</span>
            <span className="flex items-center gap-1"><MapPin size={11} />Washington St., Batac City</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 flex">
          {[
            { id: "track",   label: "Track a Document",              icon: Activity    },
            { id: "library", label: "Ordinances & Resolutions",       icon: BookOpen   },
            { id: "submit",  label: "Submit a Request / Complaint",   icon: MessageSquare },
          ].map(t => {
            const { icon: Icon } = t
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
                style={tab === t.id ? { borderBottomColor: "#00A651" } : {}}>
                <Icon size={15} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── TRACK TAB ── */}
        {tab === "track" && (
          <div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Track Your Document</h2>
              <p className="text-sm text-gray-500 mb-4">Enter the tracking number from your document's cover sheet or official receipt to view its current status and complete routing history.</p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleTrack()}
                    placeholder="e.g., DTS-2026-000045"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none brand-ring" />
                </div>
                <Btn variant="primary" size="md" onClick={handleTrack} icon={Search}>Track Document</Btn>
              </div>
              <p className="text-xs text-gray-400 mt-2">The tracking number is printed on the QR cover sheet of your physical document. Format: DTS-YYYY-NNNNNN</p>
            </div>

            {result && (
              <div className="bg-white rounded-xl border border-green-200 p-6 mb-5" style={{ borderColor: "#00A651" }}>
                <div className="flex items-start gap-4">
                  <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-base font-bold text-gray-900">Resolution No. 7SP 2026-047</p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">DTS-2026-000045</p>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      {[["Current Status", <StatusBadge status="Released" />],["Current Office","Records Archive — SP Secretariat"],["Last Updated","June 2, 2026"]].map(([k,v]) => (
                        <div key={k}>
                          <p className="text-xs text-gray-400">{k}</p>
                          <div className="mt-1 text-sm font-medium text-gray-900">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                      <Btn variant="outline" size="sm" icon={Eye}>View Full Routing History</Btn>
                      <Btn variant="secondary" size="sm" icon={Download}>Download Official Copy</Btn>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!result && (
              <div className="text-center py-12 text-gray-300">
                <Activity size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Enter a tracking number above to check document status</p>
                <p className="text-xs mt-1 opacity-60">No account required — any tracking number can be looked up publicly</p>
              </div>
            )}
          </div>
        )}

        {/* ── LIBRARY TAB ── */}
        {tab === "library" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Published Ordinances & Resolutions</h2>
                <p className="text-sm text-gray-500 mt-0.5">Official legislative actions of the Sangguniang Panlungsod · 7th SP · Batac City</p>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by number or title..." className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none brand-ring w-56" />
              </div>
            </div>
            <div className="space-y-3">
              {publicOrdinances.map((doc, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between hover:border-green-300 hover:shadow-sm transition-all cursor-pointer">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${doc.type === "Ordinance" ? "bg-purple-100" : "bg-blue-100"}`}>
                      {doc.type === "Ordinance" ? <Scale size={17} className="text-purple-600" /> : <FileText size={17} className="text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-xs font-bold ${doc.type === "Ordinance" ? "text-purple-700" : "text-blue-700"}`}>{doc.number}</span>
                        <ClassificationBadge level="Public" />
                        <span className="text-xs text-gray-400">{doc.pages} pages</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{doc.title}</p>
                      <p className="text-xs text-gray-400 mt-1">Published: {doc.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <Btn variant="secondary" size="xs" icon={Eye}>View</Btn>
                    <Btn variant="ghost" size="xs" icon={Download}>PDF</Btn>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 text-center">
              <Btn variant="secondary" size="sm" icon={Archive}>View Full Archive (2014 – Present)</Btn>
            </div>
          </div>
        )}

        {/* ── SUBMIT TAB ── */}
        {tab === "submit" && (
          submitted ? (
            <div className="bg-white rounded-xl border border-green-200 p-10 text-center max-w-lg mx-auto">
              <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-900 mb-2">Submission Received!</h2>
              <p className="text-sm text-gray-500 mb-4">Your request has been logged and assigned a tracking number. You will receive status updates via your registered contact details.</p>
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-400 mb-1">Your Tracking Number</p>
                <p className="font-mono text-lg font-bold text-gray-900">DTS-2026-000099</p>
                <p className="text-xs text-gray-400 mt-1">Save this number to track your submission status.</p>
              </div>
              <Btn variant="primary" onClick={() => { setSubmitted(false); setTab("track"); setQuery("DTS-2026-000099") }}>
                Track My Submission
              </Btn>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Submit a Request or Complaint</h2>
              <p className="text-sm text-gray-500 mb-5">Your submission will be logged and tracked. You will receive a tracking number immediately. Fields marked <span className="text-red-500">*</span> are required.</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Type <span className="text-red-500">*</span></label>
                    <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                      {["Service Request","Complaint (Transportation)","Complaint (General)","Information Request","Document Copy Request"].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Concerned Office <span className="text-red-500">*</span></label>
                    <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                      {["Mayor's Office","SP Secretariat","City Engineering","City Health","CSWDO","City Treasurer","City Civil Registrar"].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Juan dela Cruz" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Contact Number <span className="text-red-500">*</span></label>
                    <input type="tel" placeholder="+63 9XX XXX XXXX" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Barangay</label>
                  <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                    <option>Select your barangay...</option>
                    {["Brgy. 1-S Valdez","Brgy. 2","Brgy. 3","Brgy. 4","Brgy. 5","Brgy. 6","Brgy. 7 Payac"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Subject <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Brief description of your request or complaint" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Details <span className="text-red-500">*</span></label>
                  <textarea rows={4} placeholder="Please describe your request or complaint in full detail. Include relevant dates, locations, names, and any reference numbers from previous transactions." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none brand-ring" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Supporting Documents (optional)</label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-green-300 transition-colors cursor-pointer">
                    <Upload size={20} className="mx-auto text-gray-300 mb-1.5" />
                    <p className="text-sm text-gray-400">Click to upload or drag files here</p>
                    <p className="text-xs text-gray-300 mt-0.5">PDF, JPG, PNG — maximum 10 MB per file</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <input type="checkbox" id="privacy" className="mt-0.5 accent-green-600" />
                  <label htmlFor="privacy" className="text-xs text-gray-600 leading-relaxed">
                    I have read and understood the <span className="text-green-700 underline cursor-pointer">Privacy Notice</span> of the City Government of Batac, and I consent to the collection and processing of my personal information for the purpose of this submission, in accordance with the Data Privacy Act of 2012 (RA 10173).
                  </label>
                </div>
                <div className="pt-2">
                  <Btn variant="primary" size="md" onClick={() => setSubmitted(true)} icon={Send}>
                    Submit Request
                  </Btn>
                  <p className="text-xs text-gray-400 mt-2">You will receive a tracking number immediately upon submission.</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
const pages = {
  kitchen:  { component: KitchenSinkPage,   title: "Design System",          subtitle: "Component Library & Design Tokens · v0.1" },
  mayor:    { component: MayorPage,          title: "Mayor's Dashboard",       subtitle: "Executive Operations Overview" },
  sp:       { component: SPSecretaryPage,    title: "SP Secretary's Dashboard",subtitle: "Sangguniang Panlungsod · Legislative Workflow" },
  dts:      { component: DTSPage,            title: "Document Tracking",       subtitle: "Complete Routing History · DTS-2026-000045" },
  wms:      { component: WMSPage,            title: "Approval Interface",       subtitle: "WMS — Document Review & Action" },
  dms:      { component: DMSPage,            title: "Document Repository",      subtitle: "DMS — Internal Document Search & Management" },
  portal:   { component: CitizenPortalPage,  title: "Citizen Portal",          subtitle: "Public Access — sp.batac.gov.ph" },
}

export default function App() {
  const [page, setPage] = useState("mayor")
  const [collapsed, setCollapsed] = useState(false)
  const isPortal = page === "portal"
  const cfg = pages[page]
  const Pg = cfg?.component

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isPortal && <TopBar title={cfg?.title} subtitle={cfg?.subtitle} />}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F6F8F6" }}>
          {Pg && <Pg />}
        </main>
      </div>
    </div>
  )
}
