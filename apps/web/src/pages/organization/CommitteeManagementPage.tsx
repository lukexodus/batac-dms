import { Plus, Edit, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  PageHeader,
  Card,
  CardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
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

import { trpc } from '../../lib/trpc';

interface CommitteeSummary {
  committeeId: string;
  name: string;
  code: string | null;
  description: string | null;
  chairedByEmployeeId?: string | null;
  deletedAt: Date | string | null;
}

export function CommitteeManagementPage() {
  const utils = trpc.useUtils();
  const { data: committees, isLoading } = trpc.organization.listCommittees.useQuery();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const [selectedCommittee, setSelectedCommittee] = useState<CommitteeSummary | null>(null);

  // Forms state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    chairedByEmployeeId: '',
  });

  const [assignData, setAssignData] = useState<{
    employeeId: string;
    committeeRole: 'chairman' | 'vice_chairman' | 'member';
    startDate: string;
  }>({
    employeeId: '',
    committeeRole: 'member',
    startDate: new Date().toISOString().split('T')[0]!,
  });

  const createMutation = trpc.organization.createCommittee.useMutation({
    onSuccess: () => {
      toast.success('Committee created successfully');
      setIsCreateOpen(false);
      void utils.organization.listCommittees.invalidate();
    },
    onError: (err) => toast.error(`Failed to create committee: ${err.message}`),
  });

  const updateMutation = trpc.organization.updateCommittee.useMutation({
    onSuccess: () => {
      toast.success('Committee updated successfully');
      setIsEditOpen(false);
      void utils.organization.listCommittees.invalidate();
    },
    onError: (err) => toast.error(`Failed to update committee: ${err.message}`),
  });

  const assignMutation = trpc.organization.assignCommitteeMembership.useMutation({
    onSuccess: () => {
      toast.success('Membership assigned successfully');
      setIsAssignOpen(false);
    },
    onError: (err) => toast.error(`Failed to assign membership: ${err.message}`),
  });

  // Employee Search
  const [employeeSearch, setEmployeeSearch] = useState('');
  const { data: employeesData } = trpc.organization.listEmployees.useQuery({
    limit: 100,
    search: employeeSearch,
  });

  const openEdit = (committee: CommitteeSummary) => {
    setSelectedCommittee(committee);
    setFormData({
      name: committee.name || '',
      code: committee.code || '',
      chairedByEmployeeId: committee.chairedByEmployeeId || '',
    });
    setIsEditOpen(true);
  };

  const openAssign = (committee: CommitteeSummary) => {
    setSelectedCommittee(committee);
    setAssignData({
      employeeId: '',
      committeeRole: 'member',
      startDate: new Date().toISOString().split('T')[0]!,
    });
    setEmployeeSearch('');
    setIsAssignOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      code: formData.code,
      chairedByEmployeeId: formData.chairedByEmployeeId || null,
    });
  };

  const handleUpdate = () => {
    if (!selectedCommittee) return;
    updateMutation.mutate({
      committeeId: selectedCommittee.committeeId,
      name: formData.name,
      code: formData.code,
      chairedByEmployeeId: formData.chairedByEmployeeId || null,
    });
  };

  const handleAssign = () => {
    if (!selectedCommittee) return;
    assignMutation.mutate({
      committeeId: selectedCommittee.committeeId,
      employeeId: assignData.employeeId,
      committeeRole: assignData.committeeRole,
      startDate: new Date(assignData.startDate),
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Committees"
        subtitle="Manage standing committees and assignments"
        actions={
          <Button
            onClick={() => {
              setFormData({ name: '', code: '', chairedByEmployeeId: '' });
              setIsCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Committee
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : committees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">
                    No committees found.
                  </TableCell>
                </TableRow>
              ) : (
                committees?.map((committee) => (
                  <TableRow key={committee.committeeId}>
                    <TableCell className="font-medium">{committee.code}</TableCell>
                    <TableCell>{committee.name}</TableCell>
                    <TableCell>{committee.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(committee)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openAssign(committee)}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Assign
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={isCreateOpen || isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setIsEditOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Committee' : 'Create Committee'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. WAYS_MEANS"
              />
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Committee on Ways and Means"
              />
            </div>
            <div className="grid gap-2">
              <Label>Chairperson</Label>
              <Select
                value={formData.chairedByEmployeeId}
                onValueChange={(val) =>
                  setFormData({ ...formData, chairedByEmployeeId: val === 'none' ? '' : val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Chairperson" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Chairperson</SelectItem>
                  {employeesData?.items.map((emp) => (
                    <SelectItem key={emp.employeeId} value={emp.employeeId}>
                      {emp.displayName} {emp.positionTitle ? `(${emp.positionTitle})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setIsEditOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isEditOpen ? handleUpdate : handleCreate}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEditOpen ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Membership Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Membership: {selectedCommittee?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select
                value={assignData.employeeId}
                onValueChange={(val) => setAssignData({ ...assignData, employeeId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeesData?.items.map((emp) => (
                    <SelectItem key={emp.employeeId} value={emp.employeeId}>
                      {emp.displayName} {emp.positionTitle ? `(${emp.positionTitle})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={assignData.committeeRole}
                onValueChange={(val) =>
                  setAssignData({
                    ...assignData,
                    committeeRole: val as 'chairman' | 'vice_chairman' | 'member',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chairman">Chairman</SelectItem>
                  <SelectItem value="vice_chairman">Vice Chairman</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={assignData.startDate}
                onChange={(e) => setAssignData({ ...assignData, startDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assignMutation.isPending}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
