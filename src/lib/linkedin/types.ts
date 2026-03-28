export interface LinkedInHeader {
  name: string;
  headline: string;
  location: string;
}

export interface LinkedInContact {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

export interface LinkedInExperience {
  company: string;
  title: string;
  employmentType: string | null;
  startDate: string;
  endDate: string | null;
  current: boolean;
  location: string;
  description: string;
}

export interface LinkedInEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string | null;
  description: string;
}

export interface LinkedInCertification {
  name: string;
  issuer: string;
  date: string;
}

export interface LinkedInLanguage {
  language: string;
  proficiency: string;
}

export interface ParsedLinkedInProfile {
  header: LinkedInHeader;
  contact: LinkedInContact;
  summary: string;
  experience: LinkedInExperience[];
  education: LinkedInEducation[];
  skills: string[];
  certifications: LinkedInCertification[];
  languages: LinkedInLanguage[];
}
