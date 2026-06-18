import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

import {
  usePendingSignatures, useSLAData, useDeptWorkload, useLegislativeQueue,
  useSessionCalendar, useLegislativeOutput, useRoutingHistory, useDocuments,
  usePublicOrdinances, useAddDocument, useRemovePendingSignature, useAddSession,
  useAddLegislativeQueue, useUpdateLegislativeQueue, useUpdatePendingSignature
} from '../hooks/use-documents';

import {
  StatusBadge, ClassificationBadge, PriorityTag, Btn, StatCard,
  SectionHdr, PageHdr, Modal, FLabel, FRow
} from '../components/ui';

import {
  LogDocumentModal, PrintCoverSheetModal, UploadDocumentModal,
  NewDocumentModal, ReviewDocumentModal, SignDocumentModal,
  ScheduleSessionModal, OrderOfBusinessModal, LogCommitteeReportModal,
  FloorVotingModal
} from '../modals';

import { CitySealOfficial, QRDisplay } from '../layout';




export const KitchenSinkPage = () => (
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
export const MayorPage = () => {
  const { data: pendingSignatures = [] } = usePendingSignatures();
  const { data: slaData = [] } = useSLAData();
  const { data: deptWorkload = [] } = useDeptWorkload();

  const queryClient = useQueryClient()
  const [timeFilter, setTimeFilter] = useState("year")
  const { data: documents = [] } = useDocuments()

  const pendingCount = pendingSignatures.length;
  const overdueDocs = pendingSignatures.filter(d => d.priority === "overdue");
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
            {pendingSignatures.map((doc, i) => (
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
// SP Secretary Modals
// ─────────────────────────────────────────────────────────────────────────────

export const SPSecretaryPage = () => {
  const [showLogDoc, setShowLogDoc] = useState(false)
  const [showScheduleSession, setShowScheduleSession] = useState(false)
  const [showOrderOfBusiness, setShowOrderOfBusiness] = useState(false)
  const [showCommitteeReport, setShowCommitteeReport] = useState(false)
  const [showFloorVote, setShowFloorVote] = useState(false)

  // Use dynamic queries
  const { data: legislativeQueue = [] } = useLegislativeQueue();
  const updateLegislativeQueue = useUpdateLegislativeQueue();
  const { data: sessionCalendar = [] } = useSessionCalendar();
  const { data: legislativeOutput = [] } = useLegislativeOutput();

  // Dynamic calculations for SP Secretary Dashboard
  const activeQueueCount = legislativeQueue.filter(i => !["Completed", "Archived"].includes(i.status)).length;

  const nextSession = sessionCalendar.length > 0 ? sessionCalendar[0] : null;
  const nextSessionItems = nextSession ? nextSession.items : 0;
  const nextSessionDate = nextSession ? nextSession.date : "TBD";

  const latestOutput = legislativeOutput.length > 0 ? legislativeOutput[legislativeOutput.length - 1] : { resolutions: 0, ordinances: 0 };
  const approvedThisMonth = latestOutput.resolutions + latestOutput.ordinances;

  const forMayorReview = legislativeQueue.filter(i => i.status === "VP Certification").length;

  return (
    <div className="p-6">
      <LogDocumentModal open={showLogDoc} onClose={() => setShowLogDoc(false)} />
      <ScheduleSessionModal open={showScheduleSession} onClose={() => setShowScheduleSession(false)} queue={legislativeQueue} />
      <OrderOfBusinessModal open={showOrderOfBusiness} onClose={() => setShowOrderOfBusiness(false)} items={legislativeQueue} />
      <LogCommitteeReportModal open={showCommitteeReport} onClose={() => setShowCommitteeReport(false)} items={legislativeQueue} onSave={updateLegislativeQueue.mutate} />
      <FloorVotingModal open={showFloorVote} onClose={() => setShowFloorVote(false)} items={legislativeQueue} onSave={updateLegislativeQueue.mutate} />
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
                {legislativeQueue.map((item, i) => (
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
              {sessionCalendar.map((s, i) => (
                <div key={i} onClick={() => setShowOrderOfBusiness(true)} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:shadow-sm transition-all ${s.type === "special" ? "bg-amber-50 border border-amber-200 hover:border-amber-300" : "border border-green-100 hover:border-green-300"}`} style={s.type === "regular" ? { backgroundColor: "#F0FAF4" } : {}}>
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
                [FileText, "Log Committee Report", () => setShowCommitteeReport(true)],
                [Archive, "Record Floor Vote", () => setShowFloorVote(true)],
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
          <BarChart data={legislativeOutput} barSize={20} margin={{ top: 2, right: 10, left: -20, bottom: 0 }}>
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
export const DTSPage = () => {
  const { data: documents = [] } = useDocuments();
  const { data: routingHistory = [] } = useRoutingHistory();

  const [showPrint, setShowPrint] = useState(false)
  const targetDocId = new URLSearchParams(window.location.search).get("docId");
  const doc = documents.find(d => d.id === targetDocId) || documents[0];

  if (!doc) {
    return <div className="p-6 text-center text-gray-500 mt-10">No document found. Please wait or select a valid document.</div>;
  }

  let timelineSteps = 1;
  if (["Pending Approval", "In Committee", "For 1st Reading", "Endorsed"].includes(doc.status)) timelineSteps = 2;
  if (["Approved", "Fund Certified", "VP Certification"].includes(doc.status)) timelineSteps = 3;
  if (["Released", "Completed", "Archived"].includes(doc.status)) timelineSteps = 4;

  const dynamicRoutingHistory = routingHistory.slice(0, timelineSteps).map((entry, i) => {
    const isLast = i === timelineSteps - 1;
    const isDone = ["Released", "Completed", "Archived"].includes(doc.status);
    return {
      ...entry,
      detail: entry.detail.replace(/Purchase Request/g, doc.type).replace(/Leave Application/g, doc.type),
      status: (isLast && !isDone) ? "current" : "done",
      timestamp: i === 0 ? (doc.date || entry.timestamp) : ((isLast && !isDone) ? "Pending..." : entry.timestamp)
    };
  });

  if (doc.status === "Rejected") {
    dynamicRoutingHistory.push({
      id: "reject-step",
      office: "Reviewing Office",
      action: "Rejected / Returned",
      detail: "Document was rejected and returned to originator.",
      timestamp: "Pending...",
      status: "current",
      user: "System",
      role: "Reviewer"
    });
  }

  return (
    <div className="p-6">
      <PrintCoverSheetModal open={showPrint} onClose={() => setShowPrint(false)} document={doc} />
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
                <p className="text-base font-semibold text-gray-900 mb-0.5">{doc.type} — Version {doc.ver || 1}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{doc.title}</p>
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                  {[["Type", doc.type], ["Office", doc.office], ["Created", doc.date], ["Released", ["Released", "Completed", "Archived"].includes(doc.status) ? "Yes" : "—"]].map(([k, v]) => (
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
              {dynamicRoutingHistory.map((entry, i) => (
                <div key={entry.id} className="flex gap-4">
                  {/* Spine */}
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 flex-shrink-0 ${entry.status === "current" ? "border-green-500 text-white" : "bg-white border-green-400"}`}
                      style={entry.status === "current" ? { backgroundColor: "#00A651" } : {}}>
                      {entry.status === "current"
                        ? <Clock size={13} className="text-white" />
                        : <Check size={13} className="text-green-600" />}
                    </div>
                    {i < dynamicRoutingHistory.length - 1 && (
                      <div className="w-0.5 flex-1 mt-0" style={{ backgroundColor: "#bbf7d0", minHeight: 24 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 mb-4 ${i === dynamicRoutingHistory.length - 1 ? "mb-0" : ""}`}>
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
                ["Classification", <ClassificationBadge level={doc.classification || "Internal"} />],
                ["Owning Office", doc.office],
                ["Retention Policy", "Permanent Record"],
                ["Current Custodian", ["Released", "Completed"].includes(doc.status) ? "Records Officer" : doc.office],
                ["Physical Custody", ["Released", "Completed"].includes(doc.status) ? <span className="text-xs text-green-700 font-medium flex items-center gap-1"><CheckCircle size={12} />Records Archive Room</span> : <span className="text-xs text-amber-700 font-medium flex items-center gap-1"><Clock size={12} />In Transit / Office</span>],
                ["Total Transit Time", doc.daysInQueue ? `${doc.daysInQueue} calendar days` : "Just logged"],
                ["Total Steps", `${dynamicRoutingHistory.length} workflow steps`],
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
export const WMSPage = () => {
  const { data: documents = [] } = useDocuments();
  const { data: routingHistory = [] } = useRoutingHistory();
  const { data: pendingSignatures = [] } = usePendingSignatures();
  const { data: legislativeQueue = [] } = useLegislativeQueue();

  const [action, setAction] = useState(null)
  const [comment, setComment] = useState("")
  const [done, setDone] = useState(false)

  const targetDocId = new URLSearchParams(window.location.search).get("docId");
  const doc = pendingSignatures.find(d => d.id === targetDocId) ||
    legislativeQueue.find(d => d.id === targetDocId) ||
    documents.find(d => d.id === targetDocId) || pendingSignatures[0] || legislativeQueue[0] || documents[0];

  if (!doc) {
    return <div className="p-6 text-center text-gray-500 mt-10">No pending document found for approval. Please wait or select a valid document.</div>;
  }

  const removePendingSignature = useRemovePendingSignature();
  const updatePendingSignature = useUpdatePendingSignature();
  const updateLegislativeQueue = useUpdateLegislativeQueue();

  const handleSubmit = () => {
    if ((action === "reject" || action === "return") && !comment.trim()) return

    const isPendingSig = pendingSignatures.some(d => d.id === doc.id);
    const isLegQueue = legislativeQueue.some(d => d.id === doc.id);

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
export const DMSPage = () => {
  const { data: documents = [] } = useDocuments();

  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState({ type: "All Types", office: "All Offices", status: "All Statuses", classification: "All" })
  const [showUpload, setShowUpload] = useState(false)
  const [showNewDoc, setShowNewDoc] = useState(false)

  const filtered = documents.filter(d => {
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
        <p className="text-sm text-gray-500">Showing <span className="font-semibold text-gray-800">{filtered.length}</span> of {documents.length} documents</p>
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
                  ["Document Identifier", ""],
                  ["Type", "whitespace-nowrap"],
                  ["Office", "whitespace-nowrap"],
                  ["Date", "whitespace-nowrap"],
                  ["Status", "whitespace-nowrap"],
                  ["Classification", "whitespace-nowrap"],
                  ["Actions", "whitespace-nowrap"],
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
                  <td colSpan={7} className="text-center py-16">
                    <Search size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No documents match your filters</p>
                    <button className="mt-2 text-xs brand-text hover:underline" onClick={() => { setSearch(""); setFilters({ type: "All Types", office: "All Offices", status: "All Statuses", classification: "All" }) }}>Clear all filters</button>
                  </td>
                </tr>
              ) : filtered.map((doc, i) => (
                <tr key={doc.id} className={`hover:bg-gray-50 cursor-pointer transition-colors group ${i !== filtered.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <td className="px-4 py-3.5" style={{ maxWidth: 300 }}>
                    <p className="text-sm font-bold text-gray-900 truncate mb-0.5" title={doc.title}>{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">{doc.id}</span>
                      <span className="text-gray-400">v{doc.ver} · {doc.size}</span>
                    </div>
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
                      {[[Eye, "View"], [Activity, "Track"], [Download, "Download"], [MoreHorizontal, "More"]].map(([Icon, title]) => (
                        <button key={title} title={title} onClick={() => title === "Track" ? window.open("?page=dts&docId=" + doc.id, "_blank") : null} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
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
export const CitizenPortalPage = () => {
  const { data: publicOrdinances = [] } = usePublicOrdinances();
  const { data: documents = [] } = useDocuments();

  const [tab, setTab] = useState("track")
  const [query, setQuery] = useState("")
  const [result, setResult] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const handleTrack = () => {
    if (query.trim()) {
      const found = documents.find(d => d.id === query.trim().toUpperCase());
      setResult(found || { notFound: true });
    }
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

            {result && !result.notFound && (
              <div className="bg-white rounded-xl border border-green-200 p-6 mb-5" style={{ borderColor: "#00A651" }}>
                <div className="flex items-start gap-4">
                  <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-base font-bold text-gray-900">{result.title}</p>
                    <p className="font-mono text-xs text-gray-400 mt-0.5">{result.id}</p>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      {[["Current Status", <StatusBadge status={result.status} />], ["Current Office", result.office], ["Date Logged", result.date]].map(([k, v]) => (
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
            {result && result.notFound && (
              <div className="text-center py-12 text-gray-500">
                <AlertCircle size={36} className="mx-auto mb-3 text-red-400 opacity-80" />
                <p className="text-sm font-medium">Tracking number not found</p>
                <p className="text-xs mt-1">Please check the number and try again.</p>
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

export const LoginRegisterPage = () => {
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
                  className={`flex-1 py-2 px-3 rounded-md font-medium text-sm transition-colors ${mode === m.id
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
