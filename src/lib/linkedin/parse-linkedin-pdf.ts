import type {
  ParsedLinkedInProfile,
  LinkedInExperience,
  LinkedInEducation,
  LinkedInCertification,
  LinkedInLanguage,
  LinkedInContact,
  LinkedInHeader,
} from "./types";

// Month name → zero-padded number (English + Swedish)
const MONTHS: Record<string, string> = {
  january: "01", jan: "01",
  february: "02", feb: "02",
  march: "03", mar: "03",
  april: "04", apr: "04",
  may: "05", maj: "05",
  june: "06", jun: "06",
  july: "07", jul: "07",
  august: "08", aug: "08",
  september: "09", sep: "09",
  october: "10", oct: "10",
  november: "11", nov: "11",
  december: "12", dec: "12",
  // Swedish full names
  januari: "01",
  februari: "02",
  mars: "03",
  juni: "06",
  juli: "07",
  augusti: "08",
  oktober: "10",
};

const SECTION_HEADERS = new Set([
  // English
  "Experience",
  "Education",
  "Skills",
  "About",
  "Summary",
  "Licenses & Certifications",
  "Certifications",
  "Languages",
  "Honors & Awards",
  "Volunteer Experience",
  "Volunteer",
  "Publications",
  "Projects",
  "Courses",
  "Recommendations",
  "Contact",
  "Top Skills",
  "Interests",
  "Achievements",
  "Patents",
  "Test Scores",
  "Organizations",
  // Swedish
  "Erfarenhet",
  "Utbildning",
  "Kompetenser",
  "Om",
  "Språk",
  "Licenser och certifieringar",
  "Utmärkelser och priser",
  "Kontakt",
  "Volontärarbete",
  "Intressen",
]);

const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Self-employed",
  "Freelance",
  "Internship",
  "Apprenticeship",
  "Seasonal",
  // Swedish
  "Heltid",
  "Deltid",
  "Konsult",
  "Egenföretagare",
];

/**
 * Detect whether the extracted PDF text is a LinkedIn profile export.
 */
export function isLinkedInPdf(text: string): boolean {
  const hasLinkedInUrl = text.includes("linkedin.com/in/");

  // Count how many known section headers appear as standalone lines
  const sectionCount = [
    "Experience", "Education", "Skills", "About",
    "Licenses & Certifications",
    "Erfarenhet", "Utbildning", "Kompetenser", "Om",
  ].filter((s) => new RegExp(`^${s}$`, "m").test(text)).length;

  return hasLinkedInUrl || sectionCount >= 3;
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

function parseMonthYear(raw: string): string | null {
  const str = raw.trim().toLowerCase().replace(/\.$/, "");

  // "jan 2023" or "january 2023"
  const monthYear = str.match(/^(\w+)\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1]];
    if (month) return `${monthYear[2]}-${month}`;
  }

  // "2023"
  if (/^\d{4}$/.test(str)) return str;

  return null;
}

function parseDateRange(line: string): {
  startDate: string;
  endDate: string | null;
  current: boolean;
} {
  // Strip duration suffix: "Jan 2023 - Present · 2 yrs 3 mos" → "Jan 2023 - Present"
  const withoutDuration = line.split("·")[0].trim();

  const current = /\b(present|nu|i dag)\b/i.test(withoutDuration);

  // Split on " - " or " – "
  const dashMatch = withoutDuration.match(/^(.+?)\s[-–]\s(.+)$/);
  if (!dashMatch) {
    const single = parseMonthYear(withoutDuration);
    return { startDate: single ?? withoutDuration, endDate: null, current: false };
  }

  const startDate = parseMonthYear(dashMatch[1].trim()) ?? dashMatch[1].trim();
  const endDate = current
    ? null
    : parseMonthYear(dashMatch[2].trim()) ?? dashMatch[2].trim();

  return { startDate, endDate, current };
}

function isDateRangeLine(line: string): boolean {
  if (!line || !/\b\d{4}\b/.test(line)) return false;

  // Must contain a dash/en-dash separator
  if (!/ [-–] /.test(line)) return false;

  // Right side must have a year or "Present / Nu / i dag"
  const dashIdx = line.search(/ [-–] /);
  const rightSide = line.slice(dashIdx + 3).split("·")[0].trim();
  return /\b\d{4}\b|\b(present|nu|i dag)\b/i.test(rightSide);
}

// ---------------------------------------------------------------------------
// Section splitting
// ---------------------------------------------------------------------------

interface SectionMap {
  header: string[];
  about: string[];
  experience: string[];
  education: string[];
  skills: string[];
  certifications: string[];
  languages: string[];
  [key: string]: string[];
}

function splitIntoSections(text: string): SectionMap {
  const map: SectionMap = {
    header: [],
    about: [],
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };

  const lines = text.split("\n").map((l) => l.trim());
  let currentKey = "header";

  for (const line of lines) {
    if (!line) continue;

    if (SECTION_HEADERS.has(line)) {
      const lower = line.toLowerCase();
      if (lower === "experience" || lower === "erfarenhet") {
        currentKey = "experience";
      } else if (lower === "education" || lower === "utbildning") {
        currentKey = "education";
      } else if (lower === "skills" || lower === "kompetenser") {
        currentKey = "skills";
      } else if (lower === "about" || lower === "summary" || lower === "om") {
        currentKey = "about";
      } else if (
        lower.includes("certification") ||
        lower.includes("licens")
      ) {
        currentKey = "certifications";
      } else if (lower === "languages" || lower === "språk") {
        currentKey = "languages";
      } else if (lower === "top skills") {
        // Merge top skills into main skills section
        currentKey = "skills";
      } else {
        // Other sections (Interests, Volunteer, etc.) — collect in their own bucket
        const key = "other_" + lower.replace(/\s+/g, "_");
        if (!map[key]) map[key] = [];
        currentKey = key;
      }
      continue;
    }

    if (!map[currentKey]) map[currentKey] = [];
    map[currentKey].push(line);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

function parseHeader(lines: string[]): LinkedInHeader {
  // Filter out contact info lines that may appear at the top
  const nonContact = lines.filter(
    (l) =>
      !l.includes("@") &&
      !l.includes("linkedin.com") &&
      !/\+?[\d][\d\s().-]{8,}/.test(l)
  );
  return {
    name: nonContact[0] ?? lines[0] ?? "",
    headline: nonContact[1] ?? "",
    location: nonContact[2] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Contact parsing
// ---------------------------------------------------------------------------

function parseContact(text: string): LinkedInContact {
  const emailMatch = text.match(/\b[\w.+%-]+@[\w.-]+\.[a-z]{2,}\b/i);
  const linkedinMatch = text.match(/linkedin\.com\/in\/([\w%-]+)/i);
  // Phone: +prefix or 10+ digit sequence
  const phoneMatch = text.match(/(?:^|\s)(\+?[\d][\d\s().-]{9,})(?:\s|$)/m);

  return {
    email: emailMatch?.[0] ?? null,
    phone: phoneMatch?.[1]?.trim() ?? null,
    linkedinUrl: linkedinMatch
      ? `https://www.linkedin.com/in/${linkedinMatch[1]}`
      : null,
  };
}

// ---------------------------------------------------------------------------
// Experience parsing
// ---------------------------------------------------------------------------

function isLikelyLocation(line: string): boolean {
  if (!line || line.length > 80) return false;
  if (/^[-•·*]/.test(line)) return false;

  const lower = line.toLowerCase();
  const descStarters = [
    "led", "built", "developed", "managed", "created", "improved",
    "worked", "responsible", "helped", "designed", "implemented",
    "launched", "collaborated", "spearheaded", "oversaw", "coordinated",
    "delivered", "drove", "established", "executed", "facilitated",
    "maintained", "partnered", "provided", "supported",
  ];
  const firstWord = lower.split(/\s+/)[0];
  if (descStarters.includes(firstWord)) return false;

  // Remote/hybrid keywords are definitely location-like
  if (/\b(remote|hybrid|onsite|on-site)\b/i.test(line)) return true;
  // Cities often have commas (e.g. "London, UK")
  if (line.includes(",")) return true;
  // Short phrase with no digits (numbers are rare in city names)
  if (line.split(/\s+/).length <= 4 && !/\d/.test(line)) return true;

  return false;
}

function parseExperienceSection(lines: string[]): LinkedInExperience[] {
  if (lines.length === 0) return [];

  // Find all indices where a date range line appears
  const dateIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isDateRangeLine(lines[i])) dateIdxs.push(i);
  }

  if (dateIdxs.length === 0) return [];

  const experiences: LinkedInExperience[] = [];

  for (let di = 0; di < dateIdxs.length; di++) {
    const dateIdx = dateIdxs[di];
    // Next job's date range is at dateIdxs[di+1].
    // Before it: title at [dateIdxs[di+1] - 1], company at [dateIdxs[di+1] - 2]
    const nextDateIdx = dateIdxs[di + 1] ?? lines.length + 2;

    // Title: line immediately before the date range
    let title = dateIdx >= 1 ? lines[dateIdx - 1] : "";
    let employmentType: string | null = null;

    // Extract employment type from title line (e.g. "Engineer · Full-time")
    for (const et of EMPLOYMENT_TYPES) {
      if (title.includes(`· ${et}`) || title.endsWith(et)) {
        title = title
          .replace(`· ${et}`, "")
          .replace(et, "")
          .trim()
          .replace(/·$/, "")
          .trim();
        employmentType = et;
        break;
      }
    }

    // Company: 2 lines before the date range
    const company = dateIdx >= 2 ? lines[dateIdx - 2] : "";

    // Date range
    const dateRange = parseDateRange(lines[dateIdx]);

    // Location: first line after date range (if it looks like a place)
    let location = "";
    let descStart = dateIdx + 1;

    if (dateIdx + 1 < lines.length && !isDateRangeLine(lines[dateIdx + 1])) {
      const candidate = lines[dateIdx + 1];
      if (isLikelyLocation(candidate)) {
        location = candidate;
        descStart = dateIdx + 2;
      }
    }

    // Description: from descStart to before the next entry's company line
    // Next entry: company at nextDateIdx - 2, title at nextDateIdx - 1
    const descEnd = nextDateIdx - 2;
    const descLines = lines.slice(descStart, Math.max(descStart, descEnd));

    if (company || title) {
      experiences.push({
        company: company.trim(),
        title: title.trim(),
        employmentType,
        ...dateRange,
        location: location.trim(),
        description: descLines.filter(Boolean).join("\n"),
      });
    }
  }

  return experiences;
}

// ---------------------------------------------------------------------------
// Education parsing
// ---------------------------------------------------------------------------

function parseDegreeField(raw: string): { degree: string; field: string } {
  if (!raw) return { degree: "", field: "" };

  // "Bachelor of Science - BS, Computer Science"
  // "Master of Science, Computer Science"
  // "Bachelor's degree, Economics"
  const commaIdx = raw.indexOf(", ");
  if (commaIdx > 0) {
    const degreeRaw = raw.slice(0, commaIdx).replace(/\s*-\s*\w+$/, "").trim();
    const field = raw.slice(commaIdx + 2);
    return { degree: degreeRaw, field };
  }

  return { degree: raw, field: "" };
}

function parseEducationSection(lines: string[]): LinkedInEducation[] {
  if (lines.length === 0) return [];

  const dateIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isDateRangeLine(lines[i])) dateIdxs.push(i);
  }

  // No dates found — try to parse as institution + degree pairs
  if (dateIdxs.length === 0) {
    const educations: LinkedInEducation[] = [];
    let i = 0;
    while (i < lines.length - 1) {
      const institution = lines[i];
      const degreeRaw = lines[i + 1];
      if (institution && degreeRaw && !SECTION_HEADERS.has(institution)) {
        const { degree, field } = parseDegreeField(degreeRaw);
        educations.push({
          institution,
          degree,
          field,
          startDate: "",
          endDate: null,
          description: "",
        });
        i += 2;
      } else {
        i++;
      }
    }
    return educations;
  }

  const educations: LinkedInEducation[] = [];

  for (let di = 0; di < dateIdxs.length; di++) {
    const dateIdx = dateIdxs[di];
    const nextDateIdx = dateIdxs[di + 1] ?? lines.length + 2;

    const degreeFieldRaw = dateIdx >= 1 ? lines[dateIdx - 1] : "";
    const institution = dateIdx >= 2 ? lines[dateIdx - 2] : "";

    const { degree, field } = parseDegreeField(degreeFieldRaw);
    const dateRange = parseDateRange(lines[dateIdx]);

    const descEnd = nextDateIdx - 2;
    const descLines = lines.slice(dateIdx + 1, Math.max(dateIdx + 1, descEnd));

    educations.push({
      institution: institution.trim(),
      degree: degree.trim(),
      field: field.trim(),
      ...dateRange,
      description: descLines.filter(Boolean).join("\n"),
    });
  }

  return educations;
}

// ---------------------------------------------------------------------------
// Skills parsing
// ---------------------------------------------------------------------------

function parseSkillsSection(lines: string[]): string[] {
  return lines
    .map((l) => l.replace(/\s*\(\d+\)\s*$/, "").trim()) // strip endorsement counts
    .filter((l) => l.length > 0 && l.length < 100 && !SECTION_HEADERS.has(l));
}

// ---------------------------------------------------------------------------
// Certifications parsing
// ---------------------------------------------------------------------------

function parseCertificationsSection(lines: string[]): LinkedInCertification[] {
  const certs: LinkedInCertification[] = [];
  let i = 0;

  while (i < lines.length) {
    const name = lines[i];
    if (!name || SECTION_HEADERS.has(name)) {
      i++;
      continue;
    }

    let issuer = "";
    let date = "";

    if (i + 1 < lines.length) {
      const issuerLine = lines[i + 1];

      // "Amazon Web Services · Issued Jan 2023" or "Amazon Web Services · Jan 2023"
      const middotMatch = issuerLine.match(/^(.+?)\s*[·•]\s*(?:Issued\s+)?(.+)$/i);
      if (middotMatch) {
        issuer = middotMatch[1].trim();
        date = parseMonthYear(middotMatch[2].split(/[·•,]/)[0].trim()) ?? "";
        i += 2;
      } else {
        issuer = issuerLine.trim();
        i += 2;

        // Check if next line has issued date
        if (i < lines.length) {
          const dateLine = lines[i];
          const issuedMatch = dateLine.match(/issued\s+(.+)/i);
          if (issuedMatch) {
            date = parseMonthYear(issuedMatch[1].split(/[·•,]/)[0].trim()) ?? "";
            i++;
          }
        }
      }
    } else {
      i++;
    }

    if (name.trim()) {
      certs.push({ name: name.trim(), issuer: issuer.trim(), date });
    }
  }

  return certs;
}

// ---------------------------------------------------------------------------
// Languages parsing
// ---------------------------------------------------------------------------

function mapLinkedInProficiency(raw: string): string {
  const lower = raw.toLowerCase();
  if (/native|modersmål|infödda/.test(lower)) return "native";
  if (/fluent|flytande|full professional|professional working/.test(lower))
    return "fluent";
  if (/advanced|avancerad/.test(lower)) return "advanced";
  if (/intermediate|mellannivå/.test(lower)) return "intermediate";
  return "basic";
}

function parseLanguagesSection(lines: string[]): LinkedInLanguage[] {
  return lines
    .map((line): LinkedInLanguage | null => {
      if (!line.trim()) return null;

      // "Swedish (Native or Bilingual)"
      const parenMatch = line.match(/^(.+?)\s*\((.+)\)$/);
      if (parenMatch) {
        return {
          language: parenMatch[1].trim(),
          proficiency: mapLinkedInProficiency(parenMatch[2]),
        };
      }

      // "Swedish · Native"
      const dotMatch = line.match(/^(.+?)\s*[·•]\s*(.+)$/);
      if (dotMatch) {
        return {
          language: dotMatch[1].trim(),
          proficiency: mapLinkedInProficiency(dotMatch[2]),
        };
      }

      return { language: line.trim(), proficiency: "intermediate" };
    })
    .filter((l): l is LinkedInLanguage => l !== null && l.language.length > 0);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function parseLinkedInPdf(text: string): ParsedLinkedInProfile {
  const sections = splitIntoSections(text);

  const header: LinkedInHeader = parseHeader(sections.header);
  const contact: LinkedInContact = parseContact(text);
  const summary = sections.about.join(" ").trim();
  const experience: LinkedInExperience[] = parseExperienceSection(
    sections.experience
  );
  const education: LinkedInEducation[] = parseEducationSection(
    sections.education
  );
  const skills: string[] = parseSkillsSection(sections.skills);
  const certifications: LinkedInCertification[] = parseCertificationsSection(
    sections.certifications
  );
  const languages: LinkedInLanguage[] = parseLanguagesSection(
    sections.languages
  );

  return {
    header,
    contact,
    summary,
    experience,
    education,
    skills,
    certifications,
    languages,
  };
}
