import { z } from "zod";
import { SpResolutionMetadataSchema, DesignationMetadataSchema, DocumentMetadataSchema } from "./src/schemas/document-metadata.js";
import { LogPanlalawiganOutcomeInputSchema as DocsLogPanlalawiganOutcomeInputSchema } from "./src/schemas/documents.js";
import {
  WorkflowContextSchema,
  TerminationStepConfigSchema,
  MultiReferralStepConfigSchema,
  ApprovalStepConfigSchema,
  WorkflowStepDefSchema
} from "./src/workflow/index.js";
import crypto from "crypto";


const uuid1 = crypto.randomUUID();
const uuid2 = crypto.randomUUID();

function runTests() {
  let passed = true;
  
  // Test 1: SpResolutionMetadataSchema
  try {
    SpResolutionMetadataSchema.parse({ sponsors: [{ employeeId: uuid1, displayName: 'X' }] });
    console.log("Test 1a passed");
  } catch(e) {
    console.error("Test 1a failed", e);
    passed = false;
  }
  
  try {
    SpResolutionMetadataSchema.parse({ 
      sponsors: [{ employeeId: uuid1, displayName: 'X' }],
      certificationOfUrgencyDocumentId: uuid2, 
      committeeReferralIds: [uuid1] 
    });
    console.error("Test 1b failed - should have thrown");
    passed = false;
  } catch(e) {
    const errorMsg = e.issues[0].message;
    if (errorMsg === "A certified urgent measure cannot also have committee referrals") {
      console.log("Test 1b passed");
    } else {
      console.error("Test 1b failed with wrong message:", errorMsg);
      passed = false;
    }
  }

  // Test 2: LogPanlalawiganOutcomeInputSchema
  try {
    DocsLogPanlalawiganOutcomeInputSchema.parse({ documentId: uuid1, outcome: 'valid_in_part', receivedAt: new Date().toISOString(), remarks: 'short' });
    console.error("Test 2a failed - should have thrown");
    passed = false;
  } catch(e) {
    if (e.issues.some(i => i.message.includes("Remarks required for VALID-IN-PART (min 10 chars)"))) {
      console.log("Test 2a passed");
    } else {
      console.error("Test 2a failed with wrong message:", e.issues);
      passed = false;
    }
  }
  
  try {
    DocsLogPanlalawiganOutcomeInputSchema.parse({ documentId: uuid1, outcome: 'valid_in_part', receivedAt: new Date().toISOString(), remarks: 'ten or more chars' });
    console.log("Test 2b passed");
  } catch(e) {
    console.error("Test 2b failed", e);
    passed = false;
  }

  // Test 3: DesignationMetadataSchema
  try {
    DesignationMetadataSchema.parse({ 
      delegatingAuthorityEmployeeId: uuid1, 
      delegatingAuthorityDisplayName: 'A',
      designatedPersonEmployeeId: uuid1,
      designatedPersonDisplayName: 'B',
      designatedOfficeId: uuid2,
      designatedPositionId: uuid2,
      scopeDescription: 'Test',
      effectiveFrom: '2026-06-30',
      effectiveUntil: '2026-07-01'
    });
    console.error("Test 3 failed - should have thrown");
    passed = false;
  } catch(e) {
    if (e.issues.some(i => i.message.includes("Delegating authority and designated person must differ"))) {
      console.log("Test 3 passed");
    } else {
      console.error("Test 3 failed with wrong message:", e.issues);
      passed = false;
    }
  }

  // Test 4: DocumentMetadataSchema
  try {
    const parsed = DocumentMetadataSchema.parse({ 
      __type: 'SP_RESOLUTION', 
      sponsors: [{ employeeId: uuid1, displayName: 'X' }] 
    });
    if (parsed.__type === 'SP_RESOLUTION') {
      console.log("Test 4 passed");
    } else {
      console.error("Test 4 failed with wrong type");
      passed = false;
    }
  } catch(e) {
    console.error("Test 4 failed", e);
    passed = false;
  }
  
  // Test 5: WorkflowContextSchema (optional keys)
  try {
    WorkflowContextSchema.parse({});
    console.log("Test 5a passed");
  } catch(e) {
    console.error("Test 5a failed", e);
    passed = false;
  }

  try {
    WorkflowContextSchema.parse({ document_id: "not-a-uuid" });
    console.error("Test 5b failed - should have thrown");
    passed = false;
  } catch(e) {
    console.log("Test 5b passed");
  }

  // Test 6: TerminationStepConfigSchema
  try {
    TerminationStepConfigSchema.parse({
      outcome_code: 'REPASSED',
      final_document_status: null
    });
    console.log("Test 6 passed");
  } catch(e) {
    console.error("Test 6 failed", e);
    passed = false;
  }

  // Test 7: MultiReferralStepConfigSchema (non-optional fields)
  try {
    MultiReferralStepConfigSchema.parse({
      default_committee_roles: [],
      report_acceptor_role: 'role'
    });
    console.error("Test 7a failed - should have thrown");
    passed = false;
  } catch(e) {
    console.log("Test 7a passed");
  }

  try {
    MultiReferralStepConfigSchema.parse({
      default_committee_roles: [],
      report_acceptor_role: 'role',
      thursday_cutoff_enabled: true,
      require_all_committee_signatures: true,
      allow_secretary_advance: false
    });
    console.log("Test 7b passed");
  } catch(e) {
    console.error("Test 7b failed", e);
    passed = false;
  }

  // Test 8: ApprovalStepConfigSchema (optional is_final_approval)
  try {
    ApprovalStepConfigSchema.parse({
      assignee: 'role',
      allowed_outcomes: ['approved'],
      is_final_approval: true
    });
    console.log("Test 8 passed");
  } catch(e) {
    console.error("Test 8 failed", e);
    passed = false;
  }

  if (passed) {
    console.log("ALL TESTS PASSED");
  } else {
    console.log("SOME TESTS FAILED");
  }
}

runTests();

