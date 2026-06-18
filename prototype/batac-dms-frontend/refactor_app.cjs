const fs = require('fs');
const lines = fs.readFileSync('src/App.jsx', 'utf-8').split('\n');

function extractLines(startStr, endStr) {
  const startIdx = lines.findIndex(l => l.includes(startStr));
  let endIdx = -1;
  if (endStr) {
    endIdx = lines.findIndex((l, i) => i > startIdx && l.includes(endStr));
  } else {
    // try to find the next comment block or top-level function
    endIdx = lines.findIndex((l, i) => i > startIdx && (l.startsWith('// ───') || l.startsWith('const ') || l.startsWith('export ')));
  }
  return lines.slice(startIdx, endIdx);
}

// Just copy over everything since I know the exact ranges now.
// Let's find exactly the blocks.

let currentIdx = 0;
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('const ')) {
    const name = lines[i].match(/^const (\w+) =/)?.[1];
    if (name) {
      blocks.push({ name, start: i });
    }
  }
}
for (let i = 0; i < blocks.length; i++) {
  blocks[i].end = i < blocks.length - 1 ? blocks[i+1].start - 1 : lines.length - 1;
}

const modals = [
  "LogDocumentModal", "PrintCoverSheetModal", "UploadDocumentModal", "NewDocumentModal",
  "ReviewDocumentModal", "SignDocumentModal", "ScheduleSessionModal", "OrderOfBusinessModal",
  "LogCommitteeReportModal", "FloorVotingModal"
];
const pages = [
  "KitchenSinkPage", "MayorPage", "SPSecretaryPage", "DTSPage", "WMSPage", "DMSPage", "CitizenPortalPage"
];

let modalsCode = '';
let pagesCode = '';

for (const b of blocks) {
  if (modals.includes(b.name)) {
    modalsCode += lines.slice(b.start, b.end + 1).join('\n') + '\n';
  } else if (pages.includes(b.name)) {
    pagesCode += lines.slice(b.start, b.end + 1).join('\n') + '\n';
  }
}

// write modals
const modalsHeader = `import React, { useState } from 'react';
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

`;
let finalModals = modalsHeader + modalsCode;
finalModals = finalModals.replace(/^const (\w+Modal) = /gm, 'export const $1 = ');
fs.writeFileSync('src/modals/index.jsx', finalModals);

// write pages
const pagesHeader = `import React, { useState } from 'react';
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
} from '../api/queries';

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

import { DEBUG_USER_ROLE } from '../layout';
import {
  mockPendingSignatures, mockSLAData, mockDeptWorkload, mockLegislativeQueue,
  mockSessionCalendar, mockLegislativeOutput, mockRoutingHistory, mockDocuments, publicOrdinances
} from '../data/mockData';

`;
let finalPages = pagesHeader + pagesCode;
finalPages = finalPages.replace(/^const (\w+Page) = /gm, 'export const $1 = ');
fs.writeFileSync('src/pages/index.jsx', finalPages);

// Write clean App.jsx
const appCode = `import { useState } from "react"
import { useQueryClient } from '@tanstack/react-query';
import {
  usePendingSignatures, useSLAData, useDeptWorkload, useLegislativeQueue,
  useSessionCalendar, useLegislativeOutput, useRoutingHistory, useDocuments,
  usePublicOrdinances, useAddDocument, useRemovePendingSignature, useAddSession,
  useAddLegislativeQueue, useUpdateLegislativeQueue, useUpdatePendingSignature
} from './api/queries';

import {
  mockPendingSignatures, mockSLAData, mockDeptWorkload, mockLegislativeQueue,
  mockSessionCalendar, mockLegislativeOutput, mockRoutingHistory, mockDocuments, publicOrdinances
} from './data/mockData';

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
export default function App() {
  return <AppContent />;
};

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
`;
fs.writeFileSync('src/App.jsx', appCode);

console.log('Refactor complete!');
