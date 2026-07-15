CREATE TYPE "documents"."attachment_type_enum" AS ENUM('certification_of_urgency', 'committee_report', 'transmittal_letter', 'scan', 'other');--> statement-breakpoint
CREATE TYPE "documents"."classification_level_enum" AS ENUM('public', 'internal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "documents"."lifecycle_state_enum" AS ENUM('draft', 'submitted', 'in_workflow', 'pending_mayor_action', 'pending_panlalawigan_review', 'completed', 'released', 'archived', 'disposed', 'cancelled', 'superseded');--> statement-breakpoint
CREATE TYPE "documents"."number_type_enum" AS ENUM('preliminary', 'final', 'control');--> statement-breakpoint
CREATE TYPE "documents"."owning_module_enum" AS ENUM('workflow', 'organization', 'portal');--> statement-breakpoint
CREATE TYPE "documents"."panlalawigan_outcome_enum" AS ENUM('valid', 'valid_in_part', 'returned', 'operative_in_its_entirety', 'deemed_approved');--> statement-breakpoint
CREATE TYPE "documents"."phase_enum" AS ENUM('1', '1b');--> statement-breakpoint
CREATE TYPE "documents"."public_visibility_rule_enum" AS ENUM('title_and_first_page_public', 'not_public', 'complainant_restricted', 'requester_restricted');--> statement-breakpoint
CREATE TYPE "documents"."scan_quality_category_enum" AS ENUM('good', 'fair', 'poor');--> statement-breakpoint
CREATE TYPE "documents"."series_type_enum" AS ENUM('legislative', 'administrative');--> statement-breakpoint
CREATE TYPE "documents"."signature_type_enum" AS ENUM('presiding_officer', 'mayor', 'sp_secretary', 'vice_mayor', 'committee_chair');--> statement-breakpoint
CREATE TYPE "documents"."sponsorship_type_enum" AS ENUM('principal_author', 'co_author', 'introducer', 'co_introducer');--> statement-breakpoint
ALTER TABLE "documents"."attachments" DROP CONSTRAINT "attachments_attachment_type_check";--> statement-breakpoint
ALTER TABLE "documents"."document_sponsorships" DROP CONSTRAINT "document_sponsorships_sponsorship_type_check";--> statement-breakpoint
ALTER TABLE "documents"."document_types" DROP CONSTRAINT "document_types_owning_module_check";--> statement-breakpoint
ALTER TABLE "documents"."document_types" DROP CONSTRAINT "document_types_classification_default_check";--> statement-breakpoint
ALTER TABLE "documents"."document_types" DROP CONSTRAINT "document_types_public_visibility_rule_check";--> statement-breakpoint
ALTER TABLE "documents"."documents" DROP CONSTRAINT "documents_lifecycle_state_check";--> statement-breakpoint
ALTER TABLE "documents"."documents" DROP CONSTRAINT "documents_classification_level_check";--> statement-breakpoint
ALTER TABLE "documents"."number_series" DROP CONSTRAINT "number_series_series_type_check";--> statement-breakpoint
ALTER TABLE "documents"."number_series" DROP CONSTRAINT "number_series_phase_check";--> statement-breakpoint
ALTER TABLE "documents"."numbers" DROP CONSTRAINT "numbers_number_type_check";--> statement-breakpoint
ALTER TABLE "documents"."panlalawigan_reviews" DROP CONSTRAINT "panlalawigan_reviews_outcome_check";--> statement-breakpoint
ALTER TABLE "documents"."signatures" DROP CONSTRAINT "signatures_signature_type_check";--> statement-breakpoint
ALTER TABLE "documents"."versions" DROP CONSTRAINT "versions_scan_quality_category_check";--> statement-breakpoint
ALTER TABLE "documents"."attachments" ALTER COLUMN "attachment_type" SET DATA TYPE "documents"."attachment_type_enum" USING "attachment_type"::"documents"."attachment_type_enum";--> statement-breakpoint
ALTER TABLE "documents"."document_sponsorships" ALTER COLUMN "sponsorship_type" SET DATA TYPE "documents"."sponsorship_type_enum" USING "sponsorship_type"::"documents"."sponsorship_type_enum";--> statement-breakpoint
ALTER TABLE "documents"."document_types" ALTER COLUMN "owning_module" SET DATA TYPE "documents"."owning_module_enum" USING "owning_module"::"documents"."owning_module_enum";--> statement-breakpoint
ALTER TABLE "documents"."document_types" ALTER COLUMN "classification_default" SET DATA TYPE "documents"."classification_level_enum" USING "classification_default"::"documents"."classification_level_enum";--> statement-breakpoint
ALTER TABLE "documents"."document_types" ALTER COLUMN "public_visibility_rule" SET DATA TYPE "documents"."public_visibility_rule_enum" USING "public_visibility_rule"::"documents"."public_visibility_rule_enum";--> statement-breakpoint
ALTER TABLE "documents"."documents" ALTER COLUMN "lifecycle_state" SET DEFAULT 'draft'::"documents"."lifecycle_state_enum";--> statement-breakpoint
ALTER TABLE "documents"."documents" ALTER COLUMN "lifecycle_state" SET DATA TYPE "documents"."lifecycle_state_enum" USING "lifecycle_state"::"documents"."lifecycle_state_enum";--> statement-breakpoint
DROP POLICY IF EXISTS documents_it_admin_no_confidential ON documents.documents;--> statement-breakpoint
ALTER TABLE "documents"."documents" ALTER COLUMN "classification_level" SET DATA TYPE "documents"."classification_level_enum" USING "classification_level"::"documents"."classification_level_enum";--> statement-breakpoint
CREATE POLICY documents_it_admin_no_confidential ON documents.documents FOR SELECT TO batac_it_admin USING (classification_level NOT IN ('confidential','restricted'));--> statement-breakpoint
ALTER TABLE "documents"."number_series" ALTER COLUMN "series_type" SET DATA TYPE "documents"."series_type_enum" USING "series_type"::"documents"."series_type_enum";--> statement-breakpoint
ALTER TABLE "documents"."number_series" ALTER COLUMN "phase" SET DEFAULT '1'::"documents"."phase_enum";--> statement-breakpoint
ALTER TABLE "documents"."number_series" ALTER COLUMN "phase" SET DATA TYPE "documents"."phase_enum" USING "phase"::"documents"."phase_enum";--> statement-breakpoint
ALTER TABLE "documents"."numbers" ALTER COLUMN "number_type" SET DATA TYPE "documents"."number_type_enum" USING "number_type"::"documents"."number_type_enum";--> statement-breakpoint
ALTER TABLE "documents"."panlalawigan_reviews" ALTER COLUMN "outcome" SET DATA TYPE "documents"."panlalawigan_outcome_enum" USING "outcome"::"documents"."panlalawigan_outcome_enum";--> statement-breakpoint
ALTER TABLE "documents"."signatures" ALTER COLUMN "signature_type" SET DATA TYPE "documents"."signature_type_enum" USING "signature_type"::"documents"."signature_type_enum";--> statement-breakpoint
ALTER TABLE "documents"."versions" ALTER COLUMN "scan_quality_category" SET DATA TYPE "documents"."scan_quality_category_enum" USING "scan_quality_category"::"documents"."scan_quality_category_enum";