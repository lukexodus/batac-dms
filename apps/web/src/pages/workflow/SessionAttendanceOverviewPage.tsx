import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
  PageHeader,
} from '@batac/ui';

import { trpc } from '../../lib/trpc';

export function SessionAttendanceOverviewPage() {
  const { data, isLoading, error } = trpc.session.getAttendanceStatistics.useQuery({});

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <PageHeader
        title="Session Attendance"
        actions={
          <Button variant="outline" disabled>
            Print Summary (Not Available)
          </Button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-danger-600">
            Failed to load attendance statistics.
          </div>
        ) : (
          <div className="rounded-md border bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session Date</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.series && data.series.length > 0 ? (
                  data.series.map((item) => {
                    const dateStr = format(new Date(item.sessionDate), 'yyyy-MM-dd');
                    return (
                      <TableRow key={dateStr}>
                        <TableCell className="font-medium">
                          {format(new Date(item.sessionDate), 'MMMM d, yyyy')}
                        </TableCell>
                        {item.presentCount === null ? (
                          <TableCell colSpan={2} className="text-muted-foreground">
                            Not Yet Recorded
                          </TableCell>
                        ) : (
                          <>
                            <TableCell className="text-success-600">{item.presentCount}</TableCell>
                            <TableCell className="text-danger-600">{item.absentCount}</TableCell>
                          </>
                        )}
                        <TableCell className="text-right">
                          <Link to={`/sessions/${dateStr}`}>
                            <Button variant="secondary" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No session attendance records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
