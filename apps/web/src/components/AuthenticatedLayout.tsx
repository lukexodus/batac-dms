import {
  FileText,
  CheckSquare,
  List,
  Calendar,
  AlertCircle,
  Inbox,
  LayoutDashboard,
  Settings,
  Shield,
  Building,
  Users,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { AppShell, Sidebar, Topbar } from '@batac/ui';

import { hasRole } from '../lib/auth-helpers';

import { IdleWarningModal } from '@/components/IdleWarningModal';
import { useAuthActions } from '@/hooks/useAuthActions';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { SessionLockScreen } from '@/pages/auth/SessionLockScreen';
import { useSessionStore , useShellStore } from '@/stores';

interface BreadcrumbItem {
  label: string;
  href?: string;
}


const ROLE_LABELS: Record<string, string> = {
  sys_admin: 'System Administrator',
  plat_admin: 'Platform Administrator',
  records_officer: 'Records Officer',
  dept_encoder: 'Department Encoder',
  dept_approver: 'Department Approver',
  sp_secretary: 'SP Secretary',
  sp_member: 'SP Member',
  sp_presiding_officer: 'SP Presiding Officer',
  mayor: 'Mayor',
  brgy_encoder: 'Barangay Encoder',
  brgy_captain: 'Barangay Captain',
  auditor: 'Auditor',
  citizen: 'Citizen',
};

const ROLE_PRIORITY = [
  'mayor',
  'sp_secretary',
  'sys_admin',
  'plat_admin',
  'sp_presiding_officer',
  'sp_member',
  'dept_approver',
  'dept_encoder',
  'brgy_captain',
  'brgy_encoder',
  'records_officer',
  'auditor',
  'citizen',
];

export function AuthenticatedLayout() {
  useIdleTimer();
  const identity = useSessionStore((s) => s.identity);
  const isLocked = useSessionStore((s) => s.isLocked);
  const { logout, lock } = useAuthActions();
  const { sidebarCollapsed, toggleSidebar } = useShellStore();
  const location = useLocation();

  const roleCodes = identity?.roleCodes ?? [];

  // 1. Role formatting for Topbar
  const displayRole = useMemo(() => {
    for (const role of ROLE_PRIORITY) {
      if (roleCodes.includes(role)) {
        return ROLE_LABELS[role] || role;
      }
    }
    return roleCodes[0] ? ROLE_LABELS[roleCodes[0]] || roleCodes[0] : 'User';
  }, [roleCodes]);

  const currentUser = {
    name: identity?.username || 'Unknown User',
    role: displayRole,
  };

  // 2. Sidebar Navigation Items
  const navItems = useMemo(() => {
    const items = [];

    // Documents
    if (
      hasRole(
        identity,
        'records_officer',
        'dept_encoder',
        'dept_approver',
        'sp_secretary',
        'sp_member',
        'sp_presiding_officer',
        'mayor',
        'brgy_encoder',
        'brgy_captain',
      )
    ) {
      items.push({ id: 'documents', icon: FileText, label: 'Documents', href: '/documents' });
    }

    // Workflow Steps
    if (
      hasRole(
        identity,
        'dept_encoder',
        'dept_approver',
        'sp_secretary',
        'sp_member',
        'sp_presiding_officer',
        'mayor',
        'brgy_encoder',
        'brgy_captain',
      )
    ) {
      items.push({ id: 'workflow', icon: CheckSquare, label: 'My Tasks', href: '/workflow/steps' });
    }

    // Order of Business
    if (
      hasRole(identity, 'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor', 'auditor')
    ) {
      items.push({
        id: 'order-of-business',
        icon: List,
        label: 'Order of Business',
        href: '/order-of-business',
      });
    }

    // Sessions
    if (hasRole(identity, 'sp_secretary', 'auditor')) {
      items.push({ id: 'sessions', icon: Calendar, label: 'Sessions', href: '/sessions' });
    }

    // Complaints
    if (hasRole(identity, 'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor')) {
      items.push({ id: 'complaints', icon: AlertCircle, label: 'Complaints', href: '/complaints' });
    }

    // Document Requests
    if (
      hasRole(
        identity,
        'sp_secretary',
        'mayor',
        'sp_presiding_officer',
        'sp_member',
        'records_officer',
      )
    ) {
      items.push({
        id: 'document-requests',
        icon: Inbox,
        label: 'Document Requests',
        href: '/document-requests',
      });
    }

    // Organization
    if (hasRole(identity, 'plat_admin', 'records_officer', 'sp_secretary')) {
      items.push({ id: 'organization', icon: Users, label: 'Organization', href: '/organization' });
    }

    // Role-specific Dashboards
    if (hasRole(identity, 'sp_secretary')) {
      items.push({
        id: 'secretary-dashboard',
        icon: LayoutDashboard,
        label: 'Secretary Dashboard',
        href: '/secretary',
      });
    }
    if (hasRole(identity, 'mayor')) {
      items.push({
        id: 'mayor-dashboard',
        icon: LayoutDashboard,
        label: 'Mayor Dashboard',
        href: '/mayor',
      });
    }

    // System/Platform Admin
    if (hasRole(identity, 'sys_admin')) {
      items.push({ id: 'sysadmin', icon: Settings, label: 'System Admin', href: '/sysadmin' });
      items.push({
        id: 'sysadmin-sessions',
        icon: Settings,
        label: 'Active Sessions',
        href: '/sysadmin/sessions',
      });
      items.push({
        id: 'sysadmin-users',
        icon: Users,
        label: 'User Accounts',
        href: '/sysadmin/users',
      });
    }
    if (hasRole(identity, 'plat_admin')) {
      items.push({
        id: 'admin-roles',
        icon: Shield,
        label: 'Role Assignment',
        href: '/admin/roles',
      });
      items.push({
        id: 'admin-committees',
        icon: Building,
        label: 'Committees',
        href: '/admin/committees',
      });
    }

    return items;
  }, [roleCodes]);

  const activeItemId = useMemo(() => {
    const match = [...navItems]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => location.pathname.startsWith(item.href));
    return match?.id || '';
  }, [location.pathname, navItems]);

  // 3. Breadcrumbs Lookups
  // Note: Option A approach. Needs a new entry here whenever a future route is added.
  // Consider Option B (route-context based) if this grows too large.
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const p = location.pathname;

    if (p.startsWith('/admin/committees'))
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Committees', href: '/admin/committees' },
      ];
    if (p.startsWith('/admin/roles'))
      return [
        { label: 'Admin', href: '/admin' },
        { label: 'Role Assignment', href: '/admin/roles' },
      ];
    if (p === '/admin') return [{ label: 'Admin', href: '/admin' }];

    if (p.startsWith('/sysadmin/sessions'))
      return [{ label: 'System Admin', href: '/sysadmin' }, { label: 'Active Sessions' }];
    if (p.startsWith('/sysadmin/users'))
      return [{ label: 'System Admin', href: '/sysadmin' }, { label: 'User Accounts' }];
    if (p.startsWith('/sysadmin')) return [{ label: 'System Admin', href: '/sysadmin' }];

    if (p.startsWith('/organization')) return [{ label: 'Organization', href: '/organization' }];

    if (p.startsWith('/secretary')) return [{ label: 'Secretary Dashboard', href: '/secretary' }];
    if (p.startsWith('/mayor')) return [{ label: 'Mayor Dashboard', href: '/mayor' }];

    if (p.startsWith('/workflow/steps/'))
      return [{ label: 'My Tasks', href: '/workflow/steps' }, { label: 'Step Action' }];
    if (p.startsWith('/workflow/steps')) return [{ label: 'My Tasks', href: '/workflow/steps' }];

    if (p.startsWith('/sessions/'))
      return [{ label: 'Sessions', href: '/sessions' }, { label: 'Attendance Details' }];
    if (p.startsWith('/sessions')) return [{ label: 'Sessions', href: '/sessions' }];

    if (p.startsWith('/order-of-business'))
      return [{ label: 'Order of Business', href: '/order-of-business' }];

    if (p.startsWith('/documents/new'))
      return [{ label: 'Documents', href: '/documents' }, { label: 'New Document' }];
    if (p.startsWith('/documents/'))
      return [{ label: 'Documents', href: '/documents' }, { label: 'Document Details' }];
    if (p.startsWith('/documents')) return [{ label: 'Documents', href: '/documents' }];

    if (p.startsWith('/complaints/new'))
      return [{ label: 'Complaints', href: '/complaints' }, { label: 'New Complaint' }];
    if (p.startsWith('/complaints/'))
      return [{ label: 'Complaints', href: '/complaints' }, { label: 'Complaint Details' }];
    if (p.startsWith('/complaints')) return [{ label: 'Complaints', href: '/complaints' }];

    if (p.startsWith('/document-requests/new'))
      return [{ label: 'Requests', href: '/document-requests' }, { label: 'New Request' }];
    if (p.startsWith('/document-requests/'))
      return [{ label: 'Requests', href: '/document-requests' }, { label: 'Request Details' }];
    if (p.startsWith('/document-requests'))
      return [{ label: 'Requests', href: '/document-requests' }];

    return [{ label: 'Home', href: '/' }];
  }, [location.pathname]);

  return (
    <>
      <AppShell
        sidebarCollapsed={sidebarCollapsed}
        onSidebarToggle={toggleSidebar}
        sidebarContent={
          <Sidebar
            items={navItems}
            activeItemId={activeItemId}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            currentUser={currentUser}
          />
        }
        topbarContent={
          <Topbar
            breadcrumbs={breadcrumbs}
            sidebarCollapsed={sidebarCollapsed}
            currentUser={currentUser}
            notificationCount={0}
            onUserMenuAction={(action) => {
              if (action === 'logout') {
                void logout();
              } else if (action === 'lock') {
                void lock();
              } else if (action === 'profile') {
                // No-op per F1 specification - no profile page exists yet.
              }
            }}
          />
        }
      >
        <Outlet />
      </AppShell>
      {isLocked && <SessionLockScreen />}
      <IdleWarningModal />
    </>
  );
}
