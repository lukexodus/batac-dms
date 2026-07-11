import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Separator,
} from '@batac/ui';

type PrintableFormData = {
  requestId: string;
  title: string;
  lifecycleState: string;
  createdAt: Date | string;
  requester: {
    name: string;
    agencyOrOrganization: string | null;
    email: string | null;
    contactNumber: string | null;
    idTypePresented: string | null;
  } | null;
  documentsRequested: Array<{
    documentTitle: string;
    documentNumber: string | null;
    documentTypeLabel: string | null;
    numberOfPages: number | null;
  }>;
  purpose: string | null;
  accessMode: string | null;
  payment: {
    orNumber: string | null;
    collectingOfficer: string | null;
    amountPaid: number | null;
    paymentDate: string | null;
  } | null;
  notificationChannel: string | null;
};

interface PrintableFormViewProps {
  data: PrintableFormData;
}

export function PrintableFormView({ data }: PrintableFormViewProps) {
  return (
    <div className="space-y-6 print:space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="print-area">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-lg">
              Republic of the Philippines
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Sangguniang Panlungsod — Batac City
            </p>
            <Separator className="my-2" />
            <CardTitle>Document Request Form</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Request ID:</span>
                <span className="ml-2">{data.requestId.slice(0, 8)}…</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Date Filed:</span>
                <span className="ml-2">
                  {new Date(data.createdAt).toLocaleDateString('en-PH')}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <h3 className="font-semibold">Requester Information</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <span className="ml-2">{data.requester?.name ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Agency/Organization:</span>
                  <span className="ml-2">{data.requester?.agencyOrOrganization ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contact Number:</span>
                  <span className="ml-2">{data.requester?.contactNumber ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2">{data.requester?.email ?? '—'}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Documents Requested</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-4 text-muted-foreground">#</th>
                    <th className="py-1 pr-4 text-muted-foreground">Document Title</th>
                    <th className="py-1 pr-4 text-muted-foreground">Document No.</th>
                    <th className="py-1 text-muted-foreground">Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documentsRequested.map((doc, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1 pr-4">{i + 1}</td>
                      <td className="py-1 pr-4">{doc.documentTitle}</td>
                      <td className="py-1 pr-4">{doc.documentNumber ?? '—'}</td>
                      <td className="py-1">{doc.numberOfPages ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator />

            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Purpose:</span>
              <p className="mt-1">{data.purpose ?? '—'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Access Mode:</span>
                <span className="ml-2">
                  {data.accessMode === 'in_person_clerk'
                    ? 'In-Person (Clerk-Assisted)'
                    : data.accessMode ?? '—'}
                </span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Payment:</span>
                <span className="ml-2">
                  {data.payment
                    ? `OR# ${data.payment.orNumber ?? '—'} — ₱${data.payment.amountPaid ?? 0}`
                    : 'No payment recorded'}
                </span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
              <div className="border-t pt-2">
                <p className="text-muted-foreground">Prepared by:</p>
                <div className="mt-6 border-t border-dashed w-48" />
                <p className="mt-1">SP Secretary</p>
              </div>
              <div className="border-t pt-2">
                <p className="text-muted-foreground">Received by:</p>
                <div className="mt-6 border-t border-dashed w-48" />
                <p className="mt-1">Requester</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
