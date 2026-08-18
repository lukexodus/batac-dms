import { describe, it, expect } from 'vitest';
import { ComplaintSubmissionRequestSchema, DocumentRequestSubmissionRequestSchema } from '../portal.js';
import { TrackingLookupResponseSchema } from '../tracking.js';

describe('Public REST Schemas', () => {
  it('TEST 1: transportation_overcharging complaint against ComplaintSubmissionRequestSchema', () => {
    const payload = {
      violationType: 'overcharging',
      tricycleNumber: 'TC-1234',
      incidentDate: '2026-06-15',
      incidentTime: '14:30',
      place: 'Barangay Ablan public market',
      remarks: 'Charged 100 pesos for a 30-peso fare',
      complainantName: 'Juan Dela Cruz',
      complainantAddress: 'Barangay Ablan, Batac City',
      complainantContact: '09171234567',
      complainantEmail: 'juan@example.com',
      accessMode: 'digital_form',
    };

    const result = ComplaintSubmissionRequestSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('TEST 2: general_lgu complaint against ComplaintSubmissionRequestSchema', () => {
    const payload = {
      violationType: 'other',
      violationTypeOther: "Discourteous treatment at the Treasurer's Office",
      incidentDate: '2026-06-10',
      incidentTime: '09:15',
      place: "City Treasurer's Office",
      complainantName: 'Maria Santos',
      complainantAddress: 'Barangay 5, Batac City',
      complainantContact: '09189876543',
      accessMode: 'clerk_assisted',
    };

    const result = ComplaintSubmissionRequestSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('TEST 3: document request example against DocumentRequestSubmissionRequestSchema', () => {
    const payload = {
      requesterName: 'Jose B. Reyes',
      requesterAgency: 'Department of Public Works and Highways — Ilocos Norte',
      requesterEmail: 'jreyes@dpwh.gov.ph',
      requesterPhone: '09191234567',
      documentType: 'SP_ORDINANCE',
      documentTitle: 'An Ordinance Adopting the Annual Investment Program for Fiscal Year 2026',
      documentNumber: '7SP 2026-03',
      purpose: 'Reference for ongoing road infrastructure planning in Batac City.',
      idType: 'Government Employee ID (DPWH)',
      accessMode: 'digital_form',
    };

    const result = DocumentRequestSubmissionRequestSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('TEST 4: tracking lookup response example against TrackingLookupResponseSchema', () => {
    const payload = {
      data: {
        trackingNumber: '550e8400-e29b-41d4-a716-446655440000',
        documentId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        documentType: 'SP_RESOLUTION',
        documentTypeName: 'SP Resolution',
        title: 'A Resolution Authorizing the City Mayor to Enter Into a Memorandum of Agreement With MMSU',
        preliminaryNumber: null,
        finalNumber: '7SP 2026-04',
        lifecycleStatus: 'With Mayor — Pending Signature',
        remarks: null,
        routingHistory: [
          {
            timestamp: '2026-06-01T08:00:00+08:00',
            action: 'Logged by Secretariat',
            fromOfficeName: null,
            toOfficeName: 'SP Secretariat',
            actorDisplayName: 'Ana Reyes',
          },
        ],
        firstPagePreview: {
          url: 'https://r2.batac.gov.ph/previews/abc123-first-page.jpg?X-Amz-Expires=900&X-Amz-Signature=example',
          expiresAt: '2026-06-15T08:15:00+08:00',
          widthPx: 794,
          heightPx: 1123,
        },
        documentRequestUrl: 'https://portal.batac.gov.ph/document-requests?ref=7SP+2026-04',
        supersededBy: null,
        supersededAt: null,
        closureReason: null,
      },
    };

    const result = TrackingLookupResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
