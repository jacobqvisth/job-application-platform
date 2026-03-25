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
