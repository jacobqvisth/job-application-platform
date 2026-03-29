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
  | "unclassified";

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
  from_address: string;
  to_address: string;
  subject: string;
  body_preview: string | null;
  body_html: string | null;
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
export type ResumeTemplate = "clean" | "modern" | "compact";

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

export type ResumeSectionType =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "certifications"
  | "languages"
  | "custom";

export type ResumeSectionContent =
  | SummarySectionContent
  | ExperienceSectionContent
  | EducationSectionContent
  | SkillsSectionContent
  | CertificationsSectionContent
  | LanguagesSectionContent
  | CustomSectionContent;

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
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  github_url: string | null;
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
  source: 'adzuna' | 'jobtechdev';
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
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  github_url: string | null;
  current_title: string | null;   // derived: title from most recent work_history entry
  current_company: string | null; // derived: company from most recent work_history entry
  summary: string | null;
}

export interface FormFieldMapping {
  id: string;
  user_id: string;
  ats_type: 'workday' | 'greenhouse' | 'lever';
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
