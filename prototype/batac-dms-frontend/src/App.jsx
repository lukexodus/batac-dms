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
  KitchenSinkPage, MayorPage, SPSecretaryPage, DTSPage, WMSPage, DMSPage, CitizenPortalPage
} from './pages';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() { return <AppContent />; }

function AppContent() {
  const queryPage = new URLSearchParams(window.location.search).get("page");
  const [page, setPage] = useState(queryPage || DEBUG_USER_ROLE)
  const [collapsed, setCollapsed] = useState(false)
  const isPortal = page === "portal"

  const renderPage = () => {
    switch (page) {
      case "kitchen": return <KitchenSinkPage />
      case "mayor": return <MayorPage />
      case "sp": return <SPSecretaryPage />
      case "dts": return <DTSPage />
      case "wms": return <WMSPage />
      case "dms": return <DMSPage />
      case "portal": return <CitizenPortalPage />
      default: return <div className="p-6 text-gray-500">Page not found ({page})</div>
    }
  }

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <GlobalStyles />
      {!isPortal && <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!isPortal && <TopBar title="City of Batac" subtitle="Document Tracking System" />}
        <main className="flex-1 overflow-y-auto bg-gray-50/50">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
