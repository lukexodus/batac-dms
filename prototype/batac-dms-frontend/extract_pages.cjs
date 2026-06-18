const fs = require('fs');
const lines = fs.readFileSync('src/App.jsx', 'utf-8').split('\n');

const pagesCode = lines.slice(74, 1479).join('\n');

const header = `import React, { useState } from 'react';
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

`;

let finalCode = header + pagesCode;
finalCode = finalCode.replace(/^const (\w+Page) = /gm, 'export const $1 = ');
fs.writeFileSync('src/pages/index.jsx', finalCode);
