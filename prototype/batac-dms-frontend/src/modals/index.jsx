import React, { useState } from 'react';
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
  useAddDocument, useAddLegislativeQueue, useUpdateLegislativeQueue, useUpdatePendingSignature, useRemovePendingSignature, useAddSession
} from '../api/queries';
import { Modal, FLabel, FRow, Btn, StatusBadge } from '../components/ui';


export const LogDocumentModal = ({ open, onClose }) => {
  const [step, setStep] = useState(1) // 1 = form, 2 = success
  const [trackingId, setTrackingId] = useState("");
  const addLegislativeQueue = useAddLegislativeQueue();
  const addDocument = useAddDocument();
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

    // 1. Add to the global documents list
    addDocument.mutate({
      id: newId,
      title: form.title || "Untitled Document",
      type: form.docType || "General Document",
      office: form.senderOffice || "External",
      date: form.dateReceived,
      status: "In Workflow",
      classification: form.classification,
      size: "0.1 MB",
      ver: 1,
      submittedBy: form.sender || form.author || "Unknown User",
      daysInQueue: 0
    });

    // 2. Add to legislative queue if applicable
    if (isLegislative) {
      addLegislativeQueue.mutate({
        id: newId,
        title: form.title || "Untitled Document",
        type: form.docType.replace("SP ", "") || "Resolution",
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
export const PrintCoverSheetModal = ({ open, onClose }) => {
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
export const UploadDocumentModal = ({ open, onClose }) => {
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
export const NewDocumentModal = ({ open, onClose }) => {
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
export const ReviewDocumentModal = ({ open, onClose, doc, onSign }) => {
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
export const SignDocumentModal = ({ open, onClose, doc }) => {
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
export const ScheduleSessionModal = ({ open, onClose, queue = [] }) => {
  const { mutateAsync: addSession, isPending } = useAddSession()
  const updateLegislativeQueue = useUpdateLegislativeQueue()
  
  const unscheduledQueue = React.useMemo(() => {
    return queue.filter(item => !item.session || item.session === "TBD");
  }, [queue]);

  const [step, setStep] = useState(1) // 1=details, 2=agenda, 3=success
  const [form, setForm] = useState({
    type: "regular", sessionNo: "42", date: "2026-06-19",
    time: "09:00", venue: "SP Session Hall, City Hall Annex, Batac City",
    notes: "", generateNCH: true,
  })
  const [selectedItems, setSelectedItems] = useState([])
  React.useEffect(() => {
    if (open) setSelectedItems(unscheduledQueue.map(i => i.id));
  }, [open, unscheduledQueue]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleItem = id => setSelectedItems(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const handleClose = () => {
    setStep(1)
    setForm({ type: "regular", sessionNo: "42", date: "2026-06-19", time: "09:00", venue: "SP Session Hall, City Hall Annex, Batac City", notes: "", generateNCH: true })
    setSelectedItems(unscheduledQueue.map(i => i.id))
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
              <p className="text-xs text-gray-500">Select documents to calendar for this session. <span className="font-semibold text-gray-700">{selectedItems.length}</span> of {queue.length} selected.</p>
            </div>
            <button onClick={() => setSelectedItems(s => s.length === unscheduledQueue.length ? [] : unscheduledQueue.map(i => i.id))}
              className="text-xs font-medium brand-text hover:underline">
              {selectedItems.length === unscheduledQueue.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="space-y-2 mb-5">
            {unscheduledQueue.map(item => {
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
            <Btn variant="primary" icon={Calendar} disabled={isPending} onClick={async () => {
              const sessionLabel = form.type === "special" ? "Special Session" : `${form.sessionNo}th Regular Session`;
              await addSession({  date: form.date, day: new Date(form.date).getDate().toString(), title: form.type === "special" ? "Special Session" : "Regular Session", time: form.time, type: form.type, items: selectedItems.length, id: Date.now().toString()  });
              await Promise.all(selectedItems.map(id => updateLegislativeQueue.mutateAsync({ id, session: sessionLabel })));
              setStep(3);
            }}>
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
export const OrderOfBusinessModal = ({ open, onClose, items }) => {
  if (!open) return null;
  const firstReading = items.filter(i => i.status === "For 1st Reading");
  const committee = items.filter(i => i.status === "In Committee");
  const secondReading = items.filter(i => i.status === "For 2nd Reading");
  const thirdReading = items.filter(i => i.status === "3rd Reading");

  const renderList = (list) => {
    if (list.length === 0) return <p className="text-xs text-gray-400 py-2">No items</p>
    return (
      <ul className="space-y-2">
        {list.map(item => (
          <li key={item.id} className="text-sm bg-gray-50 border border-gray-100 rounded p-2">
            <span className="font-mono text-xs text-green-600 mr-2">{item.id}</span>
            <span className="font-medium text-gray-800">{item.title}</span>
            <div className="text-xs text-gray-500 mt-1">{item.type} | {item.author} | {item.committee}</div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Order of Business" subtitle="Generated Session Agenda" width="max-w-3xl">
      <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
        <div>
          <h4 className="font-bold text-gray-900 mb-3 border-b pb-1">I. First Reading & Referral to Committees</h4>
          {renderList(firstReading)}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 mb-3 border-b pb-1">II. Committee Reports</h4>
          {renderList(committee)}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 mb-3 border-b pb-1">III. Second Reading</h4>
          {renderList(secondReading)}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 mb-3 border-b pb-1">IV. Third Reading</h4>
          {renderList(thirdReading)}
        </div>
      </div>
      <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>Close</Btn>
        <Btn variant="primary" icon={Printer} onClick={() => window.alert('Printing...')}>Print Agenda</Btn>
      </div>
    </Modal>
  )
}

export const LogCommitteeReportModal = ({ open, onClose, items, onSave }) => {
  const [selectedId, setSelectedId] = useState("");
  const [outcome, setOutcome] = useState("Approved");
  const [notes, setNotes] = useState("");

  const eligibleItems = items.filter(i => i.status === "In Committee" || i.status === "For 1st Reading");

  const handleSubmit = () => {
    if (!selectedId) return;
    let nextStatus = "For 2nd Reading";
    if (outcome === "Deferred") {
      nextStatus = "In Committee"; // Stays in committee
    }
    onSave({ id: selectedId, status: nextStatus });
    onClose();
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Log Committee Report" subtitle="Record the outcome of a committee hearing">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Select Document</label>
          <select className="w-full border rounded-lg p-2 text-sm" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- Select a document --</option>
            {eligibleItems.map(i => <option key={i.id} value={i.id}>[{i.id}] {i.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Committee Decision</label>
          <select className="w-full border rounded-lg p-2 text-sm" value={outcome} onChange={e => setOutcome(e.target.value)}>
            <option value="Approved">Approved / Recommended</option>
            <option value="Amended">Approved with Amendments</option>
            <option value="Deferred">Deferred</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Remarks</label>
          <textarea className="w-full border rounded-lg p-2 text-sm" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={!selectedId}>Log Report</Btn>
      </div>
    </Modal>
  )
}

export const FloorVotingModal = ({ open, onClose, items, onSave }) => {
  const [selectedId, setSelectedId] = useState("");
  const [vote, setVote] = useState("Approve");

  const eligibleItems = items.filter(i => i.status === "For 2nd Reading" || i.status === "3rd Reading");
  const selectedDoc = eligibleItems.find(i => i.id === selectedId);

  const handleSubmit = () => {
    if (!selectedDoc) return;

    let nextStatus = "Archived"; // Default if rejected

    if (vote === "Approve") {
      if (selectedDoc.type === "Resolution") {
        nextStatus = "VP Certification";
      } else if (selectedDoc.type === "Ordinance") {
        nextStatus = selectedDoc.status === "For 2nd Reading" ? "3rd Reading" : "VP Certification";
      }
    }

    onSave({ id: selectedId, status: nextStatus });
    onClose();
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Record Floor Vote" subtitle="Log the session voting outcome">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Select Document</label>
          <select className="w-full border rounded-lg p-2 text-sm" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- Select a document --</option>
            {eligibleItems.map(i => <option key={i.id} value={i.id}>[{i.status}] {i.id} - {i.title}</option>)}
          </select>
        </div>

        {selectedDoc && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs">
            <span className="font-bold">{selectedDoc.type}</span> currently at <span className="font-bold">{selectedDoc.status}</span>.
            {selectedDoc.type === "Resolution" && vote === "Approve" ? " Will proceed to VP Certification." : ""}
            {selectedDoc.type === "Ordinance" && selectedDoc.status === "For 2nd Reading" && vote === "Approve" ? " Will proceed to 3rd Reading." : ""}
            {selectedDoc.type === "Ordinance" && selectedDoc.status === "3rd Reading" && vote === "Approve" ? " Will proceed to VP Certification." : ""}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Session Vote Outcome</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="vote" value="Approve" checked={vote === "Approve"} onChange={e => setVote(e.target.value)} />
              <span className="text-sm font-medium">Approved</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="vote" value="Reject" checked={vote === "Reject"} onChange={e => setVote(e.target.value)} />
              <span className="text-sm font-medium">Voted Down</span>
            </label>
          </div>
        </div>
      </div>
      <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSubmit} disabled={!selectedId}>Record Vote</Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
