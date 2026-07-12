import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Label,
  PageHeader,
} from '@batac/ui';

import { trpc } from '../../lib/trpc';

export function SessionAttendanceDetailPage() {
  const { sessionDate } = useParams<{ sessionDate: string }>();
  const dateObj = sessionDate ? new Date(sessionDate) : new Date();

  const { data: record, isLoading, refetch } = trpc.session.getAttendanceRecord.useQuery({
    sessionDate: dateObj,
  });

  const { data: substituteCandidates } = trpc.session.getEligibleSubstituteOfficers.useQuery({
    sessionDate: dateObj,
  });

  const recordAttendanceMutation = trpc.session.recordAttendance.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const [absences, setAbsences] = useState<Array<{ councilorEmployeeId: string; reason: string }>>([]);
  const [isVMAbsent, setIsVMAbsent] = useState(false);
  const [substituteId, setSubstituteId] = useState<string>('');

  const handleAddAbsence = () => {
    setAbsences([...absences, { councilorEmployeeId: '', reason: 'official_business' }]);
  };

  const handleUpdateAbsence = (index: number, field: string, value: string) => {
    const updated = [...absences];
    updated[index] = { ...updated[index], [field]: value } as { councilorEmployeeId: string; reason: string };
    setAbsences(updated);
  };

  const handleRemoveAbsence = (index: number) => {
    const updated = [...absences];
    updated.splice(index, 1);
    setAbsences(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordAttendanceMutation.mutate({
      sessionDate: dateObj,
      absences: absences.map(a => ({
        councilorEmployeeId: a.councilorEmployeeId,
        reason: a.reason as 'official_business' | 'sick_leave' | 'vacation_leave' | 'absent_unqualified',
      })),
      presidedByEmployeeIdOverride: isVMAbsent && substituteId ? substituteId : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">Loading...</div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader
        title={`Session Attendance: ${format(dateObj, 'MMMM d, yyyy')}`}
      />

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Status
                {record?.quorumMet ? (
                  <Badge variant="default" className="ml-auto bg-success-600 hover:bg-success-700">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Quorum Met
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="ml-auto">
                    <ShieldAlert className="mr-1 h-3 w-3" /> No Quorum
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Presiding Officer</h4>
                  <div className="text-lg font-medium">
                    {record?.presidedByDisplayName || record?.presidedByEmployeeId || 'Not Assigned'}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Present Councilors ({record?.presentCouncilors.length || 0})</h4>
                  {record?.presentCouncilors.length ? (
                    <ul className="list-inside list-disc space-y-1 text-sm">
                      {record.presentCouncilors.map(id => (
                        <li key={id} className="font-mono text-xs">{id}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No present councilors recorded.</p>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Absences ({record?.absences.length || 0})</h4>
                  {record?.absences.length ? (
                    <ul className="space-y-2">
                      {record.absences.map((absence, i) => (
                        <li key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                          <div>
                            <span className="font-medium">{absence.councilorDisplayName || absence.councilorEmployeeId}</span>
                            {!absence.councilorDisplayName && <span className="ml-2 font-mono text-xs text-muted-foreground">({absence.councilorEmployeeId})</span>}
                          </div>
                          <Badge variant="outline">{absence.reason}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No absences recorded.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Record Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Absences</h4>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddAbsence}>
                      Add Absence
                    </Button>
                  </div>
                  {absences.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All councilors will be marked as present.</p>
                  ) : (
                    <div className="space-y-3">
                      {absences.map((absence, idx) => (
                        <div key={idx} className="flex items-start gap-2 rounded-md border p-3">
                          <div className="grid flex-1 gap-2">
                            <div>
                              <Label className="text-xs">Employee ID (UUID)</Label>
                              <Input
                                placeholder="00000000-0000-0000-0000-000000000000"
                                value={absence.councilorEmployeeId}
                                onChange={(e) => handleUpdateAbsence(idx, 'councilorEmployeeId', e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Reason</Label>
                              <Select
                                value={absence.reason}
                                onValueChange={(val) => handleUpdateAbsence(idx, 'reason', val)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select reason" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="official_business">Official Business</SelectItem>
                                  <SelectItem value="sick_leave">Sick Leave</SelectItem>
                                  <SelectItem value="vacation_leave">Vacation Leave</SelectItem>
                                  <SelectItem value="absent_unqualified">Absent (Unqualified)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="mt-6" onClick={() => handleRemoveAbsence(idx)}>
                            <AlertCircle className="h-4 w-4 text-danger-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 rounded-md border p-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isVMAbsent"
                      checked={isVMAbsent}
                      onCheckedChange={(val) => setIsVMAbsent(!!val)}
                    />
                    <Label htmlFor="isVMAbsent" className="font-medium">
                      Regular Presiding Officer is absent
                    </Label>
                  </div>
                  
                  {isVMAbsent && (
                    <div className="ml-6 space-y-2">
                      <Label>Substitute Presiding Officer</Label>
                      <Select
                        value={substituteId}
                        onValueChange={setSubstituteId}
                        required={isVMAbsent}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a substitute" />
                        </SelectTrigger>
                        <SelectContent>
                          {substituteCandidates?.map((cand) => (
                            <SelectItem key={cand.id} value={cand.id}>
                              {cand.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Select a substitute from those with an active delegation grant for this position.
                      </p>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={recordAttendanceMutation.isPending}>
                  {recordAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance Record'}
                </Button>

                {recordAttendanceMutation.isError && (
                  <p className="text-sm text-danger-500">
                    Error: {recordAttendanceMutation.error.message}
                  </p>
                )}
                {recordAttendanceMutation.isSuccess && (
                  <p className="text-sm text-success-600">
                    Attendance successfully recorded!
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
