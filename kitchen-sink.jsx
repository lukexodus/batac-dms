import React, { useState } from "react";
import {
  LayoutDashboard, FileText, ClipboardList, CalendarDays, Users, MessageSquareWarning,
  BarChart3, Settings, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Bell,
  ChevronRight as BreadcrumbSep, Plus, Flag, Clock, CheckCircle2, XCircle, AlertTriangle,
  Upload, FileCheck2, QrCode, Paperclip, X, Info, AlertCircle, FileSearch, Hash,
  CircleDot, ArrowRight, Download, MoreHorizontal, Filter, SlidersHorizontal,
  ChevronsUpDown, Check, Calendar as CalendarIcon, ArrowLeft
} from "lucide-react";

/* =========================================================================
   MOCK DATA — realistic Batac City SP content
   ========================================================================= */

const COMMITTEES = [
  "Committee on Education, Culture, Science & Technology",
  "Committee on Tourism & Public Information",
  "Committee on Appropriations and Finance & Ways and Means",
  "Committee on Environment, Natural Resources & Climate Change Adaptation & Energy",
  "Committee on Social Welfare Development & Public Service & Calamities",
  "Committee on Women, Children & Family Relations & Indigenous Peoples",
  "Committee on Landed Estates & Assessments",
  "Committee on Human Rights & CSOs",
  "Committee on Games and Amusements",
  "Committee on Good Government/Public Ethics and Accountability",
  "Committee on Health and Sanitation & Public Welfare",
  "Committee on Cooperatives & Livelihood",
  "Committee on Trade, Commerce & Industry",
  "Committee on Transportation and Communication",
  "Committee on Laws, Rules, Ethics & Privileges",
  "Committee on Senior Citizens & NGOs",
  "Committee on Public Works, Infrastructure, Housing & Urban Development",
  "Committee on Agriculture & Food",
  "Committee on Peace and Order & Public Safety & Dangerous Drugs",
  "Committee on Labor, Employment & Civil Service",
  "Committee on Barangay Affairs",
  "Committee on Special Projects & Corporate Affairs",
  "Committee on Youth & Sports Development",
  "Committee on Economic Enterprise, Market & Slaughterhouse",
];

const COUNCILORS = [
  { name: "Atty. Windell D. Chua", role: "City Vice Mayor" },
  { name: "Hon. Bismark Angelo A. Quidang", role: "SP Member" },
  { name: "Hon. Mark Christian R. Chua", role: "SP Member" },
  { name: "Hon. Kichel Jomarie G. Pungtilan", role: "SP Member" },
  { name: "Hon. Violeta Eugenia D. Nalupta", role: "SP Member" },
  { name: "Hon. Lucky Rene G. Bunye", role: "SP Member" },
  { name: "Hon. John Gabrielle Dominique M. Daguio", role: "SP Member" },
  { name: "Hon. Christopher B. Lagmay", role: "SP Member" },
  { name: "Hon. Joel R. Garcia", role: "SP Member" },
  { name: "Hon. Jamie Anne-Marie P. Tanagon", role: "SP Member" },
  { name: "Hon. Avelard Ibarra F. Crisostomo", role: "SP Member" },
  { name: "Hon. Gilbert O. Medina", role: "SP Member, ABC President" },
  { name: "Hon. Reign Gwendia T. Mirasol", role: "SP Member, SK Federation President" },
];

const SECRETARIAT = [
  { name: "Marivic T. Agcaoili", role: "SP Secretary" },
  { name: "Ronald P. Bumanglag", role: "Secretariat Staff" },
  { name: "Hazel Marie D. Sales", role: "Secretariat Staff" },
];

const STATUS_META = {
  DRAFT:               { label: "Draft", cls: "bg-neutral-100 text-neutral-700 border-l-neutral-500" },
  IN_COMMITTEE:        { label: "In Committee", cls: "bg-info-100 text-info-900 border-l-info-500" },
  FIRST_READING:       { label: "First Reading", cls: "bg-info-100 text-info-900 border-l-info-500" },
  SECOND_READING:      { label: "Second Reading", cls: "bg-info-100 text-info-900 border-l-info-500" },
  THIRD_READING:       { label: "Third Reading", cls: "bg-info-100 text-info-900 border-l-info-500" },
  PENDING_MAYOR:       { label: "Pending Mayor", cls: "bg-warning-100 text-warning-900 border-l-warning-500" },
  LAPSED:              { label: "Lapsed into Law", cls: "bg-neutral-100 text-neutral-700 italic border-l-neutral-400" },
  VETOED:              { label: "Vetoed", cls: "bg-danger-100 text-danger-900 border-l-danger-500" },
  OVERRIDE_PENDING:    { label: "Override Pending", cls: "bg-warning-100 text-warning-900 border-l-warning-500" },
  PANLALAWIGAN_REVIEW: { label: "Panlalawigan Review", cls: "bg-warning-100 text-warning-900 border-l-warning-500" },
  VALID:               { label: "Valid", cls: "bg-success-100 text-success-900 border-l-success-500" },
  VALID_IN_PART:       { label: "Valid-in-Part", cls: "bg-warning-100 text-warning-900 border-l-warning-500" },
  RETURNED:            { label: "Returned", cls: "bg-danger-100 text-danger-900 border-l-danger-500" },
  DEEMED_APPROVED:     { label: "Deemed Approved", cls: "bg-success-100 text-success-900 border-l-success-300 italic" },
  ARCHIVED:            { label: "Archived", cls: "bg-neutral-100 text-neutral-500 border-l-neutral-400" },
  CANCELLED:           { label: "Cancelled", cls: "bg-neutral-100 text-neutral-500 line-through border-l-neutral-400" },
  PENDING_HEARING:     { label: "Pending Hearing", cls: "bg-warning-100 text-warning-900 border-l-warning-500" },
  DISMISSED:           { label: "Dismissed", cls: "bg-neutral-100 text-neutral-700 border-l-neutral-500" },
  RESOLVED:            { label: "Resolved", cls: "bg-success-100 text-success-900 border-l-success-500" },
};

const QUEUE_DOCS = [
  {
    id: 1, number: "7SP 2026-001", final: true, type: "Ordinance",
    title: "An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac",
    status: "PENDING_MAYOR", assignedTo: "Marivic T. Agcaoili", sla: { pct: 45, label: "6 days remaining", state: "ok" },
  },
  {
    id: 2, number: "Draft 7SP 2026-014", final: false, type: "Resolution",
    title: "A Resolution Authorizing the City Mayor to Enter Into a Memorandum of Agreement with MMSU on Tourism Development",
    status: "DRAFT", assignedTo: "Ronald P. Bumanglag", sla: null,
  },
  {
    id: 3, number: "7SP 2026-002", final: true, type: "Ordinance",
    title: "An Ordinance Enacting the Updated Revenue Code of the City of Batac, Ilocos Norte",
    status: "PANLALAWIGAN_REVIEW", assignedTo: "Marivic T. Agcaoili", sla: { pct: 86, label: "4 days remaining", state: "risk" },
  },
  {
    id: 4, number: "SPR 2026-038", final: true, type: "Resolution",
    title: "A Resolution Approving the 2026 Gender and Development Programs, Projects and Activities of the LGU",
    status: "VALID", assignedTo: "Hazel Marie D. Sales", sla: null,
  },
  {
    id: 5, number: "7SP 2026-003", final: true, type: "Ordinance",
    title: "An Ordinance Creating the Office of the City Environment and Natural Resources Officer",
    status: "PENDING_MAYOR", assignedTo: "Marivic T. Agcaoili", sla: { pct: 100, label: "1 day overdue", state: "breach" },
  },
  {
    id: 6, number: "SPR 2026-039", final: true, type: "Resolution",
    title: "A Resolution Commending the Achievements of the Batac City Delegation to the R1AA Meet",
    status: "THIRD_READING", assignedTo: "Hazel Marie D. Sales", sla: null,
  },
  {
    id: 7, number: "7SP 2025-08", final: true, type: "Ordinance",
    title: "An Ordinance Institutionalizing the Barangay-District Assignments of SP Members",
    status: "VETOED", assignedTo: "Marivic T. Agcaoili", sla: null,
  },
];

const ACTIVITY_FEED = [
  { actor: "Atty. Windell D. Chua", action: "Signed and transmitted", office: "Office of the Vice Mayor", doc: "7SP 2026-001", time: "2026-06-18 09:15" },
  { actor: "Marivic T. Agcaoili", action: "Routed to Office of the Mayor", office: "SP Secretariat", doc: "7SP 2026-001", time: "2026-06-18 09:02" },
  { actor: "Hon. Jamie Anne-Marie P. Tanagon", action: "Submitted committee report", office: "Committee on Public Works, Infrastructure, Housing & Urban Development", doc: "7SP 2026-003", time: "2026-06-17 16:40" },
  { actor: "Ronald P. Bumanglag", action: "Uploaded scanned document", office: "SP Secretariat", doc: "Draft 7SP 2026-014", time: "2026-06-17 14:22" },
  { actor: "Hazel Marie D. Sales", action: "Logged Panlalawigan transmittal", office: "SP Secretariat", doc: "7SP 2026-002", time: "2026-06-16 11:05" },
];

const ORDER_OF_BUSINESS = [
  { agenda: "OB-01", number: "7SP 2026-004", final: true, title: "An Ordinance Amending Section 12 of the Batac Traffic Code Relative to Tricycle Franchise Fees", committees: ["Transportation and Communication"], reportStatus: "submitted", urgent: false },
  { agenda: "OB-02", number: "7SP 2026-005", final: true, title: "An Ordinance Establishing the City Agriculture Modernization Program", committees: ["Agriculture & Food", "Appropriations and Finance"], reportStatus: "missing", urgent: false },
  { agenda: "OB-03", number: "SPR 2026-040", final: true, title: "A Resolution Authorizing the City Mayor to Sign a MOA with DILG on the SGLG Incentive Fund", committees: ["Appropriations and Finance"], reportStatus: "submitted", urgent: true },
  { agenda: "OB-04", number: "Draft 7SP 2026-015", final: false, title: "A Resolution Confirming the Reappointment of the City Health Officer", committees: ["Health and Sanitation & Public Welfare"], reportStatus: "submitted", urgent: false },
  { agenda: "OB-05", number: "7SP 2026-006", final: true, title: "An Ordinance Creating the City Tourism Office and Defining Its Functions", committees: ["Tourism & Public Information", "Laws, Rules, Ethics & Privileges"], reportStatus: "missing", urgent: false },
];

const STATS = [
  { label: "Pending in Queue", value: "14", icon: ClipboardList, trend: "+3 this week" },
  { label: "Awaiting Mayor", value: "5", icon: Clock, trend: "2 at risk" },
  { label: "Panlalawigan Review", value: "3", icon: FileSearch, trend: "1 at risk" },
  { label: "SLA Breached", value: "1", icon: AlertTriangle, trend: "Action required", danger: true },
];

const NAV_SECTIONS = [
  { items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    title: "Documents",
    items: [
      { key: "resolutions", label: "Resolutions", icon: FileText, indent: true },
      { key: "ordinances", label: "Ordinances", icon: FileText, indent: true },
      { key: "letters", label: "Letters", icon: FileText, indent: true },
      { key: "memos", label: "Memos", icon: FileText, indent: true },
    ],
  },
  {
    items: [
      { key: "workflow", label: "Workflow Queue", icon: ClipboardList, badge: 14 },
      { key: "sessions", label: "Sessions", icon: CalendarDays },
      { key: "committees", label: "Committees", icon: Users },
      { key: "complaints", label: "Complaints", icon: MessageSquareWarning, badge: 2 },
      { key: "reports", label: "Reports", icon: BarChart3 },
    ],
  },
  { items: [{ key: "settings", label: "Settings", icon: Settings }] },
];

/* =========================================================================
   PRIMITIVES — shadcn/ui-style API, styled per DESIGN.md tokens
   ========================================================================= */

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Button({ variant = "primary", size = "md", className = "", children, disabled, loading, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-md transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm",
    icon: "h-9 w-9",
  };
  const variants = {
    primary: "bg-primary-800 text-white hover:bg-primary-900 active:bg-primary-950 shadow-sm",
    secondary: "bg-white text-text-primary border border-border-default hover:bg-neutral-50 active:bg-neutral-100",
    ghost: "bg-transparent text-text-secondary hover:bg-neutral-100 hover:text-text-primary",
    destructive: "bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-900 shadow-sm",
    link: "bg-transparent text-primary-700 hover:text-primary-900 underline-offset-2 hover:underline h-auto px-0",
  };
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
      {children}
    </button>
  );
}

function Card({ className = "", children }) {
  return <div className={cn("bg-white rounded-lg border border-border-default shadow-sm", className)}>{children}</div>;
}
function CardHeader({ className = "", children }) {
  return <div className={cn("px-4 py-3 border-b border-border-subtle flex items-center justify-between", className)}>{children}</div>;
}
function CardTitle({ className = "", children }) {
  return <h3 className={cn("text-sm font-semibold text-text-primary", className)}>{children}</h3>;
}
function CardContent({ className = "", children }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

function Tooltip({ label, children }) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-neutral-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 z-dropdown"
      >
        {label}
      </span>
    </span>
  );
}

function Avatar({ name, size = "md" }) {
  const sizes = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };
  const initials = name.replace(/^(Hon\.|Atty\.)\s*/, "").split(" ").filter(w => w[0] === w[0].toUpperCase()).slice(0, 2).map(w => w[0]).join("");
  return (
    <span className={cn("inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-800 font-semibold shrink-0", sizes[size])}>
      {initials}
    </span>
  );
}

function AvatarName({ name, role, size = "md" }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Avatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text-primary truncate">{name}</span>
        {role && <span className="block text-xs text-text-muted truncate">{role}</span>}
      </span>
    </span>
  );
}

function Separator({ className = "" }) {
  return <div className={cn("h-px bg-border-default", className)} role="separator" />;
}

function Skeleton({ className = "" }) {
  return <div className={cn("animate-pulse bg-neutral-200 rounded", className)} aria-hidden="true" />;
}

function Input({ className = "", error, ...props }) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 disabled:bg-neutral-50 disabled:text-text-disabled disabled:cursor-not-allowed transition-colors",
        error ? "border-danger-500 focus-visible:ring-danger-500" : "border-border-default",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className = "", error, ...props }) {
  return (
    <textarea
      className={cn(
        "flex w-full rounded-md border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700 resize-y min-h-24 transition-colors",
        error ? "border-danger-500 focus-visible:ring-danger-500" : "border-border-default",
        className
      )}
      {...props}
    />
  );
}

function Label({ children, required, className = "" }) {
  return (
    <label className={cn("block text-sm font-medium text-text-primary mb-1.5", className)}>
      {children}
      {required && <span className="text-danger-500 ml-0.5">*</span>}
    </label>
  );
}

function HelperText({ children, error }) {
  return <p className={cn("mt-1.5 text-xs", error ? "text-danger-500 font-medium" : "text-text-muted")}>{children}</p>;
}

function SelectStub({ placeholder, options = [], value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="flex h-10 w-full appearance-none rounded-md border border-border-default bg-white pl-3 pr-9 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronsUpDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
    </div>
  );
}

function MultiSelectStub({ placeholder, selected = [] }) {
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center justify-between rounded-md border border-border-default bg-white px-3 text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
    >
      <span className={selected.length ? "text-text-primary" : "text-text-muted"}>
        {selected.length ? `${selected.length} selected` : placeholder}
      </span>
      <span className="flex items-center gap-2">
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-800 text-xs font-semibold px-1.5 py-0.5 touch-exempt">
            {selected.length}
          </span>
        )}
        <ChevronsUpDown className="h-4 w-4 text-text-muted" />
      </span>
    </button>
  );
}

function DatePickerStub({ value }) {
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center gap-2 rounded-md border border-border-default bg-white px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
    >
      <CalendarIcon className="h-4 w-4 text-text-muted" />
      {value || <span className="text-text-muted">Select date</span>}
    </button>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-border-default" role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={cn(
            "px-3 py-2 text-sm border-b-2 -mb-px transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700",
            active === t
              ? "border-primary-800 text-primary-800 font-semibold"
              : "border-transparent text-text-secondary hover:text-text-primary"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* =========================================================================
   DESIGN-SYSTEM COMPONENTS
   ========================================================================= */

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.DRAFT;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium border-l-2 touch-exempt", meta.cls)}>
      {meta.label}
    </span>
  );
}

function DocNumberBadge({ number, final }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-xs font-medium touch-exempt whitespace-nowrap",
        final
          ? "bg-primary-50 text-primary-800 border border-primary-300 border-l-2 border-l-primary-800"
          : "bg-neutral-50 text-text-secondary border border-dashed border-neutral-400 italic"
      )}
    >
      {number}
    </span>
  );
}

function CertifiedUrgentTag() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-warning-100 text-warning-900 text-[10px] font-bold uppercase tracking-wide touch-exempt">
      <AlertTriangle className="h-3 w-3" />
      Certified Urgent
    </span>
  );
}

function SLATimer({ sla }) {
  if (!sla) return <span className="text-xs text-text-muted">—</span>;
  const colorMap = {
    ok: { bar: "bg-success-500", text: "text-success-500", track: "bg-success-100" },
    risk: { bar: "bg-warning-500", text: "text-warning-500", track: "bg-warning-100" },
    breach: { bar: "bg-danger-500", text: "text-danger-500", track: "bg-danger-100" },
  };
  const c = colorMap[sla.state];
  return (
    <div className="w-32" role="timer" aria-label={`SLA status: ${sla.label}`} aria-live="polite">
      <div className={cn("h-1.5 w-full rounded-full overflow-hidden", c.track)}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", c.bar, sla.state === "breach" && "animate-pulse")}
          style={{ width: `${Math.min(sla.pct, 100)}%` }}
        />
      </div>
      <span className={cn("text-[11px] font-medium mt-0.5 block", c.text)}>{sla.label}</span>
    </div>
  );
}

function WorkflowStepIndicator({ steps, currentIndex }) {
  return (
    <div className="flex items-center" role="list" aria-label="Workflow progress">
      {steps.map((step, i) => {
        const state = i < currentIndex ? "completed" : i === currentIndex ? "active" : step.skipped ? "skipped" : "pending";
        const stateCls = {
          completed: "bg-success-500 text-white",
          active: "bg-primary-800 text-white ring-4 ring-primary-100",
          pending: "bg-neutral-200 text-neutral-500",
          skipped: "bg-neutral-100 text-neutral-400 border border-dashed border-neutral-400",
        }[state];
        return (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center gap-1.5 shrink-0" role="listitem">
              <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0", stateCls)}>
                {state === "completed" ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={cn("text-[11px] text-center w-20 leading-tight", state === "active" ? "font-semibold text-text-primary" : "text-text-muted")}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-0.5 flex-1 mb-5 mx-1 min-w-[16px]", i < currentIndex ? "bg-success-500" : "bg-neutral-200")} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function RoutingHistoryTimeline({ entries }) {
  const dotColor = {
    Transmitted: "bg-info-500", "Routed to": "bg-info-500", Signed: "bg-success-500",
    Submitted: "bg-success-500", Uploaded: "bg-neutral-500", Logged: "bg-neutral-500",
    Returned: "bg-danger-500",
  };
  const getDot = (action) => {
    const key = Object.keys(dotColor).find((k) => action.includes(k));
    return dotColor[key] || "bg-neutral-400";
  };
  return (
    <ol className="relative ml-2">
      {entries.map((e, i) => (
        <li key={i} className="relative pl-6 pb-5 last:pb-0">
          {i < entries.length - 1 && <span className="absolute left-[5px] top-3 bottom-0 w-px bg-border-default" />}
          <span className={cn("absolute left-0 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white", getDot(e.action))} />
          <p className="text-sm text-text-primary">
            <span className="font-medium">{e.actor}</span> · {e.action}
          </p>
          <p className="text-xs text-text-muted">{e.office}</p>
          <p className="text-xs font-mono text-text-muted mt-0.5">{e.time}</p>
        </li>
      ))}
    </ol>
  );
}

function StatCard({ label, value, icon: Icon, trend, danger }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
          <p className={cn("text-3xl font-bold mt-1", danger ? "text-danger-500" : "text-text-primary")}>{value}</p>
          {trend && (
            <p className={cn("text-xs font-medium mt-1", danger ? "text-danger-500" : "text-success-500")}>{trend}</p>
          )}
        </div>
        <div className={cn("h-9 w-9 rounded-md flex items-center justify-center shrink-0", danger ? "bg-danger-100 text-danger-500" : "bg-primary-50 text-primary-700")}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon = FileText, heading, body, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-neutral-400" />
      </div>
      <p className="text-base font-semibold text-text-secondary">{heading}</p>
      <p className="text-sm text-text-muted mt-1 max-w-xs">{body}</p>
      {actionLabel && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onAction}>
          <Plus className="h-3.5 w-3.5" /> {actionLabel}
        </Button>
      )}
    </div>
  );
}

function ScanQualityIndicator({ score }) {
  const level =
    score >= 95 ? { label: "Excellent", cls: "text-success-500", bar: "bg-success-500" } :
    score >= 80 ? { label: "Good", cls: "text-info-500", bar: "bg-info-500" } :
    score >= 60 ? { label: "Fair", cls: "text-warning-500", bar: "bg-warning-500" } :
    { label: "Poor", cls: "text-danger-500", bar: "bg-danger-500" };
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-neutral-200 overflow-hidden">
        <div className={cn("h-full rounded-full", level.bar)} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("text-xs font-medium", level.cls)}>{level.label}</span>
    </div>
  );
}

function QRCodeDisplay({ number, title, compact }) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-1" : "gap-2")} role="img" aria-label={`QR code for document ${number}`}>
      <div className={cn("bg-white border border-border-default rounded-md p-2 grid grid-cols-5 grid-rows-5 gap-0.5", compact ? "w-20 h-20" : "w-32 h-32")}>
        {Array.from({ length: 25 }).map((_, i) => (
          <span key={i} className={cn("rounded-[1px]", [0,1,3,4,5,9,10,14,15,19,20,21,23,24,6,8,12,16,18].includes(i) ? "bg-neutral-900" : "bg-transparent")} />
        ))}
      </div>
      <div>
        <p className="font-mono text-xs font-semibold text-text-primary">{number}</p>
        {!compact && title && <p className="text-[11px] text-text-muted max-w-[140px] line-clamp-2 mt-0.5">{title}</p>}
      </div>
    </div>
  );
}

function DocumentPreviewCard({ doc, onClick }) {
  return (
    <Card className="p-3 hover:shadow-md transition-shadow duration-150 cursor-pointer" onClick={onClick}>
      <div className="w-full aspect-[3/4] bg-neutral-100 rounded mb-3 flex items-center justify-center">
        <FileText className="h-8 w-8 text-neutral-300" />
      </div>
      <DocNumberBadge number={doc.number} final={doc.final} />
      <p className="text-sm font-medium text-text-primary mt-2 line-clamp-2 leading-snug">{doc.title}</p>
      <div className="flex items-center justify-between mt-2">
        <StatusBadge status={doc.status} />
      </div>
    </Card>
  );
}

function OrderOfBusinessRow({ row }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-md border", row.reportStatus === "missing" ? "bg-danger-50 border-danger-200" : "bg-white border-border-subtle")}>
      <span className="font-mono text-xs text-text-muted w-12 shrink-0">{row.agenda}</span>
      <DocNumberBadge number={row.number} final={row.final} />
      <span className="flex-1 min-w-0 text-sm text-text-primary truncate">{row.title}</span>
      {row.urgent && <CertifiedUrgentTag />}
      <span className="hidden md:flex items-center gap-1 shrink-0">
        {row.committees.slice(0, 2).map((c) => (
          <span key={c} className="text-[11px] px-1.5 py-0.5 rounded-sm bg-neutral-100 text-text-secondary whitespace-nowrap">{c.split(" ").slice(0, 2).join(" ")}</span>
        ))}
      </span>
      {row.reportStatus === "missing" ? (
        <Tooltip label="Missing committee report">
          <span className="inline-flex items-center gap-1 text-danger-500 shrink-0">
            <Flag className="h-3.5 w-3.5" aria-label="Missing committee report" />
            <span className="text-xs font-medium hidden sm:inline">Missing report</span>
          </span>
        </Tooltip>
      ) : (
        <span className="inline-flex items-center gap-1 text-success-500 shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs font-medium hidden sm:inline">Report ready</span>
        </span>
      )}
    </div>
  );
}

function CommitteeReferralBlock({ referrals }) {
  const statusCls = {
    submitted: "bg-success-100 text-success-900",
    pending: "bg-warning-100 text-warning-900",
    absent: "bg-neutral-100 text-neutral-700",
  };
  const statusLabel = { submitted: "Submitted", pending: "Pending", absent: "Absent / Not Heard" };
  return (
    <div className="space-y-2">
      {referrals.map((r) => (
        <div key={r.committee} className="flex items-start justify-between gap-3 p-3 rounded-md border border-border-subtle bg-surface-raised">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">{r.committee}</p>
            {r.submittedBy && (
              <p className="text-xs text-text-muted mt-0.5">
                {r.submittedBy} · <span className="font-mono">{r.time}</span>
              </p>
            )}
          </div>
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-sm shrink-0 touch-exempt", statusCls[r.status])}>
            {statusLabel[r.status]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
   APP SHELL
   ========================================================================= */

function Sidebar({ collapsed, onToggle, active, onNavigate }) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-primary-950 flex flex-col z-sticky transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      <div className="h-14 flex items-center gap-2 px-3 border-b border-white/10 shrink-0">
        <div className="h-8 w-8 rounded-full bg-warning-500 flex items-center justify-center shrink-0">
          <span className="text-primary-950 font-bold text-xs">CB</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate leading-tight">CITY OF BATAC</p>
            <p className="text-[10px] text-primary-300 truncate leading-tight">SP Document System</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4" aria-label="Main navigation">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-primary-400 mb-1">{section.title}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md text-sm transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                      item.indent && !collapsed && "pl-7",
                      isActive
                        ? "bg-primary-700 text-white font-semibold border-l-2 border-warning-500"
                        : "text-primary-200 hover:bg-primary-800 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className="text-[10px] font-semibold bg-danger-500 text-white rounded-full px-1.5 py-0.5 touch-exempt min-h-0 min-w-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="h-11 flex items-center justify-center gap-2 text-primary-300 hover:bg-primary-800 hover:text-white border-t border-white/10 text-xs font-medium shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-500"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
      </button>
    </aside>
  );
}

function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-text-muted min-w-0">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-text-disabled" aria-hidden="true">/</span>}
          {i === items.length - 1 ? (
            <span className="text-text-primary font-medium truncate">{item}</span>
          ) : (
            <button className="hover:text-text-primary transition-colors duration-100 truncate">{item}</button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

function Topbar({ sidebarCollapsed, breadcrumb, onOpenCommandPalette }) {
  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-14 bg-white border-b border-border-default flex items-center px-5 gap-4 z-sticky transition-all duration-200",
        sidebarCollapsed ? "left-14" : "left-60"
      )}
    >
      <Breadcrumb items={breadcrumb} />

      <div className="flex-1" />

      <button
        onClick={onOpenCommandPalette}
        className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-md border border-border-default bg-surface-raised text-text-muted text-xs hover:bg-neutral-100 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search or jump to…</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded-sm bg-white border border-border-default text-[10px] font-mono">⌘K</kbd>
      </button>

      <Tooltip label="Notifications">
        <button aria-label="Notifications, 3 unread" className="relative h-9 w-9 flex items-center justify-center rounded-md text-text-secondary hover:bg-neutral-100 hover:text-text-primary transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
        </button>
      </Tooltip>

      <button className="flex items-center gap-2 rounded-md hover:bg-neutral-100 px-1.5 py-1 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700">
        <Avatar name="Marivic T. Agcaoili" size="sm" />
        <span className="hidden md:block text-left">
          <span className="block text-xs font-medium text-text-primary leading-tight">Marivic T. Agcaoili</span>
          <span className="block text-[10px] text-text-muted leading-tight">SP Secretary</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-text-muted hidden md:block" />
      </button>
    </header>
  );
}

function PageHeader({ title, subtitle, primaryAction, secondaryAction }) {
  return (
    <div className="mb-6 pb-4 border-b border-border-default flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {secondaryAction}
        {primaryAction}
      </div>
    </div>
  );
}

/* =========================================================================
   FEEDBACK & OVERLAYS
   ========================================================================= */

function Toast({ variant = "success", title, body, onClose }) {
  const meta = {
    success: { icon: CheckCircle2, cls: "bg-white border-l-success-500", iconCls: "text-success-500" },
    error: { icon: XCircle, cls: "bg-white border-l-danger-500", iconCls: "text-danger-500" },
    warning: { icon: AlertTriangle, cls: "bg-white border-l-warning-500", iconCls: "text-warning-500" },
    info: { icon: Info, cls: "bg-white border-l-info-500", iconCls: "text-info-500" },
  }[variant];
  const Icon = meta.icon;
  return (
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      aria-live={variant === "error" || variant === "warning" ? "assertive" : "polite"}
      className={cn("fixed bottom-5 right-5 z-toast w-80 rounded-md shadow-xl border border-border-default border-l-4 p-3.5 flex items-start gap-3", meta.cls)}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", meta.iconCls)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary mt-0.5">{body}</p>
      </div>
      <button onClick={onClose} aria-label="Dismiss notification" className="text-text-muted hover:text-text-primary shrink-0 touch-exempt">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Alert({ variant = "warning", title, body, icon: IconOverride }) {
  const meta = {
    danger: { icon: AlertTriangle, cls: "bg-danger-100 border-danger-500 text-danger-900" },
    warning: { icon: AlertTriangle, cls: "bg-warning-100 border-warning-500 text-warning-900" },
    info: { icon: Info, cls: "bg-info-100 border-info-500 text-info-900" },
  }[variant];
  const Icon = IconOverride || meta.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-md px-4 py-3 text-sm border-l-4", meta.cls)} role="alert">
      <Icon className="h-4.5 w-4.5 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">{title}</p>
        {body && <p className="text-xs mt-0.5 opacity-90">{body}</p>}
      </div>
    </div>
  );
}

function Dialog({ open, onClose, title, description, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-border-subtle">
          <h2 id="dialog-title" className="text-lg font-semibold text-text-primary">{title}</h2>
          {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
        </div>
        <div className="p-5">{children}</div>
        <div className="p-5 pt-0 flex items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

function Sheet({ open, onClose, title, subtitle, children, widthClass = "w-[480px]" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className={cn("relative bg-white h-full shadow-xl flex flex-col", widthClass, "max-w-full")}>
        <div className="h-14 px-5 flex items-center justify-between border-b border-border-default shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary truncate">{title}</h2>
            {subtitle && <p className="text-xs text-text-muted truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close panel" className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-neutral-100 text-text-secondary shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose }) {
  if (!open) return null;
  const results = [
    { icon: FileText, label: "7SP 2026-001 — Solid Waste Management Ordinance", hint: "Document" },
    { icon: ClipboardList, label: "Workflow Queue", hint: "Module" },
    { icon: CalendarDays, label: "Sessions — Regular Session, 17 June 2026", hint: "Session" },
    { icon: Users, label: "Committee on Appropriations and Finance", hint: "Committee" },
  ];
  return (
    <div className="fixed inset-0 z-modal flex items-start justify-center pt-24 px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="relative bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border-default">
          <Search className="h-4 w-4 text-text-muted" />
          <input autoFocus placeholder="Search documents, sessions, committees…" className="flex-1 text-sm outline-none placeholder:text-text-muted" />
          <kbd className="px-1.5 py-0.5 rounded-sm bg-neutral-100 text-[10px] font-mono text-text-muted">ESC</kbd>
        </div>
        <div className="py-2 max-h-80 overflow-y-auto">
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <button key={i} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 text-left transition-colors duration-100">
                <Icon className="h-4 w-4 text-text-muted shrink-0" />
                <span className="flex-1 text-sm text-text-primary truncate">{r.label}</span>
                <span className="text-[10px] text-text-muted uppercase tracking-wide">{r.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   DATA TABLE — Workflow Queue
   ========================================================================= */

function WorkflowQueueTable({ docs, onRowClick }) {
  const [selected, setSelected] = useState([]);
  const toggleAll = () => setSelected(selected.length === docs.length ? [] : docs.map((d) => d.id));
  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Workflow Queue</CardTitle>
        <div className="flex items-center gap-2">
          <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-neutral-100 text-text-secondary" aria-label="Filter">
            <Filter className="h-3.5 w-3.5" />
          </button>
          <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-neutral-100 text-text-secondary" aria-label="Column settings">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          <Button variant="secondary" size="sm">
            <Plus className="h-3.5 w-3.5" /> Log New
          </Button>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-text-muted font-semibold uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 text-left w-10">
                <input type="checkbox" checked={selected.length === docs.length} onChange={toggleAll} aria-label="Select all rows" className="touch-exempt h-4 w-4 rounded border-border-strong text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700" />
              </th>
              <th className="px-4 py-2.5 text-left">Document No.</th>
              <th className="px-4 py-2.5 text-left">Title</th>
              <th className="px-4 py-2.5 text-left">Type</th>
              <th className="px-4 py-2.5 text-left">
                <span className="inline-flex items-center gap-1 cursor-pointer text-text-primary">Status <ChevronDown className="h-3 w-3" /></span>
              </th>
              <th className="px-4 py-2.5 text-left">Assigned To</th>
              <th className="px-4 py-2.5 text-left">SLA</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr
                key={doc.id}
                className={cn(
                  "border-b border-border-subtle hover:bg-primary-50 transition-colors duration-100 cursor-pointer",
                  selected.includes(doc.id) && "bg-primary-50 border-l-2 border-l-primary-700"
                )}
                onClick={() => onRowClick(doc)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.includes(doc.id)} onChange={() => toggleOne(doc.id)} aria-label={`Select ${doc.number}`} className="touch-exempt h-4 w-4 rounded border-border-strong text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700" />
                </td>
                <td className="px-4 py-3"><DocNumberBadge number={doc.number} final={doc.final} /></td>
                <td className="px-4 py-3 max-w-xs"><span className="truncate block text-text-primary">{doc.title}</span></td>
                <td className="px-4 py-3 text-text-secondary">{doc.type}</td>
                <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                <td className="px-4 py-3"><AvatarName name={doc.assignedTo} size="sm" /></td>
                <td className="px-4 py-3"><SLATimer sla={doc.sla} /></td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Tooltip label="More actions">
                    <button className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-neutral-200 text-text-secondary touch-exempt" aria-label={`Actions for ${doc.number}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </Tooltip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
        <span>Showing 1–{docs.length} of 14 documents</span>
        <div className="flex items-center gap-1">
          <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-neutral-100" aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="px-2 font-medium text-text-primary">1</span>
          <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-neutral-100" aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </Card>
  );
}

/* =========================================================================
   COMPLAINT CARD
   ========================================================================= */

function ComplaintCard() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-mono text-text-muted">CMP 2026-014</p>
          <h4 className="text-sm font-semibold text-text-primary mt-0.5">Noise Disturbance Complaint — Brgy. 5 Cal-laguip</h4>
        </div>
        <StatusBadge status="PENDING_HEARING" />
      </div>
      <Separator className="mb-3" />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-muted">Complainant</p>
          <p className="text-text-primary font-medium">Reynaldo S. Bautista</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Respondent</p>
          <p className="text-text-primary font-medium">Mario D. Valdez</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Hearing Officer</p>
          <p className="text-text-primary font-medium">Hon. Avelard Ibarra F. Crisostomo</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Scheduled Hearing</p>
          <p className="text-text-primary font-medium font-mono">2026-06-25</p>
        </div>
      </div>
      <Separator className="my-3" />
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">Outcome state: <span className="text-text-secondary font-medium">Not yet resolved</span></p>
        <Button variant="ghost" size="sm">View case file <ArrowRight className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );
}

/* =========================================================================
   FORM — Log New Resolution
   ========================================================================= */

function LogResolutionForm() {
  const [titleError, setTitleError] = useState(true);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log New Resolution</CardTitle>
        <span className="text-xs text-text-muted">All fields required unless noted</span>
      </CardHeader>
      <CardContent className="space-y-5">

        <section>
          <div className="border-b border-border-subtle pb-2 mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Document Information</h3>
            <p className="text-xs text-text-muted">Basic identification for this measure</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label required>Document Type</Label>
              <SelectStub placeholder="Select document type" options={["Resolution", "Ordinance", "Letter", "Memo"]} />
            </div>
            <div>
              <Label>Session Date</Label>
              <DatePickerStub value="17 June 2026" />
            </div>
            <div className="sm:col-span-2">
              <Label required>Title</Label>
              <Input
                placeholder="A Resolution Authorizing…"
                error={titleError}
                onChange={(e) => setTitleError(e.target.value.trim().length === 0)}
              />
              {titleError && <HelperText error>This field is required. Please enter a document title.</HelperText>}
            </div>
            <div className="sm:col-span-2">
              <Label required>Sponsors</Label>
              <MultiSelectStub placeholder="Select sponsoring SP Members" selected={["Hon. Tanagon", "Hon. Daguio"]} />
            </div>
          </div>
        </section>

        <section>
          <div className="border-b border-border-subtle pb-2 mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Attachment</h3>
            <p className="text-xs text-text-muted">Upload the signed and scanned measure</p>
          </div>
          <div className="border-2 border-dashed border-border-default rounded-lg p-8 text-center hover:border-primary-500 hover:bg-primary-50 transition-colors duration-150 cursor-pointer">
            <Upload className="h-7 w-7 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-primary font-medium">Drag and drop file here, or click to browse</p>
            <p className="text-xs text-text-muted mt-1">PDF, DOCX, XLSX, PNG, JPG · up to 25MB</p>
          </div>
          <div className="mt-3 flex items-center justify-between p-3 rounded-md border border-border-subtle bg-surface-raised">
            <div className="flex items-center gap-3 min-w-0">
              <FileCheck2 className="h-5 w-5 text-success-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">SPR-2026-014-signed-scan.pdf</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-neutral-100 text-text-secondary">PDF</span>
                  <ScanQualityIndicator score={91} />
                </div>
              </div>
            </div>
            <button aria-label="Remove file" className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-neutral-200 text-text-muted shrink-0 touch-exempt">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        <section>
          <div className="border-b border-border-subtle pb-2 mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Secretariat Remarks</h3>
            <p className="text-xs text-text-muted">Optional routing notes for internal reference</p>
          </div>
          <Label>Remarks</Label>
          <Textarea placeholder="Add any routing notes or context for this measure…" />
        </section>

      </CardContent>
      <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm">Cancel</Button>
        <Button variant="secondary" size="sm">Save Draft</Button>
        <Button variant="primary" size="sm">Submit to Queue</Button>
      </div>
    </Card>
  );
}

/* =========================================================================
   DESIGN SYSTEM SPECIMEN SECTION
   ========================================================================= */

function ColorSwatch({ name, hex, textCls = "text-white" }) {
  return (
    <div className="rounded-md overflow-hidden border border-border-subtle">
      <div className={cn("h-14 flex items-end p-2", textCls)} style={{ backgroundColor: hex }}>
        <span className="text-[10px] font-mono font-medium drop-shadow-sm">{hex}</span>
      </div>
      <div className="px-2 py-1.5 bg-white">
        <span className="text-[11px] text-text-secondary">{name}</span>
      </div>
    </div>
  );
}

function SpecimenSection({ open, onToggle }) {
  const [tab, setTab] = useState("Typography");
  const primaryScale = [
    ["50", "#eef2f9", "text-text-primary"], ["100", "#d5e0f0", "text-text-primary"], ["200", "#adc2e3", "text-text-primary"],
    ["300", "#7d9fd2", "text-white"], ["400", "#527cbf", "text-white"], ["500", "#3560ad", "text-white"],
    ["600", "#274d93", "text-white"], ["700", "#1e3d7a", "text-white"], ["800", "#162e60", "text-white"],
    ["900", "#0e2044", "text-white"], ["950", "#081229", "text-white"],
  ];
  const semantic = [
    ["Success 500", "#10b981"], ["Warning 500", "#f59e0b"], ["Danger 500", "#ef4444"], ["Info 500", "#3b82f6"],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Design System Reference</CardTitle>
        <button onClick={onToggle} className="text-xs font-medium text-primary-700 hover:text-primary-900 flex items-center gap-1">
          {open ? "Collapse" : "Expand"} {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent>
          <Tabs tabs={["Typography", "Colors", "Buttons", "Badges", "SLA Timers"]} active={tab} onChange={setTab} />

          {tab === "Typography" && (
            <div className="space-y-5 pt-5">
              <div>
                <p className="text-2xl font-bold text-text-primary">SP Secretary Dashboard</p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">text-2xl font-bold · Page Heading</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-text-primary">Order of Business — Regular Session, 17 June 2026</p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">text-xl font-semibold · Section Heading</p>
              </div>
              <div>
                <p className="text-base text-text-primary">An Ordinance Providing for the Comprehensive Solid Waste Management Program of the City of Batac.</p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">text-base · Body</p>
              </div>
              <div>
                <p className="text-sm text-text-primary">Transmitted to the Office of the City Mayor on 12 June 2026 at 2:34 PM.</p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">text-sm · Body Small (app default)</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Last updated: 18 June 2026 · 09:15 AM · by Secretariat Staff</p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">text-xs text-text-muted · Caption</p>
              </div>
              <div>
                <p className="font-mono text-xs font-medium text-primary-800">7SP 2026-001</p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">font-mono · Document Number (Final)</p>
              </div>
              <div>
                <p className="font-mono text-xs font-medium italic text-text-secondary">Draft 7SP 2026-002</p>
                <p className="text-[11px] text-text-muted mt-1 font-mono">font-mono italic · Document Number (Preliminary)</p>
              </div>
            </div>
          )}

          {tab === "Colors" && (
            <div className="space-y-6 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Primary — Brand Navy</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-2">
                  {primaryScale.map(([n, hex, txt]) => (
                    <ColorSwatch key={n} name={`primary-${n}`} hex={hex} textCls={txt} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Semantic</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {semantic.map(([n, hex]) => (
                    <ColorSwatch key={n} name={n} hex={hex} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "Buttons" && (
            <div className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link Button</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" loading>Loading</Button>
                <Button variant="primary" disabled>Disabled</Button>
                <Button variant="secondary" size="sm">Small</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </div>
          )}

          {tab === "Badges" && (
            <div className="space-y-5 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Status Badges — All States</p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(STATUS_META).map((k) => <StatusBadge key={k} status={k} />)}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Document Number Variants</p>
                <div className="flex flex-wrap gap-2">
                  <DocNumberBadge number="7SP 2026-001" final />
                  <DocNumberBadge number="SPR 2026-038" final />
                  <DocNumberBadge number="Draft 7SP 2026-002" final={false} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Other Tags</p>
                <CertifiedUrgentTag />
              </div>
            </div>
          )}

          {tab === "SLA Timers" && (
            <div className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center gap-8">
                <div>
                  <SLATimer sla={{ pct: 45, label: "6 days remaining", state: "ok" }} />
                  <p className="text-[11px] text-text-muted mt-2 font-mono">On track</p>
                </div>
                <div>
                  <SLATimer sla={{ pct: 86, label: "1 day remaining", state: "risk" }} />
                  <p className="text-[11px] text-text-muted mt-2 font-mono">At risk (≥80%)</p>
                </div>
                <div>
                  <SLATimer sla={{ pct: 100, label: "2 days overdue", state: "breach" }} />
                  <p className="text-[11px] text-text-muted mt-2 font-mono">Breached</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* =========================================================================
   DOCUMENT DETAIL SHEET CONTENT
   ========================================================================= */

function DocumentDetailContent() {
  const [docTab, setDocTab] = useState("Overview");
  const steps = [
    { label: "First Reading" }, { label: "Committee" }, { label: "Second Reading" },
    { label: "Third Reading" }, { label: "Mayor's Review" }, { label: "Panlalawigan" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <DocNumberBadge number="7SP 2026-002" final />
          <h3 className="text-base font-semibold text-text-primary mt-2 leading-snug">
            An Ordinance Enacting the Updated Revenue Code of the City of Batac, Ilocos Norte
          </h3>
          <div className="mt-2"><StatusBadge status="PANLALAWIGAN_REVIEW" /></div>
        </div>
        <QRCodeDisplay number="7SP 2026-002" compact />
      </div>

      <Separator />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Workflow Progress</p>
        <WorkflowStepIndicator steps={steps} currentIndex={5} />
      </div>

      <Alert variant="warning" title="SLA at risk" body="4 days remaining before the 30-day Panlalawigan review window lapses." />

      <Tabs tabs={["Overview", "Committee Reports", "History", "Attachments"]} active={docTab} onChange={setDocTab} />

      {docTab === "Overview" && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-text-muted">Sponsors</p><p className="text-text-primary font-medium">Hon. Mark Christian R. Chua</p></div>
          <div><p className="text-xs text-text-muted">Session Date</p><p className="text-text-primary font-medium font-mono">2026-05-26</p></div>
          <div><p className="text-xs text-text-muted">Adopted</p><p className="text-text-primary font-medium font-mono">2026-06-02</p></div>
          <div><p className="text-xs text-text-muted">Transmitted to Panlalawigan</p><p className="text-text-primary font-medium font-mono">2026-06-09</p></div>
        </div>
      )}

      {docTab === "Committee Reports" && (
        <CommitteeReferralBlock
          referrals={[
            { committee: "Committee on Appropriations and Finance & Ways and Means", status: "submitted", submittedBy: "Hon. Mark Christian R. Chua", time: "2026-05-30 10:12" },
            { committee: "Committee on Trade, Commerce & Industry", status: "pending" },
          ]}
        />
      )}

      {docTab === "History" && <RoutingHistoryTimeline entries={ACTIVITY_FEED.slice(0, 4)} />}

      {docTab === "Attachments" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-md border border-border-subtle">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="h-4 w-4 text-text-muted shrink-0" />
              <span className="text-sm text-text-primary truncate">7SP-2026-002-signed.pdf</span>
            </div>
            <ScanQualityIndicator score={97} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-md border border-border-subtle">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="h-4 w-4 text-text-muted shrink-0" />
              <span className="text-sm text-text-primary truncate">revenue-code-annex-a.xlsx</span>
            </div>
            <ScanQualityIndicator score={72} />
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   MAIN APP
   ========================================================================= */

export default function BatacDMSKitchenSink() {
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);
  const [specimenOpen, setSpecimenOpen] = useState(false);
  const [comment, setComment] = useState("");

  return (
    <div className="min-h-screen bg-surface-raised font-sans text-text-primary" style={{
      "--color-primary-50": "#eef2f9", "--color-primary-100": "#d5e0f0", "--color-primary-800": "#162e60",
    }}>
      <style>{`
        .bg-primary-50{background-color:#eef2f9}.bg-primary-100{background-color:#d5e0f0}.bg-primary-200{background-color:#adc2e3}
        .bg-primary-700{background-color:#1e3d7a}.bg-primary-800{background-color:#162e60}.bg-primary-900{background-color:#0e2044}
        .bg-primary-950{background-color:#081229}.hover\\:bg-primary-50:hover{background-color:#eef2f9}.hover\\:bg-primary-800:hover{background-color:#162e60}
        .hover\\:bg-primary-900:hover{background-color:#0e2044}.active\\:bg-primary-900:active{background-color:#0e2044}
        .active\\:bg-primary-950:active{background-color:#081229}.text-primary-200{color:#adc2e3}.text-primary-300{color:#7d9fd2}
        .text-primary-400{color:#527cbf}.text-primary-700{color:#1e3d7a}.text-primary-800{color:#162e60}.text-primary-900{color:#0e2044}
        .hover\\:text-primary-900:hover{color:#0e2044}.border-primary-300{border-color:#7d9fd2}.border-l-primary-700{border-left-color:#1e3d7a}
        .border-l-primary-800{border-left-color:#162e60}.ring-primary-100{--tw-ring-color:#eef2f9}.outline-primary-700{outline-color:#1e3d7a}
        .outline-warning-500{outline-color:#f59e0b}.focus-visible\\:ring-primary-700:focus-visible{--tw-ring-color:#1e3d7a}
        .bg-neutral-50{background-color:#f8f9fa}.bg-neutral-100{background-color:#f1f3f5}.bg-neutral-200{background-color:#e9ecef}
        .hover\\:bg-neutral-50:hover{background-color:#f8f9fa}.hover\\:bg-neutral-100:hover{background-color:#f1f3f5}
        .hover\\:bg-neutral-200:hover{background-color:#e9ecef}.active\\:bg-neutral-100:active{background-color:#f1f3f5}
        .text-neutral-300{color:#dee2e6}.text-neutral-400{color:#ced4da}.text-neutral-500{color:#adb5bd}.text-neutral-700{color:#495057}
        .border-neutral-400{border-color:#ced4da}.bg-success-100{background-color:#d1fae5}.text-success-500{color:#10b981}
        .text-success-900{color:#064e3b}.bg-success-500{background-color:#10b981}.border-l-success-500{border-left-color:#10b981}
        .border-l-success-300{border-left-color:#6ee7b7}.bg-warning-100{background-color:#fef3c7}.text-warning-500{color:#f59e0b}
        .text-warning-900{color:#78350f}.bg-warning-500{background-color:#f59e0b}.border-l-warning-500{border-left-color:#f59e0b}
        .border-warning-500{border-color:#f59e0b}.bg-danger-50{background-color:#fef2f2}.bg-danger-100{background-color:#fee2e2}
        .text-danger-500{color:#ef4444}.text-danger-700{color:#b91c1c}.text-danger-900{color:#7f1d1d}.bg-danger-500{background-color:#ef4444}
        .hover\\:bg-danger-700:hover{background-color:#b91c1c}.active\\:bg-danger-900:active{background-color:#7f1d1d}
        .border-l-danger-500{border-left-color:#ef4444}.border-danger-200{border-color:#fecaca}.border-danger-500{border-color:#ef4444}
        .focus-visible\\:ring-danger-500:focus-visible{--tw-ring-color:#ef4444}.bg-info-100{background-color:#dbeafe}
        .text-info-500{color:#3b82f6}.text-info-900{color:#1e3a8a}.bg-info-500{background-color:#3b82f6}
        .border-l-info-500{border-left-color:#3b82f6}.bg-surface-raised{background-color:#f8f9fa}.text-text-primary{color:#212529}
        .text-text-secondary{color:#495057}.text-text-muted{color:#868e96}.text-text-disabled{color:#ced4da}
        .border-border-default{border-color:#dee2e6}.border-border-subtle{border-color:#e9ecef}.border-border-strong{border-color:#ced4da}
        .bg-warning-100{background-color:#fef3c7}
        .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .z-sticky{z-index:100}.z-dropdown{z-index:200}.z-modal{z-index:300}.z-toast{z-index:400}
        *{scrollbar-width:thin}
        @media (prefers-reduced-motion: reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
      `}</style>

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} active="dashboard" onNavigate={() => {}} />
      <Topbar
        sidebarCollapsed={collapsed}
        breadcrumb={["Home", "Dashboard"]}
        onOpenCommandPalette={() => setPaletteOpen(true)}
      />

      <main className={cn("transition-all duration-200 pt-14", collapsed ? "ml-14" : "ml-60")}>
        <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

          <PageHeader
            title="SP Secretary Dashboard"
            subtitle="Overview of pending legislative measures, sessions, and SLA status"
            primaryAction={<Button variant="primary" size="sm"><Plus className="h-3.5 w-3.5" /> Log New Document</Button>}
            secondaryAction={<Button variant="secondary" size="sm"><Download className="h-3.5 w-3.5" /> Export</Button>}
          />

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Order of Business */}
          <Card>
            <CardHeader>
              <CardTitle>Order of Business — Regular Session, 23 June 2026</CardTitle>
              <Button variant="ghost" size="sm">View Full Agenda <ArrowRight className="h-3.5 w-3.5" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {ORDER_OF_BUSINESS.map((row) => <OrderOfBusinessRow key={row.agenda} row={row} />)}
            </CardContent>
          </Card>

          {/* Workflow queue table */}
          <WorkflowQueueTable docs={QUEUE_DOCS} onRowClick={() => setSheetOpen(true)} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Activity feed */}
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
              <CardContent>
                <RoutingHistoryTimeline entries={ACTIVITY_FEED} />
              </CardContent>
            </Card>

            {/* Complaint card */}
            <div className="lg:col-span-2 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Pending Complaint</p>
              <ComplaintCard />
            </div>
          </div>

          {/* SLA breach alert (standalone, persistent) */}
          <Alert
            variant="danger"
            title="SLA breached: 7SP 2026-003"
            body="The 10-day Mayor's review window lapsed 1 day ago. Ordinance creating the Office of the City Environment and Natural Resources Officer requires immediate routing confirmation."
          />

          {/* Form example */}
          <LogResolutionForm />

          {/* Document preview cards row */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Document Library — Recent</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {QUEUE_DOCS.slice(0, 5).map((d) => (
                <DocumentPreviewCard key={d.id} doc={d} onClick={() => setSheetOpen(true)} />
              ))}
            </div>
          </div>

          {/* Empty state demo */}
          <Card>
            <CardContent>
              <EmptyState
                icon={ClipboardList}
                heading="No archived documents this quarter"
                body="Documents move here automatically once fully enacted and beyond the retention review period."
                actionLabel="Browse Archive"
              />
            </CardContent>
          </Card>

          {/* Skeleton loading demo */}
          <Card>
            <CardHeader><CardTitle>Loading State Example</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
              </div>
            </CardContent>
          </Card>

          {/* Specimen / design system reference section */}
          <SpecimenSection open={specimenOpen} onToggle={() => setSpecimenOpen((o) => !o)} />

        </div>
      </main>

      {/* Document detail sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Document Detail"
        subtitle="7SP 2026-002"
      >
        <DocumentDetailContent />
      </Sheet>

      {/* Confirm workflow advance dialog with mandatory comment */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Confirm Workflow Advance"
        description="Advancing 7SP 2026-001 from Pending Mayor to Lapsed into Law. This action will be logged and cannot be undone."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" disabled={comment.trim().length === 0}>
              Confirm Advance
            </Button>
          </>
        }
      >
        <Label required>Remarks (required for manual override)</Label>
        <Textarea
          placeholder="Explain the reason for this manual workflow advance…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        {comment.trim().length === 0 && (
          <HelperText error>A comment is required before this action can be confirmed.</HelperText>
        )}
      </Dialog>

      {/* Command palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Toast notification */}
      {toastVisible && (
        <Toast
          variant="success"
          title="Workflow step completed"
          body="7SP 2026-001 was successfully transmitted to the Office of the Mayor."
          onClose={() => setToastVisible(false)}
        />
      )}
    </div>
  );
}
