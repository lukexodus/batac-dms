const fs = require('fs');
const lines = fs.readFileSync('src/App.jsx', 'utf-8').split('\n');
const modalsCode = lines.slice(74, 1313).join('\n') + '\n' + lines.slice(1693, 1863).join('\n');
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
  useAddDocument, useAddLegislativeQueue, useUpdateLegislativeQueue, useUpdatePendingSignature, useRemovePendingSignature, useAddSession
} from '../api/queries';
import { Modal, FLabel, FRow, Btn, StatusBadge } from '../components/ui';

`;
let finalCode = header + modalsCode;
finalCode = finalCode.replace(/^const (\w+Modal) = /gm, 'export const $1 = ');
fs.writeFileSync('src/modals/index.jsx', finalCode);
