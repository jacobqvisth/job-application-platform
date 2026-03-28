export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remoteType?: 'remote' | 'hybrid' | 'onsite' | 'unknown' | null;
  salary?: string | null;
  matchScore: number;
  description: string;
  url: string;
  source: string;
  postedAt?: string | null;
}

export interface ApplicationSummary {
  id: string;
  company: string;
  role: string;
  status: string;
  updatedAt: string;
  daysSinceUpdate: number;
  location?: string | null;
  remoteType?: string | null;
}

export interface ApplicationStatusCounts {
  saved: number;
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  rejected: number;
  withdrawn: number;
}

export interface ApplicationPackageData {
  company: string;
  role: string;
  matchScore: number;
  resumeChanges: string[];
  coverLetter: string;
  screeningAnswers: { question: string; answer: string; source?: string }[];
  jobSaved: boolean;
  applicationId?: string;
}

export interface ProfileCategory {
  name: string;
  count: number;
  completeness: number;
}

export interface ProfileSummaryData {
  summary: string;
  strengths: string[];
  categories: ProfileCategory[];
  totalKnowledgeItems: number;
  name?: string | null;
  currentTitle?: string | null;
}

export interface WeeklyStats {
  period: 'week' | 'month';
  appsSubmitted: number;
  responsesReceived: number;
  interviewInvitations: number;
  rejections: number;
  responseRate: number | null;
  activeApplications: number;
  staleApplications: number;
}

export interface CanonicalAnswer {
  id: string;
  question: string;
  answer: string;
  category: string;
  rating: string;
  tone: string;
  usageCount: number;
}

export interface SearchJobsResult {
  jobs: JobResult[];
  total: number;
  query: string;
}

export interface ApplicationStatusResult {
  applications: ApplicationSummary[];
  counts: ApplicationStatusCounts;
}

export interface WeeklyStatsResult {
  period: string;
  stats: WeeklyStats;
  insight?: string;
}

export interface SearchAnswerLibraryResult {
  answers: CanonicalAnswer[];
  total: number;
  query: string;
}
