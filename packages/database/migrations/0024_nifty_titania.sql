ALTER TABLE "documents"."document_sponsorships" ALTER COLUMN "sponsorship_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."document_types" ALTER COLUMN "owning_module" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."document_types" ALTER COLUMN "classification_default" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."document_types" ALTER COLUMN "public_visibility_rule" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."documents" ALTER COLUMN "lifecycle_state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."documents" ALTER COLUMN "lifecycle_state" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "documents"."documents" ALTER COLUMN "classification_level" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."number_series" ALTER COLUMN "series_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."number_series" ALTER COLUMN "phase" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."number_series" ALTER COLUMN "phase" SET DEFAULT '1';--> statement-breakpoint
ALTER TABLE "documents"."numbers" ALTER COLUMN "number_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."panlalawigan_reviews" ALTER COLUMN "outcome" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."signatures" ALTER COLUMN "signature_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."versions" ALTER COLUMN "scan_quality_category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "documents"."document_sponsorships" ADD CONSTRAINT "documents_sponsorship_type_check" CHECK ("documents"."document_sponsorships"."sponsorship_type" IN ('principal_author', 'co_author', 'introducer', 'co_introducer'));--> statement-breakpoint
ALTER TABLE "documents"."document_types" ADD CONSTRAINT "documents_owning_module_check" CHECK ("documents"."document_types"."owning_module" IN ('workflow', 'organization', 'portal'));--> statement-breakpoint
ALTER TABLE "documents"."document_types" ADD CONSTRAINT "documents_classification_default_check" CHECK ("documents"."document_types"."classification_default" IN ('public', 'internal', 'confidential', 'restricted'));--> statement-breakpoint
ALTER TABLE "documents"."document_types" ADD CONSTRAINT "documents_public_visibility_rule_check" CHECK ("documents"."document_types"."public_visibility_rule" IN ('title_and_first_page_public', 'not_public', 'complainant_restricted', 'requester_restricted'));--> statement-breakpoint
ALTER TABLE "documents"."documents" ADD CONSTRAINT "documents_lifecycle_state_check" CHECK ("documents"."documents"."lifecycle_state" IN ('draft','submitted','in_workflow','pending_mayor_action','pending_panlalawigan_review','completed','released','archived','disposed','cancelled','superseded'));--> statement-breakpoint
ALTER TABLE "documents"."documents" ADD CONSTRAINT "documents_classification_level_check" CHECK ("documents"."documents"."classification_level" IN ('public', 'internal', 'confidential', 'restricted'));--> statement-breakpoint
ALTER TABLE "documents"."number_series" ADD CONSTRAINT "documents_series_type_check" CHECK ("documents"."number_series"."series_type" IN ('legislative', 'administrative'));--> statement-breakpoint
ALTER TABLE "documents"."number_series" ADD CONSTRAINT "documents_phase_check" CHECK ("documents"."number_series"."phase" IN ('1', '1b'));--> statement-breakpoint
ALTER TABLE "documents"."numbers" ADD CONSTRAINT "documents_number_type_check" CHECK ("documents"."numbers"."number_type" IN ('preliminary', 'final', 'control'));--> statement-breakpoint
ALTER TABLE "documents"."panlalawigan_reviews" ADD CONSTRAINT "documents_outcome_check" CHECK ("documents"."panlalawigan_reviews"."outcome" IS NULL OR "documents"."panlalawigan_reviews"."outcome" IN ('valid', 'valid_in_part', 'returned', 'operative_in_its_entirety', 'deemed_approved'));--> statement-breakpoint
ALTER TABLE "documents"."signatures" ADD CONSTRAINT "documents_signature_type_check" CHECK ("documents"."signatures"."signature_type" IN ('presiding_officer', 'mayor', 'sp_secretary', 'vice_mayor', 'committee_chair'));--> statement-breakpoint
ALTER TABLE "documents"."versions" ADD CONSTRAINT "documents_scan_quality_category_check" CHECK ("documents"."versions"."scan_quality_category" IS NULL OR "documents"."versions"."scan_quality_category" IN ('good', 'fair', 'poor'));--> statement-breakpoint
DROP TYPE "documents"."classification_level_enum";--> statement-breakpoint
DROP TYPE "documents"."lifecycle_state_enum";--> statement-breakpoint
DROP TYPE "documents"."number_type_enum";--> statement-breakpoint
DROP TYPE "documents"."owning_module_enum";--> statement-breakpoint
DROP TYPE "documents"."panlalawigan_outcome_enum";--> statement-breakpoint
DROP TYPE "documents"."phase_enum";--> statement-breakpoint
DROP TYPE "documents"."public_visibility_rule_enum";--> statement-breakpoint
DROP TYPE "documents"."scan_quality_category_enum";--> statement-breakpoint
DROP TYPE "documents"."series_type_enum";--> statement-breakpoint
DROP TYPE "documents"."signature_type_enum";--> statement-breakpoint
DROP TYPE "documents"."sponsorship_type_enum";