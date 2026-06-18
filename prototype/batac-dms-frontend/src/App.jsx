import { useState } from "react"
import { useQueryClient } from '@tanstack/react-query';
import {
  usePendingSignatures, useSLAData, useDeptWorkload, useLegislativeQueue,
  useSessionCalendar, useLegislativeOutput, useRoutingHistory, useDocuments,
  usePublicOrdinances, useAddDocument, useRemovePendingSignature, useAddSession,
  useAddLegislativeQueue, useUpdateLegislativeQueue, useUpdatePendingSignature
} from './api/queries';



import {
  StatusBadge, ClassificationBadge, PriorityTag, Btn, StatCard,
  SectionHdr, PageHdr, Modal, FLabel, FRow
} from './components/ui';

import {
  GlobalStyles, CitySeal, CitySealOfficial, QRDisplay, DEBUG_USER_ROLE, Sidebar, TopBar
} from './layout';

import {
  LogDocumentModal, PrintCoverSheetModal, UploadDocumentModal,
  NewDocumentModal, ReviewDocumentModal, SignDocumentModal,
  ScheduleSessionModal, OrderOfBusinessModal, LogCommitteeReportModal,
  FloorVotingModal
} from './modals';

import {
  KitchenSinkPage, MayorPage, SPSecretaryPage, DTSPage, WMSPage, DMSPage, CitizenPortalPage, LoginRegisterPage
} from './pages';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() { return <AppContent />; }

function AppContent() {
  const queryPage = new URLSearchParams(window.location.search).get("page");
  const [page, setPage] = useState(queryPage || DEBUG_USER_ROLE)
  const [collapsed, setCollapsed] = useState(false)
  const isFullscreen = page === "portal" || page === "login"

  const pages = {
    kitchen:  { component: KitchenSinkPage,   title: "Design System",          subtitle: "Component Library & Design Tokens v0.1" },
    mayor:    { component: MayorPage,         title: "Mayor's Dashboard",      subtitle: "Executive Operations Overview" },
    sp:       { component: SPSecretaryPage,   title: "SP Secretary's Dashboard",subtitle: "Sangguniang Panlungsod Legislative Workflow" },
    dts:      { component: DTSPage,           title: "Document Tracking",      subtitle: "Complete Routing History" },
    wms:      { component: WMSPage,           title: "Approval Interface",     subtitle: "WMS - Document Review & Action" },
    dms:      { component: DMSPage,           title: "Document Repository",    subtitle: "DMS - Internal Document Search & Management" },
    portal:   { component: CitizenPortalPage, title: "Citizen Portal",         subtitle: "Public Access" },
    login:    { component: LoginRegisterPage, title: "Login / Register",       subtitle: "Authentication Portal" },
  }

  const cfg = pages[page] || {}
  const PageComponent = cfg.component

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <GlobalStyles />
      {!isFullscreen && <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isFullscreen && <TopBar title={cfg.title || "City of Batac"} subtitle={cfg.subtitle || "Document Tracking System"} />}
        <main className="flex-1 overflow-y-auto bg-gray-50/50">
          {PageComponent ? <PageComponent /> : <div className="p-6 text-gray-500">Page not found ({page})</div>}
        </main>
      </div>
    </div>
  )
}
