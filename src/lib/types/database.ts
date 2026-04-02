export type ApplicationStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type EventType =
  | "status_change"
  | "email_received"
  | "email_sent"
  | "note"
  | "interview_scheduled"
  | "followup_reminder";

export type RemoteType = "remote" | "hybrid" | "onsite" | null;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  company: string;
  role: string;
  url: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  job_description: string | null;
  cover_letter: string | null;
  salary_range: string | null;
  location: string | null;
  remote_type: RemoteType;
  contact_name: string | null;
  contact_email: string | null;
  next_followup_at: string | null;
  job_listing_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationEvent {
  id: string;
  application_id: string;
  event_type: EventType;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ApplicationWithEvents extends Application {
  application_events: ApplicationEvent[];
}

export interface ApplicationStats {
  total: number;
  thisWeek: number;
  byStatus: Record<ApplicationStatus, number>;
  responseRate: number | null;
}

export type CreateApplicationData = Pick<
  Application,
  | "company"
  | "role"
  | "url"
  | "status"
  | "location"
  | "remote_type"
  | "salary_range"
  | "contact_name"
  | "contact_email"
  | "notes"
  | "job_description"
>;

export type UpdateApplicationData = Partial<CreateApplicationData> & {
  applied_at?: string | null;
  cover_letter?: string | null;
  next_followup_at?: string | null;
};

// Email types
export type EmailClassification =
  | "rejection"
  | "interview_invite"
  | "followup"
  | "offer"
  | "general"
  | "unclassified"
  | "job_alert";

export type EmailDirection = "inbound" | "outbound";

export interface GmailConnection {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  last_synced_at: string | null;
  sync_cursor: string | null;
  created_at: string;
}

export interface Email {
  id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  application_id: string | null;
  job_listing_id: string | null;
  from_address: string;
  to_address: string;
  subject: string;
  body_preview: string | null;
  body_html: string | null;
  body_text: string | null;  // Full plain text body (not truncated)
  received_at: string;
  direction: EmailDirection;
  classification: EmailClassification | null;
  is_read: boolean;
  created_at: string;
}

export interface EmailWithApplication extends Email {
  applications: Pick<Application, "id" | "company" | "role" | "status"> | null;
}

// Resume types
export type ResumeTemplate = "clean" | "modern" | "compact" | "swedish";

export interface SummarySectionContent {
  text: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string | null;
  bullets: string[];
}

export interface ExperienceSectionContent {
  items: ExperienceItem[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string | null;
  gpa?: string;
  notes?: string;
}

export interface EducationSectionContent {
  items: EducationItem[];
}

export interface SkillCategory {
  id: string;
  name: string;
  skills: string[];
}

export interface SkillsSectionContent {
  categories: SkillCategory[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url?: string;
}

export interface CertificationsSectionContent {
  items: CertificationItem[];
}

export type LanguageProficiency =
  | "native"
  | "fluent"
  | "advanced"
  | "intermediate"
  | "basic";

export interface LanguageItem {
  id: string;
  language: string;
  proficiency: LanguageProficiency;
}

export interface LanguagesSectionContent {
  items: LanguageItem[];
}

export interface CustomSectionContent {
  text: string;
}

export interface ReferenceItem {
  id: string;
  name: string;
  title: string;
  company: string;
  phone?: string;
  email?: string;
  relationship?: string;
}

export interface ReferencesSectionContent {
  showOnRequest: boolean;
  items: ReferenceItem[];
}

export interface PhotoSectionContent {
  url: string | null;
}

export type ResumeSectionType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "languages"
  | "custom"
  | "references"
  | "photo";

export type ResumeSectionContent =
  | SummarySectionContent
  | ExperienceSectionContent
  | EducationSectionContent
  | SkillsSectionContent
  | CertificationsSectionContent
  | LanguagesSectionContent
  | CustomSectionContent
  | ReferencesSectionContent
  | PhotoSectionContent;

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  visible: boolean;
  order: number;
  content: ResumeSectionContent;
}

export interface ResumeContent {
  template: ResumeTemplate;
  sections: ResumeSection[];
}

export interface Resume {
  id: string;
  user_id: string;
  name: string;
  content: ResumeContent;
  is_base: boolean;
  tailored_for_application_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeWithApplication extends Resume {
  applications: Pick<Application, "id" | "company" | "role"> | null;
}

export interface UserProfileData {
  id: string;
  user_id: string;
  work_history: ExperienceItem[];
  education: EducationItem[];
  skills: SkillCategory[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  summary: string | null;
  // Contact details (added in migration 004 for browser extension autofill)
  phone: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  github_url: string | null;
  // Cover letter text (added in migration 015 for ReachMee extension autofill)
  cover_letter: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateResumeData = Pick<Resume, "name" | "content" | "is_base"> & {
  tailored_for_application_id?: string | null;
};

export type UpdateResumeData = Partial<
  Pick<Resume, "name" | "content" | "is_base" | "tailored_for_application_id">
>;

export type AnswerCategory =
  | "behavioral"
  | "technical"
  | "motivational"
  | "situational"
  | "salary"
  | "availability"
  | "why_us"
  | "why_role"
  | "other";

export type AnswerRating = "strong" | "good" | "needs_work" | "untested";

export type AnswerTone = "formal" | "conversational" | "concise" | "detailed" | "neutral";

export interface ScreeningAnswer {
  id: string;
  user_id: string;
  application_id: string | null;
  question: string;
  answer: string;
  status: "draft" | "approved";
  tags: string[];
  canonical_question_id: string | null;
  rating: AnswerRating;
  tone: AnswerTone;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export type CreateScreeningAnswerData = Pick<
  ScreeningAnswer,
  "question" | "answer" | "status" | "tags"
> & { application_id?: string | null };

export interface CanonicalQuestion {
  id: string;
  user_id: string;
  canonical_text: string;
  category: AnswerCategory;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CanonicalQuestionWithAnswers extends CanonicalQuestion {
  screening_answers: ScreeningAnswer[];
}

export interface LibraryOverview {
  totalQuestions: number;
  totalAnswers: number;
  byCategory: Record<string, number>;
  strongAnswers: number;
  needsWorkAnswers: number;
}

// Job Discovery types

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  query: string;
  location: string | null;
  remote_only: boolean;
  salary_min: number | null;
  country: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateSavedSearchData = Pick<
  SavedSearch,
  'name' | 'query' | 'location' | 'remote_only' | 'salary_min' | 'country' | 'is_active'
>;

export interface JobListing {
  id: string;
  user_id: string;
  saved_search_id: string | null;
  external_id: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  remote_type: 'remote' | 'hybrid' | 'onsite' | 'unknown' | null;
  posted_at: string | null;
  match_score: number;
  is_saved: boolean;
  created_at: string;
  // JobTechDev-enriched fields
  ats_type: string | null;
  apply_url: string | null;
  occupation: string | null;
  occupation_field: string | null;
  employment_type: string | null;
  deadline: string | null;
  required_skills: string[] | null;
  number_of_vacancies: number | null;
  // Phase D1a: Dedup + application tracking fields
  company_normalized: string | null;
  title_normalized: string | null;
  dedup_fingerprint: string | null;
  all_sources: string[];
  all_urls: string[];
  has_applied: boolean;
  applied_at: string | null;
  application_id: string | null;
  // Phase E2: AI scoring
  match_reason: string | null;
  ai_scored_at: string | null;
  // Phase JL1a: Job Leads Pipeline
  lead_status: 'pending' | 'approved' | 'rejected' | null;
  source_email_id: string | null;
  auto_approved: boolean;
  // Phase JL3: Auto-approve reason
  auto_approve_reason: string | null;
}

export type LeadStatus = 'pending' | 'approved' | 'rejected';

export interface JobEmailSource {
  id: string;
  user_id: string;
  sender_email: string;
  sender_domain: string;
  display_name: string | null;
  subject_pattern: string | null;
  is_auto_extract: boolean;
  is_trusted: boolean;
  total_extracted: number;
  total_approved: number;
  total_rejected: number;
  created_at: string;
  updated_at: string;
}

export interface JobListingSource {
  id: string;
  job_listing_id: string;
  user_id: string;
  source: string;
  external_id: string | null;
  source_url: string | null;
  raw_data: Record<string, unknown>;
  seen_at: string;
}

// Used for live search results (not persisted — returned from Adzuna API)
export interface AdzunaJobResult {
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  remote_type: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  posted_at: string | null;
  match_score: number; // computed server-side before returning
  alreadyApplied?: boolean; // set by batch fingerprint check in search API
}

// Browser Extension types (Phase 6)

// Flat profile object returned by /api/extension/profile
// Contains all the fields the extension needs for autofill
export interface ExtensionProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  first_name: string | null;  // derived: first word of full_name
  last_name: string | null;   // derived: remaining words of full_name
  phone: string | null;
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  github_url: string | null;
  current_title: string | null;   // derived: title from most recent work_history entry
  current_company: string | null; // derived: company from most recent work_history entry
  summary: string | null;
  cover_letter: string | null;    // for ReachMee prof_personalmotivation autofill
}

export interface FormFieldMapping {
  id: string;
  user_id: string;
  ats_type: 'workday' | 'greenhouse' | 'lever' | 'varbi' | 'teamtailor' | 'jobylon' | 'reachmee';
  field_identifier: string;
  profile_key: string;
  is_user_corrected: boolean;
  correction_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export type UpsertFormFieldMapping = Pick<
  FormFieldMapping,
  'ats_type' | 'field_identifier' | 'profile_key' | 'is_user_corrected'
>;

// Market settings (Phase S4)

export interface UserMarketSetting {
  id: string;
  user_id: string;
  market_code: string;
  is_primary: boolean;
  language_preference: string;
  job_search_radius_km: number;
  salary_currency: string;
  resume_format: string;
  created_at: string;
  updated_at: string;
}

export interface MarketPreferences {
  language_preference: string;
  job_search_radius_km: number;
  salary_currency: string;
  resume_format: string;
}

// ─── Application Studio Types ────────────────────────────────────────────

export type PackageStatus =
  | 'analyzing'
  | 'checkpoint_1'
  | 'matching'
  | 'checkpoint_2'
  | 'generating'
  | 'checkpoint_3'
  | 'completed'
  | 'abandoned';

export interface JobRequirement {
  text: string;
  category: 'must_have' | 'nice_to_have' | 'inferred';
  priority: number; // 1-5
}

export interface ExtractedKeyword {
  keyword: string;
  frequency: number;
  category: 'skill' | 'tool' | 'trait' | 'domain';
}

export interface CultureSignal {
  signal: string;
  evidence: string;
}

export interface JobAnalysis {
  requirements: JobRequirement[];
  keywords: ExtractedKeyword[];
  role_level: 'junior' | 'mid' | 'senior' | 'lead' | 'director' | 'executive';
  role_family: string;
  employment_type: string;
  detected_language: 'en' | 'sv' | 'no' | 'de';
  culture_signals: CultureSignal[];
  ats_type: string | null;
}

export interface CompanyResearch {
  company_name: string;
  industry: string;
  company_size: 'startup' | 'scaleup' | 'mid_market' | 'enterprise' | 'unknown';
  growth_stage: string;
  culture_notes: string;
  values: string[];
  recent_news: string | null;
  why_interesting: string;
}

export interface Checkpoint1Edits {
  edited_requirements?: JobRequirement[];
  priority_overrides?: Record<number, number>;
  added_keywords?: string[];
  notes?: string;
}

export interface AiUsageStep {
  step: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  cost_estimate: number;
}

export interface AiUsage {
  steps: AiUsageStep[];
  total_cost_estimate: number;
}

export interface ApplicationPackage {
  id: string;
  user_id: string;
  job_listing_id: string | null;
  application_id: string | null;
  status: PackageStatus;
  job_analysis: JobAnalysis | null;
  company_research: CompanyResearch | null;
  checkpoint_1_edits: Checkpoint1Edits | null;
  evidence_mapping: unknown | null;  // defined in AS2
  strategy: unknown | null;          // defined in AS2
  checkpoint_2_edits: unknown | null;
  generated_resume: ResumeContent | null;
  resume_id: string | null;
  generated_cover_letter: unknown | null; // defined in AS3
  screening_questions: unknown | null;
  quality_review: unknown | null;
  checkpoint_3_edits: unknown | null;
  ai_usage: AiUsage;
  created_at: string;
  updated_at: string;
}

// LinkedIn connection (OAuth tokens for Share API)
export interface LinkedInConnection {
  id: string;
  user_id: string;
  linkedin_id: string;
  email: string | null;
  name: string | null;
  profile_url: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
}
