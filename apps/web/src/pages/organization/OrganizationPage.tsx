import {
  Building2,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  Users,
  UserPlus,
  Briefcase,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';

import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@batac/ui';

import { useAuth } from '../../lib/auth-context';
import { trpc } from '../../lib/trpc';


// ─── Types ────────────────────────────────────────────────────────────────────

interface OfficeSummary {
  officeId: string;
  name: string;
  parentOfficeId: string | null;
  type: 'executive' | 'legislative' | 'department' | 'barangay' | 'external';
}

interface OfficeNode extends OfficeSummary {
  children: OfficeNode[];
}

type OfficeType = 'executive' | 'legislative' | 'department' | 'barangay' | 'external';
type AuthorityLevel = 'executive' | 'managerial' | 'staff' | 'support';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(offices: OfficeSummary[]): OfficeNode[] {
  const map = new Map<string, OfficeNode>();
  for (const o of offices) {
    map.set(o.officeId, { ...o, children: [] });
  }
  const roots: OfficeNode[] = [];
  for (const node of map.values()) {
    if (!node.parentOfficeId) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentOfficeId);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan — treat as root
    }
  }
  return roots;
}

const OFFICE_TYPE_BADGE_CLASS: Record<OfficeType, string> = {
  executive: 'bg-blue-100 text-blue-800',
  legislative: 'bg-purple-100 text-purple-800',
  department: 'bg-green-100 text-green-800',
  barangay: 'bg-amber-100 text-amber-800',
  external: 'bg-slate-100 text-slate-800',
};

const OFFICE_TYPE_LABELS: Record<OfficeType, string> = {
  executive: 'Executive',
  legislative: 'Legislative',
  department: 'Department',
  barangay: 'Barangay',
  external: 'External',
};

// ─── OfficeTreeNode ────────────────────────────────────────────────────────────

interface OfficeTreeNodeProps {
  node: OfficeNode;
  isPlatAdmin: boolean;
  onEditOffice: (o: OfficeSummary) => void;
  onDeactivateOffice: (o: OfficeSummary) => void;
  onAddPosition: (officeId: string) => void;
}

function OfficeTreeNode({
  node,
  isPlatAdmin,
  onEditOffice,
  onDeactivateOffice,
  onAddPosition,
}: OfficeTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const badgeClass = OFFICE_TYPE_BADGE_CLASS[node.type] ?? 'bg-slate-100 text-slate-800';
  const typeLabel = OFFICE_TYPE_LABELS[node.type] ?? node.type;

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 group">
        <button
          type="button"
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4 h-4 inline-block" />
          )}
        </button>

        <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        <span className="font-medium text-sm flex-1">{node.name}</span>

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
          {typeLabel}
        </span>

        {isPlatAdmin && (
          <div className="hidden group-hover:flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAddPosition(node.officeId)}
              title="Add Position"
            >
              <Briefcase className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEditOffice(node)}
              title="Edit Office"
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDeactivateOffice(node)}
              title="Deactivate Office"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="border-l ml-6 pl-2">
          {node.children.map((child) => (
            <OfficeTreeNode
              key={child.officeId}
              node={child}
              isPlatAdmin={isPlatAdmin}
              onEditOffice={onEditOffice}
              onDeactivateOffice={onDeactivateOffice}
              onAddPosition={onAddPosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OrganizationPage ──────────────────────────────────────────────────────────

export function OrganizationPage() {
  const { session } = useAuth();
  const utils = trpc.useUtils();

  // Client-side platform-admin gate — same approach as RoleAssignmentPage.tsx.
  // Under current seed data, only 'plat_admin' has is_platform_admin = true.
  const isPlatAdmin = session?.roleCodes.includes('plat_admin') ?? false;

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: hierarchy, isLoading: hierarchyLoading } =
    trpc.organization.getOfficeHierarchy.useQuery();

  const [employeeSearch, setEmployeeSearch] = useState('');
  const { data: employeesData } = trpc.organization.listEmployees.useQuery(
    { limit: 100, search: employeeSearch || undefined },
    { enabled: isPlatAdmin },
  );

  const offices = hierarchy?.offices ?? [];
  const tree = useMemo(() => buildTree(offices), [offices]);

  // ─── Dialog state ──────────────────────────────────────────────────────────
  const [officeDialog, setOfficeDialog] = useState<'create' | 'edit' | null>(null);
  const [positionDialog, setPositionDialog] = useState(false);
  const [employeeDialog, setEmployeeDialog] = useState<'create' | 'edit' | null>(null);
  const [assignDialog, setAssignDialog] = useState(false);

  // ─── Selected items ────────────────────────────────────────────────────────
  const [selectedOffice, setSelectedOffice] = useState<OfficeSummary | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // ─── Form state ────────────────────────────────────────────────────────────
  const defaultOfficeForm = { name: '', code: '', officeType: 'department' as OfficeType, parentOfficeId: '' };
  const [officeForm, setOfficeForm] = useState(defaultOfficeForm);

  const defaultPositionForm = { officeId: '', title: '', code: '', authorityLevel: 'staff' as AuthorityLevel };
  const [positionForm, setPositionForm] = useState(defaultPositionForm);

  const defaultEmployeeForm = { firstName: '', lastName: '', email: '', phoneNumber: '', employeeNumber: '' };
  const [employeeForm, setEmployeeForm] = useState(defaultEmployeeForm);

  const defaultAssignForm = { employeeId: '', positionId: '', officeId: '', startDate: new Date().toISOString().split('T')[0]! };
  const [assignForm, setAssignForm] = useState(defaultAssignForm);

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const invalidateHierarchy = () => { void utils.organization.getOfficeHierarchy.invalidate(); };
  const invalidateEmployees = () => { void utils.organization.listEmployees.invalidate(); };

  const createOffice = trpc.organization.createOffice.useMutation({
    onSuccess: () => { toast.success('Office created'); setOfficeDialog(null); invalidateHierarchy(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const updateOffice = trpc.organization.updateOffice.useMutation({
    onSuccess: () => { toast.success('Office updated'); setOfficeDialog(null); invalidateHierarchy(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const deactivateOffice = trpc.organization.deactivateOffice.useMutation({
    onSuccess: () => { toast.success('Office deactivated'); invalidateHierarchy(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const createPosition = trpc.organization.createPosition.useMutation({
    onSuccess: () => { toast.success('Position created'); setPositionDialog(false); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const createEmployee = trpc.organization.createEmployee.useMutation({
    onSuccess: () => { toast.success('Employee created'); setEmployeeDialog(null); invalidateEmployees(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const updateEmployee = trpc.organization.updateEmployee.useMutation({
    onSuccess: () => { toast.success('Employee updated'); setEmployeeDialog(null); invalidateEmployees(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  const assignEmployeeToPosition = trpc.organization.assignEmployeeToPosition.useMutation({
    onSuccess: () => { toast.success('Assignment created'); setAssignDialog(false); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const openCreateOffice = () => {
    setOfficeForm(defaultOfficeForm);
    setSelectedOffice(null);
    setOfficeDialog('create');
  };

  const openEditOffice = (o: OfficeSummary) => {
    setSelectedOffice(o);
    setOfficeForm({ name: o.name, code: '', officeType: o.type, parentOfficeId: o.parentOfficeId ?? '' });
    setOfficeDialog('edit');
  };

  const openDeactivateOffice = (o: OfficeSummary) => {
    if (!window.confirm(`Deactivate office "${o.name}"? This action removes it from the hierarchy.`)) return;
    deactivateOffice.mutate({ officeId: o.officeId });
  };

  const openAddPosition = (officeId: string) => {
    setPositionForm({ ...defaultPositionForm, officeId });
    setPositionDialog(true);
  };

  const openCreateEmployee = () => {
    setEmployeeForm(defaultEmployeeForm);
    setSelectedEmployee(null);
    setEmployeeDialog('create');
  };

  const openEditEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    const parts = (emp.displayName ?? '').split(' ');
    setEmployeeForm({
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      email: '',
      phoneNumber: '',
      employeeNumber: '',
    });
    setEmployeeDialog('edit');
  };

  const openAssign = () => {
    setAssignForm(defaultAssignForm);
    setAssignDialog(true);
  };

  const handleOfficeSubmit = () => {
    if (officeDialog === 'create') {
      createOffice.mutate({
        name: officeForm.name,
        code: officeForm.code,
        officeType: officeForm.officeType,
        parentOfficeId: officeForm.parentOfficeId || null,
      });
    } else if (officeDialog === 'edit' && selectedOffice) {
      updateOffice.mutate({
        officeId: selectedOffice.officeId,
        name: officeForm.name,
        officeType: officeForm.officeType,
        parentOfficeId: officeForm.parentOfficeId || null,
      });
    }
  };

  const handlePositionSubmit = () => {
    createPosition.mutate({
      officeId: positionForm.officeId,
      title: positionForm.title,
      code: positionForm.code,
      authorityLevel: positionForm.authorityLevel,
    });
  };

  const handleEmployeeSubmit = () => {
    if (employeeDialog === 'create') {
      createEmployee.mutate({
        firstName: employeeForm.firstName,
        lastName: employeeForm.lastName,
        email: employeeForm.email || null,
        phoneNumber: employeeForm.phoneNumber || null,
        // employeeNumber is nullish in Zod but NOT NULL in DB — backend validates presence
        // and returns BAD_REQUEST rather than letting a constraint violation surface.
        // The UI enforces it as required per organization.schemas.ts header note 2.
        employeeNumber: employeeForm.employeeNumber || null,
      });
    } else if (employeeDialog === 'edit' && selectedEmployee) {
      updateEmployee.mutate({
        employeeId: selectedEmployee.employeeId,
        firstName: employeeForm.firstName || undefined,
        lastName: employeeForm.lastName || undefined,
        email: employeeForm.email || undefined,
        phoneNumber: employeeForm.phoneNumber || undefined,
        employeeNumber: employeeForm.employeeNumber || undefined,
      });
    }
  };

  const handleAssignSubmit = () => {
    assignEmployeeToPosition.mutate({
      employeeId: assignForm.employeeId,
      positionId: assignForm.positionId,
      officeId: assignForm.officeId,
      startDate: new Date(assignForm.startDate),
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Organization"
        subtitle="Office hierarchy, positions, and employee assignments"
        actions={
          isPlatAdmin ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={openAssign}>
                <Users className="w-4 h-4 mr-2" />
                Assign Position
              </Button>
              <Button variant="outline" onClick={openCreateEmployee}>
                <UserPlus className="w-4 h-4 mr-2" />
                New Employee
              </Button>
              <Button onClick={openCreateOffice}>
                <Plus className="w-4 h-4 mr-2" />
                New Office
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Office Hierarchy Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-4 h-4" />
            Office Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hierarchyLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : tree.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No offices found.{isPlatAdmin && ' Create the first office to get started.'}
            </p>
          ) : (
            <div className="divide-y">
              {tree.map((node) => (
                <OfficeTreeNode
                  key={node.officeId}
                  node={node}
                  isPlatAdmin={isPlatAdmin}
                  onEditOffice={openEditOffice}
                  onDeactivateOffice={openDeactivateOffice}
                  onAddPosition={openAddPosition}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Employees Card (plat_admin only) ── */}
      {isPlatAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" />
              Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Input
                placeholder="Search employees…"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
            {!employeesData ? (
              <p className="text-sm text-muted-foreground py-2">Loading…</p>
            ) : employeesData.items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No employees found.</p>
            ) : (
              <div className="divide-y rounded-md border">
                {employeesData.items.map((emp: any) => (
                  <div
                    key={emp.employeeId}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{emp.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.positionTitle ?? 'No position assigned'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditEmployee(emp)}
                      title="Edit Employee"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Office Create / Edit Dialog ── */}
      <Dialog open={officeDialog !== null} onOpenChange={(o) => { if (!o) setOfficeDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{officeDialog === 'edit' ? 'Edit Office' : 'Create Office'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="office-name">Name</Label>
              <Input
                id="office-name"
                value={officeForm.name}
                onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
                placeholder="Office of the Mayor"
              />
            </div>
            {officeDialog === 'create' && (
              <div className="grid gap-2">
                <Label htmlFor="office-code">Code</Label>
                <Input
                  id="office-code"
                  value={officeForm.code}
                  onChange={(e) => setOfficeForm({ ...officeForm, code: e.target.value })}
                  placeholder="MAYOR"
                />
              </div>
            )}
            {/* officeType enum — DB-verified values: executive, legislative, department, barangay, external.
                Per organization.schemas.ts header note 1: the AI Prompt's alternate list would fail
                the live ck_offices_office_type CHECK constraint. */}
            <div className="grid gap-2">
              <Label htmlFor="office-type">Type</Label>
              <Select
                value={officeForm.officeType}
                onValueChange={(v) => setOfficeForm({ ...officeForm, officeType: v as OfficeType })}
              >
                <SelectTrigger id="office-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="legislative">Legislative</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="barangay">Barangay</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parent-office">Parent Office (optional)</Label>
              <Select
                value={officeForm.parentOfficeId || 'none'}
                onValueChange={(v) => setOfficeForm({ ...officeForm, parentOfficeId: v === 'none' ? '' : v })}
              >
                <SelectTrigger id="parent-office">
                  <SelectValue placeholder="None (root office)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (root office)</SelectItem>
                  {offices
                    .filter((o) => !selectedOffice || o.officeId !== selectedOffice.officeId)
                    .map((o) => (
                      <SelectItem key={o.officeId} value={o.officeId}>
                        {o.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfficeDialog(null)}>Cancel</Button>
            <Button
              onClick={handleOfficeSubmit}
              disabled={createOffice.isPending || updateOffice.isPending || !officeForm.name}
            >
              {officeDialog === 'edit' ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Position Create Dialog ── */}
      <Dialog open={positionDialog} onOpenChange={setPositionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Position</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pos-office">Office</Label>
              <Select
                value={positionForm.officeId}
                onValueChange={(v) => setPositionForm({ ...positionForm, officeId: v })}
              >
                <SelectTrigger id="pos-office">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o.officeId} value={o.officeId}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-title">Title</Label>
              <Input
                id="pos-title"
                value={positionForm.title}
                onChange={(e) => setPositionForm({ ...positionForm, title: e.target.value })}
                placeholder="City Mayor"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-code">Code</Label>
              <Input
                id="pos-code"
                value={positionForm.code}
                onChange={(e) => setPositionForm({ ...positionForm, code: e.target.value })}
                placeholder="MAYOR_POS"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-authority">Authority Level</Label>
              <Select
                value={positionForm.authorityLevel}
                onValueChange={(v) => setPositionForm({ ...positionForm, authorityLevel: v as AuthorityLevel })}
              >
                <SelectTrigger id="pos-authority">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="managerial">Managerial</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPositionDialog(false)}>Cancel</Button>
            <Button
              onClick={handlePositionSubmit}
              disabled={createPosition.isPending || !positionForm.title || !positionForm.officeId}
            >
              Create Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Employee Create / Edit Dialog ── */}
      <Dialog open={employeeDialog !== null} onOpenChange={(o) => { if (!o) setEmployeeDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{employeeDialog === 'edit' ? 'Edit Employee' : 'Create Employee'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="emp-first">First Name</Label>
                <Input
                  id="emp-first"
                  value={employeeForm.firstName}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })}
                  placeholder="Juan"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emp-last">Last Name</Label>
                <Input
                  id="emp-last"
                  value={employeeForm.lastName}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })}
                  placeholder="dela Cruz"
                />
              </div>
            </div>
            {/* employeeNumber — nullish in Zod but NOT NULL in DB (schema header note 2).
                Backend returns BAD_REQUEST if omitted; treat as required in the form. */}
            <div className="grid gap-2">
              <Label htmlFor="emp-number">
                Employee Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="emp-number"
                value={employeeForm.employeeNumber}
                onChange={(e) => setEmployeeForm({ ...employeeForm, employeeNumber: e.target.value })}
                placeholder="2024-001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-email">Email (optional)</Label>
              <Input
                id="emp-email"
                type="email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                placeholder="jdelacruz@batac.gov.ph"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emp-phone">Phone (optional)</Label>
              <Input
                id="emp-phone"
                value={employeeForm.phoneNumber}
                onChange={(e) => setEmployeeForm({ ...employeeForm, phoneNumber: e.target.value })}
                placeholder="+63 912 345 6789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialog(null)}>Cancel</Button>
            <Button
              onClick={handleEmployeeSubmit}
              disabled={
                createEmployee.isPending ||
                updateEmployee.isPending ||
                !employeeForm.firstName ||
                !employeeForm.lastName ||
                (employeeDialog === 'create' && !employeeForm.employeeNumber)
              }
            >
              {employeeDialog === 'edit' ? 'Save Changes' : 'Create Employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assignment Dialog ── */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Employee to Position</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="assign-employee">Employee</Label>
              <Select
                value={assignForm.employeeId}
                onValueChange={(v) => setAssignForm({ ...assignForm, employeeId: v })}
              >
                <SelectTrigger id="assign-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeesData?.items.map((emp: any) => (
                    <SelectItem key={emp.employeeId} value={emp.employeeId}>
                      {emp.displayName}
                      {emp.positionTitle ? ` (${emp.positionTitle})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assign-office">Office</Label>
              <Select
                value={assignForm.officeId}
                onValueChange={(v) => setAssignForm({ ...assignForm, officeId: v })}
              >
                <SelectTrigger id="assign-office">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o.officeId} value={o.officeId}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assign-position-id">Position UUID</Label>
              <Input
                id="assign-position-id"
                value={assignForm.positionId}
                onChange={(e) => setAssignForm({ ...assignForm, positionId: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Enter the UUID of the position within the selected office.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assign-start">Start Date</Label>
              <Input
                id="assign-start"
                type="date"
                value={assignForm.startDate}
                onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAssignSubmit}
              disabled={
                assignEmployeeToPosition.isPending ||
                !assignForm.employeeId ||
                !assignForm.positionId ||
                !assignForm.officeId
              }
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
