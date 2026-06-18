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

import { useQueryClient } from '@tanstack/react-query';
import {
  usePendingSignatures,
  useSLAData,
  useDeptWorkload,
  useLegislativeQueue,
  useSessionCalendar,
  useLegislativeOutput,
  useRoutingHistory,
  useDocuments,
  usePublicOrdinances,
  useAddDocument,
  useRemovePendingSignature,
  useAddSession,
  useAddLegislativeQueue,
  useUpdateLegislativeQueue,
  useUpdatePendingSignature
} from './api/queries';

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
    body { font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif; }
    .font-mono { font-family: 'IBM Plex Mono', 'Courier New', monospace !important; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .line-clamp-1 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
    .line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .sidebar-bg { background-color: #0D3D20; }
    .sidebar-mid { background-color: #1A6B35; }
    .nav-active { background-color: #00A651 !important; }
    .nav-hover:hover { background-color: #1A6B35; }
    .brand-btn { background-color: #00A651; }
    .brand-btn:hover { background-color: #0D3D20; }
    .brand-text { color: #00A651; }
    .brand-border { border-color: #00A651; }
    .brand-ring:focus { outline: 2px solid #00A651; outline-offset: 2px; }
    .brand-bg-light { background-color: #E8F5ED; }
    .brand-bg-50 { background-color: #F0FAF4; }
    .seal-ring { stroke: #F59E0B; }
  `}</style>
)

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
  "Public": { bg: "bg-green-100", text: "text-green-700", Icon: Globe },
  "Internal": { bg: "bg-blue-100", text: "text-blue-700", Icon: Building },
  "Confidential": { bg: "bg-amber-100", text: "text-amber-700", Icon: Shield },
  "Restricted": { bg: "bg-red-100", text: "text-red-700", Icon: Lock },
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

const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = "green" }) => {
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
// SHARED MODAL SHELL
// ─────────────────────────────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, subtitle, width = "max-w-2xl", children }) => {
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

// Field label helper
const FLabel = ({ children, required }) => (
  <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
)

// Divider
const FRow = ({ children, cols = 2 }) => (
  <div className={`grid gap-4 mb-4 ${cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-1"}`}>{children}</div>
)

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: LOG INCOMING DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
const LogDocumentModal = ({ open, onClose }) => {
  const [step, setStep] = useState(1) // 1 = form, 2 = success
  const [trackingId, setTrackingId] = useState("");
  const addLegislativeQueue = useAddLegislativeQueue();
  const [form, setForm] = useState({
    docType: "", sender: "", senderOffice: "",
    dateReceived: "2026-06-14", title: "", author: "",
    committee: "", classification: "Internal",
    hasPhysicalCopy: true, remarks: "",
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isLegislative = ["SP Resolution", "SP Ordinance", "Barangay Resolution"].includes(form.docType)

  const handleClose = () => { setStep(1); setTrackingId(""); setForm({ docType: "", sender: "", senderOffice: "", dateReceived: "2026-06-14", title: "", author: "", committee: "", classification: "Internal", hasPhysicalCopy: true, remarks: "" }); onClose() }

  const handleLogDocument = () => {
    const newId = "DTS-2026-" + Math.floor(1000 + Math.random() * 9000);
    setTrackingId(newId);

    if (isLegislative) {
      addLegislativeQueue.mutate({
        id: newId,
        title: form.title,
        type: form.docType.replace("SP ", ""),
        status: "For 1st Reading",
        committee: form.committee || "TBD",
        author: form.author || form.sender || "Unknown",
        session: "TBD"
      });
    }
    setStep(2);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Log Incoming Document" subtitle="SP Secretariat — Document Intake · Creates tracking number and cover sheet" width="max-w-2xl">
      {step === 1 ? (
        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-5">
            {["Document Type & Source", "Details & Classification", "Review & Log"].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${i === 0 ? "text-green-700" : "text-gray-300"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "text-white" : "bg-gray-100 text-gray-400"}`}
                    style={i === 0 ? { backgroundColor: "#00A651" } : {}}>
                    {i + 1}
                  </div>
                  <span className="hidden sm:inline">{s}</span>
                </div>
                {i < 2 && <div className="w-8 h-px bg-gray-200" />}
              </div>
            ))}
          </div>

          {/* Section: document type */}
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Document Type &amp; Source</p>

          <FRow cols={2}>
            <div>
              <FLabel required>Document Type</FLabel>
              <select value={form.docType} onChange={e => set("docType", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                <option value="">Select type…</option>
                {["SP Resolution", "SP Ordinance", "Barangay Resolution", "Letter Received", "Memo Incoming", "Citizen Complaint", "Citizen Request", "Notice of Committee Hearing", "Designation", "Document Request Form"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FLabel required>Date Received</FLabel>
              <input type="date" value={form.dateReceived} onChange={e => set("dateReceived", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
            </div>
          </FRow>

          <FRow cols={2}>
            <div>
              <FLabel required>Sender / Originator</FLabel>
              <input type="text" value={form.sender} onChange={e => set("sender", e.target.value)}
                placeholder="e.g. Coun. Jose R. Dela Cruz" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
            </div>
            <div>
              <FLabel required>Originating Office</FLabel>
              <select value={form.senderOffice} onChange={e => set("senderOffice", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                <option value="">Select office…</option>
                {["SP Secretariat", "Mayor's Office", "City Engineering", "City Health", "City Budget", "HRMO", "City Administrator", "CSWDO", "City IT Office", "City Treasurer", "Barangay Office (External)", "External / Private Party"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </FRow>

          <div className="border-t border-gray-100 my-4" />
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Document Details</p>

          <div className="mb-4">
            <FLabel required>Subject / Title</FLabel>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Enter the full subject or title of the document…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
          </div>

          {isLegislative && (
            <FRow cols={2}>
              <div>
                <FLabel>Author / Sponsor</FLabel>
                <input type="text" value={form.author} onChange={e => set("author", e.target.value)}
                  placeholder="e.g. Coun. Borleo, Coun. Flojo" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
              </div>
              <div>
                <FLabel>Committee Referral</FLabel>
                <select value={form.committee} onChange={e => set("committee", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                  <option value="">Assign later (at 1st Reading)</option>
                  {["Laws, Rules, Ethics & Privileges", "Appropriations & Finance", "Health and Sanitation", "Transportation and Communication", "Environment, NR, Climate Change", "Public Works & Infrastructure", "Education, Culture, Science & Tech", "Social Welfare Development", "Barangay Affairs", "Youth & Sports Development"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </FRow>
          )}

          <FRow cols={2}>
            <div>
              <FLabel required>Classification</FLabel>
              <select value={form.classification} onChange={e => set("classification", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                {["Public", "Internal", "Confidential", "Restricted"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FLabel>Physical Copy</FLabel>
              <div className="flex items-center gap-3 mt-2">
                {["Present", "Not yet received"].map(opt => (
                  <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="physCopy" checked={form.hasPhysicalCopy === (opt === "Present")} onChange={() => set("hasPhysicalCopy", opt === "Present")} className="accent-green-600" />
                    <span className="text-sm text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </FRow>

          <div className="mb-4">
            <FLabel>Remarks / Routing Notes</FLabel>
            <textarea value={form.remarks} onChange={e => set("remarks", e.target.value)} rows={2}
              placeholder="Optional: routing instructions, special handling, Vice Mayor's notes…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring resize-none" />
          </div>

          {/* Optional file upload */}
          <div className="mb-4">
            <FLabel>Attach File (optional — can upload later)</FLabel>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-green-300 transition-colors cursor-pointer">
              <Upload size={18} className="mx-auto text-gray-300 mb-1" />
              <p className="text-xs text-gray-400">Drop PDF or scan here, or click to browse</p>
              <p className="text-[10px] text-gray-300 mt-0.5">PDF, JPG, PNG — max 25 MB</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-400 mr-2">A tracking number will be assigned on log.</div>
              <Btn variant="primary" onClick={handleLogDocument} disabled={!form.docType || !form.title || !form.sender || addLegislativeQueue.isPending} icon={Check}>
                {addLegislativeQueue.isPending ? "Logging..." : "Log Document"}
              </Btn>
            </div>
          </div>
        </div>
      ) : (
        /* ── Success ── */
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#E8F5ED" }}>
            <CheckCircle size={32} className="brand-text" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Document Logged Successfully</h3>
          <p className="text-sm text-gray-500 mb-6">The document has been registered in the DTS. A QR cover sheet is ready to print and attach to the physical document.</p>

          <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tracking Number</span>
              <ClassificationBadge level={form.classification} />
            </div>
            <p className="font-mono text-xl font-bold text-gray-900 mb-3">{trackingId}</p>
            <dl className="space-y-1.5 text-xs">
              {[["Document Type", form.docType || "SP Resolution"], ["Date Received", form.dateReceived], ["Sender", form.sender || "—"], ["Status", "Draft — Awaiting 1st Action"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-400">{k}</dt>
                  <dd className="font-medium text-gray-700 text-right">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Btn variant="secondary" icon={Printer}>Print QR Cover Sheet</Btn>
            <Btn variant="primary" onClick={handleClose} icon={Check}>Done</Btn>
          </div>
          <p className="text-xs text-gray-400 mt-3">The document will appear in the Active Legislative Queue and the Document Repository.</p>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: PRINT COVER SHEET (preview + print)
// ─────────────────────────────────────────────────────────────────────────────
const PrintCoverSheetModal = ({ open, onClose }) => {
  const doc = {
    trackingNo: "DTS-2026-000045",
    seriesNo: "Resolution No. 7SP 2026-047",
    type: "SP Resolution",
    title: "Resolution Authorizing the City Mayor to Negotiate and Enter into a Memorandum of Agreement with the Department of Interior and Local Government (DILG) for the Community-Based Solid Waste Management Project of Batac City",
    author: "Coun. Jose R. Dela Cruz",
    office: "SP Secretariat",
    dateReceived: "May 15, 2026",
    dateReleased: "June 2, 2026",
    classification: "Public",
    retention: "Permanent",
    custodian: "Records Officer — SP Secretariat",
    status: "Released",
  }

  return (
    <Modal open={open} onClose={onClose} title="Print Cover Sheet" subtitle="DTS-2026-000045 · Resolution No. 7SP 2026-047" width="max-w-2xl">
      <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Preview — A4 portrait</span>
          <span className="text-xs text-gray-300">·</span>
          <ClassificationBadge level={doc.classification} />
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" icon={Download}>Download PDF</Btn>
          <Btn variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>Print Cover Sheet</Btn>
        </div>
      </div>

      {/* Cover sheet preview */}
      <div className="p-6 bg-gray-100 min-h-0">
        <div className="bg-white rounded-lg shadow-md mx-auto border border-gray-200" style={{ maxWidth: 560, padding: "40px 48px" }}>
          {/* Header row */}
          <div className="flex items-start justify-between mb-5 pb-5 border-b-2 border-gray-200">
            <div className="flex items-center gap-4">
              <CitySealOfficial size={64} />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-medium">Republic of the Philippines</p>
                <p className="text-[9px] uppercase tracking-widest text-gray-400">Province of Ilocos Norte</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">City Government of Batac</p>
                <p className="text-xs text-gray-500">{doc.office}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">Official Document</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Cover Sheet</p>
            </div>
          </div>

          {/* Tracking number + QR */}
          <div className="flex items-start gap-6 mb-5">
            <div className="flex-1">
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Tracking Number</p>
              <p className="font-mono text-2xl font-bold text-gray-900 mb-2">{doc.trackingNo}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Series / Reference Number</p>
              <p className="text-sm font-semibold text-gray-800">{doc.seriesNo}</p>
            </div>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="bg-black p-2 rounded-lg">
                <QRDisplay size={88} />
              </div>
              <p className="text-[9px] text-gray-400 mt-1 text-center font-mono">DTS-2026-000045</p>
              <p className="text-[8px] text-gray-300 text-center">Scan to verify status</p>
            </div>
          </div>

          {/* Title */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
            <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold mb-1">Subject / Title</p>
            <p className="text-xs font-medium text-gray-800 leading-relaxed">{doc.title}</p>
          </div>

          {/* Metadata table */}
          <table className="w-full text-xs mb-4">
            <tbody>
              {[
                ["Document Type", doc.type, "Classification", <ClassificationBadge level={doc.classification} />],
                ["Author / Sponsor", doc.author, "Status", <StatusBadge status={doc.status} />],
                ["Originating Office", doc.office, "Date Received", doc.dateReceived],
                ["Date Released", doc.dateReleased, "Custodian", doc.custodian],
              ].map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="px-2.5 py-1.5 text-gray-400 font-medium whitespace-nowrap w-1/4">{row[0]}</td>
                  <td className="px-2.5 py-1.5 text-gray-800 w-1/4">{row[1]}</td>
                  <td className="px-2.5 py-1.5 text-gray-400 font-medium whitespace-nowrap w-1/4">{row[2]}</td>
                  <td className="px-2.5 py-1.5 text-gray-800 w-1/4">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Retention + footer */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">Retention Schedule</p>
              <p className="text-xs font-bold text-gray-900">{doc.retention} Record</p>
            </div>
            <div className="text-right">
              <p className="text-[8px] text-gray-300 uppercase tracking-widest">Generated by Batac City LGU Platform</p>
              <p className="text-[8px] text-gray-300 font-mono">June 14, 2026 · 08:45 AM</p>
            </div>
          </div>
          {doc.classification !== "Public" && (
            <div className="mt-3 text-center">
              <p className="text-[10px] font-bold text-red-600 border border-red-300 rounded px-2 py-0.5 inline-block tracking-widest uppercase">Official Use Only</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: UPLOAD DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
const UploadDocumentModal = ({ open, onClose }) => {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ type: "", title: "", office: "", date: "2026-06-14", classification: "Internal", versionNote: "", remarks: "" })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const TRACKING = "DTS-2026-000100"

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) { setFile(f); set("title", f.name.replace(/\.[^.]+$/, "")) }
  }

  const handleSimUpload = () => {
    setUploading(true)
    setTimeout(() => { setUploading(false); setDone(true) }, 1800)
  }

  const handleClose = () => { setFile(null); setDone(false); setUploading(false); setForm({ type: "", title: "", office: "", date: "2026-06-14", classification: "Internal", versionNote: "", remarks: "" }); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Upload Document" subtitle="Register an existing document or scan into the DMS" width="max-w-xl">
      {done ? (
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#E8F5ED" }}>
            <CheckCircle size={32} className="brand-text" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Upload Complete</h3>
          <p className="text-sm text-gray-500 mb-5">The document has been registered and is now searchable in the Document Repository.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-5 max-w-xs mx-auto text-left">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Tracking Number</p>
            <p className="font-mono text-lg font-bold text-gray-900 mb-2">{TRACKING}</p>
            <p className="text-xs text-gray-500 truncate">{form.title || "Uploaded document"}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Btn variant="secondary" icon={Eye}>View in Repository</Btn>
            <Btn variant="primary" onClick={handleClose}>Done</Btn>
          </div>
        </div>
      ) : (
        <div className="p-6">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center mb-5 transition-colors ${dragging ? "border-green-400 bg-green-50" : file ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-green-300"}`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText size={28} className="brand-text" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB · Ready to upload</p>
                </div>
                <button onClick={() => setFile(null)} className="ml-2 p-1 rounded-lg hover:bg-gray-200 text-gray-400"><X size={14} /></button>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-600">Drop file here or <span className="brand-text underline cursor-pointer">browse</span></p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, DOCX, XLSX, JPG, PNG — maximum 25 MB</p>
              </>
            )}
          </div>

          <FRow cols={2}>
            <div>
              <FLabel required>Document Type</FLabel>
              <select value={form.type} onChange={e => set("type", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                <option value="">Select…</option>
                {["SP Resolution", "SP Ordinance", "Travel Order", "Purchase Request", "Leave Application", "Internal Memorandum", "Project Proposal", "Citizen Request", "Citizen Complaint", "Inspection Report", "Admin Case"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FLabel required>Date of Document</FLabel>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
            </div>
          </FRow>

          <div className="mb-4">
            <FLabel required>Document Title</FLabel>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Full title or subject of the document…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
          </div>

          <FRow cols={2}>
            <div>
              <FLabel required>Originating Office</FLabel>
              <select value={form.office} onChange={e => set("office", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                <option value="">Select…</option>
                {["SP Secretariat", "Mayor's Office", "City Engineering", "City Health", "City Budget", "HRMO", "City Administrator", "CSWDO", "City IT Office", "City Treasurer"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FLabel required>Classification</FLabel>
              <select value={form.classification} onChange={e => set("classification", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                {["Public", "Internal", "Confidential", "Restricted"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </FRow>

          <div className="mb-4">
            <FLabel>Version Note <span className="text-gray-400 font-normal normal-case">(optional — if replacing an existing version)</span></FLabel>
            <input type="text" value={form.versionNote} onChange={e => set("versionNote", e.target.value)} placeholder="e.g. Revised per committee amendments of May 29, 2026" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
          </div>

          <div className="mb-6">
            <FLabel>Remarks</FLabel>
            <textarea value={form.remarks} onChange={e => set("remarks", e.target.value)} rows={2} placeholder="Optional notes…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring resize-none" />
          </div>

          {uploading && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Uploading and registering document…</span><span>67%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: "67%", backgroundColor: "#00A651" }} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSimUpload} disabled={!form.type || !form.title || !form.office || uploading} icon={Upload}>
              {uploading ? "Uploading…" : "Upload & Register"}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: NEW DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
const NewDocumentModal = ({ open, onClose }) => {
  const [step, setStep] = useState(1) // 1 = type select, 2 = details, 3 = success
  const [selectedType, setSelectedType] = useState(null)
  const [form, setForm] = useState({ title: "", office: "", requestedBy: "", classification: "Internal", priority: "normal", description: "", committee: "", relatedDoc: "" })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const TRACKING = "DTS-2026-000101"

  const handleClose = () => { setStep(1); setSelectedType(null); setForm({ title: "", office: "", requestedBy: "", classification: "Internal", priority: "normal", description: "", committee: "", relatedDoc: "" }); onClose() }

  const docTypeGroups = [
    {
      label: "Legislative", color: "purple",
      types: [
        { id: "SP Resolution", icon: Scale, desc: "Official act of the Sangguniang Panlungsod — policy, authorization, recognition" },
        { id: "SP Ordinance", icon: BookOpen, desc: "Local legislation with the force of law — appropriation, regulation, licensing" },
      ]
    },
    {
      label: "Executive / Administrative", color: "blue",
      types: [
        { id: "Travel Order", icon: MapPin, desc: "Authorization for official travel — employee, department, funded" },
        { id: "Purchase Request", icon: ClipboardList, desc: "Formal request for procurement of supplies, materials, or equipment" },
        { id: "Leave Application", icon: Calendar, desc: "Annual leave, sick leave, special leave for LGU employees" },
        { id: "Internal Memorandum", icon: MessageSquare, desc: "Official communication between offices or from the Mayor / City Administrator" },
        { id: "Project Proposal", icon: FileText, desc: "Proposal for infrastructure, programs, or city projects" },
      ]
    },
    {
      label: "Citizen-Facing", color: "green",
      types: [
        { id: "Citizen Request", icon: User, desc: "Service request submitted by a Batacqueño citizen" },
        { id: "Citizen Complaint", icon: AlertCircle, desc: "Complaint submitted by a citizen — transportation, services, officials" },
      ]
    },
  ]

  const typeColors = { purple: ["bg-purple-50", "border-purple-200", "text-purple-700", "bg-purple-100"], blue: ["bg-blue-50", "border-blue-200", "text-blue-700", "bg-blue-100"], green: ["bg-green-50", "border-green-200", "text-green-700", "bg-green-100"] }

  return (
    <Modal open={open} onClose={handleClose} title="New Document" subtitle="Create and register a new document in the DMS" width="max-w-2xl">
      {step === 1 && (
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-5">Select the document type to begin. The form will adapt to the selected type's required fields and workflow.</p>
          {docTypeGroups.map(group => {
            const [gbg, gborder, gtext, gicon] = typeColors[group.color]
            return (
              <div key={group.label} className="mb-5">
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${gtext}`}>{group.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.types.map(({ id, icon: Icon, desc }) => (
                    <button key={id} onClick={() => { setSelectedType(id); setStep(2) }}
                      className={`text-left p-3.5 rounded-xl border-2 transition-all hover:shadow-sm ${selectedType === id ? `${gborder} ${gbg}` : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${gicon}`}>
                          <Icon size={16} className={gtext} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{id}</span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {step === 2 && (
        <div className="p-6">
          {/* Back + Type badge */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-xs brand-text hover:underline"><ChevronLeft size={14} />Back</button>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{selectedType}</span>
          </div>

          <div className="mb-4">
            <FLabel required>Document Title / Subject</FLabel>
            <input type="text" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Enter the full title or subject…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
          </div>

          <FRow cols={2}>
            <div>
              <FLabel required>Originating Office</FLabel>
              <select value={form.office} onChange={e => set("office", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                <option value="">Select…</option>
                {["SP Secretariat", "Mayor's Office", "City Engineering", "City Health", "City Budget", "HRMO", "City Administrator", "CSWDO", "City IT Office", "City Treasurer"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FLabel required>Prepared / Requested By</FLabel>
              <input type="text" value={form.requestedBy} onChange={e => set("requestedBy", e.target.value)} placeholder="Name and position…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
            </div>
          </FRow>

          <FRow cols={2}>
            <div>
              <FLabel required>Classification</FLabel>
              <select value={form.classification} onChange={e => set("classification", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                {["Public", "Internal", "Confidential", "Restricted"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FLabel>Priority</FLabel>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </FRow>

          {["SP Resolution", "SP Ordinance"].includes(selectedType) && (
            <div className="mb-4">
              <FLabel>Committee Referral</FLabel>
              <select value={form.committee} onChange={e => set("committee", e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                <option value="">Assign at 1st Reading…</option>
                {["Laws, Rules, Ethics & Privileges", "Appropriations & Finance", "Health and Sanitation", "Transportation and Communication", "Environment, NR, Climate Change", "Public Works & Infrastructure", "Education, Culture, Science & Tech"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          )}

          <div className="mb-4">
            <FLabel>Description / Purpose</FLabel>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Brief description, background, or purpose of this document…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring resize-none" />
          </div>

          <div className="mb-4">
            <FLabel>Related Document <span className="text-gray-400 font-normal normal-case">(optional tracking number)</span></FLabel>
            <input type="text" value={form.relatedDoc} onChange={e => set("relatedDoc", e.target.value)} placeholder="e.g. DTS-2026-000040" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring font-mono" />
          </div>

          <div className="mb-6">
            <FLabel>Attach Initial Draft <span className="text-gray-400 font-normal normal-case">(optional)</span></FLabel>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-green-300 cursor-pointer transition-colors">
              <Upload size={16} className="mx-auto text-gray-300 mb-1" />
              <p className="text-xs text-gray-400">Drop file here or click to browse</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn variant="primary" onClick={() => setStep(3)} disabled={!form.title || !form.office || !form.requestedBy} icon={Plus}>
              Create Document
            </Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#E8F5ED" }}>
            <FileCheck size={32} className="brand-text" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Document Created</h3>
          <p className="text-sm text-gray-500 mb-6">The document has been registered with a tracking number and added to the Document Repository as a Draft. The applicable workflow has been initiated.</p>
          <div className="bg-gray-50 rounded-xl p-5 mb-6 max-w-sm mx-auto text-left">
            <div className="flex justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tracking Number</span>
              <ClassificationBadge level={form.classification} />
            </div>
            <p className="font-mono text-xl font-bold text-gray-900 mb-3">{TRACKING}</p>
            <dl className="space-y-1.5 text-xs">
              {[["Type", selectedType], ["Title", form.title || "—"], ["Office", form.office || "—"], ["Status", "Draft"]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-400 flex-shrink-0">{k}</dt>
                  <dd className="font-medium text-gray-700 text-right truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Btn variant="secondary" icon={Printer}>Print QR Cover Sheet</Btn>
            <Btn variant="primary" onClick={handleClose} icon={Check}>Done</Btn>
          </div>
          <p className="text-xs text-gray-400 mt-3">The document will appear in the Document Repository with Draft status and is ready for the first workflow step.</p>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: REVIEW DOCUMENT (Mayor — full document review before signing)
// ─────────────────────────────────────────────────────────────────────────────
const ReviewDocumentModal = ({ open, onClose, doc, onSign }) => {
  const { mutateAsync: removeSignature, isPending: isRemoving } = useRemovePendingSignature()
  const [action, setAction] = useState(null)      // null | "returning"
  const [returnComment, setReturnComment] = useState("")
  const [returnDone, setReturnDone] = useState(false)

  const handleClose = () => { setAction(null); setReturnComment(""); setReturnDone(false); onClose() }
  if (!doc) return null

  const isOverdue = doc.priority === "overdue"
  const routingSteps = [
    { label: "Drafted & Submitted", done: true },
    { label: "Logged — DTS Intake", done: true },
    { label: "Department Head Approval", done: true },
    { label: "Forwarded to Mayor", done: true },
    { label: "Mayor Review", done: false, current: true },
    { label: "Archived / Released", done: false },
  ]

  return (
    <Modal open={open} onClose={handleClose} title="Review Document" subtitle={`${doc.id} · Awaiting Your Signature`} width="max-w-5xl">
      {!returnDone ? (
        <>
          {/* ARTA / SLA Banner */}
          <div className={`mx-6 mt-5 flex items-start gap-3 px-4 py-3 rounded-xl border ${isOverdue ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            {isOverdue
              ? <AlertCircle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
              : <AlertTriangle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${isOverdue ? "text-red-800" : "text-amber-800"}`}>
                {isOverdue ? `SLA Breach — ${doc.daysInQueue} days overdue · Automatically escalated` : `ARTA Deadline Approaching — Due ${doc.dueDate}`}
              </p>
              <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-700" : "text-amber-700"}`}>
                {doc.type} · Submitted by {doc.submittedBy}, {doc.office}
              </p>
            </div>
            {isOverdue && <span className="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">ESCALATED</span>}
          </div>

          {/* Two-column body */}
          <div className="grid gap-5 p-6" style={{ gridTemplateColumns: "280px 1fr" }}>
            {/* Left: metadata + workflow + actions */}
            <div className="space-y-5 min-w-0">
              {/* Document identity */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Document</p>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-mono text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{doc.id}</span>
                  <PriorityTag priority={doc.priority} />
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-snug mb-3">{doc.title}</p>
                <dl className="space-y-2">
                  {[
                    ["Type", doc.type],
                    ["Submitted by", doc.submittedBy],
                    ["Office", doc.office],
                    ["In queue", `${doc.daysInQueue} day${doc.daysInQueue !== 1 ? "s" : ""}`],
                    ["Due date", doc.dueDate],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2 min-w-0">
                      <dt className="text-[11px] text-gray-400 w-20 flex-shrink-0 pt-0.5">{k}</dt>
                      <dd className={`text-xs font-medium truncate ${k === "Due date" && isOverdue ? "text-red-600" : "text-gray-800"}`}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="border-t border-gray-100" />

              {/* Workflow progress */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Workflow Progress</p>
                <div className="space-y-2.5">
                  {routingSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${step.current ? "border-green-500 bg-white" :
                        step.done ? "border-green-400 bg-green-400" :
                          "border-gray-200 bg-white"
                        }`}>
                        {step.done && !step.current && <Check size={9} className="text-white" />}
                        {step.current && <div className="w-2 h-2 rounded-full bg-green-500" />}
                      </div>
                      <span className={`text-xs leading-tight ${step.current ? "font-semibold text-green-700" :
                        step.done ? "text-gray-500" : "text-gray-300"
                        }`}>{step.label}</span>
                      {step.current && (
                        <span className="ml-auto text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#00A651" }}>NOW</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Action zone */}
              {action === "returning" ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-2">Return for Revision</p>
                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">State your reason and revision instructions. This will be recorded in the audit log and sent to the originating office.</p>
                  <textarea
                    value={returnComment}
                    onChange={e => setReturnComment(e.target.value)}
                    rows={4}
                    placeholder="e.g. Please revise Section 3 to reflect the updated budget allocation approved in the last AIP revision..."
                    className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none resize-none"
                    style={{ backgroundColor: "#FFFBEB" }}
                    autoFocus
                  />
                  {returnComment.length > 0 && returnComment.trim().length < 10 && (
                    <p className="text-[10px] text-amber-600 mt-1">Please provide a more specific reason.</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Btn variant="ghost" size="sm" onClick={() => setAction(null)}>Cancel</Btn>
                    <Btn variant="warning" size="sm" icon={RotateCcw} disabled={returnComment.trim().length < 10 || isRemoving} onClick={async () => { await removeSignature(doc.id); setReturnDone(true) }}>
                      Confirm Return
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Btn variant="primary" size="md" icon={Check} className="w-full justify-center"
                    onClick={async () => { await removeSignature(doc.id); handleClose(); onSign(doc) }}>
                    Approve &amp; Sign
                  </Btn>
                  <Btn variant="secondary" size="md" icon={RotateCcw} className="w-full justify-center"
                    onClick={() => setAction("returning")}>
                    Return for Revision
                  </Btn>
                </div>
              )}
            </div>

            {/* Right: PDF preview */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Document Preview</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 mr-1">Page 1 of 4</span>
                  <button className="p-1 rounded text-gray-400 hover:bg-gray-100"><Download size={12} /></button>
                  <button className="p-1 rounded text-gray-400 hover:bg-gray-100"><Printer size={12} /></button>
                  <button className="p-1 rounded text-gray-400 hover:bg-gray-100"><ExternalLink size={12} /></button>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ background: "#F3F4F6" }}>
                {/* PDF toolbar */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200">
                  <FileText size={13} className="text-gray-400" />
                  <span className="font-mono text-[11px] text-gray-500">{doc.id}.pdf</span>
                  <span className="text-gray-200 mx-1">·</span>
                  <span className="text-[11px] text-gray-400">{doc.type}</span>
                  <span className="text-gray-200 mx-1">·</span>
                  <ClassificationBadge level="Internal" />
                </div>
                {/* Page 1 — visible */}
                <div className="p-4">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 mx-auto" style={{ maxWidth: 420, padding: "28px 32px" }}>
                    <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-200">
                      <CitySeal size={42} />
                      <div>
                        <p className="text-[8px] uppercase tracking-widest text-gray-400 leading-tight">Republic of the Philippines</p>
                        <p className="text-[8px] uppercase tracking-widest text-gray-400 leading-tight">Province of Ilocos Norte</p>
                        <p className="text-xs font-bold text-gray-900 mt-0.5">City Government of Batac</p>
                        <p className="text-[10px] text-gray-500">{doc.office}</p>
                      </div>
                    </div>
                    <div className="text-center mb-4">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{doc.type}</p>
                      <p className="text-[11px] font-bold text-gray-900 leading-snug">{doc.title}</p>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {[100, 92, 100, 85, 100, 70].map((w, i) => (
                        <div key={i} className="h-1.5 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                    <p className="text-[8px] font-bold text-gray-600 mb-1">WHEREAS,</p>
                    <div className="space-y-1.5 mb-3">
                      {[96, 100, 88, 100, 82, 100, 75].map((w, i) => (
                        <div key={i} className="h-1.5 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                    <p className="text-[8px] font-bold text-gray-600 mb-1">NOW, THEREFORE, BE IT RESOLVED,</p>
                    <div className="space-y-1.5">
                      {[100, 94, 80, 100, 88].map((w, i) => (
                        <div key={i} className="h-1.5 rounded-full bg-gray-200" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                  {/* Pages 2–4 — blurred */}
                  <div className="space-y-2.5 mt-3">
                    {[2, 3, 4].map(n => (
                      <div key={n} className="bg-white rounded-lg border border-gray-100 mx-auto relative overflow-hidden" style={{ maxWidth: 420, height: 100 }}>
                        <div className="absolute inset-0 flex flex-col justify-evenly p-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-1.5 rounded-full bg-gray-100" style={{ width: `${[100, 88, 75, 92][i]}%` }} />
                          ))}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center" style={{ backdropFilter: "blur(3px)", background: "rgba(249,250,251,0.75)" }}>
                          <span className="text-[11px] text-gray-400 font-medium">Page {n}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Returned for revision — success */
        <div className="p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <RotateCcw size={26} className="text-amber-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Document Returned for Revision</h3>
          <p className="text-sm text-gray-500 mb-5">Returned to {doc.office}. The originating staff member has been notified and the reason logged in the audit trail.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-sm mx-auto text-left mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1.5">Your Revision Instructions</p>
            <p className="text-xs text-amber-900 leading-relaxed italic">"{returnComment}"</p>
          </div>
          <Btn variant="primary" onClick={handleClose} icon={Check}>Done</Btn>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: SIGN DOCUMENT (Mayor — official executive signature confirmation)
// ─────────────────────────────────────────────────────────────────────────────
const SignDocumentModal = ({ open, onClose, doc }) => {
  const { mutateAsync: removeSignature, isPending } = useRemovePendingSignature()
  const [step, setStep] = useState(1) // 1=confirm, 2=success
  const [confirmed, setConfirmed] = useState(false)
  const signedAt = "June 14, 2026 · 10:47 AM"

  const handleClose = () => { setStep(1); setConfirmed(false); onClose() }
  if (!doc) return null

  // Determine next step label based on doc type
  const nextStep = ["SP Resolution", "SP Ordinance"].includes(doc.type)
    ? "SP Secretariat — Final Archive & Publication"
    : `${doc.office} — Document Released`

  return (
    <Modal open={open} onClose={handleClose} title="Sign Document" subtitle="Official Executive Signature · City of Batac" width="max-w-md">
      {step === 1 ? (
        <div className="p-6">
          {/* Identity header */}
          <div className="flex flex-col items-center text-center mb-6">
            <CitySeal size={60} />
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-3 mb-0.5">City Government of Batac, Ilocos Norte</p>
            <p className="text-sm font-bold text-gray-800">Mayor Mark Christian R. Chua</p>
          </div>

          {/* Document card */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Document to be Signed</p>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">{doc.id}</span>
              <PriorityTag priority={doc.priority} />
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug mb-2.5">{doc.title}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1"><Building size={11} />{doc.office}</span>
              <span className="flex items-center gap-1"><User size={11} />{doc.submittedBy}</span>
            </div>
          </div>

          {/* Signature metadata */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Date &amp; Time</p>
              <p className="text-xs font-semibold text-gray-900">{signedAt}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">Method</p>
              <p className="text-xs font-semibold text-gray-900">System Authentication</p>
            </div>
          </div>

          {/* Legal affirmation */}
          <div className="border-2 rounded-xl p-4 mb-5 cursor-pointer" style={{ borderColor: confirmed ? "#00A651" : "#E5E7EB", backgroundColor: confirmed ? "#F0FAF4" : "#FAFAFA" }}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 accent-green-600 flex-shrink-0" />
              <p className="text-xs text-gray-700 leading-relaxed select-none">
                I, <span className="font-semibold">Mayor Mark Christian R. Chua</span>, confirm my approval of this document. I understand this action is final, will be recorded in the tamper-evident audit log, and constitutes an official executive action of the City Government of Batac.
              </p>
            </label>
          </div>

          {!confirmed && (
            <p className="text-[11px] text-gray-400 text-center mb-3">Please read and check the confirmation above to proceed.</p>
          )}

          <div className="flex items-center justify-between">
            <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn variant="primary" icon={Check} disabled={!confirmed || isPending} onClick={async () => { await removeSignature(doc.id); setStep(2) }}>
              Confirm Signature
            </Btn>
          </div>
        </div>
      ) : (
        /* Success */
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#E8F5ED" }}>
            <CheckCircle size={34} className="brand-text" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Document Signed</h3>
          <p className="text-sm text-gray-500 mb-6">Your signature has been recorded in the audit log. The document is proceeding to the next step.</p>

          <div className="bg-gray-50 rounded-xl p-5 max-w-xs mx-auto text-left mb-6">
            <dl className="space-y-3">
              {[
                ["Tracking ID", doc.id, true],
                ["Signed at", signedAt, false],
                ["Signed by", "Mayor Mark Christian R. Chua", false],
                ["Next step", nextStep, false],
              ].map(([k, v, mono]) => (
                <div key={k}>
                  <dt className="text-[10px] text-gray-400 uppercase tracking-wide">{k}</dt>
                  <dd className={`text-xs font-semibold text-gray-900 mt-0.5 ${mono ? "font-mono" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Btn variant="secondary" icon={Printer}>Print Record</Btn>
            <Btn variant="primary" onClick={handleClose} icon={Check}>Done</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: SCHEDULE SESSION (SP Secretary)
// ─────────────────────────────────────────────────────────────────────────────
const ScheduleSessionModal = ({ open, onClose }) => {
  const { mutateAsync: addSession, isPending } = useAddSession()
  const [step, setStep] = useState(1) // 1=details, 2=agenda, 3=success
  const [form, setForm] = useState({
    type: "regular", sessionNo: "42", date: "2026-06-19",
    time: "09:00", venue: "SP Session Hall, City Hall Annex, Batac City",
    notes: "", generateNCH: true,
  })
  const [selectedItems, setSelectedItems] = useState(mockLegislativeQueue.map(i => i.id))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleItem = id => setSelectedItems(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const handleClose = () => {
    setStep(1)
    setForm({ type: "regular", sessionNo: "42", date: "2026-06-19", time: "09:00", venue: "SP Session Hall, City Hall Annex, Batac City", notes: "", generateNCH: true })
    setSelectedItems(mockLegislativeQueue.map(i => i.id))
    onClose()
  }
  const sessionLabel = form.type === "special" ? "Special Session" : `${form.sessionNo}th Regular Session`
  const displayDate = form.date ? new Date(form.date + "T00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "—"
  const displayTime = form.time ? (parseInt(form.time) >= 12 ? `${parseInt(form.time) === 12 ? 12 : parseInt(form.time) - 12}:${form.time.slice(3)} PM` : `${parseInt(form.time)}:${form.time.slice(3)} AM`) : "—"

  const stepLabels = ["Session Details", "Agenda Items", "Confirm"]

  return (
    <Modal open={open} onClose={handleClose} title="Schedule Session" subtitle="Sangguniang Panlungsod · 7th SP" width="max-w-2xl">
      {/* Step indicator */}
      <div className="px-6 pt-5 pb-1">
        <div className="flex items-center gap-2">
          {stepLabels.map((s, i) => {
            const active = step === i + 1
            const done = step > i + 1
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-green-700" : done ? "text-green-500" : "text-gray-300"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${done ? "bg-green-500 text-white" : active ? "text-white" : "bg-gray-100 text-gray-400"
                    }`} style={active ? { backgroundColor: "#00A651" } : {}}>
                    {done ? <Check size={10} /> : i + 1}
                  </div>
                  {s}
                </div>
                {i < stepLabels.length - 1 && <div className={`w-8 h-px ${done ? "bg-green-400" : "bg-gray-200"}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1 — Session Details */}
      {step === 1 && (
        <div className="p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Session Type</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { id: "regular", label: "Regular Session", desc: "Bi-weekly scheduled session. Follows standard order of business.", accent: "#00A651" },
              { id: "special", label: "Special Session", desc: "Called for a specific urgent matter only. Limited agenda.", accent: "#F59E0B" },
            ].map(opt => (
              <button key={opt.id} onClick={() => set("type", opt.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${form.type === opt.id ? "shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                style={form.type === opt.id ? { borderColor: opt.accent, backgroundColor: opt.id === "regular" ? "#F0FAF4" : "#FFFBEB" } : {}}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-3 h-3 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: opt.accent, backgroundColor: form.type === opt.id ? opt.accent : "white" }}>
                    {form.type === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{opt.label}</span>
                </div>
                <p className="text-xs text-gray-400 leading-snug pl-5">{opt.desc}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 mb-5" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Session Details</p>

          <FRow cols={2}>
            <div>
              <FLabel required>Session Number</FLabel>
              <div className="relative">
                <input type="number" min="1" value={form.sessionNo} onChange={e => set("sessionNo", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring pr-24" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 whitespace-nowrap">
                  {form.type === "special" ? "th Special" : "th Regular"}
                </span>
              </div>
            </div>
            <div>
              <FLabel>Presiding Officer</FLabel>
              <input type="text" value="Hon. Albert D. Chua, Vice Mayor" readOnly
                className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-500 cursor-default" />
            </div>
          </FRow>

          <FRow cols={2}>
            <div>
              <FLabel required>Date</FLabel>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
            </div>
            <div>
              <FLabel required>Time</FLabel>
              <input type="time" value={form.time} onChange={e => set("time", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
            </div>
          </FRow>

          <div className="mb-4">
            <FLabel required>Venue</FLabel>
            <input type="text" value={form.venue} onChange={e => set("venue", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring" />
          </div>

          <div className="mb-5">
            <FLabel>Special Instructions / Notes</FLabel>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2}
              placeholder="Optional: quorum requirements, special order of business, attendance instructions..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring resize-none" />
          </div>

          {/* Preview chip */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <Calendar size={16} className="brand-text mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Will be scheduled as</p>
              <p className="text-sm font-bold text-gray-900">7th SP · {sessionLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5">{displayDate} · {displayTime} · {form.venue || "—"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <Btn variant="ghost" onClick={handleClose}>Cancel</Btn>
            <Btn variant="primary" icon={ChevronRight} disabled={!form.date || !form.time || !form.sessionNo} onClick={() => setStep(2)}>
              Next: Agenda Items
            </Btn>
          </div>
        </div>
      )}

      {/* Step 2 — Agenda Items */}
      {step === 2 && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Agenda Items</p>
              <p className="text-xs text-gray-500">Select documents to calendar for this session. <span className="font-semibold text-gray-700">{selectedItems.length}</span> of {mockLegislativeQueue.length} selected.</p>
            </div>
            <button onClick={() => setSelectedItems(s => s.length === mockLegislativeQueue.length ? [] : mockLegislativeQueue.map(i => i.id))}
              className="text-xs font-medium brand-text hover:underline">
              {selectedItems.length === mockLegislativeQueue.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="space-y-2 mb-5">
            {mockLegislativeQueue.map(item => {
              const checked = selectedItems.includes(item.id)
              return (
                <label key={item.id} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${checked ? "border-green-300" : "border-gray-100 hover:border-gray-200"
                  }`} style={checked ? { backgroundColor: "#F0FAF4" } : { backgroundColor: "white" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} className="mt-0.5 accent-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-[10px] text-gray-400">{item.id}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${item.type === "Ordinance" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {item.type}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-1 mb-0.5">{item.title}</p>
                    <p className="text-xs text-gray-400">{item.author} · {item.committee} Committee</p>
                  </div>
                </label>
              )
            })}
          </div>

          {/* NCH option */}
          <div className="border border-gray-200 rounded-xl p-4 mb-5" style={{ backgroundColor: form.generateNCH ? "#F0FAF4" : "white", borderColor: form.generateNCH ? "#86efac" : undefined }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.generateNCH} onChange={e => set("generateNCH", e.target.checked)} className="accent-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Generate Notice of Committee Hearing (NCH) drafts</p>
                <p className="text-xs text-gray-500 mt-0.5">Auto-drafts NCH notices for items requiring committee hearing. You will assign series numbers on review before sending.</p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <Btn variant="ghost" icon={ChevronLeft} onClick={() => setStep(1)}>Back</Btn>
            <Btn variant="primary" icon={Calendar} disabled={isPending} onClick={async () => { await addSession({ date: form.date, day: new Date(form.date).getDate().toString(), title: form.type === "special" ? "Special Session" : "Regular Session", time: form.time, type: form.type, items: selectedItems.length, id: Date.now().toString() }); setStep(3) }}>
              Schedule Session
            </Btn>
          </div>
        </div>
      )}

      {/* Step 3 — Success */}
      {step === 3 && (
        <div className="p-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "#E8F5ED" }}>
            <Calendar size={32} className="brand-text" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Session Scheduled</h3>
          <p className="text-sm text-gray-500 mb-6">All SP members have been notified. The session has been added to the legislative calendar.</p>

          <div className="bg-gray-50 rounded-xl p-5 max-w-sm mx-auto text-left mb-6">
            <dl className="space-y-3">
              {[
                ["Session", `7th SP · ${sessionLabel}`],
                ["Date", displayDate],
                ["Time", displayTime],
                ["Venue", form.venue],
                ["Agenda items", `${selectedItems.length} document${selectedItems.length !== 1 ? "s" : ""} calendared`],
                ["NCH notices", form.generateNCH ? "Drafts queued — assign numbers before sending" : "Not generated"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] text-gray-400 uppercase tracking-wide">{k}</dt>
                  <dd className="text-xs font-semibold text-gray-900 mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Btn variant="secondary" icon={Printer}>Print Session Agenda</Btn>
            {form.generateNCH && <Btn variant="secondary" icon={FileText}>Review NCH Drafts</Btn>}
            <Btn variant="primary" onClick={handleClose} icon={Check}>Done</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CITY SEAL — two representations:
//   1. CitySeal (SVG mark)    — simplified abstraction of the official seal's
//      ring colors + shield composition. Used for compact UI chrome (sidebar,
//      avatars, favicons) where the full seal's fine detail is illegible.
//   2. CitySealOfficial (img) — the actual seal artwork. Used wherever the
//      seal must be presented in its authoritative form (Citizen Portal
//      header/footer, cover sheets, letterheads, login screens).
// See BRAND.md §2 "The City Seal" for full usage rules, color tokens, and the
// rationale for maintaining both forms.
// ─────────────────────────────────────────────────────────────────────────────
const starPoints = (cx, cy, rOuter, rInner) => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(" ")
}

const CitySeal = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Seal of the City of Batac">
    {/* Outer hairline edge */}
    <circle cx="50" cy="50" r="49" fill="#D1D5DB" />
    {/* Outer ring — heraldic navy */}
    <circle cx="50" cy="50" r="48" fill="#1E3A8A" />
    {/* Ring text (decorative texture at small sizes) */}
    <text x="50" y="9" textAnchor="middle" fill="#FBBF24" fontSize="6.5" fontFamily="Georgia, serif" fontWeight="700" letterSpacing="1.5">CITY OF BATAC</text>
    <text x="50" y="98" textAnchor="middle" fill="#FBBF24" fontSize="5.5" fontFamily="Georgia, serif" fontWeight="700" letterSpacing="2">OFFICIAL SEAL</text>
    {/* Large gold side stars on the navy ring */}
    <polygon points={starPoints(6.5, 50, 5.5, 2.2)} fill="#FBBF24" />
    <polygon points={starPoints(93.5, 50, 5.5, 2.2)} fill="#FBBF24" />
    {/* Middle ring — heraldic red */}
    <circle cx="50" cy="50" r="39" fill="#DC2626" />
    {/* Small white stars on the red ring */}
    {Array.from({ length: 14 }, (_, i) => {
      const a = ((Math.PI * 2) / 14) * i
      return <circle key={i} cx={50 + 34.5 * Math.cos(a)} cy={50 + 34.5 * Math.sin(a)} r="0.9" fill="#FFFFFF" />
    })}
    {/* Shield border */}
    <circle cx="50" cy="50" r="30.5" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="0.5" />
    {/* Shield — sky (top half) */}
    <path d="M 20.5 50 A 29.5 29.5 0 0 1 79.5 50 Z" fill="#7DB8F0" />
    {/* Shield — agricultural field (bottom half) */}
    <path d="M 20.5 50 A 29.5 29.5 0 0 0 79.5 50 Z" fill="#1A7A36" />
    {/* Sunburst */}
    <g stroke="#FBBF24" strokeWidth="1.3" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
        const a = (deg * Math.PI) / 180
        return <line key={deg} x1={50 + 6 * Math.cos(a)} y1={34 + 6 * Math.sin(a)} x2={50 + 9.5 * Math.cos(a)} y2={34 + 9.5 * Math.sin(a)} />
      })}
    </g>
    <circle cx="50" cy="34" r="5" fill="#FEF3C7" />
    {/* Tree (left) */}
    <circle cx="29.5" cy="42" r="5" fill="#16A34A" />
    <rect x="28.5" y="46" width="2" height="5" fill="#78350F" />
    {/* Municipal building */}
    <rect x="37" y="44" width="26" height="9" fill="#F9FAFB" stroke="#9CA3AF" strokeWidth="0.4" />
    {[39.5, 44, 48.5, 53, 57.5].map(x => <rect key={x} x={x} y="46.5" width="2" height="4" fill="#9CA3AF" />)}
    {/* Ground line */}
    <rect x="20.7" y="52.5" width="58.6" height="1.4" fill="#D1D5DB" />
    {/* Grain stalks (left of field) — agricultural motif */}
    <g stroke="#FDE68A" strokeWidth="0.8" strokeLinecap="round">
      <line x1="27" y1="64" x2="25" y2="56" />
      <line x1="30" y1="64" x2="29" y2="55" />
      <line x1="33" y1="64" x2="33" y2="56" />
    </g>
  </svg>
)

// Full official seal artwork — see /assets/city-seal-official.jpg
// In the production app this asset lives in /packages/ui/assets/branding/
// and is served from /apps/web/public/branding/city-seal-official.png
const CitySealOfficial = ({ size = 56, className = "" }) => (
  <img
    src="/assets/city-seal-official.jpg"
    alt="Official Seal of the City of Batac, Ilocos Norte"
    width={size}
    height={size}
    className={`rounded-full flex-shrink-0 ${className}`}
    style={{ width: size, height: size, objectFit: "contain" }}
  />
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
export const DEBUG_USER_ROLE = "mayor"; // "mayor" or "sp"



const navGroups = [
  {
    label: "PROTOTYPE",
    items: [{ id: "kitchen", label: "Design System", icon: Layers }],
  },
  {
    label: "DASHBOARDS",
    items: [
      { id: "mayor", label: "Mayor's Dashboard", icon: Briefcase },
      { id: "sp", label: "SP Secretary Dashboard", icon: Scale },
    ].filter(i => i.id === DEBUG_USER_ROLE),
  },
  {
    label: "OPERATIONS",
    items: [
      { id: "wms",  label: "Approval Interface", icon: FileCheck  },
      { id: "dms",  label: "Document Repository",icon: Folder     },
    ],
  },
  {
    label: "PUBLIC",
    items: [
      { id: "portal", label: "Citizen Portal", icon: Globe },
      { id: "login", label: "Login / Register", icon: User },
    ],
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
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 brand-btn">{DEBUG_USER_ROLE === "mayor" ? "MK" : "SP"}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{DEBUG_USER_ROLE === "mayor" ? "Mark Christian R. Chua" : "SP Secretary"}</p>
            <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{DEBUG_USER_ROLE === "mayor" ? "Mayor · City of Batac" : "Secretariat · City of Batac"}</p>
          </div>
        </div>
      )}
      {/* Citizen Portal login/register quick links */}
      <div className="mt-2">
        <button
          onClick={() => setPage("portal")}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors"
          style={{ color: "rgba(255,255,255,0.65)" }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
          <Globe size={14} className="flex-shrink-0" />
          {!collapsed && <span className="truncate">Citizen Portal</span>}
        </button>

      </div>

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
          {[["50", "#F0FAF4"], ["100", "#D9F2E6"], ["200", "#B3E4CC"], ["300", "#7DCFA8"], ["400", "#3DB77C"], ["500", "#00A651"], ["600", "#007A3A"], ["700", "#0D3D20"], ["800", "#092912"], ["900", "#040F07"]].map(([s, hex]) => (
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
          {[["Success", "#16a34a", "#dcfce7"], ["Warning", "#f59e0b", "#fef3c7"], ["Danger", "#dc2626", "#fee2e2"], ["Info", "#2563eb", "#dbeafe"], ["Accent Gold", "#f59e0b", "#fef9c3"]].map(([name, dark, light]) => (
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
          {[["50", "#F9FAFB"], ["100", "#F3F4F6"], ["200", "#E5E7EB"], ["300", "#D1D5DB"], ["400", "#9CA3AF"], ["500", "#6B7280"], ["600", "#4B5563"], ["700", "#374151"], ["800", "#1F2937"], ["900", "#111827"]].map(([s, hex]) => (
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
        {["Approved", "Pending Approval", "In Workflow", "In Committee", "For 1st Reading", "For 2nd Reading", "3rd Reading", "VP Certification", "Released", "Rejected", "Under Investigation", "Draft", "Archived"].map(s => (
          <StatusBadge key={s} status={s} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {["Public", "Internal", "Confidential", "Restricted"].map(l => <ClassificationBadge key={l} level={l} />)}
      </div>
    </div>

    {/* Alerts */}
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Alert Banners</p>
      <div className="space-y-3">
        {[
          { icon: CheckCircle, c: "green", bg: "bg-green-50", border: "border-green-200", title: "Document Approved", body: "Resolution No. 7SP 2026-047 has been approved and certified by the Vice Mayor." },
          { icon: AlertTriangle, c: "amber", bg: "bg-amber-50", border: "border-amber-200", title: "SLA Warning — 80% of Time Limit Reached", body: "Purchase Request DTS-2026-000085 is approaching its ARTA processing deadline." },
          { icon: AlertCircle, c: "red", bg: "bg-red-50", border: "border-red-200", title: "SLA Breach — Automatically Escalated", body: "Leave Application DTS-2026-000076 has exceeded the 3-day processing limit." },
          { icon: Inbox, c: "blue", bg: "bg-blue-50", border: "border-blue-200", title: "Mayor's 10-Day Review Period — 6 Days Remaining", body: "SP Ordinance No. 7SP 2026-004 requires executive action before June 14, 2026." },
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
        {[["Text Input", "text", "Enter document title..."], ["Date Input", "date", ""]].map(([label, type, ph]) => (
          <div key={label}>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>
            <input type={type} placeholder={ph} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none brand-ring transition-shadow" />
          </div>
        ))}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Select</label>
          <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
            {["All Document Types", "SP Resolution", "SP Ordinance", "Travel Order", "Purchase Request"].map(o => <option key={o}>{o}</option>)}
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
const MayorPage = () => {
  const queryClient = useQueryClient()
  const [timeFilter, setTimeFilter] = useState("year")
  const { data: documents = [] } = useDocuments()
  
  const pendingCount = mockPendingSignatures.length;
  const overdueDocs = mockPendingSignatures.filter(d => d.priority === "overdue");
  const overdueCount = overdueDocs.length;
  
  // 1. Dynamic Dept Workload
  const activeDocs = documents.filter(d => !["Approved", "Released", "Archived", "Completed"].includes(d.status)).length;
  const cityWideOverdue = documents.filter(d => d.priority === "overdue" || (d.daysInQueue && d.daysInQueue > 5)).length;

  const now = new Date("2026-06-17");
  const filteredDocs = documents.filter(doc => {
    const docDate = new Date(doc.date || doc.dueDate || "2026-05-01");
    const diffTime = Math.abs(now - docDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (timeFilter === "month") return diffDays <= 30;
    return diffDays <= 365;
  });

  const deptGroups = {};
  filteredDocs.forEach(doc => {
    if (!deptGroups[doc.office]) {
      deptGroups[doc.office] = { A: 0, fullMark: 0 };
    }
    deptGroups[doc.office].fullMark += 1;
    if (!["Approved", "Released", "Archived", "Completed"].includes(doc.status)) {
      deptGroups[doc.office].A += 1;
    }
  });
  const dynamicDeptWorkload = Object.keys(deptGroups).map(office => ({
    id: office,
    subject: office.replace("City ", ""),
    A: deptGroups[office].A,
    fullMark: Math.max(10, deptGroups[office].fullMark),
    overdue: 0
  }));

  // 2. Dynamic SLA Data
  const slaGroups = {};
  
  if (timeFilter === "year") {
    // Group by month
    const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    months.forEach(m => slaGroups[m] = { total: 0, comp: 0 });
    filteredDocs.forEach(doc => {
      const dDate = new Date(doc.date || "2026-05-01");
      const mName = dDate.toLocaleString('default', { month: 'short' });
      if (slaGroups[mName]) {
        slaGroups[mName].total += 1;
        if (doc.daysInQueue <= 5) slaGroups[mName].comp += 1;
      }
    });
  } else {
    // Group by week
    const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];
    weeks.forEach(w => slaGroups[w] = { total: 0, comp: 0 });
    filteredDocs.forEach(doc => {
      const dDate = new Date(doc.date || "2026-05-01");
      const diff = Math.ceil(Math.abs(now - dDate) / (1000 * 60 * 60 * 24));
      let wIdx = Math.floor((30 - diff) / 7);
      if (wIdx < 0) wIdx = 0; if (wIdx > 3) wIdx = 3;
      const wName = weeks[wIdx];
      slaGroups[wName].total += 1;
      if (doc.daysInQueue <= 5) slaGroups[wName].comp += 1;
    });
  }

  const dynamicSLAData = Object.keys(slaGroups).map(k => {
    const total = slaGroups[k].total || 1; // avoid divide by zero
    const comp = slaGroups[k].total === 0 ? 95 : Math.round((slaGroups[k].comp / total) * 100);
    return { name: k, compliant: comp, breach: 100 - comp };
  });

  const currentSLA = dynamicSLAData.length > 0 ? dynamicSLAData[dynamicSLAData.length - 1].compliant : 95;

  const handleRefresh = () => {
    queryClient.invalidateQueries()
  }

  return (
    <div className="p-6">
      <PageHdr
        title="Mayor's Dashboard"
        subtitle="Mayor Mark Christian 'Markee' R. Chua — City of Batac, Ilocos Norte"
        breadcrumb={["Dashboards", "Mayor's Dashboard"]}
        actions={<>
          <Btn variant="secondary" size="sm" icon={RefreshCw} onClick={handleRefresh}>Refresh</Btn>
          <Btn variant="secondary" size="sm" icon={Download} onClick={() => window.print()}>Export Report</Btn>
        </>}
      />

      {/* SLA breach alert */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={17} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">{overdueCount} Document{overdueCount > 1 ? "s" : ""} Require{overdueCount === 1 ? "s" : ""} Immediate Executive Attention</p>
            <p className="text-xs text-red-700 mt-0.5">There are documents in your queue that have breached ARTA limits and have been automatically escalated.</p>
          </div>
          <Btn variant="danger" size="sm" onClick={() => window.open('?page=wms&docId=' + overdueDocs[0].id, '_blank')}>Review Now</Btn>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard title="Pending Signature" value={pendingCount.toString()} subtitle={`${overdueCount} are overdue`} icon={FileCheck} color={overdueCount > 0 ? "red" : "amber"} trend={pendingCount > 10 ? "up" : "down"} trendValue="" />
        <StatCard title="City-Wide Overdue" value={cityWideOverdue.toString()} subtitle="Across departments" icon={AlertTriangle} color={cityWideOverdue > 5 ? "red" : "amber"} trend="up" trendValue="" />
        <StatCard title="SLA Compliance" value={`${currentSLA}%`} subtitle="This month — Target: 95%" icon={Activity} color={currentSLA >= 95 ? "green" : "red"} trend={currentSLA >= 95 ? "up" : "down"} trendValue="" />
        <StatCard title="Active Documents" value={activeDocs.toString()} subtitle="In workflow system" icon={FileText} color="blue" trend="up" trendValue="" />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Pending signatures table */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <SectionHdr title="Pending Your Signature" subtitle="Sorted by urgency — ARTA deadlines apply" />
          </div>
          <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
            {mockPendingSignatures.map((doc, i) => (
              <div key={i} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${doc.priority === "overdue" ? "bg-red-50/50" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${doc.priority === "overdue" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                    <FileCheck size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{doc.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Building size={10} />{doc.office}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} />{doc.daysInQueue}d in queue</span>
                      <span className={`text-xs ${doc.priority === "overdue" ? "text-red-600 font-medium" : "text-gray-400"}`}>Due: {doc.dueDate}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Btn variant="secondary" size="xs" icon={Eye} onClick={() => window.open('?page=wms&docId=' + doc.id, '_blank')}>Review / Sign</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
          <SectionHdr title="Quick Actions" subtitle="Frequently used tasks" />
          <Btn variant="primary" icon={Plus} onClick={() => window.alert('Route New Memorandum')}>Route New Memorandum</Btn>
          <Btn variant="secondary" icon={Layers}>View Department Queue</Btn>
          <Btn variant="secondary" icon={Briefcase}>City Council Agenda</Btn>
          <Btn variant="secondary" icon={AlertCircle}>Escalated Documents</Btn>
          
          <div className="mt-auto pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Digital Signature Status</span>
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
            </div>
            <p className="text-xs text-gray-400">Your PKI token is validated and ready for document signing.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* SLA chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHdr title="SLA Compliance Trend" subtitle="Dynamic ARTA compliance rate (%)" />
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setTimeFilter("year")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeFilter === "year" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Year</button>
              <button onClick={() => setTimeFilter("month")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeFilter === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Month</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={185}>
            <AreaChart data={dynamicSLAData} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="slaG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A651" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00A651" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="compliant" stroke="#00A651" fill="url(#slaG)" strokeWidth={2} dot={{ r: 3 }} name="Compliant %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Dept workload */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHdr title="Department Document Workload" subtitle="Active vs Total Processed" />
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setTimeFilter("year")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeFilter === "year" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Year</button>
              <button onClick={() => setTimeFilter("month")} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${timeFilter === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Month</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={dynamicDeptWorkload} margin={{ top: 2, right: 2, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="subject" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="fullMark" fill="#e5e7eb" name="Total Documents" radius={[2, 2, 0, 0]} />
              <Bar dataKey="A" fill="#3b82f6" name="Active / Pending" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const SPSecretaryPage = () => {
  const [showLogDoc, setShowLogDoc] = useState(false)
  const [showScheduleSession, setShowScheduleSession] = useState(false)

  // Dynamic calculations for SP Secretary Dashboard
  const activeQueueCount = mockLegislativeQueue.filter(i => !["Completed", "Archived"].includes(i.status)).length;

  const nextSession = mockSessionCalendar.length > 0 ? mockSessionCalendar[0] : null;
  const nextSessionItems = nextSession ? nextSession.items : 0;
  const nextSessionDate = nextSession ? nextSession.date : "TBD";

  const latestOutput = mockLegislativeOutput.length > 0 ? mockLegislativeOutput[mockLegislativeOutput.length - 1] : { resolutions: 0, ordinances: 0 };
  const approvedThisMonth = latestOutput.resolutions + latestOutput.ordinances;

  const forMayorReview = mockLegislativeQueue.filter(i => i.status === "VP Certification").length;

  return (
    <div className="p-6">
      <LogDocumentModal open={showLogDoc} onClose={() => setShowLogDoc(false)} />
      <ScheduleSessionModal open={showScheduleSession} onClose={() => setShowScheduleSession(false)} />
      <PageHdr
        title="SP Secretary's Dashboard"
        subtitle="Office of the Secretary, Sangguniang Panlungsod · 7th SP · Batac City"
        breadcrumb={["Dashboards", "SP Secretary's Dashboard"]}
        actions={<>
          <Btn variant="primary" size="sm" icon={Plus} onClick={() => setShowLogDoc(true)}>Log New Document</Btn>
          <Btn variant="secondary" size="sm" icon={Calendar} onClick={() => setShowScheduleSession(true)}>Schedule Session</Btn>
        </>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard title="Active in Queue" value={activeQueueCount.toString()} subtitle="Legislative documents" icon={ClipboardList} color="blue" />
        <StatCard title="Next Session" value={nextSessionItems.toString()} subtitle={`Items · ${nextSessionDate}`} icon={Calendar} color="green" />
        <StatCard title="Approved This Month" value={approvedThisMonth.toString()} subtitle="Resolutions & Ordinances" icon={CheckCircle} color="green" trend="up" trendValue="+3 vs May" />
        <StatCard title="For Mayor Review" value={forMayorReview.toString()} subtitle="SP Ordinances — pending LCE" icon={Scale} color="amber" />
      </div>

      <div className="grid grid-cols-3 gap-5 mb-5">
        {/* Legislative queue */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <SectionHdr title="Active Legislative Queue" subtitle="All SP resolutions and ordinances currently in workflow"
              action={<Btn variant="ghost" size="xs" icon={Plus} onClick={() => setShowLogDoc(true)}>Log New</Btn>} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Tracking ID", "Title", "Type", "Status", "Session Date"].map(h => (
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
                [Plus, "Log Incoming Document", () => setShowLogDoc(true)],
                [Printer, "Print Session Agenda", null],
                [FileText, "Draft Session Minutes", null],
                [Archive, "Archive Released Docs", null],
              ].map(([Icon, label, handler]) => (
                <button key={label} onClick={handler || undefined} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors text-left">
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
            <Bar dataKey="ordinances" fill="#7c3aed" name="Ordinances" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: DTS TIMELINE
// ─────────────────────────────────────────────────────────────────────────────
const DTSPage = ({ selectedDocId, setSelectedDocId, setPage }) => {
  const [showPrint, setShowPrint] = useState(false)
  // Get the selected document or use the first one as default
  const doc = selectedDocId 
    ? mockDocuments.find(d => d.id === selectedDocId) 
    : mockDocuments[0]
  
  return (
  <div className="p-6">
    <PrintCoverSheetModal open={showPrint} onClose={() => setShowPrint(false)} />
    <PageHdr
      title="Document Tracking View"
      subtitle="Complete routing history and physical custody record"
      breadcrumb={["Operations", "Document Tracking"]}
      actions={<>
        <Btn variant="secondary" size="sm" icon={Printer} onClick={() => setShowPrint(true)}>Print Cover Sheet</Btn>
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
                <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{doc.id}</span>
                <StatusBadge status={doc.status} />
                <ClassificationBadge level={doc.classification} />
              </div>
              <p className="text-base font-semibold text-gray-900 mb-0.5">{doc.title}</p>
              <p className="text-sm text-gray-600 line-clamp-2">{doc.title}</p>
              <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                {[["Type",doc.type],["Office",doc.office],["Date",doc.date],["Status",doc.status]].map(([k,v]) => (
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
              <p className="font-mono text-sm font-bold text-gray-900">{doc.id}</p>
              <p className="text-xs text-gray-500 mt-0.5">{doc.type}</p>
              <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400 leading-relaxed">
                City Government of Batac<br />Ilocos Norte, Philippines<br />
                <span className="font-semibold">Permanent Retention · {doc.classification}</span>
              </div>
            </div>
            <Btn variant="secondary" size="sm" className="w-full mt-3" icon={Printer} onClick={() => setShowPrint(true)}>Print Cover Sheet</Btn>
          </div>

          {/* Document details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Document Details</p>
            <dl className="space-y-3">
              {[
                ["Classification", <ClassificationBadge level={doc.classification} />],
                ["Owning Office", doc.office],
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
              {[[Eye, "View Official Document"], [Download, "Download Certified Copy"], [ExternalLink, "View on Citizen Portal"]].map(([Icon, label]) => (
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
}

// ─────────────────────────────────────────────────────────────────────────────
const WMSPage = () => {
  const [action, setAction] = useState(null)
  const [comment, setComment] = useState("")
  const [done, setDone] = useState(false)
  
  const targetDocId = new URLSearchParams(window.location.search).get("docId");
  const doc = mockPendingSignatures.find(d => d.id === targetDocId) || 
              mockLegislativeQueue.find(d => d.id === targetDocId) ||
              mockDocuments.find(d => d.id === targetDocId) || {
    id: "DTS-2026-000085",
    title: "Medical Supplies — Q3 2026",
    type: "Purchase Request",
    office: "City Health Office",
    submittedBy: "Dr. Juan C. Reyes",
    daysInQueue: 4,
    dueDate: "2026-06-07",
    priority: "overdue",
    classification: "Internal"
  };

  const removePendingSignature = useRemovePendingSignature();
  const updatePendingSignature = useUpdatePendingSignature();
  const updateLegislativeQueue = useUpdateLegislativeQueue();

  const handleSubmit = () => {
    if ((action === "reject" || action === "return") && !comment.trim()) return
    
    const isPendingSig = mockPendingSignatures.some(d => d.id === doc.id);
    const isLegQueue = mockLegislativeQueue.some(d => d.id === doc.id);

    if (action === "approve") {
      if (isPendingSig) removePendingSignature.mutate(doc.id);
      if (isLegQueue) updateLegislativeQueue.mutate({ id: doc.id, status: "Completed" });
    } else if (action === "reject") {
      if (isPendingSig) updatePendingSignature.mutate({ id: doc.id, priority: "rejected" });
      if (isLegQueue) updateLegislativeQueue.mutate({ id: doc.id, status: "Archived" });
    } else if (action === "return") {
      if (isPendingSig) updatePendingSignature.mutate({ id: doc.id, priority: "returned" });
      if (isLegQueue) updateLegislativeQueue.mutate({ id: doc.id, status: "Needs Revision" });
    }
    
    setDone(true)
  }

  if (done) return (
    <div className="p-6 flex items-center justify-center" style={{ minHeight: "60vh" }}>
      <div className="bg-white rounded-xl border border-gray-200 p-10 max-w-md w-full text-center">
        {action === "approve" && <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />}
        {action === "reject" && <XCircle size={52} className="text-red-500 mx-auto mb-4" />}
        {action === "return" && <RotateCcw size={52} className="text-amber-500 mx-auto mb-4" />}
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          {action === "approve" ? "Document Approved" : action === "reject" ? "Document Rejected" : "Returned for Revision"}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {action === "approve" ? "Forwarded to the next workflow step. The concerned office has been notified."
            : action === "reject" ? `The request has been rejected. The submitter (${doc.submittedBy || "Unknown"}, ${doc.office}) has been notified.`
              : `Returned to ${doc.submittedBy || "Unknown"} (${doc.office}) with your revision instructions.`}
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
              <span className="font-medium text-gray-700">{doc.type} — {doc.title}</span>
              <span className="text-gray-300">·</span>
              <span className="font-mono">{doc.id}</span>
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
                  <p className="text-xs text-gray-500">{doc.office}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-gray-400">{doc.id}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{doc.dueDate ? "Due: " + doc.dueDate : "May 24, 2026"}</p>
                </div>
              </div>
              <div className="text-center mb-7">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">{doc.type}</p>
                <h2 className="text-lg font-bold text-gray-900 mt-1">{doc.title}</h2>
              </div>
              
              {/* Just a generic mockup body that adapts slightly */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg text-xs mb-6">
                {[
                  ["Requesting Office", doc.office], 
                  ["Requested By", doc.submittedBy || "Unknown User"], 
                  ["Status", doc.daysInQueue ? `${doc.daysInQueue} days in queue` : "Active"], 
                  ["Purpose", `Official documentation for ${doc.title}`]
                ].map(([k, v]) => (
                  <div key={k}><span className="text-gray-400">{k}:</span><br /><strong>{v}</strong></div>
                ))}
              </div>
              
              <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-center mb-6">
                <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-600">Document Body Content</p>
                <p className="text-xs text-gray-400 mt-1">Full content is available in the original PDF attachment.</p>
              </div>

              <p className="text-xs text-gray-500 italic">I hereby certify that the above statements are true and correct and will be used for the official functions of the {doc.office} of Batac City.</p>
              <div className="mt-8 grid grid-cols-3 gap-4 pt-5 border-t border-gray-200">
                {[["Requested By", doc.submittedBy || "Submitter", "[Signed]"], ["Noted By", "Department Head", "[Signed]"], ["Approved By", "Mayor's Office", "____________"]].map(([r, n, s]) => (
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
              {[
                ["Tracking No.", doc.id, "font-mono text-xs"], 
                ["Document Type", doc.type, "text-xs"], 
                ["Submitted By", doc.submittedBy || "Unknown", "text-xs"], 
                ["Office", doc.office, "text-xs"], 
                ["Days in Queue", doc.daysInQueue ? <span className={doc.priority === "overdue" ? "text-red-600 font-bold text-xs" : "text-amber-600 font-bold text-xs"}>{doc.daysInQueue} days</span> : "N/A", ""], 
                ["Deadline", doc.dueDate || "N/A", "text-xs font-medium"], 
                ["Classification", <ClassificationBadge level={doc.classification || "Internal"} />, ""]
              ].map(([k, v, cls]) => (
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
              {[["Submitted by Originator", true, false], ["Department Head Endorsement", true, false], ["Budget / Admin Certification", true, false], ["Executive Approval", false, true], ["Release to Requesting Office", false, false]].map(([step, done, current], i) => (
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
                { id: "approve", icon: Check, border: "border-green-500", bg: "bg-green-50", label: "Approve", sub: "Forward to next step" },
                { id: "return", icon: RotateCcw, border: "border-amber-400", bg: "bg-amber-50", label: "Return for Revision", sub: "Send back with comments" },
                { id: "reject", icon: X, border: "border-red-500", bg: "bg-red-50", label: "Reject", sub: "Terminate this request" },
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

            <button onClick={handleSubmit} disabled={!action || ((action === "reject" || action === "return") && !comment.trim())}
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
// ─────────────────────────────────────────────────────────────────────────────
const DMSPage = ({ selectedDocId, setSelectedDocId, setPage }) => {
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState({ type: "All Types", office: "All Offices", status: "All Statuses", classification: "All" })
  const [showUpload, setShowUpload] = useState(false)
  const [showNewDoc, setShowNewDoc] = useState(false)

  const handleDocumentClick = (docId) => {
    setSelectedDocId(docId)
    setPage("dts")
  }

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
      <UploadDocumentModal open={showUpload} onClose={() => setShowUpload(false)} />
      <NewDocumentModal open={showNewDoc} onClose={() => setShowNewDoc(false)} />
      <PageHdr
        title="Document Repository"
        subtitle="DMS — Search, filter, and manage all registered documents"
        breadcrumb={["Operations", "Document Repository"]}
        actions={<>
          <Btn variant="secondary" size="sm" icon={Upload} onClick={() => setShowUpload(true)}>Upload Document</Btn>
          <Btn variant="primary" size="sm" icon={Plus} onClick={() => setShowNewDoc(true)}>New Document</Btn>
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
          <Btn variant="ghost" size="sm" icon={RefreshCw} onClick={() => { setSearch(""); setFilters({ type: "All Types", office: "All Offices", status: "All Statuses", classification: "All" }) }}>Reset</Btn>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            ["type", "All Types", ["All Types", "SP Resolution", "SP Ordinance", "Travel Order", "Purchase Request", "Leave Application", "Internal Memorandum", "Citizen Request", "Citizen Complaint", "Project Proposal", "Admin Case"]],
            ["office", "All Offices", ["All Offices", "SP Secretariat", "Mayor's Office", "City Engineering", "City Health", "City Budget", "HRMO", "City Administrator", "CSWDO", "City IT Office"]],
            ["status", "All Statuses", ["All Statuses", "In Workflow", "Pending Approval", "Approved", "Released", "Rejected", "Under Investigation", "Archived"]],
            ["classification", "All", ["All", "Public", "Internal", "Confidential", "Restricted"]],
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
            {["Date (newest first)", "Title A–Z", "Status", "Type", "Office"].map(o => <option key={o}>{o}</option>)}
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
                    <button className="mt-2 text-xs brand-text hover:underline" onClick={() => { setSearch(""); setFilters({ type: "All Types", office: "All Offices", status: "All Statuses", classification: "All" }) }}>Clear all filters</button>
                  </td>
                </tr>
              ) : filtered.map((doc, i) => (
                <tr key={doc.id} className={`hover:bg-gray-50 cursor-pointer transition-colors group ${i !== filtered.length - 1 ? "border-b border-gray-50" : ""}`} onClick={() => handleDocumentClick(doc.id)}>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-xs text-green-600 hover:text-green-800 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDocumentClick(doc.id); }}>{doc.id}</span>
                  </td>
                  <td className="px-4 py-3.5" style={{ maxWidth: 260 }}>
                    <p className="text-sm font-medium text-gray-900 truncate cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDocumentClick(doc.id); }}>{doc.title}</p>
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
// PAGE: LOGIN / REGISTER
// ─────────────────────────────────────────────────────────────────────────────
const LoginRegisterPage = () => {
  const [mode, setMode] = useState("login") // "login" or "register"
  const [loginForm, setLoginForm] = useState({ email: "", password: "" })
  const [registerForm, setRegisterForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "", agreeTerms: false })
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleLogin = () => {
    if (loginForm.email && loginForm.password) setSubmitted(true)
  }

  const handleRegister = () => {
    if (registerForm.fullName && registerForm.email && registerForm.password && registerForm.password === registerForm.confirmPassword && registerForm.agreeTerms) {
      setSubmitted(true)
    }
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Gov header */}
      <div style={{ backgroundColor: "#0D3D20" }} className="text-white">
        <div className="max-w-2xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CitySealOfficial size={52} />
            <div>
              <p className="text-xs opacity-60">Republic of the Philippines · Province of Ilocos Norte</p>
              <p className="text-base font-bold leading-tight">City Government of Batac</p>
              <p className="text-xs" style={{ color: "#86efac" }}>Document Management System</p>
            </div>
          </div>
        </div>
      </div>

      {/* Auth container */}
      <div className="max-w-md mx-auto px-6 py-12">
        {!submitted ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            {/* Mode toggle */}
            <div className="flex gap-2 mb-8 bg-gray-100 p-1 rounded-lg">
              {[
                { id: "login", label: "Sign In" },
                { id: "register", label: "Create Account" }
              ].map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className={`flex-1 py-2 px-3 rounded-md font-medium text-sm transition-colors ${
                    mode === m.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* LOGIN MODE */}
            {mode === "login" && (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-bold text-gray-900 mb-1">Sign In to Your Account</p>
                  <p className="text-sm text-gray-500">Access the citizen portal and track documents</p>
                </div>

                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <input type="email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none brand-ring" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none brand-ring pr-10" />
                      <button onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <Eye size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="accent-green-600" />
                      <span className="text-sm text-gray-600">Remember me</span>
                    </label>
                    <a href="#" className="text-sm text-green-700 hover:underline">Forgot password?</a>
                  </div>

                  <Btn variant="primary" className="w-full justify-center" onClick={handleLogin}>Sign In</Btn>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 text-center">
                      Don't have an account?{" "}
                      <button onClick={() => setMode("register")} className="text-green-700 font-medium hover:underline">
                        Create one
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* REGISTER MODE */}
            {mode === "register" && (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-bold text-gray-900 mb-1">Create Your Account</p>
                  <p className="text-sm text-gray-500">Register to access document tracking and services</p>
                </div>

                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                    <input type="text" value={registerForm.fullName} onChange={e => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                      placeholder="Juan Dela Cruz"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none brand-ring" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                    <input type="email" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none brand-ring" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none brand-ring pr-10" />
                      <button onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <Eye size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                    <input type={showPassword ? "text" : "password"} value={registerForm.confirmPassword} onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none brand-ring" />
                    {registerForm.password !== registerForm.confirmPassword && registerForm.confirmPassword && (
                      <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={registerForm.agreeTerms} onChange={e => setRegisterForm({ ...registerForm, agreeTerms: e.target.checked })}
                      className="mt-0.5 accent-green-600" />
                    <span className="text-xs text-gray-600 leading-relaxed">
                      I agree to the <a href="#" className="text-green-700 hover:underline">Terms of Service</a> and{" "}
                      <a href="#" className="text-green-700 hover:underline">Privacy Policy</a>
                    </span>
                  </label>

                  <Btn variant="primary" className="w-full justify-center" disabled={!registerForm.fullName || !registerForm.email || !registerForm.password || registerForm.password !== registerForm.confirmPassword || !registerForm.agreeTerms} onClick={handleRegister}>Create Account</Btn>

                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-600 text-center">
                      Already have an account?{" "}
                      <button onClick={() => setMode("login")} className="text-green-700 font-medium hover:underline">
                        Sign in
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Success state */
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "#E8F5ED" }}>
              <CheckCircle size={32} className="brand-text" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {mode === "login" ? "Sign In Successful" : "Account Created Successfully"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {mode === "login"
                ? "Welcome back! You are now signed into your account."
                : "Your account has been created. You can now access the citizen portal and track documents."}
            </p>
            <Btn variant="primary" className="w-full justify-center" onClick={() => { setSubmitted(false); setMode("login"); setLoginForm({ email: "", password: "" }); setRegisterForm({ fullName: "", email: "", password: "", confirmPassword: "", agreeTerms: false }); }}>
              {mode === "login" ? "Go to Dashboard" : "Continue to Sign In"}
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: CITIZEN PORTAL
// ─────────────────────────────────────────────────────────────────────────────
const CitizenAuthFooter = () => null


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
            <CitySealOfficial size={52} />
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
            { id: "track", label: "Track a Document", icon: Activity },
            { id: "library", label: "Ordinances & Resolutions", icon: BookOpen },
            { id: "submit", label: "Submit a Request / Complaint", icon: MessageSquare },
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

        {/* Public auth (Login/Register) — moved here to the citizen portal “public lower” area */}
        <div className="pt-2">
          <CitizenAuthFooter />
        </div>

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
                      {[["Current Status", <StatusBadge status="Released" />], ["Current Office", "Records Archive — SP Secretariat"], ["Last Updated", "June 2, 2026"]].map(([k, v]) => (
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
                      {["Service Request", "Complaint (Transportation)", "Complaint (General)", "Information Request", "Document Copy Request"].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Concerned Office <span className="text-red-500">*</span></label>
                    <select className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none brand-ring">
                      {["Mayor's Office", "SP Secretariat", "City Engineering", "City Health", "CSWDO", "City Treasurer", "City Civil Registrar"].map(o => <option key={o}>{o}</option>)}
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
                    {["Brgy. 1-S Valdez", "Brgy. 2", "Brgy. 3", "Brgy. 4", "Brgy. 5", "Brgy. 6", "Brgy. 7 Payac"].map(o => <option key={o}>{o}</option>)}
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
  dts:      { component: DTSPage,            title: "Document Tracking",       subtitle: "Complete Routing History & Physical Custody Record" },
  wms:      { component: WMSPage,            title: "Approval Interface",       subtitle: "WMS — Document Review & Action" },
  dms:      { component: DMSPage,            title: "Document Repository",      subtitle: "DMS — Internal Document Search & Management" },
  portal:   { component: CitizenPortalPage,  title: "Citizen Portal",          subtitle: "Public Access — sp.batac.gov.ph" },
  login:    { component: LoginRegisterPage,  title: "Login / Register",         subtitle: "Sign in to your account or create a new one" },
}

const DataFetcher = () => {
  const q1 = usePendingSignatures();
  const q2 = useSLAData();
  const q3 = useDeptWorkload();
  const q4 = useLegislativeQueue();
  const q5 = useSessionCalendar();
  const q6 = useLegislativeOutput();
  const q7 = useRoutingHistory();
  const q8 = useDocuments();
  const q9 = usePublicOrdinances();

  const queries = [q1, q2, q3, q4, q5, q6, q7, q8, q9];
  const isLoading = queries.some(q => q.isLoading);
  const isError = queries.some(q => q.isError);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
          <p className="text-sm font-medium text-gray-500">Connecting to API...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-red-50 p-6 max-w-md text-center shadow-lg border border-red-100">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-red-700 font-bold mb-2">Failed to load data</p>
          <p className="text-sm text-red-600 mb-4">Make sure the API server is running on {import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}</p>
        </div>
      </div>
    );
  }

  mockPendingSignatures.splice(0, mockPendingSignatures.length, ...(q1.data || []));
  mockSLAData.splice(0, mockSLAData.length, ...(q2.data || []));
  mockDeptWorkload.splice(0, mockDeptWorkload.length, ...(q3.data || []));
  mockLegislativeQueue.splice(0, mockLegislativeQueue.length, ...(q4.data || []));
  mockSessionCalendar.splice(0, mockSessionCalendar.length, ...(q5.data || []));
  mockLegislativeOutput.splice(0, mockLegislativeOutput.length, ...(q6.data || []));
  mockRoutingHistory.splice(0, mockRoutingHistory.length, ...(q7.data || []));
  mockDocuments.splice(0, mockDocuments.length, ...(q8.data || []));
  publicOrdinances.splice(0, publicOrdinances.length, ...(q9.data || []));

  return <AppContent />;
};

function AppContent() {
  const queryPage = new URLSearchParams(window.location.search).get("page");
  const [page, setPage] = useState(queryPage || DEBUG_USER_ROLE)
  const [collapsed, setCollapsed] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState(null)
  const isPortal = page === "portal" || page === "login"
  const cfg = pages[page]
  const Pg = cfg?.component

  // Props to pass to page components
  const pageProps = {
    selectedDocId,
    setSelectedDocId,
    setPage,
  }

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <GlobalStyles />
      <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isPortal && <TopBar title={cfg?.title} subtitle={cfg?.subtitle} />}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: "#F6F8F6" }}>
          {Pg && <Pg {...pageProps} />}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return <DataFetcher />
}
